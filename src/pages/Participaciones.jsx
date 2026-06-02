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
  const [filtro, setFiltro] = useState('proximas') // proximas | todas

  useEffect(() => { fetchMisCarreras() }, [])

  async function fetchMisCarreras() {
    const { data: parts } = await supabase
      .from('participaciones')
      .select('estado, distancia_elegida, carrera:carreras(id, nombre, fecha, hora, distancias, distancia, link, lugar, tipo)')
      .eq('user_id', user.id)
      .neq('estado', 'Pendiente')
      .order('carreras(fecha)', { ascending: true })

    setItems(parts || [])
    setLoading(false)
  }

  const hoy = new Date().toISOString().split('T')[0]

  const filtradas = items.filter(p => {
    if (filtro === 'proximas') return !p.carrera?.fecha || p.carrera.fecha >= hoy
    return true
  })

  // Agrupar por mes
  const porMes = {}
  filtradas.forEach(p => {
    const fecha = p.carrera?.fecha
    const key = fecha ? `${new Date(fecha + 'T00:00:00').getFullYear()}-${new Date(fecha + 'T00:00:00').getMonth()}` : 'sin-fecha'
    if (!porMes[key]) porMes[key] = { label: fecha ? `${MESES[new Date(fecha + 'T00:00:00').getMonth()]} ${new Date(fecha + 'T00:00:00').getFullYear()}` : 'Sin fecha', items: [] }
    porMes[key].items.push(p)
  })

  if (loading) return <div className="page-loading">Cargando...</div>

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

      {filtradas.length === 0 && (
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
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
