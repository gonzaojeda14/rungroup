-- =============================================
-- RunGroup — Schema para Supabase
-- Ejecutar en: Supabase > SQL Editor
-- =============================================

-- 1. Tabla de perfiles (extiende auth.users)
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  nombre text not null,
  email text,
  role text not null default 'corredor' check (role in ('admin', 'corredor')),
  created_at timestamptz default now()
);

-- 2. Tabla de carreras
create table public.carreras (
  id uuid default gen_random_uuid() primary key,
  nombre text not null,
  fecha date,
  distancia text,
  link text,
  codigo text,
  created_at timestamptz default now()
);

-- 3. Tabla de participaciones
create table public.participaciones (
  id uuid default gen_random_uuid() primary key,
  carrera_id uuid references public.carreras on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  estado text not null default 'Pendiente'
    check (estado in ('Inscripto', 'No voy', 'Tal vez', 'Lista de espera', 'Pendiente')),
  updated_at timestamptz default now(),
  unique(carrera_id, user_id)
);

-- =============================================
-- TRIGGER: crear perfil automáticamente al registrar usuario
-- =============================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, nombre, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nombre', split_part(new.email, '@', 1)),
    new.email,
    coalesce(new.raw_user_meta_data->>'role', 'corredor')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- =============================================
-- TRIGGER: crear participaciones cuando se agrega un corredor nuevo
-- (para todas las carreras existentes)
-- =============================================
create or replace function public.handle_new_profile()
returns trigger language plpgsql security definer as $$
begin
  insert into public.participaciones (carrera_id, user_id)
  select id, new.id from public.carreras
  on conflict do nothing;
  return new;
end;
$$;

create trigger on_profile_created
  after insert on public.profiles
  for each row execute procedure public.handle_new_profile();

-- =============================================
-- TRIGGER: crear participaciones cuando se agrega una carrera nueva
-- (para todos los corredores existentes)
-- =============================================
create or replace function public.handle_new_carrera()
returns trigger language plpgsql security definer as $$
begin
  insert into public.participaciones (carrera_id, user_id)
  select new.id, id from auth.users
  on conflict do nothing;
  return new;
end;
$$;

create trigger on_carrera_created
  after insert on public.carreras
  for each row execute procedure public.handle_new_carrera();

-- =============================================
-- RLS (Row Level Security)
-- =============================================
alter table public.profiles enable row level security;
alter table public.carreras enable row level security;
alter table public.participaciones enable row level security;

-- Profiles: cada usuario ve su propio perfil; admin ve todos
create policy "Profiles: usuario ve el propio"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Profiles: admin ve todos"
  on public.profiles for select
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

create policy "Profiles: admin inserta"
  on public.profiles for insert
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- Carreras: todos los usuarios autenticados pueden leer
create policy "Carreras: todos leen"
  on public.carreras for select
  using (auth.role() = 'authenticated');

create policy "Carreras: solo admin escribe"
  on public.carreras for insert
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

create policy "Carreras: solo admin borra"
  on public.carreras for delete
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- Participaciones: usuario ve las propias; admin ve todas
create policy "Participaciones: usuario ve las propias"
  on public.participaciones for select
  using (auth.uid() = user_id);

create policy "Participaciones: admin ve todas"
  on public.participaciones for select
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

create policy "Participaciones: usuario actualiza la propia"
  on public.participaciones for update
  using (auth.uid() = user_id);

create policy "Participaciones: admin actualiza cualquiera"
  on public.participaciones for update
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- =============================================
-- Crear el primer usuario admin (reemplazá los valores)
-- Esto se hace desde Supabase > Authentication > Users > Add user
-- Luego ejecutar:
-- update public.profiles set role = 'admin' where email = 'TU_EMAIL_AQUI';
-- =============================================

-- =============================================
-- MIGRACIÓN: Tipo de carrera, múltiples distancias y distancia elegida
-- Ejecutar en: Supabase > SQL Editor
-- =============================================

-- 1. Agregar tipo a carreras (Trail / Calle)
alter table public.carreras
  add column if not exists tipo text check (tipo in ('Trail', 'Calle'));

