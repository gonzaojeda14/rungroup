-- Soporte para seña (50%) en pedidos de la tienda
alter table pedidos
  add column if not exists es_sena boolean default false,
  add column if not exists monto_sena numeric,
  add column if not exists comprobante_url_2 text;
