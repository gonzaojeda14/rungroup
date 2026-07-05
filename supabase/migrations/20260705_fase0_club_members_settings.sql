-- =============================================
-- Fase 0 (resto) — club_members + club_settings + club_id
-- =============================================
-- Completa la fundación multi-tenant. TODO ADITIVO: tablas y columnas nuevas,
-- todo backfilleado a Flama. No cambia el comportamiento actual de la app
-- (nada lee club_id / club_members / club_settings todavía — eso es Fase 1).
-- Idempotente: se puede correr más de una vez.
--
-- Requiere haber corrido antes: 20260704_multitenant_fundacion.sql
-- Orden importante: las tablas se crean ANTES que las funciones helper, porque
-- las funciones referencian club_members y Postgres valida su cuerpo al crearlas.
-- =============================================

-- ─────────────────────────────────────────────
-- 1. club_members — membresía + rol POR club (reemplaza al role global)
-- ─────────────────────────────────────────────
create table if not exists public.club_members (
  club_id    uuid references public.clubs on delete cascade not null,
  user_id    uuid references auth.users on delete cascade not null,
  role       text not null default 'corredor'
               check (role in ('owner', 'admin', 'corredor')),
  estado     text not null default 'activo'
               check (estado in ('activo', 'invitado', 'baja')),
  created_at timestamptz default now(),
  primary key (club_id, user_id)
);

-- Backfill: todos los perfiles actuales son miembros de Flama.
-- Se mapea el role global actual (admin/corredor) al role por club.
insert into public.club_members (club_id, user_id, role, estado)
select (select id from public.clubs where slug = 'flama'),
       p.id,
       case when p.role = 'admin' then 'admin' else 'corredor' end,
       case when p.activo = false then 'baja' else 'activo' end
from public.profiles p
on conflict (club_id, user_id) do nothing;

-- ─────────────────────────────────────────────
-- 2. club_settings — configuración por club (branding, módulos, terminología…)
-- ─────────────────────────────────────────────
create table if not exists public.club_settings (
  club_id      uuid primary key references public.clubs on delete cascade,
  branding     jsonb not null default '{}',
  modulos      jsonb not null default '{}',
  terminologia jsonb not null default '{}',
  puntos       jsonb not null default '{}',
  ventanas     jsonb not null default '{}',
  locale       jsonb not null default '{}'
);

-- Override de Flama con su identidad actual (para que Fase 1 no cambie nada visible).
insert into public.club_settings (club_id, branding, terminologia, puntos, ventanas, locale, modulos)
select id,
  '{"nombre": "Flama", "accent": "#ff2d2d"}'::jsonb,
  '{"puntos_singular": "Flamita", "puntos_plural": "Flamitas", "estado_apoyo": "Stand Flama"}'::jsonb,
  '{"inscripto": 2, "stand_flama": 1, "bonus_perfil": 5}'::jsonb,
  '{"plazo_reclamo_dias": 7}'::jsonb,
  '{"timezone": "America/Argentina/Buenos_Aires"}'::jsonb,
  '{"carreras": true, "tiempos": true, "fotos": true, "puntos": true, "metas": true, "cumpleanos": true, "certificados": true, "tienda": true, "reventa": true, "alianzas": true, "clima": true}'::jsonb
from public.clubs where slug = 'flama'
on conflict (club_id) do nothing;

-- ─────────────────────────────────────────────
-- 3. Helpers de RLS (SECURITY DEFINER para evitar recursión de policies).
--    Se crean DESPUÉS de club_members porque referencian esa tabla.
-- ─────────────────────────────────────────────
create or replace function public.es_miembro_club(c uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.club_members
    where club_id = c and user_id = auth.uid() and estado = 'activo'
  );
$$;

create or replace function public.es_admin_club(c uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.club_members
    where club_id = c and user_id = auth.uid()
      and role in ('owner', 'admin') and estado = 'activo'
  );
$$;

-- ─────────────────────────────────────────────
-- 4. RLS de club_members
-- ─────────────────────────────────────────────
alter table public.club_members enable row level security;

drop policy if exists "club_members: propio" on public.club_members;
create policy "club_members: propio"
  on public.club_members for select
  using (user_id = auth.uid());

drop policy if exists "club_members: admin del club lee" on public.club_members;
create policy "club_members: admin del club lee"
  on public.club_members for select
  using (public.es_admin_club(club_id));

drop policy if exists "club_members: admin del club escribe" on public.club_members;
create policy "club_members: admin del club escribe"
  on public.club_members for all
  using (public.es_admin_club(club_id))
  with check (public.es_admin_club(club_id));

-- ─────────────────────────────────────────────
-- 5. RLS de club_settings
-- ─────────────────────────────────────────────
alter table public.club_settings enable row level security;

drop policy if exists "club_settings: miembros leen" on public.club_settings;
create policy "club_settings: miembros leen"
  on public.club_settings for select
  using (public.es_miembro_club(club_id));

drop policy if exists "club_settings: admin escribe" on public.club_settings;
create policy "club_settings: admin escribe"
  on public.club_settings for all
  using (public.es_admin_club(club_id))
  with check (public.es_admin_club(club_id));

-- ─────────────────────────────────────────────
-- 6. club_id (nullable) en las tablas de contenido + backfill a Flama
-- ─────────────────────────────────────────────
-- Recorre una lista curada de tablas de contenido. Para cada una que exista:
-- agrega club_id, backfillea a Flama, le pone default Flama (para que las filas
-- nuevas queden bien durante el período single-tenant) e indexa. Tablas de
-- plataforma/por-usuario (profiles, push_subscriptions, bug_reports) quedan afuera.
do $$
declare
  t text;
  flama uuid := (select id from public.clubs where slug = 'flama');
  tbls text[] := array[
    'carreras', 'participaciones', 'tiempos_carreras', 'records_personales',
    'fotos_carreras', 'foto_tags', 'puntos_carreras', 'metas_personales',
    'productos', 'pedidos', 'carritos', 'tienda_config', 'promos', 'alianzas',
    'ventas_inscripciones', 'novedades', 'carreras_sugeridas', 'planes'
  ];
begin
  foreach t in array tbls loop
    if exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = t
    ) then
      execute format('alter table public.%I add column if not exists club_id uuid references public.clubs', t);
      execute format('update public.%I set club_id = %L where club_id is null', t, flama);
      execute format('alter table public.%I alter column club_id set default %L::uuid', t, flama);
      execute format('create index if not exists %I on public.%I (club_id)', t || '_club_id_idx', t);
    end if;
  end loop;
end $$;

-- ─────────────────────────────────────────────
-- Verificación sugerida:
--   select role, count(*) from public.club_members group by role;
--   select * from public.club_settings;
--   select table_name from information_schema.columns
--     where column_name = 'club_id' and table_schema = 'public' order by table_name;
-- =============================================
