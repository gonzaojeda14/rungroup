import { useSearchParams } from 'react-router-dom'
import PageLoader from '../components/PageLoader'
import FotosModal from '../components/FotosModal'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { formatFechaHora, agregarAlCalendario, yaEmpezo } from '../lib/utils'

const ESTADO_COLOR = {
  'Inscripto': '#4ade80',
  'Quizás': '#fbbf24',
  'Lista de espera': '#60a5fa',
  'No voy': '#f87171',
  'Pendiente': '#475569',
}

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

// Convierte HH:MM:SS o MM:SS a segundos
function tiempoASegundos(texto) {
  const partes = texto.split(':').map(Number)
  if (partes.some(isNaN)) return null
  if (partes.length === 3) return partes[0] * 3600 + partes[1] * 60 + partes[2]
  if (partes.length === 2) return partes[0] * 60 + partes[1]
  return null
}

// Formatea segundos a MM:SS o HH:MM:SS según corresponda
function segundosATiempo(seg) {
  const h = Math.floor(seg / 3600)
  const m = Math.floor((seg % 3600) / 60)
  const s = seg % 60
  if (h > 0) return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
}

// Valida formato MM:SS o HH:MM:SS
function validarTiempo(texto) {
  return /^\d{1,2}:\d{2}(:\d{2})?$/.test(texto.trim())
}

// Autoformatea mientras el usuario tipea
// Si ya tiene ":" lo deja escribir libre, si son solo números inserta : automáticamente
function autoformatTiempo(valor) {
  let nums = valor.replace(/\D/g, '')
  if (nums.length >= 3 && parseInt(nums[2]) > 5) nums = nums.slice(0, 2)
  if (nums.length >= 5 && parseInt(nums[4]) > 5) nums = nums.slice(0, 4)
  nums = nums.slice(0, 6)
  if (nums.length <= 2) return nums
  if (nums.length <= 4) return `${nums.slice(0,2)}:${nums.slice(2)}`
  return `${nums.slice(0,2)}:${nums.slice(2,4)}:${nums.slice(4)}`
}

// Extrae km numérico de una distancia como "15K", "Maratón", etc.
function parsearDistanciaKm(dist) {
  if (!dist) return null
  const str = String(dist).toLowerCase().trim()
  if (str.includes('maratón') || str.includes('maraton') || str === '42k' || str === '42.2k') return 42.195
  if (str.includes('media') || str === '21k' || str === '21.1k') return 21.097
  const m = str.match(/^(\d+(?:\.\d+)?)\s*k/)
  if (m) return parseFloat(m[1])
  const n = parseFloat(str)
  return isNaN(n) ? null : n
}

// Calcula ritmo en formato "MM:SS /km"
function calcularRitmo(segundos, distKm) {
  if (!segundos || !distKm) return null
  const rSeg = Math.round(segundos / distKm)
  const m = Math.floor(rSeg / 60)
  const s = rSeg % 60
  return `${m}:${String(s).padStart(2, '0')} /km`
}

function diasRestantes(fecha) {
  if (!fecha) return null
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const carrera = new Date(fecha + 'T00:00:00')
  return Math.ceil((carrera - hoy) / (1000 * 60 * 60 * 24))
}

function labelDias(dias, empezo) {
  if (dias < 0 || (dias === 0 && empezo)) return 'Finalizada'
  if (dias === 0) return '¡Hoy!'
  if (dias === 1) return 'Mañana'
  if (dias < 7) return `En ${dias} días`
  if (dias < 14) return 'En 1 semana'
  if (dias < 30) return `En ${Math.floor(dias / 7)} semanas`
  return `En ${Math.floor(dias / 30)} mes${Math.floor(dias / 30) > 1 ? 'es' : ''}`
}

