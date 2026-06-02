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
