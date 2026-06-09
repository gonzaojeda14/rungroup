import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { suscribirPush } from '../lib/push'
import { formatTelefonoWA } from '../lib/utils'
import PageLoader from '../components/PageLoader'
import ConfirmModal from '../components/ConfirmModal'


function tiempoAtras(fecha) {
  const diff = Math.floor((new Date() - new Date(fecha)) / (1000 * 60))
  if (diff < 60) return `hace ${diff} min`
  if (diff < 1440) return `hace ${Math.floor(diff / 60)}h`
  if (diff < 10080) return `hace ${Math.floor(diff / 1440)} días`
  return new Date(fecha).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export default function Novedades() {
  const { isAdmin, user, marcarAvisosLeidos, profile } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [tipo, setTipo] = useState('anuncio')
  const [titulo, setTitulo] = useState('')
  const [contenido, setContenido] = useState('')
  const [archivo, setArchivo] = useState(null)
  const [imagenesAnuncio, setImagenesAnuncio] = useState([]) // array de File
  const [imagenesPreview, setImagenesPreview] = useState([]) // array de URLs
  const [contactoHabilitado, setContactoHabilitado] = useState(false)
  const [contactoLabel, setContactoLabel] = useState('')
  const [programarEn, setProgramarEn] = useState('')
  const [saving, setSaving] = useState(false)
  const [msgError, setMsgError] = useState('')
  const [verAnteriores, setVerAnteriores] = useState(false)
  const [confirmarEliminar, setConfirmarEliminar] = useState(null) // id a eliminar

  useEffect(() => {
    fetchNovedades()
    marcarAvisosLeidos()
    suscribirPush().catch(() => {})
    const channel = supabase.channel('novedades-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'novedades' }, fetchNovedades)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [])

  async function fetchNovedades() {
    const { data, error } = await supabase
      .from('novedades')
      .select('*')
      .order('publicar_en', { ascending: false, nullsFirst: true })
    if (error) console.error('Error al cargar novedades:', error)

    // Resolver datos del autor por separado (no hay relación FK directa para el embed de Supabase)
    let itemsConAutor = data || []
    const autorIds = [...new Set(itemsConAutor.filter(i => i.contacto_habilitado && i.autor_id).map(i => i.autor_id))]
    if (autorIds.length) {
      const { data: autores } = await supabase.from('profiles').select('id, nombre, telefono').in('id', autorIds)
      const mapAutores = {}
      ;(autores || []).forEach(a => { mapAutores[a.id] = a })
      itemsConAutor = itemsConAutor.map(i => ({ ...i, autor: i.autor_id ? mapAutores[i.autor_id] : null }))
    }
    setItems(itemsConAutor)

    // Generar URLs firmadas para planes con archivo
    const conArchivo = (data || []).filter(i => i.tipo === 'plan' && i.archivo_url)
    if (conArchivo.length) {
      const results = await Promise.all(conArchivo.map(async p => {
        const { data: sd } = await supabase.storage.from('planes').createSignedUrl(p.archivo_url, 60 * 60)
        return [p.archivo_url, sd?.signedUrl]
      }))
      const map = {}
      results.forEach(([key, val]) => { if (val) map[key] = val })
      setPlanesUrls(map)
    }

    setLoading(false)
  }

  const ahora = new Date().toISOString()
  // Admin ve todo, corredores solo los publicados
  const itemsVisibles = isAdmin
    ? items
    : items.filter(i => !i.publicar_en || i.publicar_en <= ahora)

  async function handlePublicar(e) {
    e.preventDefault()
    if (tipo === 'anuncio' && !contenido.trim()) {
      setMsgError('El mensaje es obligatorio')
      return
    }
    if (tipo === 'plan' && !archivo && !contenido.trim()) {
      setMsgError('Agregá un mensaje o un archivo')
      return
    }
    setMsgError('')
    setSaving(true)

    let archivoUrl = null
    let archivoNombre = null
    let imagenesUrls = []

    // Subir imágenes del anuncio a Cloudinary
    if (imagenesAnuncio.length > 0) {
      const CLOUD = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME
      const PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET
      imagenesUrls = await Promise.all(imagenesAnuncio.map(async img => {
        const fd = new FormData()
        fd.append('file', img)
        fd.append('upload_preset', PRESET)
        fd.append('folder', 'flamarun/anuncios')
        const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD}/image/upload`, { method: 'POST', body: fd })
        const data = await res.json()
        return data.secure_url || null
      }))
      imagenesUrls = imagenesUrls.filter(Boolean)
    }

    if (archivo) {
      const ext = archivo.name.split('.').pop().toLowerCase()
      const path = `${Date.now()}_${archivo.name}`
      const { error: uploadError } = await supabase.storage
        .from('planes')
        .upload(path, archivo, { upsert: false })
      if (uploadError) {
        setMsgError('Error al subir el archivo: ' + uploadError.message)
        setSaving(false)
        return
      }
      archivoUrl = path
      archivoNombre = archivo.name
    }

    const { error: insertError } = await supabase.from('novedades').insert([{
      tipo,
      titulo: titulo || null,
      contenido: contenido || null,
      archivo_url: archivoUrl,
      archivo_nombre: archivoNombre,
      imagen_url: imagenesUrls[0] || null,
      imagenes_urls: imagenesUrls.length > 0 ? imagenesUrls : null,
      publicar_en: programarEn ? new Date(programarEn).toISOString() : null,
      contacto_habilitado: contactoHabilitado,
      contacto_label: contactoHabilitado && contactoLabel ? contactoLabel : null,
      autor_id: user.id,
    }])

    if (insertError) {
      setMsgError('Error al publicar: ' + insertError.message)
      setSaving(false)
      return
    }

    // Disparar push a todos los suscriptores (solo si es publicación inmediata, y solo si se guardó bien)
    if (!programarEn) {
      const { data: { session } } = await supabase.auth.getSession()
      fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-push`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ title: titulo || '', body: contenido || '', tipo }),
      }).then(r => r.text()).then(t => console.log('Push result:', t))
        .catch(e => console.error('Push error:', e))
    }

    setTitulo('')
    setContenido('')
    setArchivo(null)
    setImagenesAnuncio([])
    setImagenesPreview([])
    setContactoHabilitado(false)
    setContactoLabel('')
    setProgramarEn('')
    setShowForm(false)
    setSaving(false)
    fetchNovedades()
  }

  async function handleEliminar(id) {
    await supabase.from('novedades').delete().eq('id', id)
    setConfirmarEliminar(null)
    fetchNovedades()
  }

  const [planesUrls, setPlanesUrls] = useState({}) // { archivo_url: signedUrl }

  const planes = itemsVisibles.filter(i => i.tipo === 'plan')
  const planesRecientes = planes.slice(0, 4)
  const planesAnteriores = planes.slice(4)

  const anuncios = itemsVisibles.filter(i => i.tipo === 'anuncio')

  if (loading) return <PageLoader />

  return (
    <div className="page">
      <div className="page-header">
        <h2>Avisos</h2>
        {isAdmin && (
          showForm
            ? <button className="btn-icon" onClick={() => setShowForm(false)} style={{ fontSize: '18px', color: 'var(--text2)' }}>✕</button>
            : <button className="btn-accent" onClick={() => setShowForm(true)}>+ Publicar</button>
        )}
      </div>

      {/* FORM */}
      {isAdmin && showForm && (
        <form className="card form-card" onSubmit={handlePublicar} noValidate>
          <div className="filtro-group" style={{ marginBottom: '14px' }}>
            {[['anuncio', '📢 Anuncio'], ['plan', '📄 Plan semanal']].map(([val, label]) => (
              <button
                key={val} type="button"
                className={`filtro-btn ${tipo === val ? 'active' : ''}`}
                onClick={() => setTipo(val)}
              >{label}</button>
            ))}
          </div>

          {tipo === 'anuncio' && (
            <>
              <div className="field" style={{ marginBottom: '10px' }}>
                <label>Título (opcional)</label>
                <input value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Ej: ¡Se viene la media maratón!" />
              </div>
              <div className="field" style={{ marginBottom: '10px' }}>
                <label>Mensaje *</label>
                <textarea
                  value={contenido}
                  onChange={e => setContenido(e.target.value)}
                  placeholder="Escribí el anuncio acá..."
                  required
                  style={{
                    width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)',
                    borderRadius: '10px', color: 'var(--text)', padding: '10px 12px',
                    fontSize: '14px', resize: 'none', minHeight: '120px', fontFamily: 'inherit',
                  }}
                />
              </div>
              <div className="field" style={{ marginBottom: '10px' }}>
                <label>Imágenes (opcional)</label>
                {imagenesPreview.length > 0 && (
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
                    {imagenesPreview.map((url, i) => (
                      <div key={i} style={{ position: 'relative', display: 'inline-block' }}>
                        <img src={url} alt="" style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: '8px' }} />
                        <button
                          type="button"
                          onClick={() => {
                            setImagenesAnuncio(prev => prev.filter((_, j) => j !== i))
                            setImagenesPreview(prev => prev.filter((_, j) => j !== i))
                          }}
                          style={{ position: 'absolute', top: 2, right: 2, width: 20, height: 20, borderRadius: '50%', background: 'rgba(0,0,0,0.7)', border: 'none', color: '#fff', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >✕</button>
                      </div>
                    ))}
                  </div>
                )}
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', padding: '10px 12px', background: 'var(--bg3)', border: '1px dashed var(--border)', borderRadius: '10px', fontSize: '13px', color: 'var(--text2)' }}>
                  📷 Agregar imagen{imagenesPreview.length > 0 ? ' más' : ''}
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    style={{ display: 'none' }}
                    onChange={e => {
                      const files = Array.from(e.target.files)
                      if (!files.length) return
                      setImagenesAnuncio(prev => [...prev, ...files])
                      setImagenesPreview(prev => [...prev, ...files.map(f => URL.createObjectURL(f))])
                      e.target.value = ''
                    }}
                  />
                </label>
              </div>
            </>
          )}

          {tipo === 'plan' && (
            <>
              <div className="field" style={{ marginBottom: '10px' }}>
                <label>Título (ej: Plan semana 23/06)</label>
                <input value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Plan semana 23/06" />
              </div>
              <div className="field" style={{ marginBottom: '10px' }}>
                <label>Archivo *</label>
                <label className="file-upload-label">
                  <input type="file" accept=".docx,.pdf,.doc" onChange={e => setArchivo(e.target.files[0])} style={{ display: 'none' }} />
                  <span className="file-upload-btn">
                    {archivo ? `✅ ${archivo.name}` : '📎 Seleccionar archivo'}
                  </span>
                </label>
                <div style={{ fontSize: '11px', color: 'var(--text2)', marginTop: '6px' }}>
                  Recomendamos subir en formato <strong>PDF</strong> — se abre directo en el celular sin necesidad de otra app. Los DOCX también funcionan pero pueden pedir seleccionar una app para abrirse.
                </div>
              </div>
            </>
          )}

          {tipo === 'anuncio' && (
            <div style={{ marginBottom: '14px' }}>
              <div
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: '10px', cursor: 'pointer' }}
                onClick={() => setContactoHabilitado(v => !v)}
              >
                <span style={{ fontSize: '13px' }}>Agregar botón de contacto directo</span>
                <div style={{ width: 36, height: 20, borderRadius: 10, background: contactoHabilitado ? 'var(--accent)' : 'var(--border)', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
                  <div style={{ position: 'absolute', top: 2, left: contactoHabilitado ? 18 : 2, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
                </div>
              </div>
              {contactoHabilitado && (
                <input
                  value={contactoLabel}
                  onChange={e => setContactoLabel(e.target.value)}
                  placeholder='Ej: "Reservar buzo" o "Hablar con Santi"'
                  style={{ marginTop: '8px', width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: '10px', color: 'var(--text)', padding: '8px 12px', fontSize: '13px', fontFamily: 'inherit', boxSizing: 'border-box' }}
                />
              )}
            </div>
          )}

          <div className="field" style={{ marginBottom: '14px' }}>
            <label>Programar para más tarde (opcional)</label>
            <input
              type="datetime-local"
              value={programarEn}
              onChange={e => setProgramarEn(e.target.value)}
            />
            {programarEn && <span style={{ fontSize: '11px', color: 'var(--text2)', marginTop: '4px' }}>Se publicará el {new Date(programarEn).toLocaleString('es-AR')}</span>}
          </div>

          {msgError && <p style={{ color: '#f87171', fontSize: '13px', marginBottom: '8px' }}>{msgError}</p>}
          <div className="form-actions">
            <button type="button" className="btn-ghost" onClick={() => setShowForm(false)}>Cancelar</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Guardando...' : programarEn ? '🕐 Programar' : 'Publicar ahora'}
            </button>
          </div>
        </form>
      )}

      {/* PLANES SEMANALES */}
      {planes.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' }}>
            📄 Planes semanales
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {planesRecientes.map((p, i) => (
              <div key={p.id} className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '2px' }}>
                    {p.titulo || 'Plan semanal'}
                    {i === 0 && <span style={{ marginLeft: '8px', fontSize: '11px', background: 'rgba(74,222,128,0.15)', color: '#4ade80', padding: '2px 8px', borderRadius: '20px' }}>Actual</span>}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text2)' }}>{tiempoAtras(p.created_at)}</div>
                </div>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  {p.archivo_url && planesUrls[p.archivo_url] && (
                    <button
                      className="btn-ghost"
                      style={{ height: 32, fontSize: 12, padding: '0 12px' }}
                      onClick={() => {
                        const url = planesUrls[p.archivo_url]
                        // En iOS PWA target="_blank" abre un webview in-app que queda en blanco.
                        // En mobile navegamos directo (Safari abre el archivo y el back vuelve a la app).
                        // En desktop abrimos en pestaña nueva.
                        // iOS PWA: target="_blank" abre un webview que queda en blanco con archivos de Supabase.
                        // Solución: navegar directo (Safari abre el archivo, back button vuelve a la app).
                        // Android y desktop: window.open funciona bien y abre en nueva pestaña sin efectos raros.
                        if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) {
                          window.location.href = url
                        } else {
                          window.open(url, '_blank', 'noopener,noreferrer')
                        }
                      }}
                    >
                      Abrir →
                    </button>
                  )}
                  {isAdmin && <button className="btn-icon danger" onClick={() => setConfirmarEliminar(p.id)}>✕</button>}
                </div>
              </div>
            ))}

            {planesAnteriores.length > 0 && (
              <>
                <button
                  onClick={() => setVerAnteriores(v => !v)}
                  style={{ background: 'none', border: 'none', color: 'var(--text2)', fontSize: '13px', cursor: 'pointer', textAlign: 'left', padding: '4px 0' }}
                >
                  {verAnteriores ? '▲ Ocultar anteriores' : `▼ Ver ${planesAnteriores.length} planes anteriores`}
                </button>
                {verAnteriores && planesAnteriores.map(p => (
                  <div key={p.id} className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', opacity: 0.6 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '2px' }}>{p.titulo || 'Plan semanal'}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text2)' }}>{tiempoAtras(p.created_at)}</div>
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      {p.archivo_url && <button onClick={() => abrirArchivo(p.archivo_url)} className="btn-ghost" style={{ height: 32, fontSize: 12, padding: '0 12px' }}>Abrir →</button>}
                      {isAdmin && <button className="btn-icon danger" onClick={() => setConfirmarEliminar(p.id)}>✕</button>}
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      )}

      {/* ANUNCIOS */}
      {anuncios.length > 0 && (
        <div>
          <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' }}>
            📢 Anuncios
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {anuncios.map(a => (
              <div key={a.id} className="card" style={{ borderLeft: '3px solid rgba(255,45,45,0.4)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: a.contenido ? '8px' : 0 }}>
                  <div>
                    {a.titulo && <div style={{ fontWeight: 600, fontSize: '15px', marginBottom: '2px' }}>{a.titulo}</div>}
                    <div style={{ fontSize: '12px', color: 'var(--text2)', display: 'flex', gap: '8px', alignItems: 'center' }}>
                      {isAdmin && a.publicar_en && new Date(a.publicar_en) > new Date()
                        ? <span style={{ color: '#fbbf24' }}>🕐 Programado para {new Date(a.publicar_en).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                        : tiempoAtras(a.created_at)
                      }
                    </div>
                  </div>
                  {isAdmin && <button className="btn-icon danger" onClick={() => setConfirmarEliminar(a.id)}>✕</button>}
                </div>
                {a.contenido && (
                  <div style={{ fontSize: '14px', color: 'var(--text)', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                    {a.contenido}
                  </div>
                )}
                {(a.imagenes_urls?.length > 0 ? a.imagenes_urls : a.imagen_url ? [a.imagen_url] : []).map((url, i) => (
                  <img
                    key={i}
                    src={url}
                    alt=""
                    style={{ width: '100%', borderRadius: '10px', marginTop: '10px', objectFit: 'cover', maxHeight: '300px', cursor: 'pointer' }}
                    onClick={() => window.open(url, '_blank')}
                  />
                ))}
                {a.contacto_habilitado && a.autor?.telefono && (
                  <a
                    href={`https://wa.me/${formatTelefonoWA(a.autor.telefono)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginTop: '12px', padding: '10px 16px', background: 'rgba(74,222,128,0.12)', border: '1px solid rgba(74,222,128,0.3)', borderRadius: '10px', color: '#4ade80', fontWeight: 600, fontSize: '14px', textDecoration: 'none' }}
                  >
                    <svg width="16" height="16" viewBox="0 0 32 32" fill="currentColor"><path d="M16 2C8.28 2 2 8.28 2 16c0 2.44.65 4.73 1.79 6.72L2 30l7.47-1.76A13.93 13.93 0 0 0 16 30c7.72 0 14-6.28 14-14S23.72 2 16 2zm0 25.5c-2.2 0-4.27-.6-6.04-1.64l-.43-.26-4.43 1.04 1.07-4.3-.28-.45A11.45 11.45 0 0 1 4.5 16C4.5 9.6 9.6 4.5 16 4.5S27.5 9.6 27.5 16 22.4 27.5 16 27.5zm6.27-8.57c-.34-.17-2.02-1-2.34-1.11-.32-.11-.55-.17-.78.17-.23.34-.9 1.11-1.1 1.34-.2.23-.4.26-.74.09-.34-.17-1.44-.53-2.74-1.69-1.01-.9-1.7-2.01-1.9-2.35-.2-.34-.02-.52.15-.69.15-.15.34-.4.51-.6.17-.2.23-.34.34-.57.11-.23.06-.43-.03-.6-.09-.17-.78-1.88-1.07-2.57-.28-.67-.57-.58-.78-.59h-.67c-.23 0-.6.09-.91.43-.32.34-1.2 1.17-1.2 2.86s1.23 3.32 1.4 3.55c.17.23 2.42 3.7 5.87 5.19.82.35 1.46.56 1.96.72.82.26 1.57.22 2.16.13.66-.1 2.02-.82 2.31-1.62.28-.8.28-1.48.2-1.62-.09-.14-.32-.23-.66-.4z"/></svg>
                    {a.contacto_label || 'Contactar'}
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {items.length === 0 && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "60px 24px", gap: "16px" }}><img src="/logo-flama.png" alt="Flama Run" style={{ height: 64, width: "auto", opacity: 0.12 }} /><p style={{ color: "var(--text2)", fontSize: "14px", textAlign: "center", margin: 0 }}>Todo tranquilo por acá.<br />Las novedades aparecerán aquí.</p></div>
      )}

      {confirmarEliminar && (
        <ConfirmModal
          mensaje="¿Querés eliminar esta novedad?"
          onConfirm={() => handleEliminar(confirmarEliminar)}
          onCancel={() => setConfirmarEliminar(null)}
        />
      )}
    </div>
  )
}
