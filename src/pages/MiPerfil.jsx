import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'

const thisYear = new Date().getFullYear()

export default function MiPerfil() {
  const { user, profile } = useAuth()
  const [form, setForm] = useState({ nombre: '', fechaNacimiento: '', telefono: '' })
  const [certInfo, setCertInfo] = useState({ url: null, fecha: null })
  const [certFile, setCertFile] = useState(null)
  const [avatarUrl, setAvatarUrl] = useState(null)
  const [avatarFile, setAvatarFile] = useState(null)
  const [savingAvatar, setSavingAvatar] = useState(false)
  const [pwd, setPwd] = useState({ nueva: '', confirmar: '' })
  const [saving, setSaving] = useState(false)
  const [savingPwd, setSavingPwd] = useState(false)
  const [savingCert, setSavingCert] = useState(false)
  const [msg, setMsg] = useState('')
  const [msgPwd, setMsgPwd] = useState('')
  const [msgCert, setMsgCert] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchProfile() }, [])

  async function fetchProfile() {
    const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    if (data) {
      setForm({
        nombre: data.nombre || '',
        fechaNacimiento: data.fecha_nacimiento || '',
        telefono: data.telefono || '',
      })
      setCertInfo({ url: data.certificado_url || null, fecha: data.certificado_fecha || null })
      setAvatarUrl(data.avatar_url || null)
    }
    setLoading(false)
  }

  function handleAvatarFile(e) {
    const file = e.target.files[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { alert('Solo se permiten imágenes'); return }
    if (file.size > 5 * 1024 * 1024) { alert('La imagen no puede superar 5MB'); return }
    setAvatarFile(file)
    // Preview local
    const reader = new FileReader()
    reader.onload = ev => setAvatarUrl(ev.target.result)
    reader.readAsDataURL(file)
  }

  async function handleSubirAvatar() {
    if (!avatarFile) return
    setSavingAvatar(true)
    const ext = avatarFile.name.split('.').pop().toLowerCase()
    const path = `${user.id}/avatar.${ext}`
    const { error } = await supabase.storage.from('avatares').upload(path, avatarFile, { upsert: true })
    if (error) { alert('Error al subir la foto'); setSavingAvatar(false); return }
    const { data: { publicUrl } } = supabase.storage.from('avatares').getPublicUrl(path)
    // Agregar cache buster
    const url = `${publicUrl}?t=${Date.now()}`
    await supabase.from('profiles').update({ avatar_url: url }).eq('id', user.id)
    setAvatarUrl(url)
    setAvatarFile(null)
    setSavingAvatar(false)
  }

  async function handleSaveDatos(e) {
    e.preventDefault()
    setSaving(true)
    setMsg('')
    const { error } = await supabase.from('profiles').update({
      nombre: form.nombre,
      fecha_nacimiento: form.fechaNacimiento || null,
      telefono: form.telefono || null,
    }).eq('id', user.id)
    setMsg(error ? 'Error al guardar' : '✅ Datos actualizados')
    setSaving(false)
  }

  async function handleSavePwd(e) {
    e.preventDefault()
    setMsgPwd('')
    if (pwd.nueva !== pwd.confirmar) { setMsgPwd('Las contraseñas no coinciden'); return }
    if (pwd.nueva.length < 6) { setMsgPwd('Mínimo 6 caracteres'); return }
    setSavingPwd(true)
    const { error } = await supabase.auth.updateUser({ password: pwd.nueva })
    setMsgPwd(error ? 'Error al cambiar contraseña' : '✅ Contraseña actualizada')
    setPwd({ nueva: '', confirmar: '' })
    setSavingPwd(false)
  }

  function handleFile(e) {
    const file = e.target.files[0]
    if (!file) return
    const validTypes = ['image/jpeg', 'image/jpg', 'application/pdf']
    if (!validTypes.includes(file.type)) { setMsgCert('El archivo debe ser JPG o PDF'); return }
    if (file.size > 10 * 1024 * 1024) { setMsgCert('El archivo no puede superar 10MB'); return }
    setMsgCert('')
    setCertFile(file)
  }

  async function handleSubirCert() {
    if (!certFile) return
    setSavingCert(true)
    setMsgCert('')
    const ext = certFile.name.split('.').pop().toLowerCase()
    const path = `${user.id}/certificado.${ext}`
    const { error: uploadError } = await supabase.storage
      .from('certificados')
      .upload(path, certFile, { upsert: true })
    if (uploadError) { setMsgCert('Error al subir el archivo'); setSavingCert(false); return }

    const hoy = new Date().toISOString().split('T')[0]
    await supabase.from('profiles').update({
      certificado_url: path,
      certificado_fecha: hoy,
    }).eq('id', user.id)
    setCertInfo({ url: path, fecha: hoy })
    setCertFile(null)
    setMsgCert('✅ Certificado actualizado')
    setSavingCert(false)
  }

  async function verCertificado() {
    const { data, error } = await supabase.storage
      .from('certificados')
      .createSignedUrl(certInfo.url, 60 * 60) // válida 1 hora
    if (error || !data?.signedUrl) { alert('No se pudo abrir el certificado'); return }
    window.open(data.signedUrl, '_blank')
  }

  const certAnio = certInfo.fecha ? new Date(certInfo.fecha).getFullYear() : null
  const certVencido = certAnio !== null && certAnio < thisYear

  if (loading) return <div className="page-loading">Cargando...</div>

  return (
    <div className="page">
      <div className="page-header"><h2>Mi perfil</h2></div>

      {/* FOTO DE PERFIL */}
      <div className="card" style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <label style={{ cursor: 'pointer', flexShrink: 0 }}>
          <input type="file" accept="image/*" onChange={handleAvatarFile} style={{ display: 'none' }} />
          <div style={{
            width: 72, height: 72, borderRadius: '50%',
            background: avatarUrl ? 'transparent' : 'rgba(255,45,45,0.15)',
            border: '2px solid rgba(255,45,45,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            overflow: 'hidden', position: 'relative'
          }}>
            {avatarUrl
              ? <img src={avatarUrl} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <span style={{ fontSize: 28, color: '#ff2d2d', fontWeight: 700 }}>{form.nombre?.[0]?.toUpperCase() || '?'}</span>
            }
            <div style={{
              position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              opacity: 0, transition: 'opacity .15s',
              borderRadius: '50%',
            }}
              onMouseEnter={e => e.currentTarget.style.opacity = 1}
              onMouseLeave={e => e.currentTarget.style.opacity = 0}
            >
              <span style={{ fontSize: 11, color: 'white' }}>Cambiar</span>
            </div>
          </div>
        </label>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>{form.nombre || 'Sin nombre'}</div>
          <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 8 }}>{user.email}</div>
          {avatarFile && (
            <button className="btn-primary" style={{ height: 32, fontSize: 13, padding: '0 14px' }} onClick={handleSubirAvatar} disabled={savingAvatar}>
              {savingAvatar ? 'Subiendo...' : 'Guardar foto'}
            </button>
          )}
          {!avatarFile && <span style={{ fontSize: 12, color: '#64748b' }}>Tocá la foto para cambiarla</span>}
        </div>
      </div>

      {/* DATOS PERSONALES */}
      <div className="card" style={{ marginBottom: '12px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '14px' }}>Datos personales</h3>
        <form onSubmit={handleSaveDatos}>
          <div className="form-grid">
            <div className="field full">
              <label>Nombre completo</label>
              <input value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} required />
            </div>
            <div className="field">
              <label>Fecha de nacimiento</label>
              <input type="date" value={form.fechaNacimiento} onChange={e => setForm({ ...form, fechaNacimiento: e.target.value })} />
            </div>
            <div className="field">
              <label>Teléfono</label>
              <input type="tel" value={form.telefono} onChange={e => setForm({ ...form, telefono: e.target.value })} placeholder="+54 11 1234-5678" />
            </div>
            <div className="field full">
              <label>Email</label>
              <input value={user.email} disabled style={{ opacity: 0.5 }} />
            </div>
          </div>
          {msg && <div className={msg.startsWith('✅') ? 'success-msg' : 'error-msg'} style={{ marginTop: '10px' }}>{msg}</div>}
          <div className="form-actions" style={{ marginTop: '12px' }}>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </form>
      </div>

      {/* CERTIFICADO MÉDICO */}
      <div className="card" style={{ marginBottom: '12px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '14px' }}>Certificado médico</h3>

        {certVencido && (
          <div style={{
            background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)',
            borderRadius: '8px', padding: '10px 14px', marginBottom: '12px',
            color: '#f87171', fontSize: '13px'
          }}>
            ⚠️ Tu certificado está vencido. Por favor subí uno nuevo correspondiente a {thisYear}.
          </div>
        )}

        {certInfo.url && !certVencido && (
          <div style={{ marginBottom: '12px' }}>
            <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '6px' }}>
              Subido el {certInfo.fecha} · Válido hasta el 31/12/{certAnio}
            </div>
            <button onClick={verCertificado} className="race-link" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, font: 'inherit' }}>
              Ver certificado →
            </button>
          </div>
        )}

        {!certInfo.url && !certVencido && (
          <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '12px' }}>
            No tenés un certificado cargado todavía.
          </div>
        )}

        <div className="field" style={{ marginBottom: '10px' }}>
          <label>{certInfo.url ? 'Renovar certificado (JPG o PDF)' : 'Subir certificado (JPG o PDF)'}</label>
          <label className="file-upload-label">
            <input type="file" accept=".jpg,.jpeg,.pdf" onChange={handleFile} style={{ display: 'none' }} />
            <span className="file-upload-btn">
              {certFile ? `✅ ${certFile.name}` : '📎 Seleccionar archivo'}
            </span>
          </label>
          <span style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>Máx. 10MB</span>
        </div>

        {msgCert && <div className={msgCert.startsWith('✅') ? 'success-msg' : 'error-msg'} style={{ marginBottom: '10px' }}>{msgCert}</div>}

        <button
          className="btn-primary"
          onClick={handleSubirCert}
          disabled={!certFile || savingCert}
        >
          {savingCert ? 'Subiendo...' : certInfo.url ? 'Renovar certificado' : 'Subir certificado'}
        </button>
      </div>

      {/* CAMBIAR CONTRASEÑA */}
      <div className="card">
        <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '14px' }}>Cambiar contraseña</h3>
        <form onSubmit={handleSavePwd}>
          <div className="form-grid">
            <div className="field">
              <label>Nueva contraseña</label>
              <input type="password" value={pwd.nueva} onChange={e => setPwd({ ...pwd, nueva: e.target.value })} placeholder="Mínimo 6 caracteres" required />
            </div>
            <div className="field">
              <label>Confirmar contraseña</label>
              <input type="password" value={pwd.confirmar} onChange={e => setPwd({ ...pwd, confirmar: e.target.value })} placeholder="Repetí la contraseña" required />
            </div>
          </div>
          {msgPwd && <div className={msgPwd.startsWith('✅') ? 'success-msg' : 'error-msg'} style={{ marginTop: '10px' }}>{msgPwd}</div>}
          <div className="form-actions" style={{ marginTop: '12px' }}>
            <button type="submit" className="btn-primary" disabled={savingPwd}>
              {savingPwd ? 'Guardando...' : 'Cambiar contraseña'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
