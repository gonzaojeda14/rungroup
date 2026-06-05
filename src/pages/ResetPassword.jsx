import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function ResetPassword() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [sessionReady, setSessionReady] = useState(false)

  // Supabase pone el token en el hash de la URL al llegar desde el link
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setSessionReady(true)
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (password !== confirmPassword) { setError('Las contraseñas no coinciden'); return }
    if (password.length < 6) { setError('Mínimo 6 caracteres'); return }
    setLoading(true)
    const { error: err } = await supabase.auth.updateUser({ password })
    if (err) {
      setError('Error al actualizar la contraseña. Intentá de nuevo.')
      setLoading(false)
      return
    }
    await supabase.auth.signOut()
    setDone(true)
    setLoading(false)
    setTimeout(() => navigate('/'), 2500)
  }

  if (done) {
    return (
      <div className="login-wrapper">
        <div className="login-card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '40px', marginBottom: '16px' }}>✅</div>
          <h1 style={{ fontSize: '20px', marginBottom: '8px' }}>Contraseña actualizada</h1>
          <p style={{ color: 'var(--text2)', fontSize: '14px' }}>Ya podés ingresar con tu nueva contraseña.</p>
        </div>
      </div>
    )
  }

  if (!sessionReady) {
    return (
      <div className="login-wrapper">
        <div className="login-card" style={{ textAlign: 'center' }}>
          <p style={{ color: 'var(--text2)', fontSize: '14px' }}>Verificando link...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="login-wrapper">
      <div className="login-card">
        <div className="login-logo">
          <img src="/logo-flama.png" alt="Flama Run" style={{ height: 40, width: 'auto' }} />
        </div>
        <h1 style={{ fontSize: '20px', textAlign: 'center', marginBottom: '4px' }}>Nueva contraseña</h1>
        <p className="login-sub">Elegí una contraseña nueva para tu cuenta</p>
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Nueva contraseña</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="new-password"
            />
          </div>
          <div className="field">
            <label>Repetir contraseña</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="new-password"
            />
          </div>
          {error && <p className="error-msg">{error}</p>}
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Guardando...' : 'Guardar contraseña'}
          </button>
        </form>
      </div>
    </div>
  )
}
