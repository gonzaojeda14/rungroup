import PageLoader from '../components/PageLoader'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'

export default function Corredores() {
  const { isAdmin } = useAuth()
  const [corredores, setCorredores] = useState([])
  const [loading, setLoading] = useState(true)
  const [newEmail, setNewEmail] = useState('')
  const [newNombre, setNewNombre] = useState('')
  const [newPass, setNewPass] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => { fetchCorredores() }, [])

  async function fetchCorredores() {
    const { data } = await supabase.from('profiles').select('*').order('nombre')
    setCorredores(data || [])
    setLoading(false)
  }

  async function handleBloquear(corredor) {
    if (!confirm(`¿Bloquear el email de ${corredor.nombre}? No podrá volver a registrarse con ${corredor.email}.`)) return
    const { error } = await supabase.from('emails_bloqueados').insert([{ email: corredor.email }])
    if (error) { setMsg('Error al bloquear: ' + error.message); return }
    setMsg(`🚫 ${corredor.email} bloqueado`)
  }

  async function handleToggleAcceso(corredor) {
    const bloqueando = corredor.activo !== false
    const { error } = await supabase.from('profiles').update({ activo: !bloqueando }).eq('id', corredor.id)
    if (error) { setMsg('Error: ' + error.message); return }
    setMsg(bloqueando ? `🚫 ${corredor.nombre} bloqueado — no podrá ingresar` : `✅ ${corredor.nombre} desbloqueado`)
    fetchCorredores()
  }

  async function handleAdd(e) {
    e.preventDefault()
    setSaving(true)
    setMsg('')
    // Crear usuario en Supabase Auth via admin (requiere service role — ver README)
    // En producción esto se hace desde un Edge Function. Por ahora usamos la API admin.
    const { data, error } = await supabase.auth.admin.createUser({
      email: newEmail,
      password: newPass,
      email_confirm: true,
      user_metadata: { nombre: newNombre }
    })
    if (error) {
      setMsg('Error: ' + error.message)
    } else {
      // El trigger de Supabase crea el perfil automáticamente
      setMsg('✓ Corredor/a agregado/a')
      setNewEmail(''); setNewNombre(''); setNewPass('')
      fetchCorredores()
    }
    setSaving(false)
  }

  if (!isAdmin) {
    return (
      <div className="page">
        <div className="page-header"><h2>Corredores</h2></div>
        <div className="empty-state">Solo el administrador puede ver esta sección</div>
      </div>
    )
  }

  if (loading) return <PageLoader />

  return (
    <div className="page">
      <div className="page-header">
        <h2>Corredores ({corredores.length})</h2>
      </div>

      <form className="card form-card" onSubmit={handleAdd}>
        <h3 style={{ marginBottom: '0.75rem', fontSize: '14px', fontWeight: 600 }}>Agregar corredor/a</h3>
        <div className="form-grid">
          <div className="field">
            <label>Nombre completo</label>
            <input value={newNombre} onChange={e => setNewNombre(e.target.value)} placeholder="Ana García" required />
          </div>
          <div className="field">
            <label>Email</label>
            <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="ana@email.com" required />
          </div>
          <div className="field">
            <label>Contraseña inicial</label>
            <input type="password" value={newPass} onChange={e => setNewPass(e.target.value)} placeholder="Min. 6 caracteres" minLength={6} required />
          </div>
        </div>
        {msg && <p className={msg.startsWith('✓') ? 'success-msg' : 'error-msg'}>{msg}</p>}
        <div className="form-actions">
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Creando...' : 'Crear cuenta'}
          </button>
        </div>
      </form>

      <div className="cards-list">
        {corredores.map(c => (
          <div key={c.id} className="card runner-card">
            <div className="runner-avatar" style={{ overflow: 'hidden', padding: 0 }}>
              {c.avatar_url
                ? <img src={c.avatar_url} alt={c.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                : <span style={{ fontSize: 14, fontWeight: 600 }}>{(c.nombre || '?')[0].toUpperCase()}</span>
              }
            </div>
            <div style={{ flex: 1 }}>
              <div className="runner-name">{c.nombre}</div>
              <div className="runner-email">{c.email}</div>
            </div>
            {c.role === 'admin' && <span className="badge green">Admin</span>}
            {c.role !== 'admin' && (
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                {c.activo === false && <span style={{ fontSize: '11px', color: '#f87171', background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 6, padding: '2px 7px' }}>Bloqueado</span>}
                <button
                  className="btn-icon"
                  onClick={() => handleToggleAcceso(c)}
                  title={c.activo === false ? 'Desbloquear acceso' : 'Bloquear acceso'}
                  style={{ fontSize: '13px' }}
                >
                  {c.activo === false ? '✅' : '🚫'}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
