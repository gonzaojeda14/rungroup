import PageLoader from '../components/PageLoader'
import FotosModal from '../components/FotosModal'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { formatFechaHora, agregarAlCalendario } from '../lib/utils'

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

function diasRestantes(fecha) {
  if (!fecha) return null
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const carrera = new Date(fecha + 'T00:00:00')
  return Math.ceil((carrera - hoy) / (1000 * 60 * 60 * 24))
}

function labelDias(dias) {
  if (dias < 0) return 'Finalizada'
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
  const [filtro, setFiltro] = useState(() => localStorage.getItem('agenda_filtro') || 'proximas')
  const [mesActivo, setMesActivo] = useState(() => localStorage.getItem('agenda_mes') || null)

  function setFiltroGuardado(val) { setFiltro(val); localStorage.setItem('agenda_filtro', val) }
  function setMesActivoGuardado(val) { setMesActivo(val); val ? localStorage.setItem('agenda_mes', val) : localStorage.removeItem('agenda_mes') }
  const [toast, setToast] = useState('')
  const [notas, setNotas] = useState({}) // { carreraId: texto }
  const [tiempos, setTiempos] = useState({}) // { carreraId_distancia: texto }
  const [tiemposGuardados, setTiemposGuardados] = useState({}) // { carreraId_distancia: tiempo_texto }
  const [editandoTiempo, setEditandoTiempo] = useState({}) // { key: true } cuando está en modo edición
  const [savingTiempo, setSavingTiempo] = useState({})
  const [fotosCarrera, setFotosCarrera] = useState(null)

  useEffect(() => {
    fetchMisCarreras()
    const channel = supabase.channel('participaciones-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'participaciones' }, fetchMisCarreras)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'carreras' }, fetchMisCarreras)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [])

  async function fetchMisCarreras() {
    const [{ data: parts }, { data: tcs }] = await Promise.all([
      supabase.from('participaciones')
        .select('estado, distancia_elegida, feedback, feedback_nota, carrera:carreras(id, nombre, fecha, hora, distancias, distancia, link, lugar, tipo)')
        .eq('user_id', user.id)
        .neq('estado', 'Pendiente'),
      supabase.from('tiempos_carreras')
        .select('carrera_id, distancia, tiempo_texto')
        .eq('user_id', user.id)
    ])

    const sorted = (parts || []).sort((a, b) => {
      if (!a.carrera?.fecha) return 1
      if (!b.carrera?.fecha) return -1
      return a.carrera.fecha.localeCompare(b.carrera.fecha)
    })
    setItems(sorted)

    const tMap = {}
    ;(tcs || []).forEach(t => { tMap[`${t.carrera_id}_${t.distancia}`] = t.tiempo_texto })
    setTiemposGuardados(tMap)
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

    const esPR = rp && seg < rp.tiempo_segundos

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

  const filtradas = items.filter(p => {
    if (filtro === 'proximas' && p.carrera?.fecha && p.carrera.fecha < hoy) return false
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
        <div className="filtro-group">
          {[['proximas', 'Próximas'], ['todas', 'Todas']].map(([val, label]) => (
            <button key={val} className={`filtro-btn ${filtro === val ? 'active' : ''}`} onClick={() => setFiltroGuardado(val)}>{label}</button>
          ))}
        </div>
      </div>

      {mesesDisponibles.length > 1 && (
        <div className="filtros-bar" style={{ marginBottom: '12px' }}>
          <div className="filtro-group">
            <button className={`filtro-btn ${!mesActivo ? 'active' : ''}`} onClick={() => setMesActivoGuardado(null)}>Todos</button>
            {mesesDisponibles.map(m => (
              <button key={m.key} className={`filtro-btn ${mesActivo === m.key ? 'active' : ''}`} onClick={() => setMesActivoGuardado(m.key)}>{m.label}</button>
            ))}
          </div>
        </div>
      )}

      {porFiltroMes.length === 0 && (
        <div className="empty-state">
          {filtro === 'proximas' ? 'No tenés carreras próximas marcadas' : 'No tenés carreras marcadas todavía'}
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
              const urgente = dias !== null && dias >= 0 && dias < 7
              const pasada = dias !== null && dias < 0

              return (
                <div key={i} className="card" style={{
                  borderLeft: `3px solid ${ESTADO_COLOR[p.estado] || '#475569'}`,
                }}>
                  {/* Alerta menos de 1 semana */}
                  {urgente && p.estado === 'Inscripto' && (
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
                        {(p.distancia_elegida || p.carrera?.distancia) && (
                          <span className="tag">📏 {p.distancia_elegida || p.carrera?.distancia}</span>
                        )}
                        {p.carrera?.lugar && <span className="tag">📍 {p.carrera.lugar}</span>}
                        {p.carrera?.tipo && <span className="tag" style={{ background: p.carrera.tipo === 'Trail' ? 'rgba(251,146,60,0.15)' : 'rgba(96,165,250,0.15)', color: p.carrera.tipo === 'Trail' ? '#fb923c' : '#60a5fa', border: `1px solid ${p.carrera.tipo === 'Trail' ? 'rgba(251,146,60,0.3)' : 'rgba(96,165,250,0.3)'}`, fontWeight: 600 }}>{p.carrera.tipo}</span>}
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px', flexShrink: 0 }}>
                      <span className="badge" style={{ background: ESTADO_COLOR[p.estado] + '22', color: ESTADO_COLOR[p.estado] }}>
                        {p.estado}
                      </span>
                      {dias !== null && (
                        <span style={{ fontSize: '11px', color: urgente ? '#fbbf24' : '#64748b', fontWeight: urgente ? 600 : 400 }}>
                          {labelDias(dias)}
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

                  {pasada && p.estado === 'Inscripto' && (
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
                      onClick={() => setFotosCarrera(p.carrera)}
                      style={{ marginTop: '10px', width: '100%', padding: '8px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text2)', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                    >
                      📷 Fotos de la carrera
                    </button>
                  )}

                  {/* Tiempo de carrera */}
                  {pasada && p.estado === 'Inscripto' && (() => {
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
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '15px', fontWeight: 700, color: '#4ade80' }}>{guardado}</span>
                            <button
                              onClick={() => setEditandoTiempo(prev => ({ ...prev, [key]: true }))}
                              style={{ fontSize: '11px', color: 'var(--text2)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                            >
                              Editar
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
          onClose={() => setFotosCarrera(null)}
          onToast={msg => { setToast(msg); setTimeout(() => setToast(''), 2500) }}
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