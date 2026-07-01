# RunGroup → Plataforma multi-tenant para clubes de running

> Documento de enfoque. No es una implementación, es la hoja de ruta para migrar de
> "app de un club" a "plataforma para muchos clubes" **sin tocar la experiencia actual de Flama**.
> Mercado inicial: Argentina (ARS). Cobro: fijo mensual por club. Flama: cortesía permanente (club fundador).

---

## 1. Principio rector: Flama es el tenant #1

La forma más segura de no romper Flama es no tratarlo como "el caso especial", sino como
**el primer club de la plataforma**. Todo lo que existe hoy en la base pasa a pertenecer a
un club llamado Flama, y a partir de ahí el sistema ya es multi-tenant aunque solo haya un club.

Esto funciona porque **hoy el 100% de los datos son de Flama**. El backfill es trivial:

```
club_id de todas las filas existentes = <id de Flama>
```

Mientras Flama sea el único club, la app se comporta exactamente igual que ahora.
Recién cuando aparezca un segundo club el aislamiento entra en juego.

---

## 2. Modelo de aislamiento: shared-schema + `club_id` + RLS

Hay tres formas clásicas de hacer multi-tenancy:

| Modelo | Aislamiento | Costo operativo | Encaje con Supabase |
|---|---|---|---|
| Base por cliente | Máximo | Altísimo (N proyectos) | Malo |
| Schema por cliente | Alto | Alto (migraciones × N) | Regular |
| **Schema compartido + `club_id`** | Bueno (vía RLS) | **Bajo** | **Excelente** |

**Recomendación: schema compartido con columna `club_id` en cada tabla y aislamiento por RLS.**
Es el modelo estándar para Supabase/Postgres, mantiene una sola migración, y RLS garantiza que
un club nunca vea datos de otro. Es reversible y no requiere reescribir la app: se agrega una columna,
no se mueven tablas.

El aislamiento fuerte lo da una policy RLS que compara el `club_id` de la fila contra los clubes
a los que pertenece el usuario logueado — no el frontend. Aunque el frontend tenga un bug, la base
no filtra datos cruzados.

---

## 3. Estructura de base de datos

### 3.1 Tablas nuevas (núcleo del multi-tenant)

**`clubs`** — un registro por club.

```sql
create table public.clubs (
  id            uuid primary key default gen_random_uuid(),
  slug          text unique not null,          -- flama, harriers, etc. → subdominio
  nombre        text not null,
  plan          text not null default 'free'   -- free | pro | premium
                  check (plan in ('free', 'pro', 'premium')),
  es_cortesia   boolean not null default false, -- Flama = true (no se factura)
  estado        text not null default 'activo'  -- activo | suspendido | prueba
                  check (estado in ('activo', 'suspendido', 'prueba')),
  created_at    timestamptz default now()
);
```

**`club_members`** — reemplaza el `role` global de `profiles`. Un usuario puede pertenecer a
varios clubes con distinto rol en cada uno.

```sql
create table public.club_members (
  club_id  uuid references public.clubs on delete cascade not null,
  user_id  uuid references auth.users on delete cascade not null,
  role     text not null default 'corredor'
             check (role in ('owner', 'admin', 'corredor')),
  estado   text not null default 'activo',  -- activo | invitado | baja
  created_at timestamptz default now(),
  primary key (club_id, user_id)
);
```

Hoy `profiles.role` es admin/corredor a nivel global. En multi-tenant el rol **es por club**:
alguien puede ser admin de su club y corredor invitado en otro. `profiles` queda solo para datos
de persona (nombre, avatar, fecha de nacimiento, certificado). La pertenencia y el rol viven en
`club_members`.

**`club_settings`** — la configuración por club (branding, módulos, reglas). Ver sección 4.

```sql
create table public.club_settings (
  club_id     uuid primary key references public.clubs on delete cascade,
  branding    jsonb not null default '{}',   -- logo, colores, nombre visible
  modulos     jsonb not null default '{}',   -- feature flags on/off
  terminologia jsonb not null default '{}',  -- "Flamitas", "Stand Flama", etc.
  puntos      jsonb not null default '{}',   -- reglas y valores del sistema de puntos
  ventanas    jsonb not null default '{}',   -- plazos de reclamo, timing de notifs
  locale      jsonb not null default '{}'    -- zona horaria, idioma, moneda
);
```

