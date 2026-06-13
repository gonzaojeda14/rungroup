-- Carrito persistente por usuario (sincronizado entre dispositivos)
-- Una sola fila por usuario, con snapshot completo de los items

create table if not exists public.carritos (
  user_id    uuid primary key references public.profiles(id) on delete cascade,
  items      jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.carritos enable row level security;

-- Cada usuario solo accede a su propio carrito
create policy "carritos_own" on public.carritos
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid());
