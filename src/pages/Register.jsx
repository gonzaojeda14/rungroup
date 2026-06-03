import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Register() {
  const codigoUrl = new URLSearchParams(window.location.search).get('code') || ''
  const [form, setForm] = useState({
    nombre: '', fechaNacimiento: '', telefono: '', email: '', password: '', confirmPassword: '', codigo: codigoUrl
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)


  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    const codigoEsperado = import.meta.env.VITE_INVITE_CODE
    if (!codigoEsperado || form.codigo.trim().toLowerCase() !== codigoEsperado.trim().toLowerCase()) {
      setError('Código de invitación incorrecto')
      return
    }
    if (form.password !== form.confirmPassword) {
      setError('Las contraseñas no coinciden')
      return
    }
    if (!form.fechaNacimiento) {
      setError('La fecha de nacimiento es obligatoria')
      return
    }
    if (!form.telefono.trim()) {
      setError('El teléfono es obligatorio')
      return
    }
    if (form.password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres')
      return
    }
    setSaving(true)

    // 0. Verificar si el email está bloqueado
    const { data: bloqueado } = await supabase
      .from('emails_bloqueados')
      .select('email')
      .eq('email', form.email.toLowerCase())
      .maybeSingle()
    if (bloqueado) {
      setError('Este email no puede registrarse en la plataforma.')
      setSaving(false)
      return
    }

    // 1. Crear cuenta
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: { data: { nombre: form.nombre } }
    })

    if (signUpError) {
      setError(signUpError.message === 'User already registered'
        ? 'Ya existe una cuenta con ese email'
        : signUpError.message)
      setSaving(false)
      return
    }

    const userId = data.user?.id
    if (!userId) {
      setError('Error al crear la cuenta. Intentá de nuevo.')
      setSaving(false)
      return
    }

    // 2. Actualizar perfil con datos adicionales
    await supabase.from('profiles').update({
      nombre: form.nombre,
      fecha_nacimiento: form.fechaNacimiento || null,
      telefono: form.telefono || null,
    }).eq('id', userId)

    // 4. Cerrar sesión para que ingresen manualmente
    await supabase.auth.signOut()

    setDone(true)
    setSaving(false)
  }

  if (done) {
    return (
      <div className="login-wrapper">
        <div className="login-card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '40px', marginBottom: '16px' }}>✅</div>
          <h1 style={{ fontSize: '20px', marginBottom: '8px' }}>¡Registro completado!</h1>
          <p style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '24px' }}>
            Ya podés ingresar a la app con tu email y contraseña.
          </p>
          <a href="/" className="btn-primary" style={{ display: 'block', textAlign: 'center', textDecoration: 'none', lineHeight: '40px' }}>
            Ir al inicio
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="login-wrapper" style={{ alignItems: 'flex-start', paddingTop: '32px' }}>
      <div className="login-card" style={{ maxWidth: '420px' }}>
        <div className="login-logo">
          <img src="/logo-flama.png" alt="Flama Run" style={{ height: 36, width: 'auto' }} />
        </div>
        <h1 style={{ textAlign: 'center', fontSize: '20px', marginBottom: '4px' }}>Crear cuenta</h1>
        <p className="login-sub">Completá tus datos para registrarte</p>

        <form onSubmit={handleSubmit}>
          <div className="field" style={{ marginBottom: '12px' }}>
            <label>Código de invitación *</label>
            <input
              value={form.codigo}
              onChange={e => setForm({ ...form, codigo: e.target.value })}
              placeholder="El código del grupo de WhatsApp"
              required
            />
          </div>
          <div className="field" style={{ marginBottom: '12px' }}>
            <label>Nombre completo *</label>
            <input
              value={form.nombre}
              onChange={e => setForm({ ...form, nombre: e.target.value })}
              placeholder="Juan Pérez"
              required
            />
          </div>
          <div className="field" style={{ marginBottom: '12px' }}>
            <label>Fecha de nacimiento *</label>
            <input
              type="date"
              value={form.fechaNacimiento}
              onChange={e => setForm({ ...form, fechaNacimiento: e.target.value })}
              required
            />
          </div>
          <div className="field" style={{ marginBottom: '12px' }}>
            <label>Teléfono *</label>
            <input
              type="tel"
              value={form.telefono}
              onChange={e => setForm({ ...form, telefono: e.target.value })}
              placeholder="+54 11 1234-5678"
              required
            />
          </div>
          <div className="field" style={{ marginBottom: '12px' }}>
            <label>Email *</label>
            <input
              type="email"
              value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
              placeholder="vos@email.com"
              required
            />
          </div>
          <div className="field" style={{ marginBottom: '12px' }}>
            <label>Contraseña *</label>
            <input
              type="password"
              value={form.password}
              onChange={e => setForm({ ...form, password: e.target.value })}
              placeholder="Mínimo 6 caracteres"
              required
            />
          </div>
          <div className="field" style={{ marginBottom: '12px' }}>
            <label>Confirmar contraseña *</label>
            <input
              type="password"
              value={form.confirmPassword}
              onChange={e => setForm({ ...form, confirmPassword: e.target.value })}
              placeholder="Repetí la contraseña"
              required
            />
          </div>

          {error && <div className="error-msg" style={{ marginBottom: '12px' }}>{error}</div>}

          <button type="submit" className="btn-primary" style={{ width: '100%', height: '44px', fontSize: '15px' }} disabled={saving}>
            {saving ? 'Registrando...' : 'Crear cuenta'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: '16px', fontSize: '13px', color: '#64748b' }}>
          ¿Ya tenés cuenta? <a href="/" style={{ color: '#ff2d2d' }}>Ingresá acá</a>
        </p>
      </div>
    </div>
  )
}
