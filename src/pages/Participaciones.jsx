import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'

const ESTADOS = ['Inscripto', 'No voy', 'Tal vez', 'Lista de espera', 'Pendiente']

const ESTADO_STYLE = {
  'Inscripto': 'badge green',
  'No voy': 'badge red',
  'Tal vez': 'badge amber',
  'Lista de espera': 'badge blue',
  'Pendiente': 'badge gray',
}

export default function Participaciones() {
  const { user, isAdmin, profile } = useAuth()
  const [carreras, setCarreras] = useState([])
  const [carreraId, setCarreraId] = useState('')
  const [participaciones, setParticipaciones] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchCarreras()
  }, [])

  useEffect(() => {
    if (carreraId) fetchParticipaciones()
  }, [carreraId])

  async function fetchCarreras() {
    const { data } = await supabase.from('carreras').select('id, nombre, fecha').order('fecha')
    setCarreras(data || [])
    if (data?.length) setCarreraId(data[0].id)
    setLoading(false)
  }

  async function fetchParticipaciones() {
    let query = supabase
      .from('participaciones')
      .select('*, profiles(nombre)')
      .eq('carrera_id', carreraId)
      .order('profiles(nombre)')

    // Si no es admin, solo ve la propia
    if (!isAdmin) {
      query = query.eq('user_id', user.id)
    }

    const { data } = await query
    setParticipaciones(data || [])
  }

  async function updateEstado(id, estado) {
    await supabase.from('participaciones').update({ estado }).eq('id', id)
    setParticipaciones(prev => prev.map(p => p.id === id ? { ...p, estado } : p))
  }

  if (loading) return <div className="page-loading">Cargando...</div>

  return (
    <div className="page">
      <div className="page-header">
        <h2>Participaciones</h2>
      </div>

      {carreras.length === 0 && (
        <div className="empty-state">No hay carreras cargadas todavía</div>
      )}

      {carreras.length > 0 && (
        <>
          <div className="field" style={{ marginBottom: '1rem' }}>
            <label>Carrera</label>
            <select value={carreraId} onChange={e => setCarreraId(e.target.value)}>
              {carreras.map(c => (
                <option key={c.id} value={c.id}>{c.nombre}{c.fecha ? ` — ${c.fecha}` : ''}</option>
              ))}
            </select>
          </div>

          {participaciones.length === 0 && (
            <div className="empty-state">Sin registros para esta carrera</div>
          )}

          <div className="part-list">
            {participaciones.map(p => {
              const canEdit = isAdmin || p.user_id === user.id
              return (
                <div key={p.id} className="card part-card">
                  <div className="part-name">{p.profiles?.nombre || '—'}</div>
                  {canEdit ? (
                    <div className="estado-buttons">
                      {ESTADOS.map(e => (
                        <button
                          key={e}
                          className={`estado-btn ${p.estado === e ? 'active ' + ESTADO_STYLE[e] : ''}`}
                          onClick={() => updateEstado(p.id, e)}
                        >
                          {e}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <span className={ESTADO_STYLE[p.estado] || 'badge gray'}>{p.estado}</span>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
