-- Agregar columna fotos (array de URLs) a productos
-- Migra el foto_url existente al nuevo array

ALTER TABLE public.productos
  ADD COLUMN IF NOT EXISTS fotos jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Migrar foto_url existente al array fotos
UPDATE public.productos
  SET fotos = jsonb_build_array(foto_url)
  WHERE foto_url IS NOT NULL
    AND jsonb_array_length(fotos) = 0;
