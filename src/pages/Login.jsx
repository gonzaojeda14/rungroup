import { useState, useEffect } from 'react'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'
import PasswordInput from '../components/PasswordInput'

const MAX_INTENTOS = 3
const LOCK_KEY = 'login_bloqueado'

function getBloqueado() {
  try { return JSON.parse(localStorage.getItem(LOCK_KEY) || 'null') } catch { return null }
}

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
  const [intentos, setIntentos] = useState(() => getBloqueado()?.intentos || 0)
  const bloqueado = intentos >= MAX_INTENTOS

  // Recuperar contraseña
  const [showRecuperar, setShowRecuperar] = useState(bloqueado)
  const [emailRecuperar, setEmailRecuperar] = useState('')
  const [recuperarLoading, setRecuperarLoading] = useState(false)
  const [recuperarDone, setRecuperarDone] = useState(false)
  const [recuperarError, setRecuperarError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const err = await signIn(email, password)
    if (err) {
      const nuevos = intentos + 1
      setIntentos(nuevos)
      localStorage.setItem(LOCK_KEY, JSON.stringify({ intentos: nuevos }))
      if (nuevos >= MAX_INTENTOS) {
        setShowRecuperar(true)
      } else {
        setError(`Email o contraseña incorrectos. Intentos restantes: ${MAX_INTENTOS - nuevos}`)
      }
    } else {
      localStorage.removeItem(LOCK_KEY)
    }
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
      localStorage.removeItem(LOCK_KEY)
      setIntentos(0)
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
                {!bloqueado && (
                  <button
                    type="button"
                    className="btn-ghost"
                    style={{ marginTop: '8px', width: '100%' }}
                    onClick={() => setShowRecuperar(false)}
                  >
                    Volver
                  </button>
                )}
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
            <PasswordInput
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
            />
          </div>
          {error && <p className="error-msg">{error}</p>}
          <button type="submit" className="btn-primary" disabled={loading || bloqueado}>
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
        <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border)', textAlign: 'center' }}>
          <span style={{ fontSize: '13px', color: 'var(--text2)' }}>¿No tenés cuenta? </span>
          <button
            type="button"
            onClick={() => navigate('/registro')}
            style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: '13px', fontWeight: 600, cursor: 'pointer', padding: 0 }}
          >
            Registrarme
          </button>
        </div>
      </div>
    </div>
  )
}