export default function Participaciones() {
  const { user } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState(() => localStorage.getItem('agenda_filtro') || 'recientes')
  const [mesActivo, setMesActivo] = useState(() => localStorage.getItem('agenda_mes') || null)
  const [showFiltros, setShowFiltros] = useState(false)

  function setFiltroGuardado(val) { setFiltro(val); localStorage.setItem('agenda_filtro', val) }
  function setMesActivoGuardado(val) { setMesActivo(val); val ? localStorage.setItem('agenda_mes', val) : localStorage.removeItem('agenda_mes') }
  const [toast, setToast] = useState('')
  const [notas, setNotas] = useState({}) // { carreraId: texto }
  const [tiempos, setTiempos] = useState({}) // { carreraId_distancia: texto }
  const [tiemposGuardados, setTiemposGuardados] = useState({}) // { carreraId_distancia: tiempo_texto }
  const [tiemposSegundos, setTiemposSegundos] = useState({}) // { carreraId_distancia: tiempo_segundos }
  const [compartiendo, setCompartiendo] = useState(null) // key en generación
  const [editandoTiempo, setEditandoTiempo] = useState({}) // { key: true } cuando está en modo edición
  const [savingTiempo, setSavingTiempo] = useState({})
  const [fotosCarrera, setFotosCarrera] = useState(null)
  const [searchParams, setSearchParams] = useSearchParams()

  function labelFotos(tipo) {
    if (tipo === 'evento') return 'Ver fotos del evento'
    if (tipo === 'entrenamiento') return 'Ver fotos del entrenamiento'
    return 'Ver fotos de la carrera'
  }

  function abrirGaleria(carrera) {
    setFotosCarrera(carrera)
    setSearchParams({ galeria: carrera.id }, { replace: true })
  }

  function cerrarGaleria() {
    setFotosCarrera(null)
    setSearchParams({}, { replace: true })
  }

  async function compartirResultado({ carreraNombre, dist, tiempoTexto, segundos, key }) {
    // Pedir foto de fondo antes de mostrar spinner
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    const bgFile = await new Promise(res => {
      input.onchange = e => res(e.target.files?.[0] || null)
      input.addEventListener('cancel', () => res(null))
      input.click()
    })

    setCompartiendo(key)
    try {
      const W = 1080, H = 1080
      const canvas = document.createElement('canvas')
      canvas.width = W; canvas.height = H
      const ctx = canvas.getContext('2d')

      // Panel dimensions (bottom portion, taller to fit logo)
      const pH = 500, pY = H - pH - 40
      const pX = 50, pW = W - 100

      // Rounded rect helper
      function rr(x, y, w, h, r) {
        ctx.beginPath()
        ctx.moveTo(x + r, y)
        ctx.lineTo(x + w - r, y)
        ctx.quadraticCurveTo(x + w, y, x + w, y + r)
        ctx.lineTo(x + w, y + h - r)
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
        ctx.lineTo(x + r, y + h)
        ctx.quadraticCurveTo(x, y + h, x, y + h - r)
        ctx.lineTo(x, y + r)
        ctx.quadraticCurveTo(x, y, x + r, y)
        ctx.closePath()
      }

      // Foto de fondo (cover fit) o fondo negro si no hay foto
      if (bgFile) {
        const bgUrl = URL.createObjectURL(bgFile)
        const bg = new Image()
        bg.src = bgUrl
        await new Promise((res, rej) => { bg.onload = res; bg.onerror = rej })
        const scale = Math.max(W / bg.naturalWidth, H / bg.naturalHeight)
        const sw = bg.naturalWidth * scale, sh = bg.naturalHeight * scale
        ctx.drawImage(bg, (W - sw) / 2, (H - sh) / 2, sw, sh)
        URL.revokeObjectURL(bgUrl)
      }

      // Dark semi-transparent panel
      rr(pX, pY, pW, pH, 36)
      ctx.fillStyle = 'rgba(0, 0, 0, 0.75)'
      ctx.fill()

      // Subtle border
      rr(pX, pY, pW, pH, 36)
      ctx.strokeStyle = 'rgba(255,255,255,0.12)'
      ctx.lineWidth = 2
      ctx.stroke()

      // Carrera name (top of panel)
      ctx.fillStyle = 'rgba(255,255,255,0.55)'
      ctx.font = '30px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
      ctx.textAlign = 'center'
      const nombreTrunc = (carreraNombre || '').length > 36 ? (carreraNombre || '').slice(0, 34) + '…' : (carreraNombre || '')
      ctx.fillText(nombreTrunc, W / 2, pY + 60)

      // Big time
      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 108px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(tiempoTexto, W / 2, pY + 180)

      // Label under time
      ctx.fillStyle = 'rgba(255,255,255,0.45)'
      ctx.font = '26px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
      ctx.fillText('Tiempo total', W / 2, pY + 216)

      // Divider line
      ctx.strokeStyle = 'rgba(255,255,255,0.18)'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(pX + 60, pY + 248)
      ctx.lineTo(pX + pW - 60, pY + 248)
      ctx.stroke()

      // Middle row: Distancia | Ritmo
      const distKm = parsearDistanciaKm(dist)
      const ritmo = calcularRitmo(segundos, distKm)

      const col1 = pX + pW * 0.25
      const col2 = pX + pW * 0.75

      ctx.fillStyle = '#4ade80'
      ctx.font = 'bold 52px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(dist, col1, pY + 318)
      ctx.fillStyle = 'rgba(255,255,255,0.45)'
      ctx.font = '24px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
      ctx.fillText('Distancia', col1, pY + 352)

      if (ritmo) {
        ctx.fillStyle = '#60a5fa'
        ctx.font = 'bold 52px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
        ctx.fillText(ritmo.replace(' /km', ''), col2, pY + 318)
        ctx.fillStyle = 'rgba(255,255,255,0.45)'
        ctx.font = '24px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
        ctx.fillText('Ritmo promedio', col2, pY + 352)

        // Vertical divider between cols
        ctx.strokeStyle = 'rgba(255,255,255,0.18)'
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.moveTo(W / 2, pY + 268)
        ctx.lineTo(W / 2, pY + 370)
        ctx.stroke()
      }

      // Logo large at bottom center
      try {
        const logo = new Image()
        logo.src = '/logo-flama.png'
        await new Promise((res, rej) => { logo.onload = res; logo.onerror = rej })
        const logoH = 90
        const logoW = logo.naturalWidth * (logoH / logo.naturalHeight)
        ctx.drawImage(logo, W / 2 - logoW / 2, pY + pH - logoH - 28, logoW, logoH)
      } catch {}

      // Export
      const blob = await new Promise(res => canvas.toBlob(res, 'image/png'))
      const file = new File([blob], `resultado-${dist || 'carrera'}.png`, { type: 'image/png' })
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: `Mi resultado en ${carreraNombre}` })
      } else {
        // Fallback: download
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url; a.download = file.name; a.click()
        setTimeout(() => URL.revokeObjectURL(url), 1000)
      }
    } catch (err) {
      console.error('[compartir]', err)
    } finally {
      setCompartiendo(null)
    }
  }

  // Restaurar la galería abierta tras un refresh, leyendo el id de la URL
  useEffect(() => {
    const galeriaId = searchParams.get('galeria')
    if (galeriaId && !fotosCarrera && items.length > 0) {
      const encontrada = items.find(p => p.carrera?.id === galeriaId)?.carrera
      if (encontrada) setFotosCarrera(encontrada)
    }
  }, [searchParams, items])

  useEffect(() => {
    fetchMisCarreras()
    const channel = supabase.channel('participaciones-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'participaciones' }, fetchMisCarreras)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'carreras' }, fetchMisCarreras)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [])

  async function fetchMisCarreras() {
    const hoyFetch = new Date().toISOString().split('T')[0]
    const [{ data: parts }, { data: tcs }, { data: fotosCarreras }] = await Promise.all([
      supabase.from('participaciones')
        .select('estado, distancia_elegida, feedback, feedback_nota, carrera:carreras(id, nombre, fecha, hora, distancias, distancia, link, lugar, tipo, tipo_actividad, calzado)')
        .eq('user_id', user.id)
        .neq('estado', 'Pendiente'),
      supabase.from('tiempos_carreras')
        .select('carrera_id, distancia, tiempo_texto, tiempo_segundos')
        .eq('user_id', user.id),
      supabase.from('fotos_carreras')
        .select('carrera_id, carrera:carreras(id, nombre, fecha, hora, distancias, distancia, link, lugar, tipo, tipo_actividad, calzado)'),
    ])

    // Carreras pasadas con fotos donde no tiene participación → card solo-fotos
    const carrerasConPart = new Set((parts || []).map(p => p.carrera?.id).filter(Boolean))
    const carrerasConFotos = new Map()
    ;(fotosCarreras || []).forEach(f => {
      const c = f.carrera
      if (c?.id && c.fecha < hoyFetch && !carrerasConPart.has(c.id)) carrerasConFotos.set(c.id, c)
    })
    const itemsSoloFotos = [...carrerasConFotos.values()].map(c => ({ soloFotos: true, estado: null, carrera: c }))

    const sorted = [...(parts || []), ...itemsSoloFotos].sort((a, b) => {
      if (!a.carrera?.fecha) return 1
      if (!b.carrera?.fecha) return -1
      return a.carrera.fecha.localeCompare(b.carrera.fecha)
    })
    setItems(sorted)

    const tMap = {}
    const sMap = {}
    ;(tcs || []).forEach(t => {
      const k = `${t.carrera_id}_${t.distancia}`
      tMap[k] = t.tiempo_texto
      sMap[k] = t.tiempo_segundos
    })
    setTiemposGuardados(tMap)
    setTiemposSegundos(sMap)
    setLoading(false)
  }

  async function guardarTiempo(carreraId, distancia, carreraNombre, carreraTipo, carreraFecha) {
    const key = `${carreraId}_${distancia}`
    const texto = tiempos[key]?.trim()
    if (!texto || !validarTiempo(texto)) return

    const seg = tiempoASegundos(texto)
    if (!seg) return

    const tiempoTexto = segundosATiempo(seg)
    setSavingTiempo(prev => ({ ...prev, [key]: true }))

    // Guardar en tiempos_carreras
    const { data: tc } = await supabase.from('tiempos_carreras').upsert(
      { user_id: user.id, carrera_id: carreraId, distancia, tiempo_segundos: seg, tiempo_texto: tiempoTexto },
      { onConflict: 'user_id,carrera_id,distancia' }
    ).select().single()

    // Actualizar record personal si es mejor
    const { data: rp } = await supabase.from('records_personales')
      .select('tiempo_segundos').eq('user_id', user.id).eq('distancia', distancia).single()

    const esPR = !rp || seg < rp.tiempo_segundos

    if (!rp || seg < rp.tiempo_segundos) {
      const tipo = carreraTipo === 'Trail' ? 'trail' : 'calle'
      await supabase.from('records_personales').upsert({
        user_id: user.id,
        distancia,
        tipo,
        tiempo_segundos: seg,
        tiempo_texto: tiempoTexto,
        carrera_nombre: carreraNombre,
        fecha: carreraFecha || null,
        fuente: 'automatico',
        tiempo_carrera_id: tc?.id,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,distancia' })
    }

    setTiemposGuardados(prev => ({ ...prev, [key]: tiempoTexto }))
    setEditandoTiempo(prev => { const n = {...prev}; delete n[key]; return n })
    setTiempos(prev => { const n = {...prev}; delete n[key]; return n })
    setSavingTiempo(prev => ({ ...prev, [key]: false }))
    setToast(esPR ? '🏅 ¡Felicitaciones! Tenés un nuevo PR' : '⏱ Tiempo guardado')
    setTimeout(() => setToast(''), esPR ? 3500 : 2000)
  }

  async function handleFeedback(carreraId, valor) {
    const nota = notas[carreraId] || null
    await supabase.from('participaciones')
      .update({ feedback: valor, feedback_nota: nota })
      .eq('carrera_id', carreraId)
      .eq('user_id', user.id)
    setItems(prev => prev.map(p =>
      p.carrera?.id === carreraId ? { ...p, feedback: valor, feedback_nota: nota } : p
    ))
    const mensajes = {
      excelente: '¡Vamos por más! 🔥',
      regular: '¡Gracias por el feedback! 👊',
      mal: 'Lamentamos eso. ¡La próxima será mejor! 💪',
    }
    setToast(mensajes[valor] || '')
    setTimeout(() => setToast(''), 2500)
  }

  async function handleNota(carreraId, texto) {
    setNotas(prev => ({ ...prev, [carreraId]: texto }))
    await supabase.from('participaciones')
      .update({ feedback_nota: texto })
      .eq('carrera_id', carreraId)
      .eq('user_id', user.id)
    setToast('✅ Nota guardada')
    setTimeout(() => setToast(''), 2000)
  }

  const hoy = new Date().toISOString().split('T')[0]
  const hace7dias = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  const filtradas = items.filter(p => {
    if (filtro === 'proximas' && p.carrera?.fecha && p.carrera.fecha < hoy) return false
    if (filtro === 'recientes' && p.carrera?.fecha && p.carrera.fecha < hace7dias) return false
    return true
  })

  // Calcular meses disponibles
  const mesesDisponibles = []
  const mesesVistos = new Set()
  filtradas.forEach(p => {
    const fecha = p.carrera?.fecha
    if (!fecha) return
    const d = new Date(fecha + 'T00:00:00')
    const key = `${d.getFullYear()}-${d.getMonth()}`
    if (!mesesVistos.has(key)) {
      mesesVistos.add(key)
      mesesDisponibles.push({ key, label: `${MESES[d.getMonth()].slice(0,3)} ${d.getFullYear()}` })
    }
  })

  // Filtrar por mes activo
  const porFiltroMes = mesActivo
    ? filtradas.filter(p => {
        if (!p.carrera?.fecha) return false
        const d = new Date(p.carrera.fecha + 'T00:00:00')
        return `${d.getFullYear()}-${d.getMonth()}` === mesActivo
      })
    : filtradas

  // Agrupar por mes
  const porMes = {}
  porFiltroMes.forEach(p => {
    const fecha = p.carrera?.fecha
    const key = fecha ? `${new Date(fecha + 'T00:00:00').getFullYear()}-${new Date(fecha + 'T00:00:00').getMonth()}` : 'sin-fecha'
    if (!porMes[key]) porMes[key] = { label: fecha ? `${MESES[new Date(fecha + 'T00:00:00').getMonth()]} ${new Date(fecha + 'T00:00:00').getFullYear()}` : 'Sin fecha', items: [] }
    porMes[key].items.push(p)
  })

  if (loading) return <PageLoader />

  return (
    <div className="page">
      <div className="page-header">
        <h2>Historial</h2>
      </div>

      {/* Botón filtros */}
      <div style={{ marginBottom: '12px', display: 'flex', gap: '8px', alignItems: 'center' }}>
        <button
          onClick={() => setShowFiltros(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            background: (filtro !== 'recientes' || mesActivo) ? 'rgba(255,45,45,0.12)' : 'var(--bg3)',
            border: (filtro !== 'recientes' || mesActivo) ? '1px solid rgba(255,45,45,0.4)' : '1px solid var(--border)',
            color: (filtro !== 'recientes' || mesActivo) ? 'var(--accent)' : 'var(--text2)',
            borderRadius: '8px', padding: '7px 14px', fontSize: '13px',
            cursor: 'pointer', fontFamily: 'inherit', fontWeight: (filtro !== 'recientes' || mesActivo) ? 600 : 400,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="11" y1="18" x2="13" y2="18"/></svg>
          Filtros
        </button>
        {(filtro !== 'recientes' || mesActivo) && (
          <button
            onClick={() => { setFiltroGuardado('recientes'); setMesActivoGuardado(null) }}
            style={{ background: 'none', border: 'none', color: 'var(--text2)', fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit' }}
          >
            Limpiar
          </button>
        )}
      </div>

      {showFiltros && (
        <>
          <div onClick={() => setShowFiltros(false)} style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,0.5)' }} />
          <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 70, background: 'var(--bg2)', borderTop: '1px solid var(--border)', borderRadius: '16px 16px 0 0', padding: '20px 16px 32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <span style={{ fontWeight: 700, fontSize: '15px' }}>Filtros</span>
              <button onClick={() => setShowFiltros(false)} style={{ background: 'none', border: 'none', color: 'var(--text2)', fontSize: '20px', cursor: 'pointer', lineHeight: 1 }}>✕</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div>
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>Período</div>
                <div className="filtro-group">
                  {[['recientes', 'Recientes'], ['proximas', 'Próximas'], ['todas', 'Todas']].map(([val, label]) => (
                    <button key={val} className={`filtro-btn ${filtro === val ? 'active' : ''}`} onClick={() => setFiltroGuardado(val)}>{label}</button>
                  ))}
                </div>
              </div>
              {mesesDisponibles.length > 1 && (
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>Mes</div>
                  <div className="filtro-group" style={{ flexWrap: 'wrap' }}>
                    <button className={`filtro-btn ${!mesActivo ? 'active' : ''}`} onClick={() => setMesActivoGuardado(null)}>Todos</button>
                    {mesesDisponibles.map(m => (
                      <button key={m.key} className={`filtro-btn ${mesActivo === m.key ? 'active' : ''}`} onClick={() => setMesActivoGuardado(m.key)}>{m.label}</button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <button className="btn-primary" style={{ width: '100%', marginTop: '20px', height: '44px' }} onClick={() => setShowFiltros(false)}>
              Ver {porFiltroMes.length} carrera{porFiltroMes.length !== 1 ? 's' : ''}
            </button>
          </div>
        </>
      )}

      {porFiltroMes.length === 0 && (
        <div className="empty-state">
          {filtro === 'proximas' ? 'No tenés carreras próximas marcadas' : filtro === 'recientes' ? 'No tenés carreras recientes marcadas' : 'No tenés carreras marcadas todavía'}
        </div>
      )}

      {Object.values(porMes).map(grupo => (
        <div key={grupo.label} style={{ marginBottom: '24px' }}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' }}>
            {grupo.label}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {grupo.items.map((p, i) => {
              const dias = diasRestantes(p.carrera?.fecha)
              const empezo = yaEmpezo(p.carrera?.fecha, p.carrera?.hora)
              const urgente = dias !== null && dias >= 0 && dias < 7 && !empezo
              const pasada = (dias !== null && dias < 0) || empezo

              // Card solo-fotos: etiquetado sin participación
              if (p.soloFotos) {
                return (
                  <div key={`fotos-${p.carrera.id}`} className="card" style={{ borderLeft: '3px solid #94a3b8' }}>
                    <div style={{ fontWeight: 600, fontSize: '15px', marginBottom: '4px' }}>{p.carrera?.nombre}</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
                      {p.carrera?.fecha && <span className="tag">📅 {formatFechaHora(p.carrera.fecha, p.carrera.hora)}</span>}
                    </div>
                    <button
                      onClick={() => abrirGaleria(p.carrera)}
                      style={{ width: '100%', padding: '8px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text2)', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                    >
                      📷 {labelFotos(p.carrera?.tipo_actividad)}
                    </button>
                  </div>
                )
              }

              return (
                <div key={i} className="card" style={{
                  borderLeft: `3px solid ${ESTADO_COLOR[p.estado] || '#475569'}`,
                }}>
                  {/* Alerta menos de 1 semana — solo carreras */}
                  {urgente && p.estado === 'Inscripto' && (!p.carrera?.tipo_actividad || p.carrera.tipo_actividad === 'carrera') && (
                    <div style={{
                      fontSize: '12px', color: '#fbbf24',
                      marginBottom: '8px', fontWeight: 500
                    }}>
                      ¿Estás preparadx? Ya falta poco 🏃
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: '15px', marginBottom: '4px' }}>{p.carrera?.nombre}</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {p.carrera?.fecha && (
                          <span className="tag">📅 {formatFechaHora(p.carrera.fecha, p.carrera.hora)}</span>
                        )}
                        {(!p.carrera?.tipo_actividad || p.carrera?.tipo_actividad === 'carrera') && (p.distancia_elegida || p.carrera?.distancia) && (
                          <span className="tag">📏 {p.distancia_elegida || p.carrera?.distancia}</span>
                        )}
                        {p.carrera?.lugar && <span className="tag">📍 {p.carrera.lugar}</span>}
                        {(!p.carrera?.tipo_actividad || p.carrera?.tipo_actividad === 'carrera') && p.carrera?.tipo && <span className="tag" style={{ background: p.carrera.tipo === 'Trail' ? 'rgba(251,146,60,0.15)' : 'rgba(96,165,250,0.15)', color: p.carrera.tipo === 'Trail' ? '#fb923c' : '#60a5fa', border: `1px solid ${p.carrera.tipo === 'Trail' ? 'rgba(251,146,60,0.3)' : 'rgba(96,165,250,0.3)'}`, fontWeight: 600 }}>{p.carrera.tipo}</span>}
                        {p.carrera?.tipo_actividad === 'entrenamiento' && p.carrera?.calzado && <span className="tag" style={{ background: p.carrera.calzado === 'Trail' ? 'rgba(251,146,60,0.15)' : 'rgba(96,165,250,0.15)', color: p.carrera.calzado === 'Trail' ? '#fb923c' : '#60a5fa', border: `1px solid ${p.carrera.calzado === 'Trail' ? 'rgba(251,146,60,0.3)' : 'rgba(96,165,250,0.3)'}`, fontWeight: 600 }}>👟 {p.carrera.calzado}</span>}
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px', flexShrink: 0 }}>
                      <span className="badge" style={{ background: ESTADO_COLOR[p.estado] + '22', color: ESTADO_COLOR[p.estado] }}>
                        {p.estado}
                      </span>
                      {dias !== null && (
                        <span style={{ fontSize: '11px', color: urgente ? '#fbbf24' : '#64748b', fontWeight: urgente ? 600 : 400 }}>
                          {labelDias(dias, empezo)}
                        </span>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
                    {p.carrera?.link && !pasada && (
                      <a href={p.carrera.link} target="_blank" rel="noopener noreferrer" className="race-link" style={{ display: 'inline-block' }}>
                        Inscribirme
                      </a>
                    )}
                    {p.carrera?.fecha && !pasada && p.estado === 'Inscripto' && (
                      <button
                        onClick={() => agregarAlCalendario(p.carrera.nombre, p.carrera.fecha, p.carrera.hora, p.carrera.lugar)}
                        style={{ background: 'none', border: 'none', color: 'var(--text2)', fontSize: '12px', padding: 0, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: '4px', textDecoration: 'underline', textDecorationStyle: 'dotted' }}
                      >
                        📅 Agregar al calendario
                      </button>
                    )}
                  </div>

                  {pasada && p.estado === 'Inscripto' && (!p.carrera?.tipo_actividad || p.carrera?.tipo_actividad === 'carrera') && (
                    <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--border)' }}>
                      <div style={{ fontSize: '12px', color: 'var(--text2)', marginBottom: '8px' }}>
                        ¿Cómo estuvo la carrera?
                      </div>
                      <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                                                {[['excelente','😍'],['regular','😐'],['mal','😞']].map(([val, emoji]) => (
                          <button
                            key={val}
                            onClick={() => handleFeedback(p.carrera.id, val)}
                            style={{
                              fontSize: '22px', border: 'none', cursor: 'pointer',
                              padding: '4px 8px', borderRadius: '8px', lineHeight: 1,
                              background: p.feedback === val ? 'rgba(255,255,255,0.12)' : 'transparent',
                              transform: p.feedback === val ? 'scale(1.25)' : 'scale(1)',
                              transition: 'all .15s',
                            }}
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                      {p.feedback === 'mal' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <textarea
                            placeholder="¿Qué pasó? (opcional)"
                            value={notas[p.carrera.id] ?? (p.feedback_nota || '')}
                            onChange={e => setNotas(prev => ({ ...prev, [p.carrera.id]: e.target.value }))}
                            style={{
                              width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)',
                              borderRadius: '8px', color: 'var(--text)', padding: '8px 12px',
                              fontSize: '13px', resize: 'none', minHeight: '60px',
                              fontFamily: 'inherit',
                            }}
                          />
                          <button
                            className="btn-primary"
                            style={{ height: 32, fontSize: 12, padding: '0 14px', alignSelf: 'flex-end' }}
                            onClick={() => handleNota(p.carrera.id, notas[p.carrera.id] || '')}
                          >
                            Guardar
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Fotos */}
                  {pasada && (
                    <button
                      onClick={() => abrirGaleria(p.carrera)}
                      style={{ marginTop: '10px', width: '100%', padding: '8px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text2)', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                    >
                      📷 {labelFotos(p.carrera?.tipo_actividad)}
                    </button>
                  )}

                  {/* Tiempo de carrera — solo para carreras */}
                  {pasada && p.estado === 'Inscripto' && (!p.carrera?.tipo_actividad || p.carrera?.tipo_actividad === 'carrera') && (() => {
                    const dist = p.distancia_elegida || p.carrera?.distancia
                    if (!dist) return null
                    const key = `${p.carrera.id}_${dist}`
                    const guardado = tiemposGuardados[key]
                    const saving = savingTiempo[key]
                    return (
                      <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--border)' }}>
                        <div style={{ fontSize: '12px', color: 'var(--text2)', marginBottom: '6px' }}>
                          ⏱ ¿En cuánto hiciste los {dist}?
                        </div>
                        {guardado && !editandoTiempo[key] ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '15px', fontWeight: 700, color: '#4ade80' }}>{guardado}</span>
                            <button
                              onClick={() => setEditandoTiempo(prev => ({ ...prev, [key]: true }))}
                              style={{ fontSize: '11px', color: 'var(--text2)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                            >
                              Editar
                            </button>
                            <button
                              onClick={() => compartirResultado({
                                carreraNombre: p.carrera?.nombre,
                                dist,
                                tiempoTexto: guardado,
                                segundos: tiemposSegundos[key],
                                key,
                              })}
                              disabled={compartiendo === key}
                              style={{ fontSize: '11px', color: '#60a5fa', background: 'none', border: 'none', cursor: 'pointer', padding: 0, opacity: compartiendo === key ? 0.5 : 1 }}
                            >
                              {compartiendo === key ? '⏳' : '🏅 Compartir'}
                            </button>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                            <input
                              value={tiempos[key] || ''}
                              onChange={e => setTiempos(prev => ({ ...prev, [key]: autoformatTiempo(e.target.value) }))}
                              placeholder="HH:MM:SS"
                              inputMode="numeric"
                              style={{
                                width: '140px', background: 'var(--bg3)', border: '1px solid var(--border)',
                                borderRadius: '8px', color: 'var(--text)', padding: '6px 10px',
                                fontSize: '14px', fontFamily: 'inherit',
                              }}
                            />
                            <button
                              className="btn-primary"
                              style={{ height: 32, fontSize: 12, padding: '0 14px' }}
                              disabled={saving || !validarTiempo(tiempos[key] || '')}
                              onClick={() => guardarTiempo(p.carrera.id, dist, p.carrera.nombre, p.carrera.tipo, p.carrera.fecha)}
                            >
                              {saving ? '...' : 'Guardar'}
                            </button>
                            {guardado && (
                              <button
                                className="btn-ghost"
                                style={{ height: 32, fontSize: 12, padding: '0 12px' }}
                                onClick={() => {
                                  setEditandoTiempo(prev => { const n = {...prev}; delete n[key]; return n })
                                  setTiempos(prev => { const n = {...prev}; delete n[key]; return n })
                                }}
                              >
                                Cancelar
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })()}
                </div>
              )
            })}
          </div>
        </div>
      ))}

      {fotosCarrera && (
        <FotosModal
          carrera={fotosCarrera}
          onClose={cerrarGaleria}
        />
      )}

      {toast && (
        <div style={{
          position: 'fixed', bottom: '80px', left: '50%', transform: 'translateX(-50%)',
          background: '#1f1f1f', border: '1px solid rgba(255,255,255,0.12)',
          color: '#f1f5f9', padding: '10px 18px', borderRadius: '10px',
          fontSize: '13px', fontWeight: 500, zIndex: 999,
          boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
          animation: 'fadeIn .2s ease', whiteSpace: 'nowrap',
        }}>
          {toast}
        </div>
      )}
    </div>
  )
}
