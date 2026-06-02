import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'

const EMPTY = { titulo: '', cuerpo: '' }

function ConfirmModal({ mensaje, onConfirm, onCancel }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px',
    }}>
      <div style={{
        background: 'var(--bg2)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius)', padding: '24px', width: '100%', maxWidth: '320px',
      }}>
        <p style={{ fontSize: '15px', marginBottom: '20px', lineHeight: 1.5 }}>{mensaje}</p>
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button className="btn-ghost" onClick={onCancel}>Cancelar</button>
          <button
            className="btn-primary"
            style={{ background: '#f87171', height: '40px', padding: '0 16px', fontSize: '14px' }}
            onClick={onConfirm}
          >
            Eliminar
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Avisos() {
  const { isAdmin, marcarAvisosLeidos } = useAuth()
  const [avisos, setAvisos] = useState([])
  const [form, setForm] = useState(EMPTY)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [confirmId, setConfirmId] = useState(null)

  useEffect(() => {
    fetchAvisos()
    marcarAvisosLeidos()
  }, [])

  async function fetchAvisos() {
    const { data } = await supabase
      .from('avisos')
      .select('*')
      .order('created_at', { ascending: false })
    setAvisos(data || [])
    setLoading(false)
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    await supabase.from('avisos').insert([form])
    setForm(EMPTY)
    setShowForm(false)
    fetchAvisos()
    setSaving(false)
  }

  async function handleDelete(id) {
    await supabase.from('avisos').delete().eq('id', id)
    setConfirmId(null)
    fetchAvisos()
  }

  function formatFecha(ts) {
    const d = new Date(ts)
    return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })
  }

  if (loading) return <div className="page-loading">Cargando...</div>

  return (
    <div className="page">
      {confirmId && (
        <ConfirmModal
          mensaje="¿Eliminar este aviso? Esta acción no se puede deshacer."
          onConfirm={() => handleDelete(confirmId)}
          onCancel={() => setConfirmId(null)}
        />
      )}

      <div className="page-header">
        <h2>Avisos</h2>
        {isAdmin && (
          <button className="btn-accent" onClick={() => setShowForm(f => !f)}>
            {showForm ? 'Cancelar' : '+ Nuevo'}
          </button>
        )}
      </div>

      {isAdmin && showForm && (
        <form className="card form-card" onSubmit={handleSave}>
          <h3 style={{ marginBottom: '0.75rem', fontSize: '14px', fontWeight: 600 }}>Nuevo aviso</h3>
          <div className="form-grid">
            <div className="field full">
              <label>Título *</label>
              <input
                value={form.titulo}
                onChange={e => setForm({ ...form, titulo: e.target.value })}
                placeholder="Reunión el sábado"
                required
              />
            </div>
            <div className="field full">
              <label>Mensaje</label>
              <textarea
                value={form.cuerpo}
                onChange={e => setForm({ ...form, cuerpo: e.target.value })}
                placeholder="Detalle del aviso..."
                rows={3}
                style={{
                  padding: '10px 12px', background: 'var(--bg3)',
                  border: '1px solid var(--border)', borderRadius: '10px',
                  color: 'var(--text)', fontFamily: 'DM Sans, sans-serif',
                  fontSize: '14px', resize: 'vertical', width: '100%',
                }}
              />
            </div>
          </div>
          <div className="form-actions">
            <button type="button" className="btn-ghost" onClick={() => { setShowForm(false); setForm(EMPTY) }}>Cancelar</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Publicando...' : 'Publicar aviso'}
            </button>
          </div>
        </form>
      )}

      {avisos.length === 0 && (
        <div className="empty-state">No hay avisos publicados todavía</div>
      )}

      <div className="cards-list">
        {avisos.map(a => (
          <div key={a.id} className="card">
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: '15px', marginBottom: a.cuerpo ? '6px' : '0' }}>
                  {a.titulo}
                </div>
                {a.cuerpo && (
                  <div style={{ fontSize: '14px', color: 'var(--text2)', lineHeight: 1.5 }}>
                    {a.cuerpo}
                  </div>
                )}
                <div style={{ fontSize: '12px', color: 'var(--text2)', marginTop: '8px', opacity: 0.7 }}>
                  {formatFecha(a.created_at)}
                </div>
              </div>
              {isAdmin && (
                <button
                  className="btn-icon danger"
                  onClick={() => setConfirmId(a.id)}
                  title="Eliminar"
                  style={{ flexShrink: 0, marginTop: '2px' }}
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
