-- Tabla alianzas: partners y beneficios admin-editables
CREATE TABLE IF NOT EXISTS public.alianzas (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre      text NOT NULL,
  categoria   text NOT NULL DEFAULT '',
  emoji       text NOT NULL DEFAULT '⭐',
  wp          text,
  ig          text,
  web         text,
  descuento   text,
  codigo      text,
  ubicacion   text[],        -- array: puede tener 1 o más sucursales
  activa      boolean NOT NULL DEFAULT true,
  orden       integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.alianzas ENABLE ROW LEVEL SECURITY;

-- Corredores: solo lectura de alianzas activas
CREATE POLICY "alianzas_select_activas"
  ON public.alianzas FOR SELECT
  USING (activa = true);

-- Admin: acceso completo
CREATE POLICY "alianzas_admin_all"
  ON public.alianzas FOR ALL
  USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');

-- Seed: migrar las alianzas actuales hardcodeadas
INSERT INTO public.alianzas (nombre, categoria, emoji, wp, ig, web, descuento, codigo, ubicacion, orden) VALUES
  ('Eugenia Gancedo',           'Nutrición',             '🥗', '+5491164860148',  '@eg.nutriciondeportiva', null,                              null,                                      null,        null,                                                  1),
  ('Diego Dobler',              'Kinesiología',          '🦴', '+5491163081610',  null,                     null,                              null,                                      null,        null,                                                  2),
  ('NC Body Therapy',           'Masajes',               '💆', '+5491166874129',  '@nc.bodytherapy',        null,                              '10% en masajes y reflexología',           null,        null,                                                  3),
  ('Fuel Store Arg',            'Suplementos',           '⚡', '+5491126816998',  '@fuelstorearg',          'https://www.fuelstorearg.com',    'Descuento en suplementos',                'FLAMA',     null,                                                  4),
  ('Pantro Indumentaria',       'Indumentaria',          '👕', '+5491125039851',  '@pantrotienda',          'https://www.pantrotienda.com.ar', '35% en efectivo',                         null,        ARRAY['Iberá 3168, Núñez'],                             5),
  ('A Nation',                  'Calzado',               '👟', null,              '@anacionoficial',        'https://www.anation.com.ar',      '15% en todos los productos',              'FLAMA',     null,                                                  6),
  ('Fitnesas',                  'Productos deportivos',  '🏋️', '+5491168599619',  '@fitnesas.ar',           'https://www.fitnesas.com.ar',     '10% en local y web',                      'FLAMA2025', ARRAY['Bulnes 2026, Palermo','Guillermo White 4335, Munro'], 7),
  ('Olmos Ortopedia',           'Plantillas deportivas', '🦶', '+5491126280043',  '@ortopediaolmos',        null,                              '15% a 25% en plantillas',                 null,        null,                                                  8),
  ('La Panera Rosa',            'Gastronomía',           '🥐', null,              null,                     null,                              '20% en todo el menú',                     null,        ARRAY['Arenales 511, Vicente López'],                   9),
  ('La Pianca',                 'Gastronomía',           '🍽', null,              null,                     null,                              '15% en todo el menú',                     null,        ARRAY['Tapiales 1136, Vicente López'],                  10),
  ('Brina Makeup Beauty Studio','Belleza',               '✨', '+5491168552470',  '@brinamakeup',           null,                              '10% en tratamientos faciales y corporales','FLAMA',     ARRAY['Gral. Juan Lavalle 1800, Vicente López'],        11)
;
