import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { suscribirPush } from '../lib/push'
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
  const [programarEn, setProgramarEn] = useState('')
  const [saving, setSaving] = useState(false)
  const [verAnteriores, setVerAnteriores] = useState(false)
  const [confirmarEliminar, setConfirmarEliminar] = useState(null) // id a eliminar

  useEffect(() => {
    fetchNovedades()
    marcarAvisosLeidos()
    suscribirPush().catch(() => {}) // solicitar permiso de push al entrar
  }, [])

  async function fetchNovedades() {
    const { data } = await supabase
      .from('novedades')
      .select('*')
      .order('publicar_en', { ascending: false, nullsFirst: true })
    setItems(data || [])
    setLoading(false)
  }

  const ahora = new Date().toISOString()
  // Admin ve todo, corredores solo los publicados
  const itemsVisibles = isAdmin
    ? items
    : items.filter(i => !i.publicar_en || i.publicar_en <= ahora)

  async function handlePublicar(e) {
    e.preventDefault()
    setSaving(true)

    let archivoUrl = null
    let archivoNombre = null

    if (archivo) {
      const ext = archivo.name.split('.').pop().toLowerCase()
      const path = `${Date.now()}_${archivo.name}`
      const { error: uploadError } = await supabase.storage
        .from('planes')
        .upload(path, archivo, { upsert: false })
      if (!uploadError) {
        archivoUrl = path
        archivoNombre = archivo.name
      }
    }

    await supabase.from('novedades').insert([{
      tipo,
      titulo: titulo || null,
      contenido: contenido || null,
      archivo_url: archivoUrl,
      archivo_nombre: archivoNombre,
      publicar_en: programarEn ? new Date(programarEn).toISOString() : null,
    }])

    // Disparar push a todos los suscriptores (solo si es publicación inmediata)
    if (!programarEn) {
      supabase.functions.invoke('send-push', {
        body: { title: titulo || 'Nueva novedad en Flama', body: contenido || '' }
      }).then(r => console.log('Push result:', JSON.stringify(r)))
        .catch(e => console.error('Push error:', e))
    }

    setTitulo('')
    setContenido('')
    setArchivo(null)
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

  async function abrirArchivo(url) {
    const win = window.open('', '_blank')
    const { data, error } = await supabase.storage
      .from('planes')
      .createSignedUrl(url, 60 * 60)
    if (error || !data?.signedUrl) { win?.close(); alert('No se pudo abrir el archivo'); return }
    win.location.href = data.signedUrl
  }

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
          <button className="btn-accent" onClick={() => setShowForm(s => !s)}>
            {showForm ? 'Cancelar' : '+ Publicar'}
          </button>
        )}
      </div>

      {/* FORM */}
      {isAdmin && showForm && (
        <form className="card form-card" onSubmit={handlePublicar}>
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
            </>
          )}

          {tipo === 'plan' && (
            <>
              <div className="field" style={{ marginBottom: '10px' }}>
                <label>Título (ej: Plan semana 23/06)</label>
                <input value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Plan semana 23/06" />
              </div>
              <div className="field" style={{ marginBottom: '10px' }}>
                <label>Archivo (DOCX o PDF) *</label>
                <label className="file-upload-label">
                  <input type="file" accept=".docx,.pdf,.doc" onChange={e => setArchivo(e.target.files[0])} style={{ display: 'none' }} />
                  <span className="file-upload-btn">
                    {archivo ? `✅ ${archivo.name}` : '📎 Seleccionar archivo'}
                  </span>
                </label>
              </div>
            </>
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
                  {p.archivo_url && (
                    <button onClick={() => abrirArchivo(p.archivo_url)} className="btn-ghost" style={{ height: 32, fontSize: 12, padding: '0 12px' }}>
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
              </div>
            ))}
          </div>
        </div>
      )}

      {items.length === 0 && (
        <div className="empty-state">No hay novedades todavía</div>
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