Usar `jsonb` (en vez de decenas de columnas) permite iterar la configuración sin migrar la base
cada vez que agregás una opción. Ideal justo para la etapa de pruebas macro que querés arrancar.

### 3.2 `club_id` en las tablas existentes

Se agrega `club_id uuid references public.clubs` a **todas** las tablas de datos de club:

```
carreras · participaciones · tiempos_carreras · records_personales
fotos_carreras · foto_tags · puntos_carreras · metas_personales
productos · pedidos · carritos · tienda_config · promos · alianzas
ventas_inscripciones · novedades · carreras_sugeridas · planes
```

No se les agrega a: `profiles` (la persona es global, puede estar en varios clubes),
`push_subscriptions` (por dispositivo/usuario), `bug_reports` y `emails_bloqueados`
(plataforma, no club).

Migración segura por tabla:

```sql
-- 1. columna nullable
alter table carreras add column club_id uuid references clubs;
-- 2. backfill: todo lo actual es de Flama
update carreras set club_id = '<flama_id>' where club_id is null;
-- 3. recién ahora, obligatoria + default
alter table carreras alter column club_id set not null;
-- 4. índice para las policies y los filtros
create index on carreras (club_id);
```

### 3.3 Patrón RLS

Una función helper y policies que la usan:

```sql
-- ¿el usuario logueado pertenece a este club?
create or replace function public.es_miembro(c uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from club_members
    where club_id = c and user_id = auth.uid() and estado = 'activo'
  );
$$;

-- ejemplo en carreras: solo ves las de tus clubes
create policy "Carreras: miembros del club leen"
  on carreras for select using (es_miembro(club_id));

-- escritura: solo admin/owner del club
create policy "Carreras: admin del club escribe"
  on carreras for all using (
    exists (select 1 from club_members
            where club_id = carreras.club_id and user_id = auth.uid()
              and role in ('owner','admin') and estado='activo')
  );
```

Las policies actuales que preguntan `role = 'admin'` (global) se reescriben para preguntar
`role in ('owner','admin')` **dentro del `club_id` de la fila**.

### 3.4 Los triggers que hay que desactivar (¡importante!)

Hoy existen tres triggers que asumen un solo club:

- `handle_new_profile` → al crear un corredor, le crea participaciones en **todas** las carreras.
- `handle_new_carrera` → al crear una carrera, le crea participaciones a **todos** los usuarios.
- `handle_new_user` → asigna rol global.

En multi-tenant esto es un problema doble: (a) cruzaría datos entre clubes, y (b) el producto
cartesiano usuarios × carreras explota. **Hay que eliminarlos o acotarlos al `club_id`.**
La recomendación es pasar a **creación lazy**: la participación se crea cuando el corredor
efectivamente marca asistencia (RSVP), no de antemano. Es más limpio, escala, y de paso elimina
miles de filas "Pendiente" vacías. Este cambio hay que probarlo bien porque toca la lógica de Flama,
pero es el punto más crítico de toda la migración.

---

## 4. Qué es configurable por club

Todo esto vive en `club_settings` (jsonb) y es lo que hace que la plataforma sea "de marca blanca":

**Branding** — nombre visible, logo, color de acento (hoy hardcodeado en rojo Flama), favicon,
imagen de portada.

**Terminología** — el sistema de puntos hoy se llama "Flamitas" y los estados "Stand Flama".
Eso pasa a ser texto configurable: un club puede llamarlos "Puntos", "Millas", "Kudos", lo que sea.

**Módulos on/off** — cada club prende o apaga funcionalidades: carreras/asistencia, carga de tiempos,
historial, fotos, certificados médicos, metas personales, tienda, cumpleaños, reventa de inscripciones,
sistema de puntos, alianzas/descuentos, clima. Esto es también la palanca de los planes comerciales
(sección 6).

**Reglas de puntos** — valores (hoy 2 por Inscripto, 1 por Stand Flama), plazo de reclamo (hoy 7 días),
si la validación de foto es manual o por IA, bonus por perfil completo.

