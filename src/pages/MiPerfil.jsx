import PageLoader from '../components/PageLoader'
import RecordsPersonales from '../components/RecordsPersonales'
import FotosModal from '../components/FotosModal'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { formatFecha, validarTelefono, capitalizarNombre, yaEmpezo } from '../lib/utils'
import PasswordInput from '../components/PasswordInput'
import { suscribirPush } from '../lib/push'

const thisYear = new Date().getFullYear()
const CLOUD = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME
const PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET

export default function MiPerfil() {
  const { user, profile } = useAuth()
  const [form, setForm] = useState({ nombre: '', fechaNacimiento: '', telefono: '' })
  const [emergencia, setEmergencia] = useState({ nombre: '', telefono: '' })
  const [msgEmergencia, setMsgEmergencia] = useState('')
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
  const [modoClaro, setModoClaro] = useState(() => document.body.classList.contains('light'))
  const [lesion, setLesion] = useState('')
  const [lesionGuardada, setLesionGuardada] = useState('')
  const [savingLesion, setSavingLesion] = useState(false)
  const [msgLesion, setMsgLesion] = useState('')
  const [pushStatus, setPushStatus] = useState('idle') // idle | loading | ok | error
  const [carrerasFotos, setCarrerasFotos] = useState([])
  const [mostrarSelectorFotos, setMostrarSelectorFotos] = useState(false)
  const [fotosCarrera, setFotosCarrera] = useState(null)

  // Tabs
  const [tab, setTab] = useState('datos')

  // Stats
  const [statsParticipaciones, setStatsParticipaciones] = useState([])
  const [statsFlamitas, setStatsFlamitas] = useState(0)

  // Metas personales
  const [metas, setMetas] = useState([])
  const [nuevaMeta, setNuevaMeta] = useState('')
  const [savingMeta, setSavingMeta] = useState(false)

  // Bugs
  const [bugs, setBugs] = useState([])
  // Eliminar cuenta
  const [confirmarEliminarCuenta, setConfirmarEliminarCuenta] = useState(false)
  const [eliminandoCuenta, setEliminandoCuenta] = useState(false)
  const [bugDesc, setBugDesc] = useState('')
  const [bugFoto, setBugFoto] = useState(null)
  const [savingBug, setSavingBug] = useState(false)
  const [msgBug, setMsgBug] = useState('')
  const bugFotoRef = useRef()

  useEffect(() => {
    fetchProfile()
    fetchBugs()
    fetchCarrerasFotos()
    fetchMetas()
    fetchStats()
    // Verificar si ya hay suscripción push activa en este dispositivo
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      navigator.serviceWorker.ready.then(reg => {
        reg.pushManager.getSubscription().then(sub => {
          if (sub) setPushStatus('ok')
        })
      }).catch(() => {})
    }
  }, [])

  async function fetchCarrerasFotos() {
    const { data } = await supabase.from('carreras')
      .select('id, nombre, fecha, hora')
      .order('fecha', { ascending: false })
    const carreras = (data || [])
      .filter(c => yaEmpezo(c.fecha, c.hora))
    setCarrerasFotos(carreras)
  }

  async function fetchMetas() {
    const { data } = await supabase.from('metas_personales')
      .select('id, texto, estado, created_at')
      .eq('user_id', user.id)
      .in('estado', ['activa', 'cumplida'])
      .order('created_at', { ascending: true })
    setMetas(data || [])
  }

  async function agregarMeta() {
    const texto = nuevaMeta.trim()
    if (!texto) return
    setSavingMeta(true)
    const { data, error } = await supabase.from('metas_personales')
      .insert([{ user_id: user.id, texto, estado: 'activa' }])
      .select().single()
    if (!error && data) {
      setMetas(prev => [...prev, data])
      setNuevaMeta('')
    }
    setSavingMeta(false)
  }

  async function resolverMeta(id, estado) {
    await supabase.from('metas_personales').update({ estado }).eq('id', id)
    if (estado === 'descartada') {
      setMetas(prev => prev.filter(m => m.id !== id))
    } else {
      setMetas(prev => prev.map(m => m.id === id ? { ...m, estado } : m))
    }
  }

  async function fetchStats() {
    const [{ data: parts }, { data: pts }, { data: prof }, { count: recCount }] = await Promise.all([
      supabase.from('participaciones')
        .select('estado, distancia_elegida, carrera:carreras(fecha, tipo_actividad)')
        .eq('user_id', user.id),
      supabase.from('puntos_carreras')
        .select('puntos')
        .eq('user_id', user.id)
        .eq('estado', 'validado'),
      supabase.from('profiles')
        .select('certificado_url, bonus_perfil_otorgado')
        .eq('id', user.id)
        .single(),
      supabase.from('records_personales')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id),
    ])
    setStatsParticipaciones(parts || [])
    const base = (pts || []).reduce((s, p) => s + (p.puntos || 0), 0)
    const calificaBonus = (recCount || 0) > 0 && !!prof?.certificado_url
    setStatsFlamitas(base + (calificaBonus ? 5 : 0))
  }

  async function fetchBugs() {
    // Borrar los resueltos con más de 24h
    const hace24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    await supabase.from('bug_reports').delete()
      .eq('user_id', user.id).eq('estado', 'resuelto').lt('resuelto_at', hace24h)
    const { data } = await supabase.from('bug_reports')
      .select('*').eq('user_id', user.id).order('created_at', { ascending: false })
    setBugs(data || [])
  }

  async function enviarBug(e) {
    e.preventDefault()
    if (!bugDesc.trim()) return
    setSavingBug(true)
    setMsgBug('')
    let foto_url = null
    if (bugFoto) {
      const fd = new FormData()
      fd.append('file', bugFoto)
      fd.append('upload_preset', PRESET)
      fd.append('folder', 'flamarun/bugs')
      const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD}/image/upload`, { method: 'POST', body: fd })
      const data = await res.json()
      if (data.secure_url) foto_url = data.secure_url
    }
    await supabase.from('bug_reports').insert({ user_id: user.id, descripcion: bugDesc.trim(), foto_url })
    setBugDesc('')
    setBugFoto(null)
    if (bugFotoRef.current) bugFotoRef.current.value = ''
    setMsgBug('✅ Reporte enviado, gracias!')
    setTimeout(() => setMsgBug(''), 3000)
    setSavingBug(false)
    fetchBugs()
  }

  async function eliminarCuenta() {
    setEliminandoCuenta(true)
    // Soft-delete: desactivar perfil en lugar de borrar el row.
    // Si se borrara solo el row de profiles, el usuario de auth seguiría
    // existiendo y podría volver a iniciar sesión (el trigger recrearía el perfil).
    // Con activo:false, auth.jsx lo cierra automáticamente en el próximo login.
    await supabase.from('profiles').update({ activo: false }).eq('id', user.id)
    await supabase.auth.signOut()
  }

  function toggleModo() {
    const nuevoModo = !modoClaro
    setModoClaro(nuevoModo)
    document.body.classList.toggle('light', nuevoModo)
    localStorage.setItem('tema', nuevoModo ? 'light' : 'dark')
  }

  async function fetchProfile() {
    const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    if (data) {
      setForm({
        nombre: data.nombre || '',
        fechaNacimiento: data.fecha_nacimiento || '',
        telefono: data.telefono || '',
      })
      setCertInfo({ url: data.certificado_url || null, fecha: data.certificado_fecha || null })
      setEmergencia({ nombre: data.emergencia_nombre || '', telefono: data.emergencia_telefono || '' })
      setAvatarUrl(data.avatar_url || null)
      setLesion(data.lesion_actual || '')
      setLesionGuardada(data.lesion_actual || '')
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
    if (form.telefono && !validarTelefono(form.telefono)) {
      setMsg('El teléfono parece inválido. Ingresá entre 8 y 15 dígitos.')
      return
    }
    setSaving(true)
    setMsg('')
    const nombre = capitalizarNombre(form.nombre)
    const { error } = await supabase.from('profiles').update({
      nombre,
      fecha_nacimiento: form.fechaNacimiento || null,
      telefono: form.telefono || null,
    }).eq('id', user.id)
    if (!error) setForm(prev => ({ ...prev, nombre }))
    setMsg(error ? 'Error al guardar' : '✅ Datos actualizados')
    setSaving(false)
  }

  async function handleSaveEmergencia(e) {
    e.preventDefault()
    setMsgEmergencia('')
    const { error } = await supabase.from('profiles').update({
      emergencia_nombre: emergencia.nombre.trim() || null,
      emergencia_telefono: emergencia.telefono.trim() || null,
    }).eq('id', user.id)
    setMsgEmergencia(error ? 'Error al guardar' : '✅ Guardado')
  }

  async function handleGuardarLesion(e) {
    e.preventDefault()
    setSavingLesion(true)
    setMsgLesion('')
    const texto = lesion.trim() || null
    const { error } = await supabase.from('profiles').update({ lesion_actual: texto }).eq('id', user.id)
    if (!error) setLesionGuardada(texto || '')
    setMsgLesion(error ? 'Error al guardar' : (texto ? '✅ Guardado' : '✅ Listo, ya no figura ninguna lesión'))
    setSavingLesion(false)
    setTimeout(() => setMsgLesion(''), 2500)
  }

  async function handleBorrarLesion() {
    setSavingLesion(true)
    setMsgLesion('')
    const { error } = await supabase.from('profiles').update({ lesion_actual: null }).eq('id', user.id)
    if (!error) { setLesion(''); setLesionGuardada('') }
    setMsgLesion(error ? 'Error al borrar' : '✅ Listo, ya no figura ninguna lesión')
    setSavingLesion(false)
    setTimeout(() => setMsgLesion(''), 2500)
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
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf', 'application/octet-stream', '']
    if (file.type && !validTypes.includes(file.type) && !file.type.startsWith('image/')) { setMsgCert('El archivo debe ser JPG, PNG o PDF'); return }
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

  const [certSignedUrl, setCertSignedUrl] = useState(null)

  useEffect(() => {
    if (!certInfo.url) return
    if (certInfo.url.startsWith('http')) { setCertSignedUrl(certInfo.url); return }
    supabase.storage.from('certificados').createSignedUrl(certInfo.url, 60 * 60)
      .then(({ data }) => { if (data?.signedUrl) setCertSignedUrl(data.signedUrl) })
  }, [certInfo.url])

  const certAnio = certInfo.fecha ? new Date(certInfo.fecha).getFullYear() : null
  const certVencido = certAnio !== null && certAnio < thisYear

  if (loading) return <PageLoader />

  return (
    <div className="page">
      <div className="page-header"><h2>Mi perfil</h2></div>

      {/* TABS */}
      <div className="filtro-group" style={{ marginBottom: '12px' }}>
        <button className={`filtro-btn ${tab === 'datos' ? 'active' : ''}`} onClick={() => setTab('datos')}>Datos personales</button>
        <button className={`filtro-btn ${tab === 'estadisticas' ? 'active' : ''}`} onClick={() => setTab('estadisticas')}>Estadísticas</button>
      </div>

      {tab === 'datos' && <>

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
          {avatarFile ? (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button className="btn-primary" style={{ height: 32, fontSize: 13, padding: '0 14px' }} onClick={handleSubirAvatar} disabled={savingAvatar}>
                {savingAvatar ? 'Subiendo...' : 'Guardar foto'}
              </button>
              <button className="btn-ghost" style={{ height: 32, fontSize: 13, padding: '0 12px' }} onClick={() => {
                setAvatarFile(null)
                // Restaurar la foto original
                supabase.from('profiles').select('avatar_url').eq('id', user.id).single()
                  .then(({ data }) => setAvatarUrl(data?.avatar_url || null))
              }} disabled={savingAvatar}>
                Cancelar
              </button>
            </div>
          ) : (
            <span style={{ fontSize: 12, color: '#64748b' }}>Tocá la foto para cambiarla</span>
          )}
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
              Subido el {formatFecha(certInfo.fecha)} · Válido hasta el 31/12/{certAnio}
            </div>
            {certSignedUrl && (
              <a href={certSignedUrl} target="_blank" rel="noopener noreferrer" className="race-link">
                Ver certificado →
              </a>
            )}
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

      {/* CONTACTO DE EMERGENCIA */}
      <div className="card" style={{ marginBottom: '12px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '14px' }}>Contacto de emergencia</h3>
        <form onSubmit={handleSaveEmergencia}>
          <div className="field" style={{ marginBottom: '10px' }}>
            <label>Nombre</label>
            <input value={emergencia.nombre} onChange={e => setEmergencia({ ...emergencia, nombre: e.target.value })} placeholder="Ej: María García" />
          </div>
          <div className="field" style={{ marginBottom: '10px' }}>
            <label>Teléfono</label>
            <input type="tel" value={emergencia.telefono} onChange={e => setEmergencia({ ...emergencia, telefono: e.target.value })} placeholder="+54 11 1234-5678" />
          </div>
          {msgEmergencia && <div className={msgEmergencia.startsWith('✅') ? 'success-msg' : 'error-msg'} style={{ marginBottom: '10px' }}>{msgEmergencia}</div>}
          <button type="submit" className="btn-primary">Guardar contacto</button>
        </form>
      </div>

      {/* LESIONES / MOLESTIAS */}
      <div className="card" style={{ marginBottom: '12px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '6px' }}>Lesiones / molestias</h3>
        <div style={{ fontSize: '12px', color: 'var(--text2)', marginBottom: '14px', lineHeight: 1.4 }}>
          Si tenés alguna lesión o molestia, contanos brevemente para que el equipo lo tenga en cuenta. Solo lo van a poder ver los profes.
        </div>
        <form onSubmit={handleGuardarLesion}>
          <div className="form-grid">
            <div className="field full">
              <label>Detalle</label>
              <input value={lesion} onChange={e => setLesion(e.target.value)} placeholder="Ej: molestia en la rodilla derecha" maxLength={200} />
            </div>
          </div>
          {msgLesion && <div className={msgLesion.startsWith('✅') ? 'success-msg' : 'error-msg'} style={{ marginTop: '10px' }}>{msgLesion}</div>}
          <div className="form-actions" style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
            <button type="submit" className="btn-primary" disabled={savingLesion || lesion.trim() === lesionGuardada}>
              {savingLesion ? 'Guardando...' : 'Guardar'}
            </button>
            {lesionGuardada && (
              <button type="button" className="btn-ghost" onClick={handleBorrarLesion} disabled={savingLesion}>
                Quitar
              </button>
            )}
          </div>
        </form>
      </div>

      {/* METAS PERSONALES */}
      <div className="card" style={{ marginBottom: '12px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '4px' }}>🎯 Metas personales</h3>
        <div style={{ fontSize: '12px', color: 'var(--text2)', marginBottom: '14px' }}>Escribí tus objetivos de entrenamiento o carrera.</div>
        {metas.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '12px' }}>
            {metas.map(m => (
              <div key={m.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', background: m.estado === 'cumplida' ? 'rgba(74,222,128,0.06)' : 'var(--bg3)', borderRadius: '8px', padding: '8px 10px', opacity: m.estado === 'cumplida' ? 0.75 : 1 }}>
                <span style={{ flex: 1, fontSize: '13px', lineHeight: 1.5, textDecoration: m.estado === 'cumplida' ? 'line-through' : 'none', color: m.estado === 'cumplida' ? '#4ade80' : 'var(--text)' }}>
                  {m.estado === 'cumplida' && '✓ '}{m.texto}
                </span>
                {m.estado === 'activa' && (
                  <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                    <button
                      onClick={() => resolverMeta(m.id, 'cumplida')}
                      title="Cumplida"
                      style={{ background: 'rgba(74,222,128,0.15)', border: 'none', color: '#4ade80', cursor: 'pointer', fontSize: '11px', fontWeight: 600, padding: '2px 7px', borderRadius: '6px', fontFamily: 'inherit' }}
                    >✓ Cumplida</button>
                    <button
                      onClick={() => resolverMeta(m.id, 'descartada')}
                      title="Descartar"
                      style={{ background: 'rgba(248,113,113,0.12)', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: '11px', fontWeight: 600, padding: '2px 7px', borderRadius: '6px', fontFamily: 'inherit' }}
                    >✕ Descartar</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            value={nuevaMeta}
            onChange={e => setNuevaMeta(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && agregarMeta()}
            placeholder="Ej: Correr 21K en menos de 2hs"
            style={{ flex: 1, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text)', padding: '8px 10px', fontSize: '13px', fontFamily: 'inherit' }}
          />
          <button
            onClick={agregarMeta}
            disabled={!nuevaMeta.trim() || savingMeta}
            className="btn-primary"
            style={{ padding: '0 14px', fontSize: '13px', height: 36, flexShrink: 0 }}
          >+ Agregar</button>
        </div>
      </div>

      {/* NOTIFICACIONES */}
      <div className="card" style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: 2 }}>Notificaciones</div>
          <div style={{ fontSize: '12px', color: '#94a3b8' }}>
            {pushStatus === 'ok' ? '✓ Activadas en este dispositivo' : 'Recibí avisos en el celular'}
          </div>
        </div>
        <button
          onClick={async () => {
            setPushStatus('loading')
            try {
              const sub = await suscribirPush()
              setPushStatus(sub ? 'ok' : 'error')
            } catch (e) {
              console.error('Push error:', e)
              setPushStatus('error')
            }
          }}
          disabled={pushStatus === 'loading' || pushStatus === 'ok'}
          style={{
            padding: '8px 14px', borderRadius: '8px', border: 'none', cursor: pushStatus === 'ok' ? 'default' : 'pointer',
            background: pushStatus === 'ok' ? '#4ade8022' : '#ff2d2d', color: pushStatus === 'ok' ? '#4ade80' : '#fff',
            fontSize: '13px', fontWeight: 600, fontFamily: 'inherit', flexShrink: 0,
          }}
        >
          {pushStatus === 'loading' ? '...' : pushStatus === 'ok' ? '✓ Listo' : pushStatus === 'error' ? 'Reintentar' : 'Activar'}
        </button>
      </div>

      {/* APARIENCIA */}
      <div className="card" style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: 2 }}>Apariencia</div>
          <div style={{ fontSize: '12px', color: '#94a3b8' }}>{modoClaro ? '☀️ Modo claro' : '🌙 Modo oscuro'}</div>
        </div>
        <button
          onClick={toggleModo}
          style={{
            width: 52, height: 28, borderRadius: 999, border: 'none', cursor: 'pointer',
            background: modoClaro ? '#ff2d2d' : 'var(--bg3)',
            position: 'relative', transition: 'background 0.2s', flexShrink: 0,
          }}
        >
          <span style={{
            position: 'absolute', top: 3, left: modoClaro ? 27 : 3,
            width: 22, height: 22, borderRadius: '50%',
            background: '#fff', transition: 'left 0.2s',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12,
          }}>
            {modoClaro ? '☀️' : '🌙'}
          </span>
        </button>
      </div>

      {/* CARGA DE FOTOS */}
      <div className="card" style={{ marginBottom: '12px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '6px' }}>📷 Carga de fotos</h3>
        <div style={{ fontSize: '12px', color: 'var(--text2)', marginBottom: '14px', lineHeight: 1.4 }}>
          ¿Tenés fotos de alguna carrera? Subilas acá para que todos las puedan ver.
        </div>
        {carrerasFotos.length === 0 ? (
          <div style={{ fontSize: '13px', color: 'var(--text2)' }}>Todavía no hay carreras para subir fotos.</div>
        ) : !mostrarSelectorFotos ? (
          <button className="btn-primary" onClick={() => setMostrarSelectorFotos(true)}>Elegir carrera</button>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {carrerasFotos.map(c => (
              <button
                key={c.id}
                onClick={() => { setFotosCarrera(c); setMostrarSelectorFotos(false) }}
                className="btn-ghost"
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', textAlign: 'left', width: '100%' }}
              >
                <span>{c.nombre}</span>
                {c.fecha && <span style={{ fontSize: '12px', color: 'var(--text2)' }}>{formatFecha(c.fecha)}</span>}
              </button>
            ))}
            <button className="btn-ghost" style={{ alignSelf: 'flex-start' }} onClick={() => setMostrarSelectorFotos(false)}>Cancelar</button>
          </div>
        )}
      </div>

      {fotosCarrera && (
        <FotosModal carrera={fotosCarrera} onClose={() => setFotosCarrera(null)} />
      )}

      {/* CAMBIAR CONTRASEÑA */}
      <div className="card" style={{ marginBottom: '12px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '14px' }}>Cambiar contraseña</h3>
        <form onSubmit={handleSavePwd}>
          <div className="form-grid">
            <div className="field">
              <label>Nueva contraseña</label>
              <PasswordInput value={pwd.nueva} onChange={e => setPwd({ ...pwd, nueva: e.target.value })} placeholder="Mínimo 8 caracteres, con letras y números" autoComplete="new-password" required />
            </div>
            <div className="field">
              <label>Confirmar contraseña</label>
              <PasswordInput value={pwd.confirmar} onChange={e => setPwd({ ...pwd, confirmar: e.target.value })} placeholder="Repetí la contraseña" autoComplete="new-password" required />
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

      {/* REPORTAR PROBLEMA CON LA APP */}
      <div className="card" style={{ marginBottom: '12px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '14px' }}>🐛 Reportar un problema con la App</h3>
        <form onSubmit={enviarBug}>
          <div className="field" style={{ marginBottom: '10px' }}>
            <label>¿Qué pasó?</label>
            <textarea
              value={bugDesc}
              onChange={e => setBugDesc(e.target.value)}
              placeholder="Describí el problema lo más claro posible..."
              required
              style={{ width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: '10px', color: 'var(--text)', padding: '10px 12px', fontSize: '14px', resize: 'none', minHeight: '90px', fontFamily: 'inherit' }}
            />
          </div>
          <div className="field" style={{ marginBottom: '12px' }}>
            <label>Foto (opcional)</label>
            <label className="file-upload-label">
              <input ref={bugFotoRef} type="file" accept="image/*" onChange={e => setBugFoto(e.target.files[0])} style={{ display: 'none' }} />
              <span className="file-upload-btn">{bugFoto ? `✅ ${bugFoto.name}` : '📎 Adjuntar imagen'}</span>
            </label>
          </div>
          {msgBug && <div className="success-msg" style={{ marginBottom: '10px' }}>{msgBug}</div>}
          <button type="submit" className="btn-primary" disabled={savingBug || !bugDesc.trim()}>
            {savingBug ? 'Enviando...' : 'Enviar reporte'}
          </button>
        </form>

        {bugs.length > 0 && (
          <div style={{ marginTop: '16px', borderTop: '1px solid var(--border)', paddingTop: '14px' }}>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text2)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Mis reportes</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {bugs.map(b => (
                <div key={b.id} style={{ background: 'var(--bg3)', borderRadius: '8px', padding: '10px 12px', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '13px', marginBottom: '4px' }}>{b.descripcion}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text2)' }}>
                      {new Date(b.created_at).toLocaleDateString('es-AR')}
                    </div>
                  </div>
                  <span style={{
                    fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '20px', flexShrink: 0,
                    background: b.estado === 'resuelto' ? 'rgba(74,222,128,0.15)' : 'rgba(251,191,36,0.15)',
                    color: b.estado === 'resuelto' ? '#4ade80' : '#fbbf24',
                  }}>
                    {b.estado === 'resuelto' ? '✓ Resuelto' : '⏳ Pendiente'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ELIMINAR CUENTA */}
      <div className="card" style={{ marginBottom: '12px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '6px' }}>Eliminar cuenta</h3>
        <p style={{ fontSize: '13px', color: 'var(--text2)', marginBottom: '14px' }}>
          Se borrarán todos tus datos: perfil, participaciones y reportes. Esta acción no se puede deshacer.
        </p>
        {!confirmarEliminarCuenta ? (
          <button
            onClick={() => setConfirmarEliminarCuenta(true)}
            style={{ background: 'rgba(248,113,113,0.1)', color: '#f87171', border: '1px solid rgba(248,113,113,0.3)', borderRadius: '8px', padding: '8px 16px', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit' }}
          >
            Eliminar mi cuenta
          </button>
        ) : (
          <div style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)', borderRadius: '10px', padding: '14px' }}>
            <p style={{ fontSize: '13px', color: '#f87171', marginBottom: '12px', fontWeight: 600 }}>
              ¿Estás seguro? No hay vuelta atrás.
            </p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={eliminarCuenta} disabled={eliminandoCuenta}
                style={{ background: '#f87171', color: '#fff', border: 'none', borderRadius: '8px', padding: '8px 16px', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>
                {eliminandoCuenta ? 'Eliminando...' : 'Sí, eliminar'}
              </button>
              <button onClick={() => setConfirmarEliminarCuenta(false)} className="btn-ghost" style={{ fontSize: '13px' }}>
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>

      </>}

      {/* ESTADÍSTICAS TAB */}
      {tab === 'estadisticas' && (() => {
        const hoy = new Date().toISOString().split('T')[0]
        const inscriptas = statsParticipaciones.filter(p => p.estado === 'Inscripto')
        const pasadas = inscriptas.filter(p => p.carrera?.fecha && p.carrera.fecha < hoy)
        const carreras = pasadas.filter(p => !p.carrera?.tipo_actividad || p.carrera?.tipo_actividad === 'carrera')
        const eventosEntrenos = pasadas.filter(p => p.carrera?.tipo_actividad === 'evento' || p.carrera?.tipo_actividad === 'entrenamiento')
        const kmTotales = pasadas.reduce((s, p) => {
          const n = parseFloat(p.distancia_elegida)
          return s + (isNaN(n) ? 0 : n)
        }, 0)
        return (
          <>
            <RecordsPersonales />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '12px' }}>
              {[
                { label: 'Carreras', value: carreras.length, icon: '🏅' },
                { label: 'Eventos / Entrenos', value: eventosEntrenos.length, icon: '🏃' },
                { label: 'Kilómetros totales', value: kmTotales > 0 ? `${kmTotales.toFixed(0)} km` : '—', icon: '📏' },
                { label: 'Flamitas ganadas', value: statsFlamitas > 0 ? `💎 ${statsFlamitas}` : '—', icon: null },
              ].map(({ label, value, icon }) => (
                <div key={label} className="card" style={{ textAlign: 'center', padding: '16px 10px' }}>
                  {icon && <div style={{ fontSize: '22px', marginBottom: '6px' }}>{icon}</div>}
                  <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--accent)', marginBottom: '4px' }}>{value}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text2)', lineHeight: 1.3 }}>{label}</div>
                </div>
              ))}
            </div>
          </>
        )
      })()}

    </div>
  )
}
