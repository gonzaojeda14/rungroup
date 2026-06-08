-- Guarda con qué tipo de participación se hizo el envío de Flama Points
-- ("Inscripto" o "Stand Flama"), para saber qué consigna de foto correspondía
-- y qué puntaje se otorgó (2 para Inscripto, 1 para Stand Flama).
alter table puntos_carreras
  add column if not exists tipo_participacion text;
