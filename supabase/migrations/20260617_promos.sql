-- Tabla de promociones por cantidad
create table public.promos (
  id         uuid primary key default gen_random_uuid(),
  nombre     text not null,
  activa     boolean not null default true,
  tramos     jsonb not null default '[]',
  created_at timestamptz not null default now()
);

alter table public.promos enable row level security;

create policy "promos_read" on public.promos
  for select using (true);

create policy "promos_admin" on public.promos
  for all using (
    (select role from public.profiles where id = auth.uid()) = 'admin'
  );

-- Relacionar productos con promos
alter table public.productos
  add column if not exists promo_id uuid references public.promos(id) on delete set null;