**Ventanas y notificaciones** — timing de los recordatorios (la notif de 2hs, la de 3 días, 7 días antes,
1 día antes, cumpleaños, certificado vencido). Cada club podría querer otros plazos o desactivar algunos.

**Locale** — zona horaria (hoy asume Argentina UTC-3), idioma, moneda de la tienda.

**Roles y permisos** — quién puede cargar carreras, aprobar fotos, gestionar tienda.

**Plantilla general vs. override de Flama:** se define una plantilla de `club_settings` por defecto
(neutral, "Puntos", colores genéricos, todos los módulos base prendidos). Flama arranca con un override
que reproduce su identidad actual (Flamitas, rojo, 2/1, 7 días). Así podés testear la plantilla general
con un club de prueba mientras Flama no cambia en nada.

---

## 5. Identificación del tenant (ruteo)

Recomendado: **subdominio por club** → `flama.tuapp.com`, `harriers.tuapp.com`.
El `slug` de la tabla `clubs` mapea al subdominio. Ventajas: cada club siente que es "su" app,
el aislamiento es claro, y el branding se resuelve antes de loguear. Alternativa más simple para
arrancar: selector de club post-login (un usuario ve los clubes a los que pertenece). Se puede
empezar con el selector y agregar subdominios después sin cambiar la base.

---

## 6. Planes comerciales (Argentina, ARS, fijo mensual por club)

Tres planes. Precios de referencia a ajustar con el mercado; la estructura es lo importante.

| | **Free** | **Pro** | **Premium** |
|---|---|---|---|
| Precio (ARS/mes) | $0 | $ (medio) | $$ (alto) |
| Corredores | hasta ~30 | hasta ~150 | ilimitados |
| Carreras y asistencia | ✅ | ✅ | ✅ |
| Carga de tiempos e historial | ✅ | ✅ | ✅ |
| Fotos de carreras | ✅ (límite) | ✅ | ✅ |
| Sistema de puntos | básico | ✅ configurable | ✅ + gamificación |
| Metas personales | ✅ | ✅ | ✅ |
| Cumpleaños / novedades | ✅ | ✅ | ✅ |
| Certificados médicos | — | ✅ | ✅ |
| Tienda | — | ✅ | ✅ |
| Reventa de inscripciones | — | ✅ | ✅ |
| Alianzas / descuentos | — | ✅ | ✅ |
| Validación de fotos por IA | — | — | ✅ |
| Branding propio (logo/colores) | — | parcial | ✅ completo |
| Subdominio propio | — | — | ✅ |
| Notificaciones programadas | básicas | ✅ | ✅ avanzadas |
| Clima en carreras | — | ✅ | ✅ |
| Analítica del club | — | básica | ✅ avanzada |
| Soporte | comunidad | email | prioritario |

**Flama**: club de cortesía → acceso equivalente a Premium, marcado `es_cortesia = true`,
excluido de facturación. Queda como caso de éxito / club fundador.

**Clubes muy grandes:** el fijo mensual funciona para el 95% de los casos. Para el club que consume
muchos recursos (miles de fotos, validación IA intensiva), la previsión es un **overage** por encima
del tope del plan (ej. costo por bloque extra de corredores o de almacenamiento), o un plan
"Enterprise" a medida. No hace falta construirlo ahora: alcanza con dejar los topes por plan en
`clubs.plan` y medir consumo.

---

## 7. Qué queda detrás de Premium (feature-gating)

El gating se resuelve leyendo `clubs.plan` + `club_settings.modulos`. Lo que más valor tiene para
reservar a planes altos:

- **Validación de fotos por IA** (`validar-dorsal`) — es el diferencial técnico y el que más cuesta.
- **Branding completo + subdominio propio** — lo que convierte la plataforma en "su app".
- **Tienda y reventa de inscripciones** — funcionalidades de monetización para el club.
- **Analítica avanzada** — participación, asistencia, ranking de puntos, retención.
- **Notificaciones avanzadas y programadas** — recordatorios configurables.
- **Corredores ilimitados** — el límite por plan es la palanca de upgrade más natural.

