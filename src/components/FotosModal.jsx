import { useState, useRef, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import ConfirmModal from './ConfirmModal'
import { notificar } from '../lib/push'

// Dedup: 1 notificación por (tagged_user, carrera, tagger) cada 2hs.
// Persiste en sesión de página, se resetea al recargar.
const notifFotosLog = {} // { 'userId:carreraId:taggerId': timestamp }
const NOTIF_FOTOS_COOLDOWN = 2 * 60 * 60 * 1000 // 2 horas

const CLOUD = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME
const PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET

export default function FotosModal({ carrera, onClose }) {
  const { isAdmin, user, profile } = useAuth()
  const [fotos, setFotos] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [progreso, setProgreso] = useState(0)
  const [fotoAmpliada, setFotoAmpliada] = useState(null)
  const [confirmarEliminarFoto, setConfirmarEliminarFoto] = useState(null)
  const [confirmarBorrarTodas, setConfirmarBorrarTodas] = useState(false)
  const [seleccionadas, setSeleccionadas] = useState(new Set())
  const [confirmarBorrarSeleccion, setConfirmarBorrarSeleccion] = useState(false)
  const [toast, setToast] = useState('')
  const [tagsFoto, setTagsFoto] = useState([])
  const [editandoTags, setEditandoTags] = useState(false)
  const [todosPerfiles, setTodosPerfiles] = useState(null)
  const [buscarTag, setBuscarTag] = useState('')
  const [guardandoTag, setGuardandoTag] = useState({})
  const fotoInputRef = useRef()

  useState(() => {
    cargarFotos()
  }, [])

  useEffect(() => {
    if (!fotoAmpliada) {
      setTagsFoto([])
      setEditandoTags(false)
      setBuscarTag('')
      return
    }
    fetchTags(fotoAmpliada.id)
  }, [fotoAmpliada?.id])

  async function fetchTags(fotoId) {
    const { data } = await supabase
      .from('foto_tags')
      .select('user_id, profiles!foto_tags_user_id_fkey(nombre)')
      .eq('foto_id', fotoId)
    setTagsFoto((data || []).map(t => ({ user_id: t.user_id, nombre: t.profiles?.nombre || '—' })))
  }

  async function abrirSelectorTags() {
    if (!todosPerfiles) {
      const { data } = await supabase.from('profiles').select('id, nombre').order('nombre')
      setTodosPerfiles(data || [])
    }
    setEditandoTags(true)
  }

  async function toggleTag(perfil) {
    if (!fotoAmpliada || guardandoTag[perfil.id]) return
    setGuardandoTag(g => ({ ...g, [perfil.id]: true }))
    const yaEtiquetado = tagsFoto.some(t => t.user_id === perfil.id)
    if (yaEtiquetado) {
      await supabase.from('foto_tags').delete().eq('foto_id', fotoAmpliada.id).eq('user_id', perfil.id)
      setTagsFoto(tags => tags.filter(t => t.user_id !== perfil.id))
    } else {
      await supabase.from('foto_tags').insert({ foto_id: fotoAmpliada.id, user_id: perfil.id, etiquetado_por: user.id })
      setTagsFoto(tags => [...tags, { user_id: perfil.id, nombre: perfil.nombre }])

      // Notificar al etiquetado — dedup 2hs por (tagged, carrera, tagger)
      const key = `${perfil.id}:${carrera.id}:${user.id}`
      const ahora = Date.now()
      if (ahora - (notifFotosLog[key] || 0) > NOTIF_FOTOS_COOLDOWN) {
        notifFotosLog[key] = ahora
        notificar(
          '📸 ¡Te etiquetaron en fotos!',
          `${profile?.nombre || 'Alguien'} te etiquetó en fotos de ${carrera.nombre}.`,
          '/carreras',
          { user_ids: [perfil.id] }
        )
      }
    }
    setGuardandoTag(g => { const { [perfil.id]: _, ...resto } = g; return resto })
  }

  async function cargarFotos() {
    setLoading(true)
    const { data } = await supabase
      .from('fotos_carreras')
      .select('*')
      .eq('carrera_id', carrera.id)
      .order('created_at', { ascending: false })
    const fs = data || []
    if (fs.length > 0) {
      const userIds = [...new Set(fs.map(f => f.user_id))]
      const { data: perfiles } = await supabase.from('profiles').select('id, nombre').in('id', userIds)
      const perfilMap = Object.fromEntries((perfiles || []).map(p => [p.id, p]))
      fs.forEach(f => { f.uploader = perfilMap[f.user_id] || null })
    }
    setFotos(fs)
    setLoading(false)
  }

  // El modal ya muestra su propio toast (ver más abajo) — antes también se lo
  // pasábamos al padre vía onToast, que mostraba OTRO toast con el mismo mensaje
  // al mismo tiempo (de ahí el "Se cargaron 3 fotos" duplicado).
  function showToast(msg) {
    setToast(msg)
    setTimeout(() => setToast(''), 2500)
  }

  async function handleSubirFotos(e) {
    const archivos = Array.from(e.target.files)
    if (!archivos.length) return
    setUploading(true)
    setProgreso(0)

    const folder = `flamarun/${carrera.nombre.replace(/\s+/g, '_')}`
    const { data: existentes } = await supabase.from('fotos_carreras').select('cloudinary_public_id').eq('carrera_id', carrera.id)
    const idsExistentes = new Set((existentes || []).map(f => f.cloudinary_public_id))

    let subidas = 0, duplicadas = 0
    for (let i = 0; i < archivos.length; i++) {
      const fd = new FormData()
      fd.append('file', archivos[i])
      fd.append('upload_preset', PRESET)
      fd.append('folder', folder)
      const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD}/image/upload`, { method: 'POST', body: fd })
      const data = await res.json()
      if (data.secure_url) {
        if (idsExistentes.has(data.public_id)) { duplicadas++; continue }
        await supabase.from('fotos_carreras').insert({
          carrera_id: carrera.id, user_id: user.id,
          cloudinary_url: data.secure_url, cloudinary_public_id: data.public_id,
        })
        subidas++
      }
      setProgreso(Math.round(((i + 1) / archivos.length) * 100))
    }
    setUploading(false)
    fotoInputRef.current.value = ''
    if (duplicadas > 0 && subidas === 0) showToast('⚠️ Esas fotos ya estaban subidas')
    else showToast(subidas === 1 ? '📸 ¡Foto compartida con el equipo!' : `📸 ¡${subidas} fotos compartidas!`)
    cargarFotos()
  }

  async function eliminarFoto(foto) {
    await supabase.from('fotos_carreras').delete().eq('id', foto.id)
    setConfirmarEliminarFoto(null)
    setFotos(prev => prev.filter(f => f.id !== foto.id))
  }

  async function borrarTodasLasFotos() {
    await supabase.from('fotos_carreras').delete().eq('carrera_id', carrera.id)
    setConfirmarBorrarTodas(false)
    setFotos([])
  }

  async function borrarSeleccionadas() {
    await supabase.from('fotos_carreras').delete().in('id', [...seleccionadas])
    setConfirmarBorrarSeleccion(false)
    setSeleccionadas(new Set())
    setFotos(prev => prev.filter(f => !seleccionadas.has(f.id)))
  }

  function toggleSeleccion(id) {
    setSeleccionadas(prev => {
      const n = new Set(prev)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, zIndex: 150, background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '15px' }}>{carrera.nombre}</div>
            <div style={{ fontSize: '12px', color: 'var(--text2)' }}>{fotos.length} foto{fotos.length !== 1 ? 's' : ''}</div>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {isAdmin && fotos.length > 0 && (
              <button onClick={() => setConfirmarBorrarTodas(true)} style={{ height: 34, fontSize: 13, padding: '0 12px', background: 'rgba(248,113,113,0.12)', color: '#f87171', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit' }}>
                🗑 Borrar todas
              </button>
            )}
            <button onClick={() => fotoInputRef.current?.click()} disabled={uploading} className="btn-accent" style={{ height: 34, fontSize: 13, padding: '0 14px' }}>
              {uploading ? `${progreso}%` : '+ Subir'}
            </button>
            <button onClick={onClose} className="btn-ghost" style={{ height: 34, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg>
              Volver
            </button>
          </div>
        </div>

        {uploading && (
          <div style={{ height: 3, background: 'var(--bg3)', flexShrink: 0 }}>
            <div style={{ height: '100%', width: `${progreso}%`, background: 'var(--accent)', transition: 'width 0.3s' }} />
          </div>
        )}

        <div style={{ flex: 1, overflowY: 'auto', padding: '2px' }}>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px', color: 'var(--text2)' }}>Cargando...</div>
          ) : fotos.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '200px', gap: '8px', color: 'var(--text2)' }}>
              <span style={{ fontSize: '36px' }}>📷</span>
              <span style={{ fontSize: '14px' }}>Todavía no hay fotos</span>
              <span style={{ fontSize: '12px' }}>¡Subí las tuyas!</span>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '2px' }}>
              {fotos.map(foto => {
                const estaSeleccionada = seleccionadas.has(foto.id)
                const puedeBorrar = isAdmin || foto.user_id === user.id
                return (
                  <div key={foto.id} style={{ position: 'relative', aspectRatio: '1', overflow: 'hidden', background: 'var(--bg3)', outline: estaSeleccionada ? '3px solid #ff2d2d' : 'none', outlineOffset: '-3px' }}
                    onClick={() => seleccionadas.size > 0 ? (puedeBorrar && toggleSeleccion(foto.id)) : setFotoAmpliada(foto)}
                  >
                    <img src={foto.cloudinary_url.replace('/upload/', '/upload/w_400,q_auto/')} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'pointer' }} loading="lazy" />
                    {estaSeleccionada && (
                      <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,45,45,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#ff2d2d', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                        </div>
                      </div>
                    )}
                    {foto.uploader?.nombre && (
                      <div style={{ position: 'absolute', bottom: 4, left: 4, background: 'rgba(0,0,0,0.62)', backdropFilter: 'blur(4px)', borderRadius: 4, padding: '2px 6px', fontSize: 10, color: '#fff', fontWeight: 500, pointerEvents: 'none', maxWidth: 'calc(100% - 32px)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {foto.uploader.nombre}
                      </div>
                    )}
                    {puedeBorrar && seleccionadas.size === 0 && (
                      <button onClick={e => { e.stopPropagation(); toggleSeleccion(foto.id) }} style={{ position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: '50%', background: 'rgba(0,0,0,0.65)', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <input ref={fotoInputRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={handleSubirFotos} />

        {seleccionadas.size > 0 && (
          <div style={{ position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 8, zIndex: 10 }}>
            <button onClick={() => setConfirmarBorrarSeleccion(true)} style={{ padding: '10px 20px', background: 'rgba(248,113,113,0.15)', color: '#f87171', border: '1px solid rgba(248,113,113,0.4)', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', backdropFilter: 'blur(8px)' }}>
              🗑 Borrar {seleccionadas.size} foto{seleccionadas.size !== 1 ? 's' : ''}
            </button>
            <button onClick={() => setSeleccionadas(new Set())} style={{ padding: '10px 16px', background: 'rgba(0,0,0,0.6)', color: 'var(--text2)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', backdropFilter: 'blur(8px)' }}>
              Cancelar
            </button>
          </div>
        )}

        {toast && (
          <div style={{ position: 'absolute', bottom: '24px', left: '50%', transform: 'translateX(-50%)', background: '#1f1f1f', border: '1px solid rgba(255,255,255,0.12)', color: '#f1f5f9', padding: '10px 18px', borderRadius: '10px', fontSize: '13px', fontWeight: 500, zIndex: 10, boxShadow: '0 4px 20px rgba(0,0,0,0.4)', whiteSpace: 'nowrap' }}>
            {toast}
          </div>
        )}
      </div>

      {fotoAmpliada && (
        <div onClick={() => setFotoAmpliada(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)', zIndex: 200, display: 'flex', flexDirection: 'column', alignItems: 'center', overflowY: 'auto', padding: '16px 16px 32px' }}>
          <button
            onClick={e => { e.stopPropagation(); setFotoAmpliada(null) }}
            style={{ position: 'fixed', top: 16, right: 16, width: 38, height: 38, borderRadius: '50%', background: 'rgba(0,0,0,0.55)', border: '1px solid rgba(255,255,255,0.3)', color: '#fff', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2, backdropFilter: 'blur(4px)' }}
          >✕</button>
          <div style={{ flex: '0 0 auto', margin: 'auto 0', display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
          <img onClick={e => e.stopPropagation()} src={fotoAmpliada.cloudinary_url.replace('/upload/', '/upload/w_1200,q_auto/')} alt="" style={{ maxWidth: '100%', maxHeight: '70vh', borderRadius: 8, objectFit: 'contain' }} />

          <div onClick={e => e.stopPropagation()} style={{ marginTop: 12, width: '100%', maxWidth: 360, display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'stretch' }}>
            {tagsFoto.length > 0 && (
              <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: 'var(--text2)' }}>
                <div style={{ fontWeight: 600, color: '#fff', marginBottom: 4 }}>Corredores etiquetados</div>
                {tagsFoto.map(t => t.nombre).join(', ')}
              </div>
            )}

            {fotoAmpliada.user_id === user.id && !editandoTags && (
              <button type="button" onClick={abrirSelectorTags} style={{ padding: '8px 16px', background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, cursor: 'pointer' }}>
                🏷️ Etiquetar compañeros
              </button>
            )}

            {editandoTags && (() => {
              const MAX_RESULTADOS = 5
              const texto = buscarTag.trim().toLowerCase()
              const candidatos = (todosPerfiles || []).filter(p => p.id !== fotoAmpliada.user_id)
              const resultados = texto
                ? candidatos.filter(p => p.nombre?.toLowerCase().includes(texto)).slice(0, MAX_RESULTADOS)
                : candidatos.filter(p => tagsFoto.some(t => t.user_id === p.id))
              return (
                <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 8, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <input
                    value={buscarTag}
                    onChange={e => setBuscarTag(e.target.value)}
                    placeholder="Escribí el nombre del compañero..."
                    style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(0,0,0,0.3)', color: '#fff', fontSize: 13 }}
                  />
                  {!texto && tagsFoto.length === 0 && (
                    <div style={{ fontSize: 12, color: 'var(--text2)', padding: '0 2px' }}>
                      Escribí un nombre para buscar y agregar etiquetas.
                    </div>
                  )}
                  {resultados.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {resultados.map(p => {
                        const marcado = tagsFoto.some(t => t.user_id === p.id)
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => toggleTag(p)}
                            disabled={!!guardandoTag[p.id]}
                            style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                              padding: '8px 12px', borderRadius: 6, border: 'none', textAlign: 'left',
                              background: marcado ? 'rgba(74,222,128,0.15)' : 'rgba(255,255,255,0.05)',
                              color: '#fff', fontSize: 13, cursor: guardandoTag[p.id] ? 'default' : 'pointer',
                              opacity: guardandoTag[p.id] ? 0.5 : 1,
                            }}
                          >
                            <span>{p.nombre}</span>
                            {marcado && <span style={{ color: '#4ade80' }}>✓</span>}
                          </button>
                        )
                      })}
                    </div>
                  )}
                  {texto && resultados.length === 0 && (
                    <div style={{ fontSize: 12, color: 'var(--text2)', padding: '0 2px' }}>
                      Sin resultados para "{buscarTag}".
                    </div>
                  )}
                  <button type="button" onClick={() => setEditandoTags(false)} style={{ alignSelf: 'flex-end', padding: '6px 14px', background: 'transparent', border: 'none', color: 'var(--text2)', fontSize: 13, cursor: 'pointer' }}>
                    Listo
                  </button>
                </div>
              )
            })()}
          </div>

          <a href={fotoAmpliada.cloudinary_url} download target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={{ marginTop: 10, padding: '8px 20px', background: 'rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff', fontSize: 13, textDecoration: 'none' }}>
            ⬇ Descargar original
          </a>
          </div>
        </div>
      )}

      {confirmarEliminarFoto && <ConfirmModal mensaje="¿Eliminar esta foto?" onConfirm={() => eliminarFoto(confirmarEliminarFoto)} onCancel={() => setConfirmarEliminarFoto(null)} />}
      {confirmarBorrarTodas && <ConfirmModal mensaje={`¿Borrar las ${fotos.length} fotos de ${carrera.nombre}?`} onConfirm={borrarTodasLasFotos} onCancel={() => setConfirmarBorrarTodas(false)} />}
      {confirmarBorrarSeleccion && <ConfirmModal mensaje={`¿Borrar ${seleccionadas.size} foto${seleccionadas.size !== 1 ? 's' : ''} seleccionada${seleccionadas.size !== 1 ? 's' : ''}?`} onConfirm={borrarSeleccionadas} onCancel={() => setConfirmarBorrarSeleccion(false)} />}
    </>
  )
}
