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

  if (loading) return <div className="page-loading">Cargando...</div>

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
            <div className="runner-avatar">{(c.nombre || '?')[0].toUpperCase()}</div>
            <div>
              <div className="runner-name">{c.nombre}</div>
              <div className="runner-email">{c.email}</div>
            </div>
            {c.role === 'admin' && <span className="badge green" style={{ marginLeft: 'auto' }}>Admin</span>}
          </div>
        ))}
      </div>
    </div>
  )
}
