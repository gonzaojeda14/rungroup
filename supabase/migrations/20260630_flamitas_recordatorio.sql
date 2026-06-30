-- Recordatorio de Flamitas sin reclamar (se envía ~3 días post-carrera).
-- Esta columna evita reenviar el recordatorio para la misma carrera.
alter table carreras
  add column if not exists flamitas_recordatorio_enviada boolean not null default false;
