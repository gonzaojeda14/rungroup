-- Cupo máximo para carreras, eventos y entrenamientos
-- Si es NULL = sin límite de cupo

ALTER TABLE public.carreras
  ADD COLUMN IF NOT EXISTS cupo_maximo integer;
