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
  // Ya tiene código de país
  if (nums.startsWith('54')) return nums
  // Quitar 0 inicial (ej: 011...)
  if (nums.startsWith('0')) nums = nums.slice(1)
  // Agregar +54 y 9 para WhatsApp
  return '549' + nums
}
