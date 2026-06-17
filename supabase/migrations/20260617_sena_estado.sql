-- Agregar estado 'senado' al CHECK constraint de pedidos
ALTER TABLE public.pedidos
  DROP CONSTRAINT IF EXISTS pedidos_estado_check;

ALTER TABLE public.pedidos
  ADD CONSTRAINT pedidos_estado_check
  CHECK (estado IN ('pendiente', 'confirmado', 'cancelado', 'entregado', 'senado'));

-- Permitir al comprador subir el 2do comprobante (saldo) cuando el pedido esta en senado
CREATE POLICY "pedidos_buyer_saldo" ON public.pedidos
  FOR UPDATE
  USING  (user_id = auth.uid() AND estado = 'senado')
  WITH CHECK (user_id = auth.uid() AND estado = 'senado');
