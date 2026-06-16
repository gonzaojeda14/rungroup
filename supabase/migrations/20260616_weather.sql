-- Columnas para clima en carreras
ALTER TABLE public.carreras ADD COLUMN IF NOT EXISTS weather_data jsonb;
ALTER TABLE public.carreras ADD COLUMN IF NOT EXISTS weather_updated_at timestamptz;
