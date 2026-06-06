import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { validarTelefono } from '../lib/utils'
import PasswordInput from '../components/PasswordInput'

export default function Register() {
  const navigate = useNavigate()
  const params = new URLSearchParams(window.location.search)

  // Si viene con ?code=, lo persistimos para cuando abran la PWA después
  const codeFromUrl = params.get('code')
  if (codeFromUrl) localStorage.setItem('invite_code', codeFromUrl)
  const savedCode = localStorage.getItem('invite_code') || ''

  const [form, setForm] = useState({
    nombre: '',
    fechaNacimiento: '',
    telefono: '',
    email: '',
    password: '',
    confirmPassword: '',
    codigo: codeFromUrl || savedCode,
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
    if (!validarTelefono(form.telefono)) {
      setError('El teléfono parece inválido. Ingresá entre 8 y 15 dígitos.')
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

    localStorage.removeItem('invite_code')
    setDone(true)
    setSaving(false)
  }

  useEffect(() => {
    if (done) {
      const t = setTimeout(() => navigate('/'), 2500)
      return () => clearTimeout(t)
    }
  }, [done])

  if (done) {
    return (
      <div className="login-wrapper">
        <div className="login-card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '40px', marginBottom: '16px' }}>🎉</div>
          <h1 style={{ fontSize: '20px', marginBottom: '8px' }}>¡Cuenta creada!</h1>
          <p style={{ color: 'var(--text2)', fontSize: '14px', marginBottom: '24px' }}>
            En un momento te llevamos al login...
          </p>
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
            <PasswordInput
              value={form.password}
              onChange={e => setForm({ ...form, password: e.target.value })}
              placeholder="Mínimo 8 caracteres, con letras y números"
              autoComplete="new-password"
              required
            />
          </div>
          <div className="field" style={{ marginBottom: '12px' }}>
            <label>Confirmar contraseña *</label>
            <PasswordInput
              value={form.confirmPassword}
              onChange={e => setForm({ ...form, confirmPassword: e.target.value })}
              placeholder="Repetí la contraseña"
              autoComplete="new-password"
              required
            />
          </div>

          {error && <div className="error-msg" style={{ marginBottom: '12px' }}>{error}</div>}

          <button type="submit" className="btn-primary" style={{ width: '100%', height: '44px', fontSize: '15px' }} disabled={saving}>
            {saving ? 'Registrando...' : 'Crear cuenta'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: '16px', fontSize: '13px', color: 'var(--text2)' }}>
          ¿Ya tenés cuenta? <a href="/" style={{ color: '#ff2d2d' }}>Ingresá acá</a>
        </p>
      </div>
    </div>
  )
}
