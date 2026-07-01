-- =============================================
-- Cron jobs de las notificaciones (pg_cron + pg_net)
-- =============================================
--
-- Programa las edge functions de notificación que faltaban en cron.job.
-- Usa cron.schedule() con jobname como clave: si el job ya existe lo ACTUALIZA,
-- si no existe lo crea. Es idempotente — se puede correr varias veces sin duplicar.
--
-- Requisitos: extensiones pg_cron y pg_net habilitadas (ya lo están, las usan
-- los jobs actuales como notif-flamitas-auto).
--
-- ⚠️ IMPORTANTE — SECRETO:
--   Antes de ejecutar, reemplazá <SERVICE_ROLE_KEY> por la service_role key real
--   (Dashboard → Settings → API). NO commitees la key real en este archivo:
--   dejá el placeholder en el repo y pegá la key solo al correr el SQL en el editor.
--   (Es la misma key que ya usan los cron jobs actuales.)
-- =============================================

-- 1. Recordatorio de Flamitas sin reclamar — 15:00 UTC diario
select cron.schedule(
  'notif-flamitas-recordatorio',
  '0 15 * * *',
  $$
  select net.http_post(
    url := 'https://dsanxuaadoytmuqfpjda.supabase.co/functions/v1/notif-flamitas-recordatorio',
    headers := '{"Authorization": "Bearer <SERVICE_ROLE_KEY>", "Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);

-- 2. Aviso 1 día antes de la carrera — 09:00 UTC diario (igual que notif-7dias)
select cron.schedule(
  'notif-1dia',
  '0 9 * * *',
  $$
  select net.http_post(
    url := 'https://dsanxuaadoytmuqfpjda.supabase.co/functions/v1/notif-1dia',
    headers := '{"Authorization": "Bearer <SERVICE_ROLE_KEY>", "Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);

-- 3. Aviso de cumpleaños a los admins — 03:00 UTC = 00:00 hora Argentina
select cron.schedule(
  'notif-cumple',
  '0 3 * * *',
  $$
  select net.http_post(
    url := 'https://dsanxuaadoytmuqfpjda.supabase.co/functions/v1/notif-cumple',
    headers := '{"Authorization": "Bearer <SERVICE_ROLE_KEY>", "Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);

-- Para verificar: select jobname, schedule, active from cron.job order by jobname;
-- Para borrar uno: select cron.unschedule('notif-1dia');
