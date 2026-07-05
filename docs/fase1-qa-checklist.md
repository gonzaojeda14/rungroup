# Fase 1 — Riesgos y checklist de QA por cambio

> La Fase 1 es donde el multi-tenant deja de ser invisible y empieza a cambiar comportamiento.
> Este doc lista, para cada cambio, **qué puede salir mal** y **cómo verificarlo** antes y después
> de deployar. Regla de oro: probar siempre con **dos cuentas reales** (un corredor y un admin de
> Flama) y, en cuanto exista, con **un segundo club de prueba** para chequear el aislamiento.

## Reglas generales (aplican a todo)

- **Un cambio a la vez.** No mezclar RLS + triggers + settings en el mismo deploy. Cada uno se prueba solo.
- **Backup antes de cada paso de DB.** Supabase → Database → Backups (o un dump). Los cambios de RLS y
  triggers son los que conviene poder revertir rápido.
- **Feature flag donde se pueda.** Sobre todo el wireo de `club_settings`: leer de la DB con **fallback**
  a los valores hardcodeados actuales, para poder apagarlo sin redeploy si algo sale mal.
- **Comparar contadores antes/después.** Anotá cantidades clave (carreras, participaciones, puntos totales
  de un par de corredores) antes del cambio y verificá que no cambien después.
- **Probar en el orden:** como corredor → como admin → (cuando exista) como miembro de otro club.

---

## Cambio 1 — Wirear `club_settings` en la app

**Qué hace:** que branding, terminología ("Flamitas"/"Stand Flama"), reglas de puntos (2/1, bonus 5),
plazo (7 días) y módulos salgan de `club_settings` en vez de estar hardcodeados.

**Riesgo: BAJO-MEDIO.** No hay pérdida de datos. Lo peor es una regresión visual o de reglas: labels en
blanco o equivocados, valores de puntos distintos, un módulo que desaparece, el color de acento cambiado.

**Mitigación:** fallback a los defaults actuales si `club_settings` falta o viene incompleto. Los valores
de Flama ya están cargados y coinciden con lo hardcodeado, así que "bien hecho" = **cero cambios visibles**.

**QA:**

- [ ] La terminología sigue diciendo **"Flamitas"** / **"Flamita"** / **"Stand Flama"** en todas las
      pantallas (Mas, MiPerfil, PerfilCorredor, Corredores, notificaciones).
