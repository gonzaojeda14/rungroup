import PageLoader from '../components/PageLoader'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { formatFechaHora } from '../lib/utils'

const ESTADO_COLOR = {
  'Inscripto': '#4ade80',
  'Tal vez': '#fbbf24',
  'Lista de espera': '#60a5fa',
  'No voy': '#f87171',
  'Pendiente': '#475569',
}

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

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
  const [filtro, setFiltro] = useState('proximas')
  const [mesActivo, setMesActivo] = useState(null)
  const [toast, setToast] = useState('')
  const [notas, setNotas] = useState({}) // { carreraId: texto }

  useEffect(() => { fetchMisCarreras() }, [])

  async function fetchMisCarreras() {
    const { data: parts } = await supabase
      .from('participaciones')
      .select('estado, distancia_elegida, feedback, feedback_nota, carrera:carreras(id, nombre, fecha, hora, distancias, distancia, link, lugar, tipo)')
      .eq('user_id', user.id)
      .neq('estado', 'Pendiente')

    const sorted = (parts || []).sort((a, b) => {
      if (!a.carrera?.fecha) return 1
      if (!b.carrera?.fecha) return -1
      return a.carrera.fecha.localeCompare(b.carrera.fecha)
    })
    setItems(sorted)
    setLoading(false)
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
    if (valor === 'excelente') {
      setToast('¡Vamos por más! 🔥')
      setTimeout(() => setToast(''), 2500)
    }
  }

  async function handleNota(carreraId, texto) {
    setNotas(prev => ({ ...prev, [carreraId]: texto }))
    await supabase.from('participaciones')
      .update({ feedback_nota: texto })
      .eq('carrera_id', carreraId)
      .eq('user_id', user.id)
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
        <h2>Mis carreras</h2>
        <div className="filtro-group">
          {[['proximas', 'Próximas'], ['todas', 'Todas']].map(([val, label]) => (
            <button key={val} className={`filtro-btn ${filtro === val ? 'active' : ''}`} onClick={() => setFiltro(val)}>{label}</button>
          ))}
        </div>
      </div>

      {mesesDisponibles.length > 1 && (
        <div className="filtros-bar" style={{ marginBottom: '12px' }}>
          <div className="filtro-group">
            <button className={`filtro-btn ${!mesActivo ? 'active' : ''}`} onClick={() => setMesActivo(null)}>Todos</button>
            {mesesDisponibles.map(m => (
              <button key={m.key} className={`filtro-btn ${mesActivo === m.key ? 'active' : ''}`} onClick={() => setMesActivo(m.key)}>{m.label}</button>
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
          <div style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' }}>
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
                  opacity: pasada ? 0.5 : 1,
                }}>
                  {/* Alerta menos de 1 semana */}
                  {urgente && p.estado === 'Inscripto' && (
                    <div style={{
                      fontSize: '12px', color: '#fbbf24',
                      marginBottom: '8px', fontWeight: 500
                    }}>
                      ¿Estás preparado? Ya falta poco 🏃
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

                  {p.carrera?.link && !pasada && (
                    <a href={p.carrera.link} target="_blank" rel="noopener noreferrer" className="race-link" style={{ marginTop: '8px', display: 'inline-block' }}>
                      Ver inscripción →
                    </a>
                  )}

                  {pasada && p.estado === 'Inscripto' && (
                    <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--border)' }}>
                      <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '8px' }}>
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
                      {(p.feedback === 'mal' || p.feedback === 'regular') && (
                        <textarea
                          placeholder="¿Qué pasó? (opcional)"
                          defaultValue={p.feedback_nota || ''}
                          onBlur={e => handleNota(p.carrera.id, e.target.value)}
                          style={{
                            width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)',
                            borderRadius: '8px', color: 'var(--text)', padding: '8px 12px',
                            fontSize: '13px', resize: 'none', minHeight: '60px',
                            fontFamily: 'inherit',
                          }}
                        />
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}

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
