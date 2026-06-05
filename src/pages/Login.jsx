import { useState, useEffect } from 'react'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'

export default function Login() {
  const { signIn } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (localStorage.getItem('invite_code')) {
      navigate('/registro')
    }
  }, [])
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Recuperar contraseña
  const [showRecuperar, setShowRecuperar] = useState(false)
  const [emailRecuperar, setEmailRecuperar] = useState('')
  const [recuperarLoading, setRecuperarLoading] = useState(false)
  const [recuperarDone, setRecuperarDone] = useState(false)
  const [recuperarError, setRecuperarError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const err = await signIn(email, password)
    if (err) setError('Email o contraseña incorrectos')
    setLoading(false)
  }

  async function handleRecuperar(e) {
    e.preventDefault()
    setRecuperarError('')
    setRecuperarLoading(true)
    const { error: err } = await supabase.auth.resetPasswordForEmail(emailRecuperar, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    if (err) {
      setRecuperarError('No se pudo enviar el correo. Verificá el email.')
    } else {
      setRecuperarDone(true)
    }
    setRecuperarLoading(false)
  }

  if (showRecuperar) {
    return (
      <div className="login-wrapper">
        <div className="login-card">
          <div className="login-logo">
            <img src="/logo-flama.png" alt="Flama Run" style={{ height: 40, width: 'auto' }} />
          </div>
          <h1 style={{ fontSize: '20px', textAlign: 'center', marginBottom: '4px' }}>Recuperar contraseña</h1>

          {recuperarDone ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '36px', marginBottom: '12px' }}>📬</div>
              <p style={{ color: 'var(--text2)', fontSize: '14px', marginBottom: '20px' }}>
                Te mandamos un link a <strong>{emailRecuperar}</strong>. Revisá tu correo y seguí las instrucciones.
              </p>
              <button className="btn-ghost" onClick={() => { setShowRecuperar(false); setRecuperarDone(false) }}>
                Volver al login
              </button>
            </div>
          ) : (
            <>
              <p className="login-sub">Ingresá tu email y te mandamos un link para restablecer tu contraseña</p>
              <form onSubmit={handleRecuperar}>
                <div className="field">
                  <label>Email</label>
                  <input
                    type="email"
                    value={emailRecuperar}
                    onChange={e => setEmailRecuperar(e.target.value)}
                    placeholder="vos@email.com"
                    required
                    autoComplete="email"
                  />
                </div>
                {recuperarError && <p className="error-msg">{recuperarError}</p>}
                <button type="submit" className="btn-primary" disabled={recuperarLoading}>
                  {recuperarLoading ? 'Enviando...' : 'Enviar link'}
                </button>
                <button
                  type="button"
                  className="btn-ghost"
                  style={{ marginTop: '8px', width: '100%' }}
                  onClick={() => setShowRecuperar(false)}
                >
                  Volver
                </button>
              </form>
            </>
          )}
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
        <h1 style={{ display: 'none' }}>Flama Run</h1>
        <p className="login-sub">Siempre todo Flama</p>
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="vos@email.com"
              required
              autoComplete="email"
            />
          </div>
          <div className="field">
            <label>Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
            />
          </div>
          {error && <p className="error-msg">{error}</p>}
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
          <button
            type="button"
            onClick={() => { setShowRecuperar(true); setEmailRecuperar(email) }}
            style={{ marginTop: '12px', background: 'none', border: 'none', color: 'var(--text2)', fontSize: '13px', cursor: 'pointer', width: '100%', textAlign: 'center', padding: '4px' }}
          >
            Olvidé mi contraseña
          </button>
        </form>
      </div>
    </div>
  )
}
