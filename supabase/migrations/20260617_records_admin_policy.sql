-- Permitir al admin borrar records personales de cualquier usuario
CREATE POLICY "records_admin_delete" ON public.records_personales
  FOR DELETE
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );
