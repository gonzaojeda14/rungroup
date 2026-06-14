-- Permite al comprador marcar su propio pedido como 'entregado'
-- solo cuando ya está en 'confirmado' (admin lo aprobó primero)
CREATE POLICY "pedidos_buyer_entregado" ON public.pedidos
  FOR UPDATE
  USING  (user_id = auth.uid() AND estado = 'confirmado')
  WITH CHECK (user_id = auth.uid() AND estado = 'entregado');
