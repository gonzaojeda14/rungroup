import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Register() {
  const [form, setForm] = useState({
    nombre: '', fechaNacimiento: '', telefono: '', email: '', password: '', confirmPassword: ''
  })
  const [certFile, setCertFile] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  function handleFile(e) {
    const file = e.target.files[0]
    if (!file) return
    const validTypes = ['image/jpeg', 'image/jpg', 'application/pdf']
    if (!validTypes.includes(file.type)) {
      setError('El certificado debe ser JPG o PDF')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('El archivo no puede superar 10MB')
      return
    }
    setError('')
    setCertFile(file)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
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

    // 2. Subir certificado si fue cargado
    let certificadoUrl = null
    if (certFile) {
      const ext = certFile.name.split('.').pop().toLowerCase()
      const path = `${userId}/certificado.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('certificados')
        .upload(path, certFile, { upsert: true })
      if (!uploadError) {
        certificadoUrl = path
      }
    }

    // 3. Actualizar perfil con datos adicionales
    await supabase.from('profiles').update({
      nombre: form.nombre,
      fecha_nacimiento: form.fechaNacimiento || null,
      telefono: form.telefono || null,
      certificado_url: certificadoUrl,
      certificado_fecha: certificadoUrl ? new Date().toISOString().split('T')[0] : null,
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
          <svg height={36} viewBox="0 0 120 36" fill="none" xmlns="http://www.w3.org/2000/svg">
            <text x="0" y="24" fontFamily="Arial Black, Arial, sans-serif" fontWeight="900" fontSize="26" fill="white" letterSpacing="-0.5">FLAMA</text>
            <text x="2" y="34" fontFamily="Arial, sans-serif" fontWeight="400" fontSize="9" fill="#94a3b8" letterSpacing="3">RUN</text>
          </svg>
        </div>
        <h1 style={{ textAlign: 'center', fontSize: '20px', marginBottom: '4px' }}>Crear cuenta</h1>
        <p className="login-sub">Completá tus datos para registrarte</p>

        <form onSubmit={handleSubmit}>
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

          <div className="field" style={{ marginBottom: '20px' }}>
            <label>Certificado médico (JPG o PDF)</label>
            <label className="file-upload-label">
              <input type="file" accept=".jpg,.jpeg,.pdf" onChange={handleFile} style={{ display: 'none' }} />
              <span className="file-upload-btn">
                {certFile ? `✅ ${certFile.name}` : '📎 Seleccionar archivo'}
              </span>
            </label>
            <span style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
              Válido para el año en curso · Máx. 10MB
            </span>
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
