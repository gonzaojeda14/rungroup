import PageLoader from '../components/PageLoader'
import ConfirmModal from '../components/ConfirmModal'
import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { formatFechaHora } from '../lib/utils'

const CLOUD = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME
const PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET

const EMPTY = { nombre: '', fecha: '', hora: '', distancias: '', lugar: '', link: '', codigo: '', tipo: '' }
const ESTADOS = ['Inscripto', 'No voy', 'Tal vez', 'Lista de espera']
const ESTADO_COLOR = {
  'Inscripto': '#4ade80',
  'No voy': '#f87171',
  'Tal vez': '#fbbf24',
  'Lista de espera': '#60a5fa',
  'Pendiente': '#64748b',
}
const TIPO_COLOR = {
  'Trail': '#fb923c',
  'Calle': '#60a5fa',
}
const today = new Date().toISOString().split('T')[0]

export default function Carreras() {
  const { isAdmin, user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [toast, setToast] = useState('')
  const [carreras, setCarreras] = useState([])
  const [participaciones, setParticipaciones] = useState([])
  const [distanciasSeleccionadas, setDistanciasSeleccionadas] = useState({})
  const [form, setForm] = useState(EMPTY)
  const [editId, setEditId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [filtros, setFiltros] = useState(() => {
    try {
      const saved = localStorage.getItem('carreras_filtros')
      return saved ? JSON.parse(saved) : { tipo: '', distancias: [], fecha: 'proximas', mes: '' }
    } catch { return { tipo: '', distancias: [], fecha: 'proximas', mes: '' } }
  })
  const [showFiltros, setShowFiltros] = useState(false)
  const [inscriptosAbiertos, setInscriptosAbiertos] = useState({}) // carreraId -> [perfiles] | 'loading'

  function setFiltrosGuardados(fn) {
    setFiltros(prev => {
      const next = typeof fn === 'function' ? fn(prev) : fn
      localStorage.setItem('carreras_filtros', JSON.stringify(next))
      return next
    })
  }
  const formRef = useRef(null)

  // Fotos
  const [fotosModal, setFotosModal] = useState(null) // carrera seleccionada
  const [fotos, setFotos] = useState([])
  const [fotosLoading, setFotosLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [progreso, setProgreso] = useState(0)
  const [fotoAmpliada, setFotoAmpliada] = useState(null)
  const [confirmarEliminarFoto, setConfirmarEliminarFoto] = useState(null)
  const [confirmarBorrarTodas, setConfirmarBorrarTodas] = useState(false)
  const [seleccionadas, setSeleccionadas] = useState(new Set())
  const [confirmarBorrarSeleccion, setConfirmarBorrarSeleccion] = useState(false)
  const fotoInputRef = useRef()

  useEffect(() => { fetchAll() }, [])

  useEffect(() => {
    const fotosId = searchParams.get('fotos')
    if (fotosId && carreras.length > 0 && !fotosModal) {
      const carrera = carreras.find(c => c.id === fotosId)
      if (carrera) abrirFotos(carrera)
    }
  }, [carreras, searchParams])

  async function fetchAll() {
    const [{ data: cars }, { data: parts }] = await Promise.all([
      supabase.from('carreras').select('*').order('fecha', { ascending: true }),
      supabase.from('participaciones').select('carrera_id, estado, distancia_elegida').eq('user_id', user.id)
    ])
    setCarreras(cars || [])
    setParticipaciones(parts || [])
    const distMap = {}
    parts?.forEach(p => { if (p.distancia_elegida) distMap[p.carrera_id] = p.distancia_elegida })
    setDistanciasSeleccionadas(distMap)
    setLoading(false)
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    const distanciasArr = form.distancias
      ? form.distancias.split(',').map(d => d.trim()).filter(Boolean)
      : []
    const payload = {
      nombre: form.nombre,
      fecha: form.fecha || null,
      hora: form.hora || null,
      lugar: form.lugar || null,
      link: form.link || null,
      codigo: form.codigo || null,
      tipo: form.tipo || null,
      distancias: distanciasArr,
      distancia: distanciasArr[0] || null,
    }
    if (editId) {
      await supabase.from('carreras').update(payload).eq('id', editId)
    } else {
      await supabase.from('carreras').insert([payload])
    }
    setForm(EMPTY)
    setEditId(null)
    setShowForm(false)
    fetchAll()
    setSaving(false)
  }

  function handleEdit(c) {
    setForm({
      nombre: c.nombre,
      fecha: c.fecha || '',
      hora: c.hora || '',
      distancias: c.distancias?.length ? c.distancias.join(', ') : (c.distancia || ''),
      lugar: c.lugar || '',
      link: c.link || '',
      codigo: c.codigo || '',
      tipo: c.tipo || '',
    })
    setEditId(c.id)
    setShowForm(true)
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
  }

  function handleCancelForm() {
    setForm(EMPTY)
    setEditId(null)
    setShowForm(false)
  }

  async function handleDelete(id) {
    if (!confirm('¿Eliminar esta carrera?')) return
    await supabase.from('carreras').delete().eq('id', id)
    fetchAll()
  }

  async function toggleDestacada(c) {
    await supabase.from('carreras').update({ destacada: !c.destacada }).eq('id', c.id)
    setCarreras(prev => prev.map(r => r.id === c.id ? { ...r, destacada: !r.destacada } : r))
  }

  async function compartirUbicacion(carreraId) {
    if (!navigator.geolocation) { alert('Tu dispositivo no soporta geolocalización'); return }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords
        const now = new Date().toISOString()
        await supabase.from('carreras').update({
          encuentro_lat: lat,
          encuentro_lng: lng,
          encuentro_updated_at: now,
        }).eq('id', carreraId)
        setCarreras(prev => prev.map(r => r.id === carreraId
          ? { ...r, encuentro_lat: lat, encuentro_lng: lng, encuentro_updated_at: now }
          : r
        ))
        setToast('📍 Ubicación compartida')
        setTimeout(() => setToast(''), 2500)
      },
      () => alert('No se pudo obtener la ubicación. Verificá los permisos.')
    )
  }

  function tiempoDesdeUpdate(updatedAt) {
    if (!updatedAt) return ''
    const diff = Math.floor((new Date() - new Date(updatedAt)) / 60000)
    if (diff < 1) return 'ahora mismo'
    if (diff < 60) return `hace ${diff} min`
    return `hace ${Math.floor(diff / 60)}h`
  }

  async function updateDistancia(carreraId, distancia) {
    setDistanciasSeleccionadas(prev => ({ ...prev, [carreraId]: distancia }))
    await supabase.from('participaciones')
      .update({ distancia_elegida: distancia })
      .eq('carrera_id', carreraId)
      .eq('user_id', user.id)
  }

  async function updateEstado(carreraId, estado) {
    const noVoy = estado === 'No voy'
    const distanciaElegida = noVoy ? null : (distanciasSeleccionadas[carreraId] || null)
    if (noVoy) setDistanciasSeleccionadas(prev => { const n = { ...prev }; delete n[carreraId]; return n })
    await supabase.from('participaciones')
      .update({ estado, distancia_elegida: distanciaElegida, updated_at: new Date().toISOString() })
      .eq('carrera_id', carreraId)
      .eq('user_id', user.id)
    setParticipaciones(prev => {
      const exists = prev.find(p => p.carrera_id === carreraId)
      if (exists) return prev.map(p => p.carrera_id === carreraId ? { ...p, estado } : p)
      return [...prev, { carrera_id: carreraId, estado }]
    })
  }

  async function abrirFotos(carrera) {
    setFotosModal(carrera)
    setSearchParams({ fotos: carrera.id }, { replace: true })
    setFotos([])
    setFotosLoading(true)
    const { data } = await supabase
      .from('fotos_carreras')
      .select('*')
      .eq('carrera_id', carrera.id)
      .order('created_at', { ascending: false })

    const fotos = data || []
    if (fotos.length > 0) {
      const userIds = [...new Set(fotos.map(f => f.user_id))]
      const { data: perfiles } = await supabase
        .from('profiles')
        .select('id, nombre')
        .in('id', userIds)
      const perfilMap = Object.fromEntries((perfiles || []).map(p => [p.id, p]))
      fotos.forEach(f => { f.uploader = perfilMap[f.user_id] || null })
    }
    setFotos(fotos)
    setFotosLoading(false)
  }

  async function handleSubirFotos(e) {
    const archivos = Array.from(e.target.files)
    if (!archivos.length || !fotosModal) return
    setUploading(true)
    setProgreso(0)
    const folder = `flamarun/${fotosModal.nombre.replace(/\s+/g, '_')}`

    // Traer hashes ya existentes para esta carrera
    const { data: existentes } = await supabase
      .from('fotos_carreras')
      .select('file_hash')
      .eq('carrera_id', fotosModal.id)
    const hashesExistentes = new Set((existentes || []).map(f => f.file_hash).filter(Boolean))

    async function hashArchivo(file) {
      const buffer = await file.arrayBuffer()
      const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
      return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('')
    }

    let duplicadas = 0
    for (let i = 0; i < archivos.length; i++) {
      const archivo = archivos[i]
      const hash = await hashArchivo(archivo)
      if (hashesExistentes.has(hash)) {
        duplicadas++
        setProgreso(Math.round(((i + 1) / archivos.length) * 100))
        continue
      }
      const fd = new FormData()
      fd.append('file', archivo)
      fd.append('upload_preset', PRESET)
      fd.append('folder', folder)
      const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD}/image/upload`, { method: 'POST', body: fd })
      const data = await res.json()
      if (data.secure_url) {
        await supabase.from('fotos_carreras').insert({
          carrera_id: fotosModal.id,
          user_id: user.id,
          cloudinary_url: data.secure_url,
          cloudinary_public_id: data.public_id,
          file_hash: hash,
        })
        hashesExistentes.add(hash)
      }
      setProgreso(Math.round(((i + 1) / archivos.length) * 100))
    }
    setUploading(false)
    fotoInputRef.current.value = ''
    const subidas = archivos.length - duplicadas
    if (duplicadas > 0 && subidas === 0) {
      setToast('⚠️ Esas fotos ya estaban subidas')
    } else if (duplicadas > 0) {
      setToast(`📸 ${subidas} subida${subidas !== 1 ? 's' : ''} · ${duplicadas} ya existía${duplicadas !== 1 ? 'n' : ''}`)
    } else {
      setToast(subidas === 1 ? '📸 ¡Foto compartida con el equipo!' : `📸 ¡${subidas} fotos compartidas con el equipo!`)
    }
    setTimeout(() => setToast(''), 3000)
    abrirFotos(fotosModal)
  }

  async function eliminarFoto(foto) {
    await supabase.from('fotos_carreras').delete().eq('id', foto.id)
    setConfirmarEliminarFoto(null)
    setFotos(prev => prev.filter(f => f.id !== foto.id))
  }

  async function borrarTodasLasFotos() {
    await supabase.from('fotos_carreras').delete().eq('carrera_id', fotosModal.id)
    setConfirmarBorrarTodas(false)
    setFotos([])
  }

  async function borrarSeleccionadas() {
    await supabase.from('fotos_carreras').delete().in('id', [...seleccionadas])
    setSeleccionadas(new Set())
    setConfirmarBorrarSeleccion(false)
    setFotos(prev => prev.filter(f => !seleccionadas.has(f.id)))
  }

  function toggleSeleccion(id) {
    setSeleccionadas(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function toggleInscriptos(carreraId) {
    if (inscriptosAbiertos[carreraId]) {
      setInscriptosAbiertos(prev => { const n = { ...prev }; delete n[carreraId]; return n })
      return
    }
    setInscriptosAbiertos(prev => ({ ...prev, [carreraId]: 'loading' }))
    const { data: parts } = await supabase
      .from('participaciones')
      .select('user_id')
      .eq('carrera_id', carreraId)
      .eq('estado', 'Inscripto')
    const userIds = (parts || []).map(p => p.user_id)
    if (userIds.length === 0) { setInscriptosAbiertos(prev => ({ ...prev, [carreraId]: [] })); return }
    const { data: perfiles } = await supabase
      .from('profiles')
      .select('nombre, avatar_url')
      .in('id', userIds)
    setInscriptosAbiertos(prev => ({ ...prev, [carreraId]: perfiles || [] }))
  }

  function getDistancias(c) {
    if (c.distancias?.length) return c.distancias
    if (c.distancia) return [c.distancia]
    return []
  }

  // Distancias únicas para el filtro
  const todasDistancias = [...new Set(carreras.flatMap(c => getDistancias(c)))]
    .sort((a, b) => parseFloat(a) - parseFloat(b))
    .sort((a, b) => parseFloat(a) - parseFloat(b))

  const todosMeses = [...new Set(carreras.filter(c => c.fecha).map(c => c.fecha.slice(0, 7)))].sort()

  // Aplicar filtros
  const carrerasFiltradas = carreras.filter(c => {
    if (filtros.tipo && c.tipo !== filtros.tipo) return false
    if (filtros.distancias.length > 0 && !filtros.distancias.some(d => getDistancias(c).includes(d))) return false
    if (filtros.fecha === 'proximas' && c.fecha && c.fecha < today) return false
    if (filtros.fecha === 'pasadas' && (!c.fecha || c.fecha >= today)) return false
    if (filtros.mes && (!c.fecha || !c.fecha.startsWith(filtros.mes))) return false
    return true
  })

  const filtrosActivos = [
    filtros.fecha !== 'proximas',
    filtros.tipo !== '',
    filtros.distancias.length > 0,
    (filtros.mes || '') !== '',
  ].filter(Boolean).length

  if (loading) return <PageLoader />

  return (
    <div className="page" style={{ position: 'relative' }}>
      <div className="page-header">
        <h2>Carreras</h2>
        {isAdmin && (
          <button className="btn-accent" onClick={() => { if (showForm) handleCancelForm(); else setShowForm(true) }}>
            {showForm ? 'Cancelar' : '+ Nueva'}
          </button>
        )}
      </div>

      {isAdmin && showForm && !editId && (
        <form ref={formRef} className="card form-card" onSubmit={handleSave}>
          <h3 style={{ marginBottom: '0.75rem', fontSize: '14px', fontWeight: 600 }}>
            {editId ? 'Editar carrera' : 'Nueva carrera'}
          </h3>
          <div className="form-grid">
            <div className="field">
              <label>Nombre *</label>
              <input value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} placeholder="21K Buenos Aires" required />
            </div>
            <div className="field">
              <label>Fecha</label>
              <input type="date" value={form.fecha} onChange={e => setForm({ ...form, fecha: e.target.value })} />
            </div>
            <div className="field">
              <label>Hora</label>
              <input type="time" value={form.hora} onChange={e => setForm({ ...form, hora: e.target.value })} />
            </div>
            <div className="field">
              <label>Distancia(s)</label>
              <input value={form.distancias} onChange={e => setForm({ ...form, distancias: e.target.value })} placeholder="5K, 10K" />
              <span style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>Separar con comas si hay varias</span>
            </div>
            <div className="field">
              <label>Tipo</label>
              <select value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })}>
                <option value="">— Sin especificar —</option>
                <option value="Trail">Trail</option>
                <option value="Calle">Calle</option>
              </select>
            </div>
            <div className="field">
              <label>Lugar</label>
              <input value={form.lugar} onChange={e => setForm({ ...form, lugar: e.target.value })} placeholder="Parque Tres de Febrero" />
            </div>
            <div className="field">
              <label>Código de descuento</label>
              <input value={form.codigo} onChange={e => setForm({ ...form, codigo: e.target.value })} placeholder="FLAMA20" />
            </div>
            <div className="field full">
              <label>Link de inscripción</label>
              <input value={form.link} onChange={e => setForm({ ...form, link: e.target.value })} placeholder="https://..." />
            </div>
          </div>
          <div className="form-actions">
            <button type="button" className="btn-ghost" onClick={handleCancelForm}>Cancelar</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Guardando...' : editId ? 'Guardar cambios' : 'Crear carrera'}
            </button>
          </div>
        </form>
      )}

      {/* Filtros */}
      {/* Botón filtros */}
      <div style={{ marginBottom: '12px', display: 'flex', gap: '8px', alignItems: 'center' }}>
        <button
          onClick={() => setShowFiltros(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            background: filtrosActivos > 0 ? 'rgba(255,45,45,0.12)' : 'var(--bg3)',
            border: filtrosActivos > 0 ? '1px solid rgba(255,45,45,0.4)' : '1px solid var(--border)',
            color: filtrosActivos > 0 ? 'var(--accent)' : 'var(--text2)',
            borderRadius: '8px', padding: '7px 14px', fontSize: '13px',
            cursor: 'pointer', fontFamily: 'inherit', fontWeight: filtrosActivos > 0 ? 600 : 400,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="11" y1="18" x2="13" y2="18"/></svg>
          Filtros
          {filtrosActivos > 0 && (
            <span style={{ background: 'var(--accent)', color: '#fff', borderRadius: '999px', fontSize: '11px', fontWeight: 700, padding: '1px 6px', marginLeft: '2px' }}>
              {filtrosActivos}
            </span>
          )}
        </button>
        {filtrosActivos > 0 && (
          <button
            onClick={() => setFiltrosGuardados({ tipo: '', distancias: [], fecha: 'proximas', mes: '' })}
            style={{ background: 'none', border: 'none', color: 'var(--text2)', fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit' }}
          >
            Limpiar
          </button>
        )}
      </div>

      {showFiltros && (
        <>
          <div onClick={() => setShowFiltros(false)} style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,0.5)' }} />
          <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 70, background: 'var(--bg2)', borderTop: '1px solid var(--border)', borderRadius: '16px 16px 0 0', padding: '20px 16px 32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <span style={{ fontWeight: 700, fontSize: '15px' }}>Filtros</span>
              <button onClick={() => setShowFiltros(false)} style={{ background: 'none', border: 'none', color: 'var(--text2)', fontSize: '20px', cursor: 'pointer', lineHeight: 1 }}>✕</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div>
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>Período</div>
                <div className="filtro-group">
                  {['proximas', 'pasadas', ''].map(val => (
                    <button key={val} className={`filtro-btn ${filtros.fecha === val ? 'active' : ''}`}
                      onClick={() => setFiltrosGuardados(f => ({ ...f, fecha: val, mes: '' }))}>
                      {val === 'proximas' ? 'Próximas' : val === 'pasadas' ? 'Anteriores' : 'Todas'}
                    </button>
                  ))}
                </div>
              </div>
              {todosMeses.length > 0 && (
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>Mes</div>
                  <div className="filtro-group" style={{ flexWrap: 'wrap' }}>
                    <button className={`filtro-btn ${(filtros.mes || '') === '' ? 'active' : ''}`}
                      onClick={() => setFiltrosGuardados(f => ({ ...f, mes: '' }))}>Todos</button>
                    {todosMeses.map(m => {
                      const [anio, mes] = m.split('-')
                      const label = new Date(parseInt(anio), parseInt(mes) - 1).toLocaleDateString('es-AR', { month: 'short', year: '2-digit' })
                      return (
                        <button key={m} className={`filtro-btn ${filtros.mes === m ? 'active' : ''}`}
                          onClick={() => setFiltrosGuardados(f => ({ ...f, mes: m, fecha: '' }))}>
                          {label}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
              <div>
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>Tipo</div>
                <div className="filtro-group">
                  {['', 'Trail', 'Calle'].map(val => (
                    <button key={val} className={`filtro-btn ${filtros.tipo === val ? 'active' : ''}`}
                      onClick={() => setFiltrosGuardados(f => ({ ...f, tipo: val }))}>
                      {val || 'Todo tipo'}
                    </button>
                  ))}
                </div>
              </div>
              {todasDistancias.length > 0 && (
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>Distancia</div>
                  <div className="filtro-group" style={{ flexWrap: 'wrap' }}>
                    <button className={`filtro-btn ${filtros.distancias.length === 0 ? 'active' : ''}`}
                      onClick={() => setFiltrosGuardados(f => ({ ...f, distancias: [] }))}>Todas</button>
                    {todasDistancias.map(d => {
                      const selected = filtros.distancias.includes(d)
                      return (
                        <button key={d} className="filtro-btn"
                          style={selected ? { background: 'rgba(255,45,45,0.2)', color: 'var(--accent)', border: '1px solid rgba(255,45,45,0.4)', fontWeight: 600 } : {}}
                          onClick={() => setFiltrosGuardados(f => ({ ...f, distancias: selected ? f.distancias.filter(x => x !== d) : [...f.distancias, d] }))}>
                          {d}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
            <button className="btn-primary" style={{ width: '100%', marginTop: '20px', height: '44px' }} onClick={() => setShowFiltros(false)}>
              Ver {carrerasFiltradas.length} carrera{carrerasFiltradas.length !== 1 ? 's' : ''}
            </button>
          </div>
        </>
      )}

      {carrerasFiltradas.length === 0 && (
        <div className="empty-state">
          {carreras.length === 0 ? 'No hay carreras cargadas todavía' : 'No hay carreras con esos filtros'}
        </div>
      )}

      <div className="cards-list">
        {carrerasFiltradas.map(c => {
          // Mostrar form de edición en lugar de la card
          if (editId === c.id && showForm) {
            return (
              <form key={c.id} ref={formRef} className="card form-card" onSubmit={handleSave}>
                <h3 style={{ marginBottom: '0.75rem', fontSize: '14px', fontWeight: 600 }}>Editar carrera</h3>
                <div className="form-grid">
                  <div className="field">
                    <label>Nombre *</label>
                    <input value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} placeholder="21K Buenos Aires" required />
                  </div>
                  <div className="field">
                    <label>Fecha</label>
                    <input type="date" value={form.fecha} onChange={e => setForm({ ...form, fecha: e.target.value })} />
                  </div>
                  <div className="field">
                    <label>Hora</label>
                    <input type="time" value={form.hora} onChange={e => setForm({ ...form, hora: e.target.value })} />
                  </div>
                  <div className="field">
                    <label>Distancia(s)</label>
                    <input value={form.distancias} onChange={e => setForm({ ...form, distancias: e.target.value })} placeholder="5K, 10K" />
                    <span style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>Separar con comas si hay varias</span>
                  </div>
                  <div className="field">
                    <label>Tipo</label>
                    <select value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })}>
                      <option value="">— Sin especificar —</option>
                      <option value="Trail">Trail</option>
                      <option value="Calle">Calle</option>
                    </select>
                  </div>
                  <div className="field">
                    <label>Lugar</label>
                    <input value={form.lugar} onChange={e => setForm({ ...form, lugar: e.target.value })} placeholder="Parque Tres de Febrero" />
                  </div>
                  <div className="field">
                    <label>Código de descuento</label>
                    <input value={form.codigo} onChange={e => setForm({ ...form, codigo: e.target.value })} placeholder="FLAMA20" />
                  </div>
                  <div className="field full">
                    <label>Link de inscripción</label>
                    <input value={form.link} onChange={e => setForm({ ...form, link: e.target.value })} placeholder="https://..." />
                  </div>
                </div>
                <div className="form-actions">
                  <button type="button" className="btn-ghost" onClick={handleCancelForm}>Cancelar</button>
                  <button type="submit" className="btn-primary" disabled={saving}>
                    {saving ? 'Guardando...' : 'Guardar cambios'}
                  </button>
                </div>
              </form>
            )
          }

          const part = participaciones.find(p => p.carrera_id === c.id)
          const estado = part?.estado || 'Pendiente'
          const dists = getDistancias(c)
          const multiDist = dists.length > 1
          const distSeleccionada = distanciasSeleccionadas[c.id] || (dists.length === 1 ? dists[0] : null)

          return (
            <div key={c.id} className="card race-card" style={c.destacada ? { borderColor: 'rgba(234,179,8,0.5)', boxShadow: '0 0 0 1px rgba(234,179,8,0.2)' } : {}}>
              <div className="race-card-top">
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                    {c.destacada && <span style={{ fontSize: '15px', lineHeight: 1 }}>⭐</span>}
                    <h3 style={{ margin: 0 }}>{c.nombre}</h3>
                  </div>
                  <div className="race-meta">
                    {c.fecha && <span className="tag">📅 {formatFechaHora(c.fecha, c.hora)}</span>}
                    {dists.length > 0 && <span className="tag">📏 {dists.join(' · ')}</span>}
                    {c.lugar && <span className="tag">📍 {c.lugar}</span>}
                    {c.tipo && <span className="tag" style={{ background: TIPO_COLOR[c.tipo] + '22', color: TIPO_COLOR[c.tipo], border: `1px solid ${TIPO_COLOR[c.tipo]}44`, fontWeight: 600 }}>{c.tipo}</span>}
                    {c.codigo && (() => {
                      const esCupon = /^\S+$/.test(c.codigo.trim())
                      return esCupon ? (
                        <span
                          className="tag code-tag"
                          style={{ cursor: 'pointer', userSelect: 'none', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                          title="Tocar para copiar"
                          onClick={() => {
                            navigator.clipboard.writeText(c.codigo)
                            setToast(`Código "${c.codigo}" copiado`)
                            setTimeout(() => setToast(''), 2500)
                          }}
                        >
                          🎟 {c.codigo}
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.7 }}><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                        </span>
                      ) : (
                        <span className="tag code-tag">🎟 {c.codigo}</span>
                      )
                    })()}
                  </div>
                </div>
                {isAdmin && (
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="btn-icon" onClick={() => toggleDestacada(c)} title={c.destacada ? 'Quitar destacada' : 'Marcar como destacada'} style={c.destacada ? { color: '#eab308', borderColor: 'rgba(234,179,8,0.4)' } : {}}>⭐</button>
                    <button className="btn-icon" onClick={() => handleEdit(c)} title="Editar">✏️</button>
                    <button className="btn-icon danger" onClick={() => handleDelete(c.id)} title="Eliminar">✕</button>
                  </div>
                )}
              </div>

              {c.link && (
                <a href={c.link} target="_blank" rel="noopener noreferrer" className="race-link">
                  Ver inscripción →
                </a>
              )}

              {/* PUNTO DE ENCUENTRO */}
              {c.encuentro_lat && (
                <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <a
                    href={`https://www.google.com/maps?q=${c.encuentro_lat},${c.encuentro_lng}`}
                    target="_blank" rel="noopener noreferrer"
                    className="race-link"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                  >
                    📍 Ver punto de encuentro →
                  </a>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>
                    {tiempoDesdeUpdate(c.encuentro_updated_at)}
                  </span>
                </div>
              )}
              {isAdmin && (() => {
                const horasRestantes = c.fecha
                  ? (new Date(c.fecha + 'T23:59:00') - new Date()) / (1000 * 60 * 60)
                  : null
                const mostrar = horasRestantes === null || horasRestantes <= 24
                if (!mostrar) return null
                return (
                  <button
                    onClick={() => compartirUbicacion(c.id)}
                    style={{
                      background: 'none', border: '1px solid var(--border)', cursor: 'pointer',
                      padding: '3px 10px', borderRadius: '6px', marginTop: '8px',
                      fontSize: '11px', color: '#64748b', fontFamily: 'inherit',
                      display: 'inline-block',
                    }}
                  >
                    {c.encuentro_lat ? '🔄 Actualizar ubicación' : '📍 Compartir punto de encuentro'}
                  </button>
                )
              })()}

              {multiDist && estado !== 'No voy' && (
                <div className="dist-selector">
                  <span style={{ fontSize: '12px', color: '#94a3b8', marginRight: '0.5rem' }}>¿En qué distancia corrés?</span>
                  <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                    {dists.map(d => (
                      <button
                        key={d}
                        className="filtro-btn"
                        style={distSeleccionada === d
                          ? { background: 'rgba(255,45,45,0.2)', color: '#ff2d2d', border: '1px solid rgba(255,45,45,0.4)', fontWeight: 600 }
                          : {}}
                        onClick={() => updateDistancia(c.id, d)}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="race-estado-section">
                <div className="race-estado-label">
                  Mi estado: <span style={{ color: ESTADO_COLOR[estado], fontWeight: 600 }}>{estado}</span>
                  {distSeleccionada && <span style={{ color: '#94a3b8', fontWeight: 400, fontSize: '12px' }}> · {distSeleccionada}</span>}
                </div>
                {multiDist && !distSeleccionada && estado !== 'No voy' ? (
                  <p style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>Elegí una distancia para marcar tu estado</p>
                ) : (
                  <div className="estado-buttons">
                    {ESTADOS.map(e => (
                      <button
                        key={e}
                        className={`estado-btn ${estado === e ? 'active' : ''}`}
                        style={estado === e ? { borderColor: ESTADO_COLOR[e], color: ESTADO_COLOR[e], background: ESTADO_COLOR[e] + '22' } : {}}
                        onClick={() => updateEstado(c.id, e)}
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Quiénes van */}
              {(() => {
                const total = participaciones.filter(p => p.carrera_id === c.id && p.estado === 'Inscripto').length
                const abierto = inscriptosAbiertos[c.id]
                return (
                  <div style={{ marginTop: '10px' }}>
                    <button
                      onClick={() => toggleInscriptos(c.id)}
                      style={{
                        width: '100%', padding: '8px',
                        background: abierto ? 'var(--bg3)' : 'var(--bg3)',
                        border: '1px solid var(--border)',
                        borderRadius: abierto ? '8px 8px 0 0' : '8px',
                        color: 'var(--text2)', fontSize: '13px',
                        cursor: 'pointer', fontFamily: 'inherit',
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      }}
                    >
                      <span>👟 {total} inscripto{total !== 1 ? 's' : ''}</span>
                      <span style={{ fontSize: '11px' }}>{abierto ? '▲ Ocultar' : '▼ Ver quiénes van'}</span>
                    </button>
                    {abierto && (
                      <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderTop: 'none', borderRadius: '0 0 8px 8px', padding: '8px 12px' }}>
                        {abierto === 'loading' ? (
                          <div style={{ fontSize: '13px', color: 'var(--text2)', textAlign: 'center', padding: '4px 0' }}>Cargando...</div>
                        ) : abierto.length === 0 ? (
                          <div style={{ fontSize: '13px', color: 'var(--text2)' }}>Nadie inscripto todavía</div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {abierto.map((p, i) => (
                              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                                <div style={{
                                  width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                                  background: 'rgba(255,45,45,0.15)', overflow: 'hidden',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  fontSize: 10, fontWeight: 700, color: 'var(--accent)',
                                }}>
                                  {p.avatar_url
                                    ? <img src={p.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                                    : p.nombre?.[0]?.toUpperCase()
                                  }
                                </div>
                                <span>{p.nombre}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })()}

              {/* Botón fotos solo en carreras pasadas */}
              {c.fecha && c.fecha < today && (
                <button
                  onClick={() => abrirFotos(c)}
                  style={{
                    marginTop: '10px', width: '100%', padding: '8px',
                    background: 'var(--bg3)', border: '1px solid var(--border)',
                    borderRadius: '8px', color: '#94a3b8', fontSize: '13px',
                    cursor: 'pointer', fontFamily: 'inherit',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                  }}
                >
                  📷 Ver fotos
                </button>
              )}
            </div>
          )
        })}
      </div>

      {/* Modal fotos */}
      {fotosModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 150, background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: '15px' }}>{fotosModal.nombre}</div>
              <div style={{ fontSize: '12px', color: '#64748b' }}>{fotos.length} foto{fotos.length !== 1 ? 's' : ''}</div>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              {isAdmin && fotos.length > 0 && (
                <button
                  onClick={() => setConfirmarBorrarTodas(true)}
                  style={{ height: 34, fontSize: 13, padding: '0 12px', background: 'rgba(248,113,113,0.12)', color: '#f87171', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  🗑 Borrar todas
                </button>
              )}
              <button
                onClick={() => fotoInputRef.current?.click()}
                disabled={uploading}
                className="btn-accent"
                style={{ height: 34, fontSize: 13, padding: '0 14px' }}
              >
                {uploading ? `${progreso}%` : '+ Subir'}
              </button>
              <button onClick={() => { setFotosModal(null); setSeleccionadas(new Set()); setSearchParams({}, { replace: true }) }} className="btn-ghost" style={{ height: 34, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg>
                Volver
              </button>
            </div>
          </div>

          {/* Barra de progreso */}
          {uploading && (
            <div style={{ height: 3, background: 'var(--bg3)', flexShrink: 0 }}>
              <div style={{ height: '100%', width: `${progreso}%`, background: 'var(--accent)', transition: 'width 0.3s' }} />
            </div>
          )}

          {/* Grid */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '2px' }}>
            {fotosLoading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px', color: '#64748b' }}>Cargando...</div>
            ) : fotos.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '200px', gap: '8px', color: '#64748b' }}>
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
                    <div
                      key={foto.id}
                      style={{ position: 'relative', aspectRatio: '1', overflow: 'hidden', background: 'var(--bg3)', outline: estaSeleccionada ? '3px solid #ff2d2d' : 'none', outlineOffset: '-3px' }}
                      onClick={() => seleccionadas.size > 0 ? (puedeBorrar && toggleSeleccion(foto.id)) : setFotoAmpliada(foto)}
                    >
                      <img
                        src={foto.cloudinary_url.replace('/upload/', '/upload/w_400,q_auto/')}
                        alt=""
                        style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'pointer' }}
                        loading="lazy"
                      />
                      {estaSeleccionada && (
                        <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,45,45,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#ff2d2d', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                          </div>
                        </div>
                      )}
                      {foto.uploader?.nombre && (
                        <div style={{
                          position: 'absolute', bottom: 4, left: 4,
                          background: 'rgba(0,0,0,0.62)', backdropFilter: 'blur(4px)',
                          borderRadius: 4, padding: '2px 6px',
                          fontSize: 10, color: '#fff', fontWeight: 500,
                          pointerEvents: 'none', maxWidth: 'calc(100% - 32px)',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {foto.uploader.nombre}
                        </div>
                      )}
                      {puedeBorrar && seleccionadas.size === 0 && (
                        <button
                          onClick={e => { e.stopPropagation(); toggleSeleccion(foto.id) }}
                          style={{
                            position: 'absolute', top: 4, right: 4, width: 22, height: 22,
                            borderRadius: '50%', background: 'rgba(0,0,0,0.65)', border: 'none',
                            color: '#fff', fontSize: 11, cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}
                        >✕</button>
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
              <button
                onClick={() => setConfirmarBorrarSeleccion(true)}
                style={{ padding: '10px 20px', background: 'rgba(248,113,113,0.15)', color: '#f87171', border: '1px solid rgba(248,113,113,0.4)', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', backdropFilter: 'blur(8px)' }}
              >
                🗑 Borrar {seleccionadas.size} foto{seleccionadas.size !== 1 ? 's' : ''}
              </button>
              <button
                onClick={() => setSeleccionadas(new Set())}
                style={{ padding: '10px 16px', background: 'rgba(0,0,0,0.6)', color: '#94a3b8', border: '1px solid var(--border)', borderRadius: 10, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', backdropFilter: 'blur(8px)' }}
              >
                Cancelar
              </button>
            </div>
          )}

          {toast && (
            <div style={{
              position: 'absolute', bottom: '24px', left: '50%', transform: 'translateX(-50%)',
              background: '#1f1f1f', border: '1px solid rgba(255,255,255,0.12)',
              color: '#f1f5f9', padding: '10px 18px', borderRadius: '10px',
              fontSize: '13px', fontWeight: 500, zIndex: 10,
              boxShadow: '0 4px 20px rgba(0,0,0,0.4)', whiteSpace: 'nowrap',
            }}>
              {toast}
            </div>
          )}
        </div>
      )}

      {/* Lightbox */}
      {fotoAmpliada && (
        <div
          onClick={() => setFotoAmpliada(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)', zIndex: 200, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 16 }}
        >
          <img
            src={fotoAmpliada.cloudinary_url.replace('/upload/', '/upload/w_1200,q_auto/')}
            alt=""
            style={{ maxWidth: '100%', maxHeight: '80vh', borderRadius: 8, objectFit: 'contain' }}
          />
          <a
            href={fotoAmpliada.cloudinary_url}
            download target="_blank" rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            style={{ marginTop: 10, padding: '8px 20px', background: 'rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff', fontSize: 13, textDecoration: 'none' }}
          >
            ⬇ Descargar original
          </a>
        </div>
      )}

      {confirmarEliminarFoto && (
        <ConfirmModal
          mensaje="¿Eliminar esta foto?"
          onConfirm={() => eliminarFoto(confirmarEliminarFoto)}
          onCancel={() => setConfirmarEliminarFoto(null)}
        />
      )}

      {confirmarBorrarTodas && (
        <ConfirmModal
          mensaje={`¿Borrar las ${fotos.length} fotos de ${fotosModal?.nombre}? Esta acción no se puede deshacer.`}
          onConfirm={borrarTodasLasFotos}
          onCancel={() => setConfirmarBorrarTodas(false)}
        />
      )}

      {confirmarBorrarSeleccion && (
        <ConfirmModal
          mensaje={`¿Borrar ${seleccionadas.size} foto${seleccionadas.size !== 1 ? 's' : ''} seleccionada${seleccionadas.size !== 1 ? 's' : ''}?`}
          onConfirm={borrarSeleccionadas}
          onCancel={() => setConfirmarBorrarSeleccion(false)}
        />
      )}

      {toast && !fotosModal && (
        <div style={{
          position: 'fixed', bottom: '80px', left: '50%', transform: 'translateX(-50%)',
          background: '#1f1f1f', border: '1px solid rgba(255,255,255,0.12)',
          color: '#f1f5f9', padding: '10px 18px', borderRadius: '10px',
          fontSize: '13px', fontWeight: 500, zIndex: 999,
          boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
          animation: 'fadeIn .2s ease',
        }}>
          ✅ {toast}
        </div>
      )}
    </div>
  )
}
