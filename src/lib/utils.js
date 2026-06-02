// Convierte "yyyy-mm-dd" a "dd/mm/yyyy"
export function formatFecha(fecha) {
  if (!fecha) return ''
  const [y, m, d] = fecha.split('-')
  return `${d}/${m}/${y}`
}
