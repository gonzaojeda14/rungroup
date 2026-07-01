# RunGroup — Estrategia comercial (cómo armar y vender el producto)

> Documento interno. Cómo pasar de "una app para Flama" a un negocio que le vende a clubes de running.
> Estado real: todavía no hay planes ni clientes. Esto es el plan para llegar ahí.
> Mercado inicial: Argentina (ARS).

---

## 1. El modelo: servicio productizado (no SaaS puro… todavía)

Lo que describiste —app base + un pago inicial por adaptarla + suscripción mensual— es un
**servicio productizado**: un producto estándar con una capa de personalización que cobrás aparte.
Es exactamente lo que conviene al arrancar, por tres razones:

1. **Caja temprana.** El setup fee te paga el laburo de adaptar y onboardear *antes* de depender
   de meses de suscripción. Sin eso, cada cliente nuevo es plata que ponés vos primero.
2. **Filtra curiosos.** Un club que paga un setup inicial (aunque sea chico) es un club que va en serio.
   Los que solo "querían ver" no pagan y no te hacen perder tiempo.
3. **Te compra tiempo para productizar.** Mientras hacés adaptaciones a mano, vas viendo qué se repite.
   Eso que se repite es lo que después convertís en configuración self-serve. El servicio financia
   la construcción del producto.

La meta a mediano plazo es que la personalización sea cada vez más self-serve y el setup fee baje o
desaparezca. Pero ese es el destino, no el punto de partida.

### Los tres momentos de ingreso

- **Setup / adaptación inicial** (one-time, al alta).
- **Suscripción mensual** (recurrente, el corazón del negocio).
- **Adaptaciones a medida / upgrades** (eventual, cuando un club pide algo específico).

---

## 2. El producto en tres capas

Pensar el producto en capas evita la trampa de "personalizo todo para cada uno" (que no escala) y a
la vez permite decir que sí a pedidos puntuales (que pagan bien).

**Capa 1 — App base (igual para todos).** Todo el núcleo funcional: carreras, asistencia, tiempos,
historial, fotos, puntos, metas, cumpleaños. Esto no se toca por cliente; es el producto.

**Capa 2 — Personalización (self-serve, vía onboarding).** Lo que el club configura solo: nombre,
logo, colores, cómo llama a los puntos, qué módulos prende o apaga, plazos. Cero código de tu parte.
Esto es lo que cubre el "que ellos personalicen todo" que mencionás.

**Capa 3 — Adaptaciones a medida (pagas, a demanda).** Un club quiere una función que no existe o
un flujo distinto. Ahí cotizás un desarrollo puntual. Es la que justifica el "pago inicial por
adaptación" cuando el pedido va más allá de la Capa 2.

Regla práctica: **todo lo que se pueda mover a Capa 2 conviene moverlo**, porque cada cosa que el club
resuelve solo es tiempo que no gastás vos.

---

## 3. Onboarding simple (el recorrido del club)

El onboarding es tu producto de venta tanto como la app. Si es simple, cerrás; si es un lío, perdés
al cliente. El flujo ideal, en pasos que el club entiende:

1. **Crear el club** — nombre, y elegís el subdominio (`miclub.tuapp.com`).
2. **Ponerle tu cara** — subir logo, elegir color principal. Vista previa en vivo.
3. **Elegir qué usar** — prender/apagar módulos con switches (tienda sí, certificados no, etc.).
4. **Nombrar tus puntos** — "Flamitas", "Puntos", "Millas", lo que sea del club.
5. **Invitar corredores** — link de invitación o carga de mails.
6. **Listo** — el club ya está vivo.

Cada paso debe poder saltarse y volver después. Nadie abandona un onboarding de 6 pasos con defaults
razonables; sí abandonan uno que exige 30 campos obligatorios. La **plantilla general** (del doc técnico)
es la que rellena todos los defaults para que el club solo cambie lo que quiere.

Para los primeros clientes, el onboarding lo podés hacer **vos con ellos** (una videollamada de 30 min),
y en paralelo ir construyendo la versión self-serve. Onboarding asistido = mejor primer cliente + aprendés
qué confunde.

---

## 4. Estructura de planes

Combinando lo que definimos: ARS, fijo mensual, más el setup fee. Tres piezas.

### 4.1 Setup / Adaptación inicial (one-time)

Cubre alta, personalización asistida y carga inicial. Sirve de filtro y de caja.

- **Setup estándar** (Capa 2, personalización normal): monto fijo accesible.
- **Adaptación a medida** (Capa 3): cotización aparte según el pedido.
- *Palanca de venta:* podés bonificar el setup a los primeros clubes ("club fundador") a cambio de
  testimonios y feedback.

### 4.2 Plan Base — "sin IA ni cobros integrados"

El plan de entrada. Todo lo esencial para que un club funcione:

- Carreras, asistencia, tiempos, historial, fotos, metas, cumpleaños, puntos (básico).
- Branding propio (logo, colores, nombre, terminología).
- **No incluye:** validación de fotos por IA, ni integración de pagos/tienda con cobro real.

Es el plan que la mayoría de los clubes chicos y medianos van a querer.

### 4.3 Plan Premium — "con IA y todo lo comercial"

Para clubes que quieren la experiencia completa y/o monetizar:

- Todo lo del Base, más:
- **Validación de fotos por IA** (el diferencial técnico).
- **Tienda con integración de pago real** (MercadoPago) y reventa de inscripciones.
- **Subdominio propio + branding completo.**
- **Analítica avanzada** y notificaciones programadas.
- Corredores ilimitados, soporte prioritario.

### 4.4 Flama

Club de cortesía permanente, acceso equivalente a Premium, sin factura. Es tu **caso de éxito** y la
prueba viviente de que el producto funciona con un club real. Vale más como referencia comercial que
como ingreso.

> **Decisiones que te quedan por tomar** (no hace falta ahora, pero anotalas): el monto del setup fee,
> el precio mensual de Base y Premium, y si hacés un descuento anual. Sugerencia: definilos recién
> después de hablar con 2-3 clubes reales, para no inventar precios en el aire.

---

## 5. Cómo conseguir los primeros clientes

El primer objetivo no es "muchos clubes", es **3 a 5 clubes piloto** que te den feedback y testimonios.

1. **Usá Flama como carta de presentación.** "Esta app la usa el club X todos los días" vale más que
   cualquier folleto. Pedile a tu amigo un testimonio y, si se puede, un contacto de otro club.
2. **Red de contacto directa.** Clubes donde conozcas a alguien, entrenadores, grupos de running de tu
   zona. La venta fría de un producto nuevo no funciona; la recomendación sí.
3. **Oferta de club fundador.** A los primeros: setup bonificado o descuento de por vida a cambio de
   feedback honesto y permiso para nombrarlos. Ganás casos de éxito y validación.
4. **Demo en vivo, no PDF.** Mostrales Flama funcionando. Que vean fotos reales, puntos reales, gente real.

---

## 6. Instagram y marketing

Instagram es la vidriera para clubes que no te conocen. No busca vender en el primer post: busca que un
club piense "quiero esto para el mío".

**Cuenta.** Nombre tipo `@rungroup.app` o el que definas junto al dominio. Bio corta: qué es + para quién
+ link a la landing/one-pager. Ej.: *"La app de tu club de running, con tu marca. Carreras, tiempos,
fotos y puntos en un solo lugar. 👇 Creá el tuyo."*

**Pilares de contenido** (rotá entre estos, no vendas todo el tiempo):

- **Producto en acción** — capturas/clips de la app: cómo se ve un calendario de carreras, el ranking de
  puntos, el álbum de fotos. Mostrar, no describir.
- **Historias de club** — Flama como protagonista: una carrera, un logro, cómo usan la app. Contenido real
  que otros clubes envidian.
- **Tips para clubes** — valor gratis: "3 formas de que tu club no pierda gente en el invierno",
  "cómo organizar la asistencia a una carrera". Te posiciona como alguien que entiende de clubes.
- **Detrás de escena** — que estás construyendo esto, updates, funciones nuevas. Genera cercanía y confianza.

**Plan de las primeras 2-3 semanas** (2-3 posts por semana alcanza para arrancar):

1. Post de presentación: qué es RunGroup y para quién.
2. Un módulo estrella mostrado en imágenes (ej. sistema de puntos).
3. Historia de Flama usándolo.
4. Tip útil para clubes (sin mencionar el producto).
5. Otro módulo (fotos / carreras).
6. Llamado a la acción: "¿Tenés un club? Escribinos y te lo mostramos."

**Regla 80/20:** 80% valor y producto, 20% venta directa. Si solo vendés, la gente deja de mirar.

**Formato que mejor funciona:** Reels cortos mostrando la app en el teléfono. Un club se proyecta más
viendo la pantalla en movimiento que leyendo una lista de features.

---

## 7. Realidades a tener en cuenta

- **El soporte escala con vos, no con el código.** Cada club nuevo son preguntas, pedidos, bugs. Por eso
  el onboarding self-serve y la Capa 2 importan tanto: cada cosa que el club resuelve solo es tiempo tuyo
  que no se consume.
- **No prometas personalización infinita.** La Capa 3 (a medida) es tentadora porque paga, pero cada
  adaptación única es deuda que mantenés para siempre. Cobrala bien y con criterio, o empujá el pedido a
  la Capa 2.
- **Precio: mejor errar caro.** Es más fácil bajar un precio que subirlo. Un producto muy barato también
  se percibe como poco serio para un club que maneja plata de socios.
- **Primero validá, después escalá.** No armes 10 planes ni automatices todo antes de tener 3 clubes
  contentos. El primer cliente que paga te enseña más que un mes de planificación.

---

## 8. Próximos pasos concretos

En orden, de lo más urgente a lo que puede esperar:

1. **Terminar la Fase 0-1 del doc técnico** — que la app soporte un segundo club con plantilla general.
   Sin esto no hay nada que vender.
2. **Definir nombre y dominio** de la plataforma (hoy "RunGroup" es placeholder) → habilita Instagram,
   mail, landing.
3. **Armar el one-pager comercial** (documento aparte, ya te lo dejo) para tener qué mandar.
4. **Crear el Instagram** y publicar los primeros 3-4 posts con Flama de protagonista.
5. **Hablar con 2-3 clubes reales** — no para vender, para entender qué necesitan y validar precios.
6. **Recién ahí, fijar precios** (setup + Base + Premium) con información real.

No necesitás nada de billing automático ni self-serve completo para los primeros clientes: podés
onboardearlos a mano y cobrar por transferencia/MercadoPago manual. Automatizás cuando el volumen lo pida.