Base (Free) siempre incluye lo que engancha: carreras, asistencia, tiempos, historial, puntos básicos.
Es el gancho para que un club entre y después escale.

---

## 8. Catálogo comercial (borrador para vender)

**RunGroup — La app de tu club de running, con tu marca.**

Tu club merece más que un grupo de WhatsApp. RunGroup le da a tu equipo una app propia para
organizar carreras, registrar tiempos, compartir fotos y mantener a todos enganchados durante
toda la temporada.

*Todo lo que tu club necesita, en un solo lugar:*
- **Carreras y asistencia** — publicá el calendario y sabé quién corre cada fecha.
- **Tiempos e historial** — cada corredor construye su historia deportiva.
- **Fotos del equipo** — el álbum compartido de cada carrera.
- **Sistema de puntos** — premiá la participación y el aguante con tu propia moneda de puntos.
- **Certificados médicos** — control de aptos al día, sin planillas.
- **Tienda y descuentos** — vendé indumentaria y ofrecé alianzas a tus socios.
- **Reventa de inscripciones** — que nadie pierda plata si no puede correr.
- **Metas y cumpleaños** — la comunidad que hace que la gente vuelva.

*Con tu identidad:* tu logo, tus colores, tu nombre, tu subdominio. Tus socios ven **tu** club,
no una app genérica.

*Planes desde $0.* Empezá gratis con lo esencial y escalá cuando tu club crezca.
Caso de éxito: **Flama**, club fundador que usa RunGroup todos los días.

*Llamado a la acción:* Creá tu club en minutos → `tuapp.com/crear-club`.

*(Este texto es un borrador de partida para landing / one-pager / deck de ventas.)*

---

## 9. Roadmap por fases (para poder testear ya, sin romper Flama)

**Fase 0 — Cimientos invisibles.** Crear `clubs`, `club_members`, `club_settings`. Insertar Flama
como club #1. Agregar `club_id` (nullable) a todas las tablas y backfillear a Flama. *La app sigue
igual, nadie nota nada.* Este es el paso que hay que hacer con más cuidado y testeo.

**Fase 1 — Aislamiento y plantilla general.** Poner `club_id` NOT NULL, reescribir RLS a por-club,
desactivar/acotar los triggers cross-join (pasar a creación lazy). Mover branding, terminología y
módulos a `club_settings`. Crear la **plantilla general** y el override de Flama. *Acá ya podés
levantar un club de prueba con la plantilla neutra y experimentar a nivel macro.*

**Fase 2 — Alta de clubes self-serve.** Onboarding de club nuevo (crear club, invitar corredores,
elegir módulos), selector de club post-login, y opcionalmente subdominios.

**Fase 3 — Comercial.** Planes, límites por plan, facturación (MercadoPago), medición de consumo
para el tema de clubes grandes.

Podés parar a hacer pruebas macro al final de la Fase 1 — que es exactamente lo que pediste.

---

## 10. Riesgos y cosas a vigilar

- **Triggers cross-join** (sección 3.4): el mayor riesgo para Flama. Cambio obligatorio y con testeo.
- **Edge functions single-tenant:** `notif-flamitas-auto`, `notif-flamitas-recordatorio`, `notif-7dias`,
  `notif-1dia`, `notif-cumple`, `notif-cert-vencido` hoy escanean toda la base sin filtrar por club.
  Hay que hacerlas conscientes de `club_id` y de `club_settings` (plazos, terminología, si el módulo
  está activo). Ej.: un club que llame "Puntos" a los Flamitas no debería recibir un push que diga "Flamitas".
- **Storage:** los buckets `certificados` y `avatares` están keyeados por `user_id`, así que son seguros
  cross-club. Pero fotos de carreras y productos convendría prefijarlas por `club_id` para orden y borrado.
- **Textos hardcodeados:** "Flamitas", "Flama", el rojo de acento, la zona horaria UTC-3 están en el código.
  Hay que ir sacándolos a `club_settings` a medida que se toca cada pantalla.
- **`handle_new_user`:** al registrarse alguien, hoy se le asigna rol global. Ahora el alta debe asociar
  a la persona a un club (por invitación o por el club del subdominio donde se registró).
