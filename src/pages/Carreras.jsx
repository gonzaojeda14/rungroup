import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'

const EMPTY = { nombre: '', fecha: '', distancias: '', lugar: '', link: '', codigo: '', tipo: '' }
const ESTADOS = ['Inscripto', 'No voy', 'Tal vez']
const ESTADO_COLOR = {
  'Inscripto': '#4ade80',
  'No voy': '#f87171',
  'Tal vez': '#fbbf24',
  'Pendiente': '#64748b',
}
const TIPO_COLOR = {
  'Trail': '#fb923c',
  'Calle': '#60a5fa',
}
const today = new Date().toISOString().split('T')[0]

export default function Carreras() {
  const { isAdmin, user } = useAuth()
  const [carreras, setCarreras] = useState([])
  const [participaciones, setParticipaciones] = useState([])
  const [distanciasSeleccionadas, setDistanciasSeleccionadas] = useState({})
  const [form, setForm] = useState(EMPTY)
  const [editId, setEditId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [filtros, setFiltros] = useState({ tipo: '', distancia: '', fecha: 'proximas' })
  const formRef = useRef(null)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    const [{ data: cars }, { data: parts }] = await Promise.all([
      supabase.from('carreras').select('*').order('fecha', { ascending: true }),
      supabase.from('participaciones').select('carrera_id, estado, distancia_elegida').eq('user_id', user.id)
    ])
    setCarreras(cars || [])
    setParticipaciones(parts || [])
    const distMap = {}
    parts?.forEach(p => { if (p.distancia_elegida) distMap[p.carrera_id] = p.distancia_elegida })
    setDistanciasSeleccionadas(distMap)
    setLoading(false)
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    const distanciasArr = form.distancias
      ? form.distancias.split(',').map(d => d.trim()).filter(Boolean)
      : []
    const payload = {
      nombre: form.nombre,
      fecha: form.fecha || null,
      lugar: form.lugar || null,
      link: form.link || null,
      codigo: form.codigo || null,
      tipo: form.tipo || null,
      distancias: distanciasArr,
      distancia: distanciasArr[0] || null,
    }
    if (editId) {
      await supabase.from('carreras').update(payload).eq('id', editId)
    } else {
      await supabase.from('carreras').insert([payload])
    }
    setForm(EMPTY)
    setEditId(null)
    setShowForm(false)
    fetchAll()
    setSaving(false)
  }

  function handleEdit(c) {
    setForm({
      nombre: c.nombre,
      fecha: c.fecha || '',
      distancias: c.distancias?.length ? c.distancias.join(', ') : (c.distancia || ''),
      lugar: c.lugar || '',
      link: c.link || '',
      codigo: c.codigo || '',
      tipo: c.tipo || '',
    })
    setEditId(c.id)
    setShowForm(true)
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
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

  async function updateDistancia(carreraId, distancia) {
    setDistanciasSeleccionadas(prev => ({ ...prev, [carreraId]: distancia }))
    const part = participaciones.find(p => p.carrera_id === carreraId)
    if (part) {
      await supabase.from('participaciones')
        .upsert(
          { carrera_id: carreraId, user_id: user.id, estado: part.estado, distancia_elegida: distancia },
          { onConflict: 'carrera_id,user_id' }
        )
    }
  }

  async function updateEstado(carreraId, estado) {
    const distanciaElegida = distanciasSeleccionadas[carreraId] || null
    await supabase.from('participaciones')
      .upsert(
        { carrera_id: carreraId, user_id: user.id, estado, distancia_elegida: distanciaElegida },
        { onConflict: 'carrera_id,user_id' }
      )
    setParticipaciones(prev => {
      const exists = prev.find(p => p.carrera_id === carreraId)
      if (exists) return prev.map(p => p.carrera_id === carreraId ? { ...p, estado } : p)
      return [...prev, { carrera_id: carreraId, estado }]
    })
  }

  function getDistancias(c) {
    if (c.distancias?.length) return c.distancias
    if (c.distancia) return [c.distancia]
    return []
  }

  // Distancias únicas para el filtro
  const todasDistancias = [...new Set(carreras.flatMap(c => getDistancias(c)))]

  // Aplicar filtros
  const carrerasFiltradas = carreras.filter(c => {
    if (filtros.tipo && c.tipo !== filtros.tipo) return false
    if (filtros.distancia && !getDistancias(c).includes(filtros.distancia)) return false
    if (filtros.fecha === 'proximas' && c.fecha && c.fecha < today) return false
    if (filtros.fecha === 'pasadas' && (!c.fecha || c.fecha >= today)) return false
    return true
  })

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

      {isAdmin && showForm && !editId && (
        <form ref={formRef} className="card form-card" onSubmit={handleSave}>
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
              <label>Distancia(s)</label>
              <input value={form.distancias} onChange={e => setForm({ ...form, distancias: e.target.value })} placeholder="5K, 10K" />
              <span style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>Separar con comas si hay varias</span>
            </div>
            <div className="field">
              <label>Tipo</label>
              <select value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })}>
                <option value="">— Sin especificar —</option>
                <option value="Trail">Trail</option>
                <option value="Calle">Calle</option>
              </select>
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

      {/* Filtros */}
      <div className="filtros-bar">
        <div className="filtro-group">
          {['proximas', 'pasadas', ''].map(val => (
            <button
              key={val}
              className={`filtro-btn ${filtros.fecha === val ? 'active' : ''}`}
              onClick={() => setFiltros(f => ({ ...f, fecha: val }))}
            >
              {val === 'proximas' ? 'Próximas' : val === 'pasadas' ? 'Pasadas' : 'Todas'}
            </button>
          ))}
        </div>
        <div className="filtro-group">
          {['', 'Trail', 'Calle'].map(val => (
            <button
              key={val}
              className={`filtro-btn ${filtros.tipo === val ? 'active' : ''}`}
              onClick={() => setFiltros(f => ({ ...f, tipo: val }))}
            >
              {val || 'Todo tipo'}
            </button>
          ))}
        </div>
        {todasDistancias.length > 0 && (
          <div className="filtro-group">
            <button
              className={`filtro-btn ${filtros.distancia === '' ? 'active' : ''}`}
              onClick={() => setFiltros(f => ({ ...f, distancia: '' }))}
            >
              Toda distancia
            </button>
            {todasDistancias.map(d => (
              <button
                key={d}
                className={`filtro-btn ${filtros.distancia === d ? 'active' : ''}`}
                onClick={() => setFiltros(f => ({ ...f, distancia: d }))}
              >
                {d}
              </button>
            ))}
          </div>
        )}
      </div>

      {carrerasFiltradas.length === 0 && (
        <div className="empty-state">
          {carreras.length === 0 ? 'No hay carreras cargadas todavía' : 'No hay carreras con esos filtros'}
        </div>
      )}

      <div className="cards-list">
        {carrerasFiltradas.map(c => {
          // Mostrar form de edición en lugar de la card
          if (editId === c.id && showForm) {
            return (
              <form key={c.id} ref={formRef} className="card form-card" onSubmit={handleSave}>
                <h3 style={{ marginBottom: '0.75rem', fontSize: '14px', fontWeight: 600 }}>Editar carrera</h3>
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
                    <label>Distancia(s)</label>
                    <input value={form.distancias} onChange={e => setForm({ ...form, distancias: e.target.value })} placeholder="5K, 10K" />
                    <span style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>Separar con comas si hay varias</span>
                  </div>
                  <div className="field">
                    <label>Tipo</label>
                    <select value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })}>
                      <option value="">— Sin especificar —</option>
                      <option value="Trail">Trail</option>
                      <option value="Calle">Calle</option>
                    </select>
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
                    {saving ? 'Guardando...' : 'Guardar cambios'}
                  </button>
                </div>
              </form>
            )
          }

          const part = participaciones.find(p => p.carrera_id === c.id)
          const estado = part?.estado || 'Pendiente'
          const dists = getDistancias(c)
          const multiDist = dists.length > 1
          const distSeleccionada = distanciasSeleccionadas[c.id] || (dists.length === 1 ? dists[0] : null)

          return (
            <div key={c.id} className="card race-card">
              <div className="race-card-top">
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                    <h3 style={{ margin: 0 }}>{c.nombre}</h3>
                    {c.tipo && (
                      <span className="tag" style={{ background: TIPO_COLOR[c.tipo] + '22', color: TIPO_COLOR[c.tipo], border: `1px solid ${TIPO_COLOR[c.tipo]}44`, fontWeight: 600 }}>
                        {c.tipo}
                      </span>
                    )}
                  </div>
                  <div className="race-meta">
                    {c.fecha && <span className="tag">📅 {c.fecha}</span>}
                    {dists.length > 0 && <span className="tag">📏 {dists.join(' · ')}</span>}
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
              </div>

              {c.link && (
                <a href={c.link} target="_blank" rel="noopener noreferrer" className="race-link">
                  Ver inscripción →
                </a>
              )}

              {multiDist && (
                <div className="dist-selector">
                  <span style={{ fontSize: '12px', color: '#94a3b8', marginRight: '0.5rem' }}>¿En qué distancia corrés?</span>
                  <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                    {dists.map(d => (
                      <button
                        key={d}
                        className="filtro-btn"
                        style={distSeleccionada === d
                          ? { background: 'rgba(255,45,45,0.2)', color: '#ff2d2d', border: '1px solid rgba(255,45,45,0.4)', fontWeight: 600 }
                          : {}}
                        onClick={() => updateDistancia(c.id, d)}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="race-estado-section">
                <div className="race-estado-label">
                  Mi estado: <span style={{ color: ESTADO_COLOR[estado], fontWeight: 600 }}>{estado}</span>
                  {distSeleccionada && <span style={{ color: '#94a3b8', fontWeight: 400, fontSize: '12px' }}> · {distSeleccionada}</span>}
                </div>
                {multiDist && !distSeleccionada ? (
                  <p style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>Elegí una distancia para marcar tu estado</p>
                ) : (
                  <div className="estado-buttons">
                    {ESTADOS.map(e => (
                      <button
                        key={e}
                        className={`estado-btn ${estado === e ? 'active' : ''}`}
                        style={estado === e ? { borderColor: ESTADO_COLOR[e], color: ESTADO_COLOR[e], background: ESTADO_COLOR[e] + '22' } : {}}
                        onClick={() => updateEstado(c.id, e)}
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