-- 2. Agregar distancias (array) a carreras
alter table public.carreras
  add column if not exists distancias text[] default '{}';

-- 3. Agregar lugar a carreras (si no existe)
alter table public.carreras
  add column if not exists lugar text;

-- 4. Agregar distancia_elegida a participaciones
alter table public.participaciones
  add column if not exists distancia_elegida text;

-- =============================================
-- MIGRACIÓN: Datos de perfil y certificado médico
-- =============================================

-- Nuevos campos en profiles
alter table public.profiles
  add column if not exists fecha_nacimiento date;
alter table public.profiles
  add column if not exists telefono text;
alter table public.profiles
  add column if not exists certificado_url text;
alter table public.profiles
  add column if not exists certificado_fecha date;

-- Política update para que cada usuario pueda actualizar su propio perfil
create policy "Profiles: usuario actualiza el propio"
  on public.profiles for update
  using (auth.uid() = id);

-- Storage: bucket certificados
-- Crear manualmente en Supabase > Storage > New bucket
-- Nombre: certificados | Public: NO (privado)
-- Luego ejecutar estas políticas:

-- insert (el corredor sube su propio certificado)
create policy "Certificados: usuario sube el propio"
  on storage.objects for insert
  with check (bucket_id = 'certificados' AND auth.uid()::text = (storage.foldername(name))[1]);

-- select (el corredor ve el suyo, admin ve todos)
create policy "Certificados: usuario ve el propio"
  on storage.objects for select
  using (bucket_id = 'certificados' AND auth.uid()::text = (storage.foldername(name))[1]);

create policy "Certificados: admin ve todos"
  on storage.objects for select
  using (bucket_id = 'certificados' AND exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  ));

-- update (reemplazar certificado)
create policy "Certificados: usuario actualiza el propio"
  on storage.objects for update
  using (bucket_id = 'certificados' AND auth.uid()::text = (storage.foldername(name))[1]);

-- =============================================
-- MIGRACIÓN: Foto de perfil (avatar)
-- =============================================

alter table public.profiles
  add column if not exists avatar_url text;

-- Storage: bucket "avatares" (público)
-- Crear en Supabase > Storage > New bucket
-- Nombre: avatares | Public: SÍ

create policy "Avatares: usuario sube el propio"
  on storage.objects for insert
  with check (bucket_id = 'avatares' AND auth.uid()::text = (storage.foldername(name))[1]);

create policy "Avatares: todos pueden ver"
  on storage.objects for select
  using (bucket_id = 'avatares');

create policy "Avatares: usuario actualiza el propio"
  on storage.objects for update
  using (bucket_id = 'avatares' AND auth.uid()::text = (storage.foldername(name))[1]);

-- =============================================
-- MIGRACIÓN: Sistema de cesión de inscripciones
-- =============================================

create table if not exists public.ventas_inscripciones (
  id uuid default gen_random_uuid() primary key,
  carrera_id uuid references public.carreras on delete cascade not null,
  vendedor_id uuid references auth.users on delete cascade not null,
  precio numeric,
  nota text,
  estado text not null default 'disponible'
    check (estado in ('disponible', 'ofertada', 'contactada', 'vendida', 'cancelada')),
  ofertado_a uuid references auth.users on delete set null,
  oferta_expira_at timestamptz,
  rechazados uuid[] default '{}',
  created_at timestamptz default now()
);

alter table public.ventas_inscripciones enable row level security;

-- Todos los autenticados pueden ver las activas
create policy "Ventas: todos leen"
  on public.ventas_inscripciones for select
  using (auth.role() = 'authenticated');

-- Solo el vendedor puede insertar
create policy "Ventas: vendedor inserta"
  on public.ventas_inscripciones for insert
  with check (auth.uid() = vendedor_id);

-- Vendedor o comprador ofertado pueden actualizar
create policy "Ventas: vendedor o comprador actualiza"
  on public.ventas_inscripciones for update
  using (auth.uid() = vendedor_id OR auth.uid() = ofertado_a);

-- 5. Política de update para carreras (admin)
create policy if not exists "Carreras: solo admin actualiza"
  on public.carreras for update
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));
