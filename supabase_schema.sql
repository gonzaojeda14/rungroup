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
