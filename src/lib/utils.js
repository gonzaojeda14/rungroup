// Convierte "yyyy-mm-dd" a "dd/mm/yyyy"
export function formatFecha(fecha) {
  if (!fecha) return ''
  const [y, m, d] = fecha.split('-')
  return `${d}/${m}/${y}`
}

// Formatea hora "HH:MM:SS" a "HH:MM"
export function formatHora(hora) {
  if (!hora) return ''
  return hora.slice(0, 5)
}

// Fecha + hora juntas
export function formatFechaHora(fecha, hora) {
  if (!fecha) return ''
  return hora ? `${formatFecha(fecha)} ${formatHora(hora)}hs` : formatFecha(fecha)
}

// Normaliza nombres propios: primera letra de cada palabra en mayúscula, resto
// en minúscula (ej. "fernanda rinaldi" / "FERNANDA RINALDI" → "Fernanda Rinaldi").
export function capitalizarNombre(nombre) {
  return String(nombre || '')
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .map(palabra => palabra ? palabra.charAt(0).toUpperCase() + palabra.slice(1).toLowerCase() : palabra)
    .join(' ')
}

// True si la carrera ya arrancó (fecha+hora ya pasaron). Las funcionalidades
// post-carrera (Flama Points, feedback, carga de tiempo, etc.) se habilitan
// desde este momento — NO recién al día siguiente. Si no hay hora cargada,
// se asume que arranca a las 00:00 de ese día (es decir, el día completo cuenta
// como "ya arrancó" desde la medianoche).
export function yaEmpezo(fecha, hora) {
  if (!fecha) return false
  const inicio = new Date(`${fecha}T${hora || '00:00'}`)
  return new Date() >= inicio
}

// Ventana en la que el profe puede pre-marcar asistencia (Flama Points → "Carrera
// actual"): arranca 3 horas antes del horario de inicio — para ir marcando a
// quienes llegan a entrenar — y se mantiene abierta el resto del día de carrera.
export function enVentanaPreAprobacion(fecha, hora) {
  if (!fecha) return false
  const inicio = new Date(`${fecha}T${hora || '00:00'}`)
  const apertura = new Date(inicio.getTime() - 3 * 60 * 60 * 1000)
  const cierre = new Date(inicio.getTime() + 24 * 60 * 60 * 1000)
  const ahora = new Date()
  return ahora >= apertura && ahora <= cierre
}

// True mientras siga dentro del plazo de "dias" días corridos posteriores a la
// fecha de la carrera para reclamar los Flama Points (incluye el día de la carrera).
export function dentroDePlazo(fecha, dias) {
  if (!fecha) return false
  const limite = new Date(`${fecha}T00:00:00`)
  limite.setDate(limite.getDate() + dias + 1)
  return new Date() < limite
}

// True si ya se cerró la ventana para publicar/operar transferencias de inscripción
// para esta carrera — se cierra 2 horas antes del horario de inicio, para evitar
// transferencias de último momento que no llegarían a confirmarse a tiempo.
// Las publicaciones que cumplen esta condición deben dejar de listarse.
export function transferenciaCerrada(fecha, hora) {
  if (!fecha) return false
  const inicio = new Date(`${fecha}T${hora || '00:00'}`)
  const cierre = new Date(inicio.getTime() - 2 * 60 * 60 * 1000)
  return new Date() >= cierre
}

// Agrega al calendario: ICS en iOS, Google Calendar en Android/desktop
export function agregarAlCalendario(nombre, fecha, hora, lugar) {
  if (!fecha) return
  const esIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)

  if (esIOS) {
    const fechaStr = fecha.replace(/-/g, '')
    let dtStart, dtEnd
    if (hora) {
      const horaStr = hora.slice(0, 5).replace(':', '') + '00'
      dtStart = `${fechaStr}T${horaStr}`
      const [h, m] = hora.split(':').map(Number)
      const totalMin = h * 60 + m + 180
      const hFin = String(Math.floor(totalMin / 60) % 24).padStart(2, '0')
      const mFin = String(totalMin % 60).padStart(2, '0')
      dtEnd = `${fechaStr}T${hFin}${mFin}00`
    } else {
      dtStart = fechaStr
      dtEnd = fechaStr
    }
    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//FlamaRun//ES',
      'BEGIN:VEVENT',
      `SUMMARY:${nombre}`,
      `DTSTART:${dtStart}`,
      `DTEND:${dtEnd}`,
      lugar ? `LOCATION:${lugar}` : '',
      'DESCRIPTION:Carrera organizada a través de Flama Run',
      'END:VEVENT',
      'END:VCALENDAR',
    ].filter(Boolean).join('\r\n')
    const blob = new Blob([ics], { type: 'text/calendar' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${nombre.replace(/\s+/g, '_')}.ics`
    a.click()
    URL.revokeObjectURL(url)
  } else {
    // Google Calendar URL
    const fechaStr = fecha.replace(/-/g, '')
    let dates
    if (hora) {
      const horaStr = hora.slice(0, 5).replace(':', '') + '00'
      const [h, m] = hora.split(':').map(Number)
      const totalMin = h * 60 + m + 180
      const hFin = String(Math.floor(totalMin / 60) % 24).padStart(2, '0')
      const mFin = String(totalMin % 60).padStart(2, '0')
      dates = `${fechaStr}T${horaStr}/${fechaStr}T${hFin}${mFin}00`
    } else {
      dates = `${fechaStr}/${fechaStr}`
    }
    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: nombre,
      dates,
      details: 'Carrera organizada a través de Flama Run',
      ...(lugar ? { location: lugar } : {}),
    })
    window.open(`https://calendar.google.com/calendar/render?${params}`, '_blank')
  }
}

// Valida que un teléfono tenga entre 8 y 15 dígitos
export function validarTelefono(tel) {
  if (!tel) return false
  const digits = tel.replace(/\D/g, '')
  return digits.length >= 8 && digits.length <= 15
}

// Formatea teléfono para WhatsApp con código de país Argentina (+54)
export function formatTelefonoWA(tel) {
  if (!tel) return ''
  let nums = tel.replace(/\D/g, '')
  if (!nums) return ''
  // Ya tiene código de país (11+ dígitos = internacional)
  if (nums.length >= 11) return nums
  // Quitar 0 inicial (ej: 011...)
  if (nums.startsWith('0')) nums = nums.slice(1)
  // Agregar 549 para Argentina
  return '549' + nums
}