- [ ] El color de acento sigue siendo el rojo de siempre (#ff2d2d) en toda la app.
- [ ] Reclamás una carrera de prueba como **Inscripto** → suma **+2**; como **Stand Flama** → **+1**.
- [ ] Una carrera **destacada** sigue sumando **+1 extra** (3 / 2).
- [ ] El bonus de perfil completo sigue siendo **+5**.
- [ ] El plazo de reclamo sigue siendo **7 días** (una carrera de hace 8 días ya no deja reclamar).
- [ ] Todos los módulos siguen visibles (tienda, certificados, alianzas, clima, etc.) — no desapareció ninguno.
- [ ] Con `club_settings` borrado a propósito (test en staging), la app **no se rompe**: cae al fallback.

---

## Cambio 2 — RLS por club en las tablas de contenido

**Qué hace:** que las policies filtren por `club_id` vía membresía (`es_miembro_club` / `es_admin_club`),
para que cada club vea solo lo suyo.

**Riesgo: ALTO.** Dos formas de fallar: **(a) bloquear de más** → un corredor deja de ver carreras/fotos/
puntos y la app parece vacía o rota; **(b) filtrar de menos** → fuga de datos entre clubes. Como hoy solo
existe Flama (todos son miembros), el riesgo inmediato es **(a) que Flama vea todo vacío** si la policy está
mal escrita. Este es el cambio que más puede romper la experiencia en vivo.

**Mitigación:** ir **tabla por tabla**, no todas de golpe. Mantener las policies viejas hasta validar la
nueva. Probar con cuenta de corredor Y de admin. No borrar la policy vieja hasta confirmar.

**QA como corredor (cuenta real de Flama):**

- [ ] La lista de **carreras** carga completa (mismo número que antes).
- [ ] Ve sus **participaciones** y puede marcar asistencia.
- [ ] El **historial de Flamitas** y el total siguen bien (mismo número que antes del cambio).
- [ ] **Fotos**, **tienda**, **novedades**, **alianzas**, **metas** cargan normal.
- [ ] Puede reclamar Flamitas de una carrera elegible.

**QA como admin (cuenta admin de Flama):**

- [ ] Ve **todas** las participaciones y la lista completa de **corredores**.
- [ ] Puede **crear / editar / borrar** una carrera.
- [ ] Ve las colas de moderación (fotos a revisar) y la gestión de tienda.

**QA de aislamiento (crítico — apenas exista un 2do club):**

- [ ] Con un usuario del **club B**, NO aparece ninguna carrera / foto / corredor / producto de **Flama**.
- [ ] Un admin de **club B** NO puede editar ni ver datos de Flama.
- [ ] Un corredor de Flama NO ve nada del club B.
- [ ] Contadores por club dan lo esperado (las carreras de Flama = las de antes; club B arranca en 0).

---

## Cambio 3 — Desactivar los triggers cross-join (creación lazy de participaciones)

**Qué hace:** eliminar `handle_new_profile` y `handle_new_carrera` (que hoy crean participaciones para
*todos × todas*) y pasar a crear la participación **cuando el corredor marca asistencia** (lazy).

**Riesgo: ALTO — el más delicado para Flama.** Hoy la app puede asumir que existe una fila de participación
(estado 'Pendiente') para cada usuario en cada carrera. Al pasar a lazy, esas filas **no existen** hasta el
RSVP. Cualquier pantalla que lea/joinee participaciones dando por sentado que la fila está, puede mostrar
distinto (listas vacías, contadores en 0, etc.).

**Mitigación:** antes de tocar, mapear **todos** los lugares que leen `participaciones`. No borrar los datos
existentes (las participaciones ya creadas quedan). Probar alta de carrera y alta de usuario. Tener rollback.

**QA:**

- [ ] Las participaciones **ya existentes** siguen intactas (contá filas antes/después).
- [ ] **Crear una carrera nueva** → aparece para los corredores y pueden marcar asistencia (RSVP crea la fila).
- [ ] Un corredor que marca **"Voy"** en una carrera nueva queda como Inscripto y puede reclamar Flamitas.
- [ ] **Un usuario nuevo** que se registra puede ver las carreras existentes y anotarse.
- [ ] La vista de admin **"quién viene"** funciona y cuenta bien (aunque arranque vacía para carreras nuevas).
- [ ] No se generan participaciones **duplicadas** ni **huérfanas** (sin carrera o sin usuario).
- [ ] El flujo de Flamitas sigue entero: Inscripto/Stand Flama → foto → acreditación.
- [ ] Las notificaciones (2hs, 7 días, 1 día) siguen encontrando a la gente correcta.

---

## Cambio 4 — Impersonación ("entrar como") + `support_sessions`

**Qué hace:** un botón en el panel de plataforma para que el super-admin entre a un club como admin,
mediante un `support_sessions` temporal y auditado que la RLS respeta.

**Riesgo: MEDIO (sensible por seguridad/privacidad).** Si el grant es muy amplio o no expira, es un agujero
de privacidad. Si es muy angosto, la impersonación muestra todo vacío.

**QA:**

- [ ] Super-admin toca **"entrar como"** un club → ve las pantallas de admin de ese club **con sus datos**.
- [ ] Al **expirar** la ventana (o cerrar la sesión de soporte), el acceso se corta solo.
- [ ] Queda una fila en `support_sessions` con **quién, cuándo y a qué club** entró.
- [ ] Un usuario **sin** `is_platform_admin` NO puede crear una `support_sessions` ni impersonar.
- [ ] En el **club demo**, la impersonación es libre (sin datos reales de por medio).
- [ ] (Si se implementa) en modo soporte, los campos sensibles (certificados, teléfonos) aparecen **redactados**.

---

## Gotchas para no olvidar

- **El `default club_id = Flama`:** en Fase 0 le puse a las tablas de contenido un default apuntando a Flama.
  Cuando sumes el **segundo club de verdad**, hay que **quitar ese default** (o la app pasar a setear `club_id`
  explícito), si no las filas nuevas de otro club quedarían asignadas a Flama por defecto.
- **Edge functions:** las notif (`notif-flamitas-auto`, `notif-7dias`, etc.) hoy escanean **toda** la base sin
  filtrar por club. Antes de tener un 2do club activo, hay que hacerlas conscientes de `club_id` y de
  `club_settings` (plazos y terminología por club), o mandarían avisos cruzados / con el nombre equivocado.
- **Storage:** los buckets (`planes`, `certificados`, `avatares`, fotos) están keyeados por path, no por club.
  Para fotos/productos conviene prefijar por `club_id` cuando escale; certificados/avatares son por usuario y
  quedan seguros.
- **`club_id` NOT NULL:** cuando la app ya setee `club_id` en todos los inserts, recién ahí conviene pasar la
  columna a NOT NULL. Antes no, o romperías inserts que todavía no lo mandan.
