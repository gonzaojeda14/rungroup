# RunGroup — Roles, administración y cómo probar/demostrar la app

> Cómo se organiza la administración cuando hay más de un club, cómo probás vos como admin,
> y cómo le das una app base a un prospecto para que la pruebe. Complementa `multi-tenant-strategy.md`.

---

## 1. La idea central: hoy tenés 2 roles, vas a necesitar 3

Hoy existe `admin` y `corredor`, y como hay un solo club, `admin` hace de todo: gestiona Flama
**y** es dueño de la plataforma. En multi-tenant eso se tiene que separar en **tres niveles**:

| Nivel | Quién | Qué maneja | Alcance |
|---|---|---|---|
| **Platform owner** (super-admin) | Vos (Gonzalo) | Clubes, planes, altas, demos | Toda la plataforma, cruza clubes |
| **Club admin / owner** | El referente de cada club | Su club: carreras, corredores, tienda, config | Un solo club |
| **Corredor** | El socio | Su propia participación | Sus datos dentro de un club |

El error a evitar es dejar todo como "admin" global. El día que entra un segundo club, un admin de
Flama **no** puede ver ni tocar datos del otro club — eso lo garantiza el `club_members.role` del doc
técnico. Y vos necesitás un rol por **encima** de los clubes que hoy no existe: el platform owner.

Implementación: `club_members.role in ('owner','admin','corredor')` resuelve el nivel club. El nivel
plataforma es un flag aparte, **no atado a ningún club** — por ejemplo una tabla `platform_admins`
(user_id) o un `profiles.is_platform_admin`. Que sea separado es importante: ser dueño de la
plataforma no es "ser admin de un club", son cosas distintas.

---

## 2. Tu pregunta: ¿admin con las visuales del corredor, panel aparte, o ambas?

**Recomendación: ambas, pero cada una para lo suyo.** No es "o una o la otra"; son dos tipos de
tarea de admin distintas:

**Acciones contextuales → inline (donde ya las tenés).** Editar una carrera, aprobar una foto, marcar
asistencia, destacar una carrera. Esto vive mejor *dentro* de la vista del corredor, justo al lado de
la cosa que estás gestionando. Es buena UX y ya lo tenés funcionando. **No lo muevas.** Además tu
toggle `vistaCorredor` te deja ver la experiencia real del socio con un click — eso es exactamente lo
que querés conservar.

**Gestión y configuración → panel dedicado.** Ajustes del club (branding, módulos on/off, terminología,
reglas de puntos), gestión de miembros, colas de moderación (fotos a revisar), tienda, analítica.
Esto **no** debería estar salpicado en las vistas del socio: lo ensucia y no tiene un lugar natural.
A medida que sumes clubes y features, este panel es el que evita que la app del corredor se llene de
botones que él nunca usa.

Regla simple para decidir dónde va cada cosa:

> ¿La acción es sobre **un objeto puntual que estás viendo** (esta carrera, esta foto)? → inline.
> ¿Es **configuración o gestión del club como un todo**? → panel de administración.

Hoy no tenés el panel porque con un club y pocas opciones alcanzaba con lo inline. Al pasar a
multi-tenant, la configuración por club (que antes no existía) necesita un hogar: ese es el panel.

---

## 3. El nivel plataforma: cómo administrás vos varios clubes

Arriba de los paneles de cada club va **tu** panel de plataforma (solo para vos). Lo mínimo útil:

- **Lista de clubes** — crear, suspender, ver plan y estado de cada uno.
- **Crear club** — el alta que después será self-serve; al principio la disparás vos.
- **Impersonar / "entrar como"** un club — la pieza más valiosa para testear. Te deja meterte en
  cualquier club como si fueras su admin, sin tener credenciales separadas. Con eso probás Flama, el
  club demo o el de un cliente sin hacer malabares de logins.

La impersonación + tu toggle `vistaCorredor` te dan las tres vistas que necesitás: plataforma → club
(como admin) → corredor. Todo con tu usuario.

---

## 4. Cómo probás como admin (flujo de testing)

1. **Como platform owner:** ves la lista de clubes y entrás al que quieras (impersonar).
2. **Como club admin:** dentro del club, gestionás carreras/corredores/config con los controles inline
   y el panel.
3. **Como corredor:** activás `vistaCorredor` y ves exactamente lo que ve un socio de ese club.

Sin construir nada nuevo ya tenés el paso 3. Faltan el 1 y el 2 (panel de plataforma + panel de club),
que son parte de la Fase 1-2 del roadmap técnico.

---

## 5. Cómo compartís la "app base sin diseños" a un prospecto

La clave es un **club demo** basado en la **plantilla general** (branding neutro, "Puntos" en vez de
"Flamitas", colores genéricos, todos los módulos base prendidos). Es la app pelada, sin la identidad
de Flama, justo lo que querés mostrar.

Opciones, de la más simple a la más pulida:

1. **Demo guiado (ya):** vos entrás como platform owner, impersonás el club demo y se lo mostrás en
   una llamada. Cero desarrollo extra. Ideal para los primeros prospectos.
2. **Login de invitado (siguiente):** un usuario `demo@...` con permisos de admin sobre el club demo,
   que le pasás al prospecto para que lo toque solo. Sembrás datos falsos (carreras, corredores,
   fotos) para que no se vea vacío. Conviene resetear ese club periódicamente.
3. **"Probá gratis" self-serve (más adelante):** el prospecto crea su propio club de prueba con la
   plantilla general y juega en su propio sandbox. Esto ya es parte del onboarding self-serve; no hace
   falta para arrancar a vender.

Recomendación para ya: armá **un** club demo con la plantilla general y datos sembrados, y usalo tanto
para el demo guiado como para dar el login de invitado. Cuando el prospecto quiere avanzar, ese mismo
flujo se convierte en su club real con su branding.

Detalle importante: el club demo debe usar la **plantilla general**, nunca los settings de Flama. Así
Flama conserva su identidad y el prospecto ve un producto neutro que puede imaginar como propio.

---

## 6. Qué construir primero (orden pragmático)

1. **Separar el rol plataforma del rol club** (flag `is_platform_admin` / tabla `platform_admins`).
   Sin esto no hay multi-tenant real.
2. **Panel de administración de club** — empezá moviendo ahí solo la *configuración nueva* (branding,
   módulos, terminología). Los controles inline actuales quedan como están.
3. **Panel de plataforma con impersonación** — lista de clubes + "entrar como". Te habilita testear y
   dar demos.
4. **Club demo con plantilla general y datos sembrados** — tu herramienta de venta.

Nada de esto toca la experiencia de Flama: son capas nuevas por encima. El corredor de Flama sigue
viendo exactamente lo mismo que hoy.
