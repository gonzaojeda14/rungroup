-- Limpieza automática con pg_cron (requiere extensión habilitada en Supabase)
-- Habilitarla: Dashboard → Database → Extensions → pg_cron

-- 1. Borrar push_subscriptions no actualizadas en +6 meses (cada domingo a las 3am)
SELECT cron.schedule(
  'cleanup-push-subscriptions',
  '0 3 * * 0',
  $$
    DELETE FROM public.push_subscriptions
    WHERE updated_at < NOW() - INTERVAL '6 months';
  $$
);

-- 2. Borrar carritos abandonados sin actualizar en +30 días (diario a las 2am)
SELECT cron.schedule(
  'cleanup-carritos',
  '0 2 * * *',
  $$
    DELETE FROM public.carritos
    WHERE updated_at < NOW() - INTERVAL '30 days';
  $$
);
