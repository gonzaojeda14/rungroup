-- La notificación debe navegar a la pantalla correcta al tocarla.
-- El SW leía notif_payload sin url (no existía la columna), por lo que
-- todas las notificaciones caían en /novedades.
ALTER TABLE public.notif_payload ADD COLUMN IF NOT EXISTS url text;
