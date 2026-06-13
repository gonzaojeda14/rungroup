-- Tienda: productos, pedidos (con carrito / items) y configuración global

create table if not exists public.productos (
  id              uuid primary key default gen_random_uuid(),
  nombre          text not null,
  descripcion     text,
  precio          numeric(10,2) not null,
  foto_url        text,
  foto_public_id  text,
  tipo_talle      text check (tipo_talle in ('ropa', 'zapatillas', 'unico')),
  talles_disponibles jsonb not null default '[]'::jsonb,  -- ["S","M","L","XL"]
  genero          text check (genero in ('Hombre', 'Mujer', 'Unisex')),
  disponible      boolean not null default true,
  created_at      timestamptz not null default now()
);

-- Un pedido = un checkout completo (puede tener varios productos/talles)
-- items: [{producto_id, nombre, talle, precio}]
create table if not exists public.pedidos (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references public.profiles(id) on delete cascade,
  items                 jsonb not null default '[]'::jsonb,
  total                 numeric(10,2) not null,
  comprobante_url       text,
  comprobante_public_id text,
  estado                text not null default 'pendiente'
                        check (estado in ('pendiente','confirmado','cancelado')),
  notas                 text,
  created_at            timestamptz not null default now()
);

-- Configuración global del shop (alias, CBU, visibilidad)
-- Una sola fila, id siempre = 1
create table if not exists public.tienda_config (
  id          int primary key default 1 check (id = 1),
  alias       text,
  cbu         text,
  activa      boolean not null default false,
  updated_at  timestamptz not null default now()
);

-- RLS
alter table public.productos       enable row level security;
alter table public.pedidos         enable row level security;
alter table public.tienda_config   enable row level security;

-- productos: todos pueden leer los disponibles; admin lee/escribe todo
create policy "productos_read" on public.productos
  for select using (
    disponible = true
    or (select role from public.profiles where id = auth.uid()) = 'admin'
  );

create policy "productos_admin" on public.productos
  for all using (
    (select role from public.profiles where id = auth.uid()) = 'admin'
  );

-- pedidos: cada usuario ve los suyos; admin ve todos
create policy "pedidos_own_select" on public.pedidos
  for select using (
    user_id = auth.uid()
    or (select role from public.profiles where id = auth.uid()) = 'admin'
  );

create policy "pedidos_insert" on public.pedidos
  for insert with check (user_id = auth.uid());

create policy "pedidos_admin_update" on public.pedidos
  for update using (
    (select role from public.profiles where id = auth.uid()) = 'admin'
  );

-- tienda_config: todos leen, solo admin escribe
create policy "tienda_config_read" on public.tienda_config
  for select using (true);

create policy "tienda_config_admin" on public.tienda_config
  for all using (
    (select role from public.profiles where id = auth.uid()) = 'admin'
  );
