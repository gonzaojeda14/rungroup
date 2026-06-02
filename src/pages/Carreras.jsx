import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'

const EMPTY = { nombre: '', fecha: '', distancia: '', lugar: '', link: '', codigo: '' }

export default function Carreras() {
  const { isAdmin, user } = useAuth()
  const [carreras, setCarreras] = useState([])
  const [participaciones, setParticipaciones] = useState([])
  const [form, setForm] = useState(EMPTY)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    const [{ data: cars }, { data: parts }] = await Promise.all([
      supabase.from('carreras').select('*').order('fecha', { ascending: true }),
      supabase.from('participaciones').select('carrera_id, estado').eq('user_id', user.id)
    ])
    setCarreras(cars || [])
    setParticipaciones(parts || [])
    setLoading(false)
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    const { error } = await supabase.from('carreras').insert([form])
    if (!error) {
      setForm(EMPTY)
      setShowForm(false)
      fetchAll()
    }
    setSaving(false)
  }

  async function handleDelete(id) {
    if (!confirm('¿Eliminar esta carrera?')) return
    await supabase.from('carreras').delete().eq('id', id)
    fetchAll()
  }

  async function updateEstado(carreraId, estado) {
    await supabase.from('participaciones')
      .update({ estado })
      .eq('carrera_id', carreraId)
      .eq('user_id', user.id)
    setParticipaciones(prev =>
      prev.map(p => p.carrera_id === carreraId ? { ...p, estado } : p)
    )
  }

  const ESTADOS = ['Inscripto', 'No voy', 'Tal vez', 'Lista de espera']
  const ESTADO_COLOR = {
    'Inscripto': '#4ade80',
    'No voy': '#f87171',
    'Tal vez': '#fbbf24',
    'Lista de espera': '#60a5fa',
    'Pendiente': '#64748b',
  }

  if (loading) return <div className="page-loading">Cargando...</div>

  return (
    <div className="page">
      <div className="page-header">
        <h2>Carreras</h2>
        {isAdmin && (
          <button className="btn-accent" onClick={() => setShowForm(v => !v)}>
            {showForm ? 'Cancelar' : '+ Nueva'}
          </button>
        )}
      </div>

      {isAdmin && showForm && (
        <form className="card form-card" onSubmit={handleSave}>
          <div className="form-grid">
            <div className="field">
              <label>Nombre *</label>
              <input value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} placeholder="21K Buenos Aires" required />
            </div>
            <div className="field">
              <label>Fecha</label>
              <input type="date" value={form.fecha} onChange={e => setForm({ ...form, fecha: e.target.value })} />
            </div>
            <div className="field">
              <label>Distancia</label>
              <input value={form.distancia} onChange={e => setForm({ ...form, distancia: e.target.value })} placeholder="21K" />
            </div>
            <div className="field">
              <label>Lugar</label>
              <input value={form.lugar} onChange={e => setForm({ ...form, lugar: e.target.value })} placeholder="Parque Tres de Febrero" />
            </div>
            <div className="field">
              <label>Código de descuento</label>
              <input value={form.codigo} onChange={e => setForm({ ...form, codigo: e.target.value })} placeholder="RUN20" />
            </div>
            <div className="field full">
              <label>Link de inscripción</label>
              <input value={form.link} onChange={e => setForm({ ...form, link: e.target.value })} placeholder="https://..." />
            </div>
          </div>
          <div className="form-actions">
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Guardando...' : 'Guardar carrera'}
            </button>
          </div>
        </form>
      )}

      {carreras.length === 0 && (
        <div className="empty-state">No hay carreras cargadas todavía</div>
      )}

      <div className="cards-list">
        {carreras.map(c => {
          const part = participaciones.find(p => p.carrera_id === c.id)
          const estado = part?.estado || 'Pendiente'
          return (
            <div key={c.id} className="card race-card">
              <div className="race-card-top">
                <div>
                  <h3>{c.nombre}</h3>
                  <div className="race-meta">
                    {c.fecha && <span className="tag">📅 {c.fecha}</span>}
                    {c.distancia && <span className="tag">📏 {c.distancia}</span>}
                    {c.lugar && <span className="tag">📍 {c.lugar}</span>}
                    {c.codigo && <span className="tag code-tag">🎟 {c.codigo}</span>}
                  </div>
                </div>
                {isAdmin && (
                  <button className="btn-icon danger" onClick={() => handleDelete(c.id)}>✕</button>
                )}
              </div>
              {c.link && (
                <a href={c.link} target="_blank" rel="noopener noreferrer" className="race-link">
                  Ver inscripción →
                </a>
              )}
              <div className="race-estado-section">
                <div className="race-estado-label">
                  Mi estado: <span style={{ color: ESTADO_COLOR[estado], fontWeight: 600 }}>{estado}</span>
                </div>
                <div className="estado-buttons">
                  {ESTADOS.map(e => (
                    <button
                      key={e}
                      className={`estado-btn ${estado === e ? 'active badge ' + e.toLowerCase().replace(/ /g, '-') : ''}`}
                      style={estado === e ? { borderColor: ESTADO_COLOR[e], color: ESTADO_COLOR[e], background: ESTADO_COLOR[e] + '22' } : {}}
                      onClick={() => updateEstado(c.id, e)}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
