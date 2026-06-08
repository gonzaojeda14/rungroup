-- Columna simétrica a asistencia_confirmada: permite al profe marcar
-- explícitamente que alguien NO vino, para rechazar automáticamente
-- su solicitud de Flama Points sin pasar por el análisis de IA.
alter table participaciones
  add column if not exists asistencia_no_vino boolean not null default false;
