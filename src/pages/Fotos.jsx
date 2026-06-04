import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import PageLoader from '../components/PageLoader'
import ConfirmModal from '../components/ConfirmModal'

const CLOUD = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME
const PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET

export default function Fotos() {
  const { isAdmin, user, profile } = useAuth()
  const [carreras, setCarreras] = useState([])
  const [carreraId, setCarreraId] = useState('')
  const [fotos, setFotos] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [progreso, setProgreso] = useState(0)
  const [confirmarEliminar, setConfirmarEliminar] = useState(null)
  const [fotoAmpliada, setFotoAmpliada] = useState(null)
  const inputRef = useRef()

  useEffect(() => {
    async function fetchCarreras() {
      const { data } = await supabase
        .from('carreras')
        .select('id, nombre, fecha')
        .order('fecha', { ascending: false })
      const pasadas = (data || []).filter(c => c.fecha <= new Date().toISOString().split('T')[0])
      setCarreras(pasadas)
      if (pasadas.length > 0) setCarreraId(pasadas[0].id)
      else setLoading(false)
    }
    fetchCarreras()
  }, [])

  useEffect(() => {
    if (!carreraId) return
    fetchFotos()
    const channel = supabase.channel('fotos-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fotos_carreras' }, fetchFotos)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [carreraId])

  async function fetchFotos() {
    setLoading(true)
    const { data } = await supabase
      .from('fotos_carreras')
      .select('*, uploader:profiles(nombre)')
      .eq('carrera_id', carreraId)
      .order('created_at', { ascending: false })
    setFotos(data || [])
    setLoading(false)
  }

  async function handleSubir(e) {
    const archivos = Array.from(e.target.files)
    if (!archivos.length || !carreraId) return
    setUploading(true)
    setProgreso(0)

    const carrera = carreras.find(c => c.id === carreraId)
    const folder = `flamarun/${carrera?.nombre?.replace(/\s+/g, '_') || carreraId}`

    for (let i = 0; i < archivos.length; i++) {
      const archivo = archivos[i]
      const fd = new FormData()
      fd.append('file', archivo)
      fd.append('upload_preset', PRESET)
      fd.append('folder', folder)

      const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD}/image/upload`, {
        method: 'POST',
        body: fd,
      })
      const data = await res.json()

      if (data.secure_url) {
        await supabase.from('fotos_carreras').insert({
          carrera_id: carreraId,
          user_id: user.id,
          cloudinary_url: data.secure_url,
          cloudinary_public_id: data.public_id,
        })
      }
      setProgreso(Math.round(((i + 1) / archivos.length) * 100))
    }

    setUploading(false)
    inputRef.current.value = ''
    fetchFotos()
  }

  async function handleEliminar(foto) {
    await supabase.from('fotos_carreras').delete().eq('id', foto.id)
    setConfirmarEliminar(null)
    fetchFotos()
  }

  const puedeEliminar = (foto) => isAdmin || foto.user_id === user.id

  return (
    <div className="page">
      <div className="page-header">
        <h2>Fotos</h2>
        <button className="btn-accent" onClick={() => inputRef.current?.click()} disabled={uploading || !carreraId}>
          {uploading ? `Subiendo ${progreso}%` : '+ Fotos'}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          style={{ display: 'none' }}
          onChange={handleSubir}
        />
      </div>

      {/* Selector de carrera */}
      {carreras.length > 0 && (
        <div style={{ marginBottom: '16px', overflowX: 'auto', display: 'flex', gap: '8px', paddingBottom: '4px' }}>
          {carreras.map(c => (
            <button
              key={c.id}
              onClick={() => setCarreraId(c.id)}
              className={`filtro-btn ${carreraId === c.id ? 'active' : ''}`}
              style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
            >
              {c.nombre}
            </button>
          ))}
        </div>
      )}

      {carreras.length === 0 && !loading && (
        <div className="empty-state">No hay carreras pasadas todavía</div>
      )}

      {/* Barra de progreso */}
      {uploading && (
        <div style={{ height: 4, background: 'var(--bg3)', borderRadius: 4, marginBottom: 16, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${progreso}%`, background: 'var(--accent)', transition: 'width 0.3s' }} />
        </div>
      )}

      {loading ? <PageLoader /> : (
        <>
          {fotos.length === 0 && (
            <div className="empty-state">
              Todavía no hay fotos de esta carrera.<br />
              <span style={{ fontSize: '13px' }}>¡Subí las tuyas!</span>
            </div>
          )}

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '3px',
          }}>
            {fotos.map(foto => (
              <div key={foto.id} style={{ position: 'relative', aspectRatio: '1', overflow: 'hidden', borderRadius: '4px', background: 'var(--bg3)' }}>
                <img
                  src={foto.cloudinary_url.replace('/upload/', '/upload/w_400,q_auto/')}
                  alt=""
                  style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'pointer' }}
                  onClick={() => setFotoAmpliada(foto)}
                  loading="lazy"
                />
                {puedeEliminar(foto) && (
                  <button
                    onClick={() => setConfirmarEliminar(foto)}
                    style={{
                      position: 'absolute', top: 4, right: 4,
                      width: 24, height: 24, borderRadius: '50%',
                      background: 'rgba(0,0,0,0.6)', border: 'none',
                      color: '#fff', fontSize: 12, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >✕</button>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Lightbox */}
      {fotoAmpliada && (
        <>
          <div
            onClick={() => setFotoAmpliada(null)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 200, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          >
            <img
              src={fotoAmpliada.cloudinary_url.replace('/upload/', '/upload/w_1200,q_auto/')}
              alt=""
              style={{ maxWidth: '100%', maxHeight: '80vh', borderRadius: 8, objectFit: 'contain' }}
            />
            <div style={{ marginTop: 12, color: '#94a3b8', fontSize: 13 }}>
              {fotoAmpliada.uploader?.nombre}
            </div>
            <a
              href={fotoAmpliada.cloudinary_url}
              download
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              style={{
                marginTop: 12, padding: '8px 20px', background: 'rgba(255,255,255,0.1)',
                borderRadius: 8, color: '#fff', fontSize: 13, textDecoration: 'none',
              }}
            >
              ⬇ Descargar original
            </a>
          </div>
        </>
      )}

      {confirmarEliminar && (
        <ConfirmModal
          mensaje="¿Eliminar esta foto?"
          onConfirm={() => handleEliminar(confirmarEliminar)}
          onCancel={() => setConfirmarEliminar(null)}
        />
      )}
    </div>
  )
}
