import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'

const EMPTY = { nombre: '', fecha: '', distancia: '', lugar: '', link: '', codigo: '' }
const ESTADOS = ['Inscripto', 'No voy', 'Tal vez']
const ESTADO_COLOR = {
  'Inscripto': '#4ade80',
  'No voy': '#f87171',
  'Tal vez': '#fbbf24',
  'Pendiente': '#64748b',
}

export default function Carreras() {
  const { isAdmin, user } = useAuth()
  const [carreras, setCarreras] = useState([])
  const [participaciones, setParticipaciones] = useState([])
  const [form, setForm] = useState(EMPTY)
  const [editId, setEditId] = useState(null)
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
    if (editId) {
      await supabase.from('carreras').update(form).eq('id', editId)
    } else {
      await supabase.from('carreras').insert([form])
    }
    setForm(EMPTY)
    setEditId(null)
    setShowForm(false)
    fetchAll()
    setSaving(false)
  }

  function handleEdit(c) {
    setForm({ nombre: c.nombre, fecha: c.fecha || '', distancia: c.distancia || '', lugar: c.lugar || '', link: c.link || '', codigo: c.codigo || '' })
    setEditId(c.id)
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function handleCancelForm() {
    setForm(EMPTY)
    setEditId(null)
    setShowForm(false)
  }

  async function handleDelete(id) {
    if (!confirm('¿Eliminar esta carrera?')) return
    await supabase.from('carreras').delete().eq('id', id)
    fetchAll()
  }

  async function updateEstado(carreraId, estado) {
    await supabase.from('participaciones')
      .upsert({ carrera_id: carreraId, user_id: user.id, estado }, { onConflict: 'carrera_id,user_id' })
    setParticipaciones(prev => {
      const exists = prev.find(p => p.carrera_id === carreraId)
      if (exists) return prev.map(p => p.carrera_id === carreraId ? { ...p, estado } : p)
      return [...prev, { carrera_id: carreraId, estado }]
    })
  }

  if (loading) return <div className="page-loading">Cargando...</div>

  return (
    <div className="page">
      <div className="page-header">
        <h2>Carreras</h2>
        {isAdmin && (
          <button className="btn-accent" onClick={() => { if (showForm) handleCancelForm(); else setShowForm(true) }}>
            {showForm ? 'Cancelar' : '+ Nueva'}
          </button>
        )}
      </div>

      {isAdmin && showForm && (
        <form className="card form-card" onSubmit={handleSave}>
          <h3 style={{ marginBottom: '0.75rem', fontSize: '14px', fontWeight: 600 }}>
            {editId ? 'Editar carrera' : 'Nueva carrera'}
          </h3>
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
              <input value={form.codigo} onChange={e => setForm({ ...form, codigo: e.target.value })} placeholder="FLAMA20" />
            </div>
            <div className="field full">
              <label>Link de inscripción</label>
              <input value={form.link} onChange={e => setForm({ ...form, link: e.target.value })} placeholder="https://..." />
            </div>
          </div>
          <div className="form-actions">
            <button type="button" className="btn-ghost" onClick={handleCancelForm}>Cancelar</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Guardando...' : editId ? 'Guardar cambios' : 'Crear carrera'}
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
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="btn-icon" onClick={() => handleEdit(c)} title="Editar">✏️</button>
                    <button className="btn-icon danger" onClick={() => handleDelete(c.id)} title="Eliminar">✕</button>
                  </div>
                )}
    