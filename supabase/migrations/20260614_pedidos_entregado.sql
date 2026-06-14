-- Agregar estado 'entregado' al flujo de pedidos
ALTER TABLE public.pedidos
  DROP CONSTRAINT IF EXISTS pedidos_estado_check;

ALTER TABLE public.pedidos
  ADD CONSTRAINT pedidos_estado_check
  CHECK (estado IN ('pendiente', 'confirmado', 'cancelado', 'entregado'));
