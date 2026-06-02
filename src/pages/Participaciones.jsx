import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { formatFecha } from '../lib/utils'

const ESTADO_COLOR = {
  'Inscripto': '#ff2d2d',
  'No voy': '#64748b',
  'Tal vez': '#fbbf24',
  'Pendiente': '#334155',
}

export default function Participaciones() {
  const { user, isAdmin } = useAuth()
  const [carreras, setCarreras] = useState([])
  const [carreraId, setCarreraId] = useState('')
  const [participaciones, setParticipaciones] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingParts, setLoadingParts] = useState(false)

  useEffect(() => { fetchCarreras() }, [])
  useEffect(() => { if (carreraId) fetchParticipaciones() }, [carreraId])

  async function fetchCarreras() {
    const { data } = await supabase.from('carreras').select('id, nombre, fecha').order('fecha')
    setCarreras(data || [])
    if (data?.length) setCarreraId(data[0].id)
    setLoading(false)
  }

  async function fetchParticipaciones() {
    setLoadingParts(true)
    const { data } = await supabase
      .from('participaciones')
      .select('*, profiles(nombre)')
      .eq('carrera_id', carreraId)
      .order('profiles(nombre)')
    setParticipaciones(data || [])
    setLoadingParts(false)
  }

  const counts = participaciones.reduce((acc, p) => {
    acc[p.estado] = (acc[p.estado] || 0) + 1
    return acc
  }, {})

  const inscriptos = participaciones.filter(p => p.estado === 'Inscripto')
  const talvez = participaciones.filter(p => p.estado === 'Tal vez')
  const noVan = participaciones.filter(p => p.estado === 'No voy')
  const pendientes = participaciones.filter(p => p.estado === 'Pendiente')

  if (loading) return <div className="page-loading">Cargando...</div>

  return (
    <div className="page">
      <div className="page-header">
        <h2>Mis carreras</h2>
      </div>

      {carreras.length === 0 && (
        <div className="empty-state">No hay carreras cargadas todavía</div>
      )}

      {carreras.length > 0 && (
        <>
          <div className="field" style={{ marginBottom: '1.25rem' }}>
            <label>Carrera</label>
            <select value={carreraId} onChange={e => setCarreraId(e.target.value)}>
              {carreras.map(c => (
                <option key={c.id} value={c.id}>{c.nombre}{c.fecha ? ` — ${formatFecha(c.fecha)}` : ''}</option>
              ))}
            </select>
          </div>

          {loadingParts ? (
            <div className="page-loading">Cargando...</div>
          ) : (
            <>
              {participaciones.length > 0 && (
                <div className="card" style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                  {[['Inscripto', '#ff2d2d'], ['Tal vez', '#fbbf24'], ['No voy', '#64748b'], ['Pendiente', '#334155']].map(([e, color]) =>
                    counts[e] ? (
                      <div key={e} style={{ textAlign: 'center', flex: 1 }}>
                        <div style={{ fontSize: '1.5rem', fontWeight: 700, color }}>{counts[e]}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{e}</div>
                      </div>
                    ) : null
                  )}
                </div>
              )}

              {participaciones.length === 0 && (
                <div className="empty-state">Sin registros para esta carrera</div>
              )}

              {inscriptos.length > 0 && <Section title="Inscriptos" color="#ff2d2d" items={inscriptos} />}
              {talvez.length > 0 && <Section title="Tal vez" color="#fbbf24" items={talvez} />}
              {noVan.length > 0 && <Section title="No van" color="#64748b" items={noVan} />}
              {pendientes.length > 0 && <Section title="Sin respuesta" color="#475569" items={pendientes} />}
            </>
          )}
        </>
      )}
    </div>
  )
}

function Section({ title, color, items }) {
  return (
    <div style={{ marginBottom: '1rem' }}>
      <div style={{ fontSize: '12px', fontWeight: 600, color, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: color }} />
        {title} ({items.length})
      </div>
      <div className="part-list">
        {items.map(p => (
          <div key={p.id} className="card part-card" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: color + '22', border: '1.5px solid ' + color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color, fontSize: '14px', flexShrink: 0 }}>
              {(p.profiles?.nombre || '?')[0].toUpperCase()}
            </div>
            <div className="part-name">{p.profiles?.nombre || '—'}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
