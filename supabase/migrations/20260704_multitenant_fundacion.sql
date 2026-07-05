-- =============================================
-- Fundación multi-tenant (ADITIVA) — Paso 1
-- =============================================
-- Crea la tabla de clubes, deja a Flama como club #1 (cortesía permanente) e
-- introduce el rol de super-admin (nivel plataforma).
--
-- IMPORTANTE: esta migración NO toca ninguna tabla existente ni cambia el
-- comportamiento actual de la app. El club_id en carreras/participaciones/etc.
-- es un paso POSTERIOR. Con esto, Flama sigue funcionando idéntico.
-- Idempotente: se puede correr más de una vez sin romper nada.
-- =============================================

-- 1. Tabla de clubes ---------------------------------------------------------
create table if not exists public.clubs (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,                 -- flama, harriers, ... → subdominio a futuro
  nombre      text not null,
  plan        text not null default 'free'
                check (plan in ('free', 'pro', 'premium')),
  es_cortesia boolean not null default false,       -- Flama = true (no se factura)
  estado      text not null default 'activo'
                check (estado in ('activo', 'suspendido', 'prueba')),
  created_at  timestamptz default now()
);

-- 2. Flama como club fundador (cortesía permanente, acceso equivalente a premium)
insert into public.clubs (slug, nombre, plan, es_cortesia, estado)
values ('flama', 'Flama', 'premium', true, 'activo')
on conflict (slug) do nothing;

-- 3. Flag de super-admin (nivel plataforma, NO atado a ningún club) ----------
alter table public.profiles
  add column if not exists is_platform_admin boolean not null default false;

-- 4. Marcar al dueño de la plataforma como super-admin
update public.profiles set is_platform_admin = true
where email = 'ojeda.gonza@hotmail.com';

-- 5. RLS de clubs ------------------------------------------------------------
alter table public.clubs enable row level security;

-- Lectura: cualquier usuario autenticado (por ahora hay un solo club y todos
-- pertenecen a Flama). Cuando se agregue membresía por club, se restringe.
drop policy if exists "Clubs: autenticados leen" on public.clubs;
create policy "Clubs: autenticados leen"
  on public.clubs for select
  using (auth.role() = 'authenticated');

-- Escritura (crear / editar / suspender clubes): solo super-admins
drop policy if exists "Clubs: super-admin escribe" on public.clubs;
create policy "Clubs: super-admin escribe"
  on public.clubs for all
  using (exists (select 1 from public.profiles where id = auth.uid() and is_platform_admin = true))
  with check (exists (select 1 from public.profiles where id = auth.uid() and is_platform_admin = true));

-- Verificación sugerida:
--   select id, slug, nombre, plan, es_cortesia, estado from public.clubs;
--   select email, is_platform_admin from public.profiles where is_platform_admin;
