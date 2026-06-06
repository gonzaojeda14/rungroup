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

// Genera y descarga un archivo ICS para agregar al calendario
export function agregarAlCalendario(nombre, fecha, hora, lugar) {
  if (!fecha) return
  const fechaStr = fecha.replace(/-/g, '')
  let dtStart, dtEnd
  if (hora) {
    const horaStr = hora.slice(0, 5).replace(':', '') + '00'
    dtStart = `${fechaStr}T${horaStr}`
    // Fin = 3 horas después
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
    `DESCRIPTION:Carrera organizada a través de Flama Run`,
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
