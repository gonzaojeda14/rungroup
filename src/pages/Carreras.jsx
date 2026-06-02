import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'

const EMPTY = { nombre: '', fecha: '', distancia: '', link: '', codigo: '' }

export default function Carreras() {
  const { isAdmin } = useAuth()
  const [carreras, setCarreras] = useState([])
  const [form, setForm] = useState(EMPTY)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)

  useEffect(() => { fetchCarreras() }, [])

  async function fetchCarreras() {
    const { data } = await supabase.from('carreras').select('*').order('fecha', { ascending: true })
    setCarreras(data || [])
    setLoading(false)
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    const { error } = await supabase.from('carreras').insert([form])
    if (!error) {
      setForm(EMPTY)
      setShowForm(false)
      fetchCarreras()
      // autocreate participaciones for all corredores
      await supabase.rpc('crear_participaciones_para_carrera', { carrera_nombre: form.nombre })
    }
    setSaving(false)
  }

  async function handleDelete(id) {
    if (!confirm('¿Eliminar esta carrera?')) return
    await supabase.from('carreras').delete().eq('id', id)
    fetchCarreras()
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
        {carreras.map(c => (
          <div key={c.id} className="card race-card">
            <div className="race-card-top">
              <div>
                <h3>{c.nombre}</h3>
                <div className="race-meta">
                  {c.fecha && <span className="tag">📅 {c.fecha}</span>}
                  {c.distancia && <span className="tag">📏 {c.distancia}</span>}
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
          </div>
        ))}
      </div>
    </div>
  )
}
