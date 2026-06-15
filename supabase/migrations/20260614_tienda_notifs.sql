-- Columna para debounce de notificaciones de producto nuevo
ALTER TABLE public.tienda_config
  ADD COLUMN IF NOT EXISTS ultima_notif_producto timestamptz;

-- Habilitar Realtime para pedidos (para el panel admin y mis pedidos del comprador)
ALTER PUBLICATION supabase_realtime ADD TABLE public.pedidos;
