import PageLoader from '../components/PageLoader'
import ConfirmModal from '../components/ConfirmModal'
import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { formatFechaHora, yaEmpezo } from '../lib/utils'
import { notificar } from '../lib/push'

const CLOUD = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME
const PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET

function EstadoBtnConInfo({ label, info, activo, color, onClick }) {
  const [visible, setVisible] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!visible) return
    function handleOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setVisible(false)
    }
    document.addEventListener('mousedown', handleOutside)
    document.addEventListener('touchstart', handleOutside)
    return () => {
      document.removeEventListener('mousedown', handleOutside)
      document.removeEventListener('touchstart', handleOutside)
    }
  }, [visible])

  return (
    <span ref={ref} style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        className={`estado-btn ${activo ? 'active' : ''}`}
        style={activo ? { borderColor: color, color, background: color + '22' } : {}}
        onClick={onClick}
      >
        {label}
        {info && (
          <span
            onClick={e => { e.stopPropagation(); setVisible(v => !v) }}
            style={{ marginLeft: '4px', opacity: 0.6, fontSize: '10px', cursor: 'pointer' }}
          >ⓘ</span>
        )}
      </button>
      {info && visible && (
        <span style={{
          position: 'absolute', bottom: 'calc(100% + 6px)', left: 0,
          background: '#1e293b', color: '#f1f5f9', fontSize: '12px', lineHeight: 1.5,
          padding: '8px 10px', borderRadius: '8px', width: '210px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.4)', zIndex: 100,
          border: '1px solid rgba(255,255,255,0.08)', pointerEvents: 'none',
        }}>
          {info}
        </span>
      )}
    </span>
  )
}

function TransferenciaModal({ carreraId, carreraNombre, originalUserId, onConfirm, onClose }) {
  const [perfiles, setPerfiles] = useState([])
  const [busqueda, setBusqueda] = useState('')
  const [seleccionado, setSeleccionado] = useState(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    async function cargar() {
      const [{ data: todos }, { data: inscriptos }] = await Promise.all([
        supabase.from('profiles').select('id, nombre, avatar_url').neq('id', originalUserId).order('nombre'),
        supabase.from('participaciones').select('user_id').eq('carrera_id', carreraId).eq('estado', 'Inscripto'),
      ])
      const ids = new Set((inscriptos || []).map(p => p.user_id))
      setPerfiles((todos || []).filter(p => !ids.has(p.id)))
      setCargando(false)
    }
    cargar()
  }, [carreraId, originalUserId])

  const filtrados = perfiles.filter(p =>
    !busqueda || p.nombre?.toLowerCase().includes(busqueda.toLowerCase())
  )

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 300, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: '16px' }} onClick={onClose}>
      <div style={{ background: 'var(--bg2)', borderRadius: '16px', padding: '20px', maxWidth: '420px', width: '100%', maxHeight: '72vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '15px' }}>Transferir lugar</div>
            <div style={{ fontSize: '12px', color: 'var(--text2)', marginTop: '2px' }}>{carreraNombre}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text2)', fontSize: '20px', cursor: 'pointer', lineHeight: 1 }}>✕</button>
        </div>
        <input
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          placeholder="Buscar corredor/a..."
          style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text)', padding: '9px 12px', fontSize: '13px', fontFamily: 'inherit', marginBottom: '10px' }}
          autoFocus
        />
        {cargando ? (
          <div style={{ textAlign: 'center', color: 'var(--text2)', padding: '24px', fontSize: '13px' }}>Cargando...</div>
        ) : (
          <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {filtrados.length === 0
              ? <div style={{ fontSize: '13px', color: 'var(--text2)', textAlign: 'center', padding: '20px' }}>Sin resultados</div>
              : filtrados.map(p => {
                const activo = seleccionado?.id === p.id
                return (
                  <div
                    key={p.id}
                    onClick={() => setSeleccionado(p)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '10px',
                      padding: '8px 10px', borderRadius: '10px', cursor: 'pointer',
                      background: activo ? 'rgba(74,222,128,0.1)' : 'transparent',
                      border: activo ? '1px solid rgba(74,222,128,0.3)' : '1px solid transparent',
                    }}
                  >
                    <div style={{ width: 30, height: 30, borderRadius: '50%', flexShrink: 0, background: 'rgba(255,45,45,0.15)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'var(--accent)' }}>
                      {p.avatar_url ? <img src={p.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : p.nombre?.[0]?.toUpperCase()}
                    </div>
                    <span style={{ flex: 1, fontSize: '14px', fontWeight: activo ? 600 : 400 }}>{p.nombre}</span>
                    {activo && <span style={{ color: '#4ade80', fontSize: '16px' }}>✓</span>}
                  </div>
                )
              })
            }
          </div>
        )}
        <button
          disabled={!seleccionado}
          onClick={() => seleccionado && onConfirm(seleccionado.id, seleccionado.nombre)}
          className="btn-primary"
          style={{ marginTop: '12px', opacity: seleccionado ? 1 : 0.4 }}
        >
          {seleccionado ? `Transferir a ${seleccionado.nombre}` : 'Seleccioná un corredor/a'}
        </button>
      </div>
    </div>
  )
}

function SugerenciaModal({ onClose, onSend, userId }) {
  const [form, setForm] = useState({ nombre: '', fecha: '', link: '', lugar: '', tipo: 'calle', distancias: '' })
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)

  async function enviar(e) {
    e.preventDefault()
    if (!form.nombre.trim()) return
    setEnviando(true)
    const { error } = await supabase.from('carreras_sugeridas').insert([{
      user_id: userId,
      nombre: form.nombre.trim(),
      fecha: form.fecha || null,
      link: form.link.trim() || null,
      lugar: form.lugar.trim() || null,
      tipo: form.tipo,
      distancias: form.distancias.trim() || null,
    }])
    setEnviando(false)
    if (!error) { setEnviado(true); onSend?.() }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 300, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: '16px' }} onClick={onClose}>
      <div style={{ background: 'var(--bg2)', borderRadius: '16px', padding: '20px', maxWidth: '420px', width: '100%', maxHeight: '88vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ fontWeight: 700, fontSize: '15px' }}>Sugerí una carrera</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text2)', fontSize: '20px', cursor: 'pointer', lineHeight: 1 }}>✕</button>
        </div>
        {enviado ? (
          <div style={{ textAlign: 'center', padding: '24px 0', fontSize: '14px', color: 'var(--text2)', lineHeight: 1.6 }}>
            <div style={{ fontSize: '32px', marginBottom: '10px' }}>🙌</div>
            <div>¡Gracias por la sugerencia!</div>
            <div style={{ fontSize: '12px', marginTop: '6px' }}>El admin la va a revisar pronto.</div>
            <button onClick={onClose} className="btn-primary" style={{ marginTop: '18px' }}>Cerrar</button>
          </div>
        ) : (
          <form onSubmit={enviar} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '12px', color: 'var(--text2)', display: 'block', marginBottom: '4px' }}>Nombre *</label>
              <input value={form.nombre} onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))} placeholder="Ej: 10K del Río" required
                style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text)', padding: '9px 12px', fontSize: '13px', fontFamily: 'inherit', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize: '12px', color: 'var(--text2)', display: 'block', marginBottom: '4px' }}>Fecha</label>
              <input type="date" value={form.fecha} onChange={e => setForm(p => ({ ...p, fecha: e.target.value }))}
                style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text)', padding: '9px 12px', fontSize: '13px', fontFamily: 'inherit', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize: '12px', color: 'var(--text2)', display: 'block', marginBottom: '4px' }}>Lugar</label>
              <input value={form.lugar} onChange={e => setForm(p => ({ ...p, lugar: e.target.value }))} placeholder="Ej: Parque Tres de Febrero"
                style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text)', padding: '9px 12px', fontSize: '13px', fontFamily: 'inherit', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize: '12px', color: 'var(--text2)', display: 'block', marginBottom: '4px' }}>Distancias (separadas por coma)</label>
              <input value={form.distancias} onChange={e => setForm(p => ({ ...p, distancias: e.target.value }))} placeholder="Ej: 5K, 10K, 21K"
                style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text)', padding: '9px 12px', fontSize: '13px', fontFamily: 'inherit', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize: '12px', color: 'var(--text2)', display: 'block', marginBottom: '4px' }}>Tipo</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                {['calle', 'trail'].map(t => (
                  <button key={t} type="button" onClick={() => setForm(p => ({ ...p, tipo: t }))}
                    style={{ flex: 1, padding: '8px', borderRadius: '8px', border: '1px solid var(--border)', background: form.tipo === t ? 'rgba(74,222,128,0.1)' : 'var(--bg)', color: form.tipo === t ? '#4ade80' : 'var(--text2)', fontFamily: 'inherit', fontSize: '13px', cursor: 'pointer', borderColor: form.tipo === t ? 'rgba(74,222,128,0.4)' : 'var(--border)', fontWeight: form.tipo === t ? 600 : 400 }}>
                    {t === 'calle' ? '🏙 Calle' : '🌲 Trail'}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label style={{ fontSize: '12px', color: 'var(--text2)', display: 'block', marginBottom: '4px' }}>Link de inscripción</label>
              <input value={form.link} onChange={e => setForm(p => ({ ...p, link: e.target.value }))} placeholder="https://..."
                style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text)', padding: '9px 12px', fontSize: '13px', fontFamily: 'inherit', boxSizing: 'border-box' }} />
            </div>
            <button type="submit" className="btn-primary" disabled={!form.nombre.trim() || enviando} style={{ marginTop: '4px' }}>
              {enviando ? 'Enviando...' : 'Enviar sugerencia'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

const EMPTY = { nombre: '', fecha: '', hora: '', distancias: '', lugar: '', link: '', codigo: '', tipo: '', running_team: false, flama_points: false, tipo_actividad: 'carrera', calzado: '' }

const INSTRUCTIVO_RUNNING_TEAM = `1. Entrar a EntryFee.com.ar con tu usuario y contraseña.
2. Ir a la solapa GRUPO.
3. Apretar UNIRSE y buscar FLAMA TRAINING. Unirse al grupo.
4. Una vez aceptado, poner "Running Team" en el apartado MODALIDAD para acceder al descuento por GRUPO.

El descuento quedará disponible para todas las carreras que organice esta asociación.`
const ESTADOS = ['Inscripto', 'Quizás', 'No voy', 'Lista de espera', 'Stand Flama']
const ESTADO_COLOR = {
  'Inscripto': '#4ade80',
  'No voy': '#f87171',
  'Quizás': '#fbbf24',
  'Lista de espera': '#60a5fa',
  'Stand Flama': '#ff2d2d',
  'Pendiente': '#64748b',
}
const ESTADO_INFO = {
  'Stand Flama': 'No corro, pero voy a alentar al grupo y tomar unos mates 🧉',
  'Lista de espera': 'Serás notificado automáticamente. Se prioriza según el orden en el que te anotaste.',
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
  const [modalRunningTeam, setModalRunningTeam] = useState(false)
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
      return saved ? JSON.parse(saved) : { tipo: '', distancias: [], fecha: 'proximas', meses: [] }
    } catch { return { tipo: '', distancias: [], fecha: 'proximas', meses: [] } }
  })
  const [showFiltros, setShowFiltros] = useState(false)
  const [inscriptosAbiertos, setInscriptosAbiertos] = useState({}) // carreraId -> [perfiles] | 'loading'
  const [inscriptosExpandidos, setInscriptosExpandidos] = useState({}) // carreraId -> bool
  const [transferenciaModal, setTransferenciaModal] = useState(null) // { carreraId, carreraNombre, originalUserId }
  const [sugerenciaModal, setSugerenciaModal] = useState(false)
  const [sugerencias, setSugerencias] = useState([]) // solo admin
  const [sugerenciasAbierto, setSugerenciasAbierto] = useState(false)

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
  const [confirmarEliminarCarrera, setConfirmarEliminarCarrera] = useState(null)
  const [confirmarBorrarTodas, setConfirmarBorrarTodas] = useState(false)
  const [seleccionadas, setSeleccionadas] = useState(new Set())
  const [confirmarBorrarSeleccion, setConfirmarBorrarSeleccion] = useState(false)
  const fotoInputRef = useRef()

  useEffect(() => {
    fetchAll()
    const channel = supabase.channel('carreras-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'carreras' }, fetchAll)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [])

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
      supabase.from('participaciones').select('carrera_id, estado, distancia_elegida, transferido').eq('user_id', user.id)
    ])
    setCarreras(cars || [])
    setParticipaciones(parts || [])
    const distMap = {}
    parts?.forEach(p => {
      if (p.distancia_elegida) distMap[p.carrera_id] = p.distancia_elegida
    })
    setDistanciasSeleccionadas(distMap)
    setLoading(false)
    if (isAdmin) fetchSugerencias()
  }

  async function fetchSugerencias() {
    const { data } = await supabase
      .from('carreras_sugeridas')
      .select('*, profiles(nombre)')
      .eq('estado', 'pendiente')
      .order('created_at', { ascending: false })
    setSugerencias(data || [])
  }

  async function publicarSugerencia(s) {
    const distanciasArr = s.distancias
      ? s.distancias.split(',').map(d => d.trim()).filter(Boolean)
      : []
    const { error } = await supabase.from('carreras').insert([{
      nombre: s.nombre,
      fecha: s.fecha || null,
      link: s.link || null,
      lugar: s.lugar || null,
      tipo: s.tipo || 'Calle',
      distancias: distanciasArr,
      tipo_actividad: 'carrera',
    }])
    if (error) { setToast('❌ Error al publicar'); setTimeout(() => setToast(''), 2500); return }
    await supabase.from('carreras_sugeridas').update({ estado: 'publicada' }).eq('id', s.id)
    setSugerencias(prev => prev.filter(x => x.id !== s.id))
    fetchAll()
    setToast('✅ Carrera publicada')
    setTimeout(() => setToast(''), 3000)
  }

  async function descartarSugerencia(id) {
    await supabase.from('carreras_sugeridas').update({ estado: 'descartada' }).eq('id', id)
    setSugerencias(prev => prev.filter(x => x.id !== id))
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    const esCarrera = (form.tipo_actividad || 'carrera') === 'carrera'
    const distanciasArr = esCarrera && form.distancias
      ? form.distancias.split(',').map(d => d.trim()).filter(Boolean)
      : []
    const payload = {
      nombre: form.nombre,
      fecha: form.fecha || null,
      hora: form.hora || null,
      lugar: form.lugar || null,
      tipo_actividad: form.tipo_actividad || 'carrera',
      calzado: form.tipo_actividad === 'entrenamiento' ? (form.calzado || null) : null,
      link: esCarrera ? (form.link || null) : null,
      codigo: esCarrera && !form.running_team ? (form.codigo || null) : null,
      running_team: esCarrera ? (form.running_team || false) : false,
      flama_points: esCarrera ? (form.flama_points || false) : false,
      tipo: esCarrera ? (form.tipo || null) : null,
      distancias: distanciasArr,
      distancia: esCarrera ? (distanciasArr[0] || null) : null,
    }
    if (editId) {
      await supabase.from('carreras').update(payload).eq('id', editId)
    } else {
      await supabase.from('carreras').insert([payload])
      // Notificar a todos según el tipo de actividad
      if (esCarrera) {
        notificar(
          '🏃 ¡Nueva carrera disponible!',
          `Se publicó "${payload.nombre}". ¡Anotate!`,
          '/carreras',
          { all: true },
        )
      } else if (payload.tipo_actividad === 'evento') {
        notificar(
          '🎉 ¡Nuevo evento!',
          `Se publicó "${payload.nombre}". ¡Confirmá si vas!`,
          '/carreras',
          { all: true },
        )
      } else if (payload.tipo_actividad === 'entrenamiento') {
        notificar(
          '💪 ¡Nuevo entrenamiento!',
          `Se publicó "${payload.nombre}". ¡Confirmá si vas!`,
          '/carreras',
          { all: true },
        )
      }
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
      hora: c.hora ? c.hora.substring(0, 5) : '',
      distancias: c.distancias?.length ? c.distancias.join(', ') : (c.distancia || ''),
      lugar: c.lugar || '',
      link: c.link || '',
      codigo: c.codigo || '',
      tipo: c.tipo || '',
      running_team: c.running_team || false,
      flama_points: c.flama_points || false,
      tipo_actividad: c.tipo_actividad || 'carrera',
      calzado: c.calzado || '',
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
    await supabase.from('carreras').delete().eq('id', id)
    setConfirmarEliminarCarrera(null)
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
    const prevEstado = participaciones.find(p => p.carrera_id === carreraId)?.estado
    let distanciaElegida = noVoy ? null : (distanciasSeleccionadas[carreraId] || null)
    // Si no eligió distancia explícitamente pero la carrera tiene solo una, usarla
    if (!noVoy && !distanciaElegida) {
      const carrera = carreras.find(c => c.id === carreraId)
      if (carrera) {
        const dists = getDistancias(carrera)
        if (dists.length === 1) distanciaElegida = dists[0]
      }
    }
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

    // Actualizar lista de inscriptos si está abierta
    if (inscriptosAbiertos[carreraId] && inscriptosAbiertos[carreraId] !== 'loading') {
      refreshInscriptos(carreraId)
    }

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

  async function notificarFlamitas(carrera) {
    const { data: parts } = await supabase
      .from('participaciones')
      .select('user_id')
      .eq('carrera_id', carrera.id)
      .in('estado', ['Inscripto', 'Stand Flama'])
    const user_ids = (parts || []).map(p => p.user_id)
    if (user_ids.length === 0) { setToast('⚠️ No hay inscriptos para notificar'); setTimeout(() => setToast(''), 2500); return }
    const ok = await notificar(
      '💎 ¡Ya podés sumar tus Flamitas!',
      `Subí tu foto de ${carrera.nombre} antes de que pasen 7 días.`,
      '/mas',
      { user_ids },
    )
    if (ok) await supabase.from('carreras').update({ flamitas_notif_enviada: true }).eq('id', carrera.id)
    setToast(ok ? '✅ Notificación enviada' : '❌ Error al enviar')
    setTimeout(() => setToast(''), 2500)
  }

  async function refreshInscriptos(carreraId) {
    const { data: parts } = await supabase
      .from('participaciones')
      .select('user_id, estado')
      .eq('carrera_id', carreraId)
      .in('estado', ['Inscripto', 'Stand Flama'])
    const userIds = (parts || []).map(p => p.user_id)
    if (userIds.length === 0) { setInscriptosAbiertos(prev => ({ ...prev, [carreraId]: [] })); return }
    const { data: perfiles } = await supabase
      .from('profiles')
      .select('id, nombre, avatar_url')
      .in('id', userIds)
    const estadoMap = {}
    parts?.forEach(p => { estadoMap[p.user_id] = p.estado })
    const ordenados = (perfiles || [])
      .map(p => ({ ...p, estadoPart: estadoMap[p.id] }))
      .sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es'))
    setInscriptosAbiertos(prev => ({ ...prev, [carreraId]: ordenados }))
  }

  async function realizarTransferencia(carreraId, originalUserId, nuevoUserId, nuevoNombre) {
    // 1. Original → No voy + transferido
    await supabase.from('participaciones')
      .update({ estado: 'No voy', distancia_elegida: null, transferido: true, updated_at: new Date().toISOString() })
      .eq('carrera_id', carreraId).eq('user_id', originalUserId)

    // 2. Nuevo → Inscripto (upsert por si no tenía participacion)
    const { error } = await supabase.from('participaciones')
      .upsert({ carrera_id: carreraId, user_id: nuevoUserId, estado: 'Inscripto', updated_at: new Date().toISOString() },
        { onConflict: 'carrera_id,user_id' })

    if (error) { setToast('❌ Error al transferir'); setTimeout(() => setToast(''), 2500); return }

    // 3. Actualizar estado local si es el usuario actual quien transfiere
    if (originalUserId === user.id) {
      setParticipaciones(prev =>
        prev.map(p => p.carrera_id === carreraId ? { ...p, estado: 'No voy', distancia_elegida: null, transferido: true } : p)
      )
      setDistanciasSeleccionadas(prev => { const n = { ...prev }; delete n[carreraId]; return n })
    }

    // 4. Refrescar lista de inscriptos si está abierta
    if (inscriptosAbiertos[carreraId] && inscriptosAbiertos[carreraId] !== 'loading') {
      refreshInscriptos(carreraId)
    }

    // 5. Notificar al nuevo inscripto
    const carrera = carreras.find(c => c.id === carreraId)
    notificar(
      '🎉 ¡Te transfirieron un lugar!',
      `Quedaste inscripto/a en ${carrera?.nombre ?? 'una carrera'}. ¡A prepararse!`,
      '/carreras',
      { user_ids: [nuevoUserId] }
    )

    setTransferenciaModal(null)
    setToast(`✅ Lugar transferido a ${nuevoNombre}`)
    setTimeout(() => setToast(''), 3000)
  }

  async function toggleInscriptos(carreraId) {
    if (inscriptosAbiertos[carreraId]) {
      setInscriptosAbiertos(prev => { const n = { ...prev }; delete n[carreraId]; return n })
      return
    }
    setInscriptosAbiertos(prev => ({ ...prev, [carreraId]: 'loading' }))
    await refreshInscriptos(carreraId)
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
    if (filtros.meses?.length > 0 && (!c.fecha || !filtros.meses.some(m => c.fecha.startsWith(m)))) return false
    return true
  })

  const filtrosActivos = [
    filtros.fecha !== 'proximas',
    filtros.tipo !== '',
    filtros.distancias.length > 0,
    (filtros.meses?.length || 0) > 0,
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

      {/* Panel de sugerencias — solo admin */}
      {isAdmin && sugerencias.length > 0 && (
        <div className="card" style={{ marginBottom: '14px' }}>
          <button
            onClick={() => setSugerenciasAbierto(v => !v)}
            style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text)' }}>
              💡 Sugerencias ({sugerencias.length})
            </span>
            <span style={{ fontSize: '12px', color: 'var(--text2)' }}>{sugerenciasAbierto ? '▲' : '▼'}</span>
          </button>
          {sugerenciasAbierto && (
            <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {sugerencias.map(s => (
                <div key={s.id} style={{ background: 'var(--bg3)', borderRadius: '10px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ fontWeight: 600, fontSize: '14px' }}>{s.nombre}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text2)', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {s.fecha && <span>📅 {s.fecha}</span>}
                    {s.lugar && <span>📍 {s.lugar}</span>}
                    {s.distancias && <span>🏃 {s.distancias}</span>}
                    {s.tipo && <span>{s.tipo === 'trail' ? '🌲' : '🏙'} {s.tipo}</span>}
                    {s.link && <a href={s.link} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>🔗 Link</a>}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text2)', marginTop: '2px' }}>
                    Sugerida por {s.profiles?.nombre || 'un usuario'}
                  </div>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                    <button
                      onClick={() => publicarSugerencia(s)}
                      style={{ flex: 1, padding: '7px', background: 'rgba(74,222,128,0.1)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.3)', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
                    >
                      ✓ Publicar
                    </button>
                    <button
                      onClick={() => descartarSugerencia(s.id)}
                      style={{ padding: '7px 14px', background: 'rgba(248,113,113,0.1)', color: '#f87171', border: '1px solid rgba(248,113,113,0.3)', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit' }}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {isAdmin && showForm && !editId && (
        <form ref={formRef} className="card form-card" onSubmit={handleSave}>
          <h3 style={{ marginBottom: '0.75rem', fontSize: '14px', fontWeight: 600 }}>
            {form.tipo_actividad === 'evento' ? 'Nuevo evento' : form.tipo_actividad === 'entrenamiento' ? 'Nuevo entrenamiento' : 'Nueva carrera'}
          </h3>
          {/* Selector de tipo de actividad */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
            {[['carrera', '🏃 Carrera'], ['evento', '🎉 Evento'], ['entrenamiento', '💪 Entrenamiento']].map(([val, label]) => (
              <button
                key={val}
                type="button"
                onClick={() => setForm({ ...EMPTY, tipo_actividad: val })}
                style={{
                  padding: '6px 14px', borderRadius: '8px', fontSize: '13px', cursor: 'pointer',
                  fontFamily: 'inherit', border: form.tipo_actividad === val ? '1.5px solid var(--accent)' : '1px solid var(--border)',
                  background: form.tipo_actividad === val ? 'rgba(255,45,45,0.1)' : 'var(--bg3)',
                  color: form.tipo_actividad === val ? 'var(--accent)' : 'var(--text2)',
                  fontWeight: form.tipo_actividad === val ? 600 : 400,
                }}
              >{label}</button>
            ))}
          </div>
          <div className="form-grid">
            <div className="field">
              <label>Nombre *</label>
              <input
                value={form.nombre}
                onChange={e => setForm({ ...form, nombre: e.target.value })}
                placeholder={form.tipo_actividad === 'entrenamiento' ? 'Entrenamiento trail' : form.tipo_actividad === 'evento' ? 'Cena de fin de año' : '21K Buenos Aires'}
                required
              />
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
              <label>Lugar</label>
              <input value={form.lugar} onChange={e => setForm({ ...form, lugar: e.target.value })} placeholder="Parque Tres de Febrero" />
            </div>
            {form.tipo_actividad === 'entrenamiento' && (
              <div className="field">
                <label>Calzado a llevar</label>
                <select value={form.calzado} onChange={e => setForm({ ...form, calzado: e.target.value })}>
                  <option value="">— Sin especificar —</option>
                  <option value="Trail">Trail</option>
                  <option value="Calle">Calle</option>
                </select>
              </div>
            )}
            {(!form.tipo_actividad || form.tipo_actividad === 'carrera') && (
              <>
                <div className="field">
                  <label>Distancia(s)</label>
                  <input
                    value={form.distancias}
                    onChange={e => setForm({ ...form, distancias: e.target.value })}
                    onBlur={e => {
                      const valor = e.target.value.split(',').map(d => {
                        const t = d.trim()
                        if (!t) return ''
                        return /k$/i.test(t) ? t.toUpperCase() : `${t}K`
                      }).filter(Boolean).join(', ')
                      setForm(f => ({ ...f, distancias: valor }))
                    }}
                    placeholder="5, 10, 21"
                  />
                  <span style={{ fontSize: '11px', color: 'var(--text2)', marginTop: '2px' }}>Separar con comas si hay varias · La K se agrega sola</span>
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
                  <label>Código de descuento</label>
                  <input
                    value={form.codigo}
                    onChange={e => setForm({ ...form, codigo: e.target.value })}
                    placeholder="FLAMA20"
                    disabled={form.running_team}
                    style={{ opacity: form.running_team ? 0.4 : 1 }}
                  />
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', cursor: 'pointer', width: 'fit-content' }}
                    onClick={() => setForm({ ...form, running_team: !form.running_team, codigo: '' })}
                  >
                    <div style={{
                      width: 14, height: 14, borderRadius: 3, border: '1.5px solid var(--border)', flexShrink: 0,
                      background: form.running_team ? 'var(--accent)' : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .15s',
                    }}>
                      {form.running_team && <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                    </div>
                    <span style={{ fontSize: '12px', color: 'var(--text2)' }}>Agregar tutorial de Descuento Club de Corredores</span>
                  </label>
                </div>
                <div className="field">
                  <label>Flamitas</label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', cursor: 'pointer', width: 'fit-content' }}
                    onClick={() => setForm({ ...form, flama_points: !form.flama_points })}
                  >
                    <div style={{
                      width: 14, height: 14, borderRadius: 3, border: '1.5px solid var(--border)', flexShrink: 0,
                      background: form.flama_points ? 'var(--accent)' : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .15s',
                    }}>
                      {form.flama_points && <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                    </div>
                    <span style={{ fontSize: '12px', color: 'var(--text2)' }}>Habilitar para sumar Flamitas</span>
                  </label>
                </div>
                <div className="field full">
                  <label>Link de inscripción</label>
                  <input value={form.link} onChange={e => setForm({ ...form, link: e.target.value })} placeholder="https://..." />
                </div>
              </>
            )}
          </div>
          <div className="form-actions">
            <button type="button" className="btn-ghost" onClick={handleCancelForm}>Cancelar</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Guardando...' : form.tipo_actividad === 'evento' ? 'Crear evento' : form.tipo_actividad === 'entrenamiento' ? 'Crear entrenamiento' : 'Crear carrera'}
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
            onClick={() => setFiltrosGuardados({ tipo: '', distancias: [], fecha: 'proximas', meses: [] })}
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
                      onClick={() => setFiltrosGuardados(f => ({ ...f, fecha: val, meses: [] }))}>
                      {val === 'proximas' ? 'Próximas' : val === 'pasadas' ? 'Anteriores' : 'Todas'}
                    </button>
                  ))}
                </div>
              </div>
              {todosMeses.length > 0 && (
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>Mes</div>
                  <div className="filtro-group" style={{ flexWrap: 'wrap' }}>
                    {todosMeses.map(m => {
                      const [anio, mes] = m.split('-')
                      const label = new Date(parseInt(anio), parseInt(mes) - 1).toLocaleDateString('es-AR', { month: 'short', year: '2-digit' })
                      const activo = filtros.meses?.includes(m)
                      return (
                        <button key={m} className={`filtro-btn ${activo ? 'active' : ''}`}
                          onClick={() => setFiltrosGuardados(f => {
                            const meses = f.meses || []
                            return { ...f, meses: activo ? meses.filter(x => x !== m) : [...meses, m], fecha: '' }
                          })}>
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
                <h3 style={{ marginBottom: '0.75rem', fontSize: '14px', fontWeight: 600 }}>
                  {form.tipo_actividad === 'evento' ? 'Editar evento' : form.tipo_actividad === 'entrenamiento' ? 'Editar entrenamiento' : 'Editar carrera'}
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
                    <label>Lugar</label>
                    <input value={form.lugar} onChange={e => setForm({ ...form, lugar: e.target.value })} placeholder="Parque Tres de Febrero" />
                  </div>
                  {form.tipo_actividad === 'entrenamiento' && (
                    <div className="field">
                      <label>Calzado a llevar</label>
                      <select value={form.calzado} onChange={e => setForm({ ...form, calzado: e.target.value })}>
                        <option value="">— Sin especificar —</option>
                        <option value="Trail">Trail</option>
                        <option value="Calle">Calle</option>
                      </select>
                    </div>
                  )}
                  {(!form.tipo_actividad || form.tipo_actividad === 'carrera') && (
                    <>
                      <div className="field">
                        <label>Distancia(s)</label>
                        <input value={form.distancias} onChange={e => setForm({ ...form, distancias: e.target.value })} placeholder="5K, 10K" />
                        <span style={{ fontSize: '11px', color: 'var(--text2)', marginTop: '2px' }}>Separar con comas si hay varias</span>
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
                        <label>Código de descuento</label>
                        <input value={form.codigo} onChange={e => setForm({ ...form, codigo: e.target.value })} placeholder="FLAMA20" disabled={form.running_team} style={{ opacity: form.running_team ? 0.4 : 1 }} />
                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', cursor: 'pointer', width: 'fit-content' }}
                          onClick={() => setForm({ ...form, running_team: !form.running_team, codigo: '' })}
                        >
                          <div style={{ width: 14, height: 14, borderRadius: 3, border: '1.5px solid var(--border)', flexShrink: 0, background: form.running_team ? 'var(--accent)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .15s' }}>
                            {form.running_team && <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                          </div>
                          <span style={{ fontSize: '12px', color: 'var(--text2)' }}>Agregar tutorial de Descuento Club de Corredores</span>
                        </label>
                      </div>
                      <div className="field">
                        <label>Flamitas</label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', cursor: 'pointer', width: 'fit-content' }}
                          onClick={() => setForm({ ...form, flama_points: !form.flama_points })}
                        >
                          <div style={{
                            width: 14, height: 14, borderRadius: 3, border: '1.5px solid var(--border)', flexShrink: 0,
                            background: form.flama_points ? 'var(--accent)' : 'transparent',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .15s',
                          }}>
                            {form.flama_points && <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                          </div>
                          <span style={{ fontSize: '12px', color: 'var(--text2)' }}>Habilitar para sumar Flamitas</span>
                        </label>
                      </div>
                      <div className="field full">
                        <label>Link de inscripción</label>
                        <input value={form.link} onChange={e => setForm({ ...form, link: e.target.value })} placeholder="https://..." />
                      </div>
                    </>
                  )}
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
          const fueTransferido = !!part?.transferido
          // Una vez que la carrera ya arrancó, no se puede modificar el estado
          // de participación — habilitar eso permitiría, por ejemplo, marcarse
          // "Inscripto" después y subir fotos pidiendo Flama Points de una
          // carrera que en realidad nunca se corrió.
          const carreraPasada = yaEmpezo(c.fecha, c.hora)
          const dists = getDistancias(c)
          const multiDist = dists.length > 1
          const distSeleccionada = distanciasSeleccionadas[c.id] || (dists.length === 1 ? dists[0] : null)

          return (
            <div key={c.id} className="card race-card" style={c.destacada ? { borderColor: 'rgba(234,179,8,0.5)', boxShadow: '0 0 0 1px rgba(234,179,8,0.2)' } : {}}>
              <div className="race-card-top">
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                    {c.destacada && <span style={{ fontSize: '15px', lineHeight: 1 }}>⭐</span>}
                    <h3 style={{ margin: 0 }}>{c.nombre}</h3>
                    {c.tipo_actividad === 'evento' && (
                      <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 7px', borderRadius: '20px', background: 'rgba(251,191,36,0.15)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.3)', whiteSpace: 'nowrap', flexShrink: 0 }}>🎉 Evento</span>
                    )}
                    {c.tipo_actividad === 'entrenamiento' && (
                      <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 7px', borderRadius: '20px', background: 'rgba(96,165,250,0.15)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.3)', whiteSpace: 'nowrap', flexShrink: 0 }}>💪 Entrenamiento</span>
                    )}
                  </div>
                  <div className="race-meta">
                    {c.fecha && <span className="tag">📅 {formatFechaHora(c.fecha, c.hora)}</span>}
                    {(!c.tipo_actividad || c.tipo_actividad === 'carrera') && dists.length > 0 && <span className="tag">📏 {dists.join(' · ')}</span>}
                    {c.lugar && (
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(c.lugar)}`}
                        target="_blank" rel="noopener noreferrer"
                        className="tag"
                        style={{ textDecoration: 'none' }}
                        onClick={e => e.stopPropagation()}
                      >📍 {c.lugar}</a>
                    )}
                    {(!c.tipo_actividad || c.tipo_actividad === 'carrera') && c.tipo && <span className="tag" style={{ background: TIPO_COLOR[c.tipo] + '22', color: TIPO_COLOR[c.tipo], border: `1px solid ${TIPO_COLOR[c.tipo]}44`, fontWeight: 600 }}>{c.tipo}</span>}
                    {c.tipo_actividad === 'entrenamiento' && c.calzado && <span className="tag" style={{ background: TIPO_COLOR[c.calzado] + '22', color: TIPO_COLOR[c.calzado], border: `1px solid ${TIPO_COLOR[c.calzado]}44`, fontWeight: 600 }}>👟 {c.calzado}</span>}
                    {(!c.tipo_actividad || c.tipo_actividad === 'carrera') && c.running_team && (
                      <span
                        className="tag code-tag"
                        style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                        onClick={() => setModalRunningTeam(true)}
                      >
                        🏃 Descuento Club de Corredores <span style={{ opacity: 0.6, fontSize: '10px' }}>ⓘ</span>
                      </span>
                    )}
                    {(!c.tipo_actividad || c.tipo_actividad === 'carrera') && !c.running_team && c.codigo && (() => {
                      const esCupon = /^\S+$/.test(c.codigo.trim())
                      return esCupon ? (
                        <span
                          className="tag code-tag"
                          style={{ cursor: 'pointer', userSelect: 'none', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                          title="Tocar para copiar"
                          onClick={() => {
                            navigator.clipboard.writeText(c.codigo)
                            const esMobile = /Android|iPhone|iPad/i.test(navigator.userAgent)
                            if (!esMobile) {
                              setToast(`Código "${c.codigo}" copiado`)
                              setTimeout(() => setToast(''), 2500)
                            }
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

                {modalRunningTeam && (
                  <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }} onClick={() => setModalRunningTeam(false)}>
                    <div style={{ background: 'var(--bg2)', borderRadius: '16px', padding: '24px', maxWidth: '400px', width: '100%' }} onClick={e => e.stopPropagation()}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <h3 style={{ margin: 0, fontSize: '15px' }}>🏃 Descuento Club de Corredores</h3>
                        <button onClick={() => setModalRunningTeam(false)} style={{ background: 'none', border: 'none', color: 'var(--text2)', fontSize: '18px', cursor: 'pointer' }}>✕</button>
                      </div>
                      <p style={{ fontSize: '13px', color: 'var(--text2)', marginBottom: '12px' }}>
                        Para acceder al descuento por grupo en EntryFee:
                      </p>
                      <div style={{ fontSize: '13px', lineHeight: 1.7, color: 'var(--text)', whiteSpace: 'pre-line' }}>
                        {INSTRUCTIVO_RUNNING_TEAM}
                      </div>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(INSTRUCTIVO_RUNNING_TEAM)
                          const esMobile = /Android|iPhone|iPad/i.test(navigator.userAgent)
                          if (!esMobile) { setToast('✅ Instructivo copiado'); setTimeout(() => setToast(''), 2000) }
                          setModalRunningTeam(false)
                        }}
                        className="btn-ghost"
                        style={{ marginTop: '16px', width: '100%', height: 38, fontSize: 13 }}
                      >
                        Copiar instructivo
                      </button>
                    </div>
                  </div>
                )}

                {isAdmin && (
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="btn-icon" onClick={() => toggleDestacada(c)} title={c.destacada ? 'Quitar destacada' : 'Marcar como destacada'} style={c.destacada ? { color: '#eab308', borderColor: 'rgba(234,179,8,0.4)' } : {}}>⭐</button>
                    <button className="btn-icon" onClick={() => handleEdit(c)} title="Editar">✏️</button>
                    <button className="btn-icon danger" onClick={() => setConfirmarEliminarCarrera(c.id)} title="Eliminar">✕</button>
                  </div>
                )}
              </div>

              {c.link && (
                <a href={c.link} target="_blank" rel="noopener noreferrer" className="race-link">
                  Inscribirme
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
                  <span style={{ fontSize: '11px', color: 'var(--text2)' }}>
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
                      fontSize: '11px', color: 'var(--text2)', fontFamily: 'inherit',
                      display: 'inline-block',
                    }}
                  >
                    {c.encuentro_lat ? '🔄 Actualizar ubicación' : '📍 Compartir punto de encuentro'}
                  </button>
                )
              })()}

              {multiDist && (
                <div className="dist-selector" style={estado === 'No voy' ? { opacity: 0.35, pointerEvents: 'none' } : {}}>
                  <span style={{ fontSize: '12px', color: estado === 'Inscripto' && !distSeleccionada ? '#f97316' : 'var(--text2)', marginRight: '0.5rem', fontWeight: estado === 'Inscripto' && !distSeleccionada ? 600 : 400 }}>
                    {estado === 'Inscripto' && !distSeleccionada ? '⚠️ ¿A qué distancia vas?' : '¿En qué distancia corrés?'}
                  </span>
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

              {(c.tipo_actividad === 'evento' || c.tipo_actividad === 'entrenamiento') ? (
                <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <button
                    className={`estado-btn ${estado === 'Inscripto' ? 'active' : ''}`}
                    style={estado === 'Inscripto' ? { borderColor: '#4ade80', color: '#4ade80', background: '#4ade8022' } : {}}
                    onClick={() => !carreraPasada && updateEstado(c.id, estado === 'Inscripto' ? 'No voy' : 'Inscripto')}
                    disabled={carreraPasada}
                  >
                    {estado === 'Inscripto' ? '✓ Voy' : 'Voy'}
                  </button>
                  {carreraPasada && <span style={{ color: 'var(--text2)', fontSize: '11px' }}>ya no se puede modificar</span>}
                </div>
              ) : (
                <div className="race-estado-section">
                  <div className="race-estado-label">
                    Mi estado: <span style={{ color: ESTADO_COLOR[estado], fontWeight: 600 }}>{estado}</span>
                    {distSeleccionada && <span style={{ color: 'var(--text2)', fontWeight: 400, fontSize: '12px' }}> · {distSeleccionada}</span>}
                    {carreraPasada && <span style={{ color: 'var(--text2)', fontWeight: 400, fontSize: '11px' }}> · ya no se puede modificar (la carrera ya pasó)</span>}
                  </div>
                  <div className="estado-buttons" style={(carreraPasada || fueTransferido) ? { opacity: 0.35, pointerEvents: 'none' } : {}}>
                    {ESTADOS.map(e => (
                      <EstadoBtnConInfo
                        key={e}
                        label={e}
                        info={ESTADO_INFO[e]}
                        activo={estado === e}
                        color={ESTADO_COLOR[e]}
                        onClick={() => updateEstado(c.id, e)}
                      />
                    ))}
                  </div>
                  {fueTransferido && !carreraPasada && (
                    <span style={{ color: 'var(--text2)', fontWeight: 400, fontSize: '11px' }}>transferiste tu lugar — no podés reinscribirte</span>
                  )}
                  {estado === 'Inscripto' && !carreraPasada && (
                    <button
                      onClick={() => setTransferenciaModal({ carreraId: c.id, carreraNombre: c.nombre, originalUserId: user.id })}
                      style={{ marginTop: '8px', background: 'none', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text2)', fontSize: '12px', padding: '5px 10px', cursor: 'pointer', fontFamily: 'inherit' }}
                    >
                      ⇄ Transferir lugar
                    </button>
                  )}
                </div>
              )}

              {/* Botón admin: notificar Flamitas */}
              {isAdmin && c.flama_points && (
                <button
                  onClick={() => notificarFlamitas(c)}
                  style={{
                    marginTop: '8px', width: '100%', padding: '7px',
                    background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.3)',
                    borderRadius: '8px', color: '#a78bfa', fontSize: '12px',
                    cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600,
                  }}
                >
                  💎 Notificar Flamitas disponibles
                </button>
              )}

              {/* Quiénes van */}
              {(() => {
                const abierto = inscriptosAbiertos[c.id]
                const inscriptos = Array.isArray(abierto) ? abierto.filter(p => p.estadoPart === 'Inscripto') : []
                const standFlama = Array.isArray(abierto) ? abierto.filter(p => p.estadoPart === 'Stand Flama') : []
                const totalInscriptos = Array.isArray(abierto) ? inscriptos.length : null
                const totalStand = Array.isArray(abierto) ? standFlama.length : null
                return (
                  <div style={{ marginTop: '10px' }}>
                    <button
                      onClick={() => toggleInscriptos(c.id)}
                      style={{
                        width: '100%', padding: '8px',
                        background: 'var(--bg3)',
                        border: '1px solid var(--border)',
                        borderRadius: abierto ? '8px 8px 0 0' : '8px',
                        color: 'var(--text2)', fontSize: '13px',
                        cursor: 'pointer', fontFamily: 'inherit',
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      }}
                    >
                      <span>
                        {totalInscriptos !== null
                          ? <>{totalInscriptos} 👟{totalStand > 0 ? <> · {totalStand} 🧉</> : ''}</>
                          : 'Ver quiénes van'}
                      </span>
                      <span style={{ fontSize: '11px' }}>{abierto ? '▲ Ocultar' : '▼'}</span>
                    </button>
                    {abierto && (
                      <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderTop: 'none', borderRadius: '0 0 8px 8px', padding: '8px 12px' }}>
                        {abierto === 'loading' ? (
                          <div style={{ fontSize: '13px', color: 'var(--text2)', textAlign: 'center', padding: '4px 0' }}>Cargando...</div>
                        ) : abierto.length === 0 ? (
                          <div style={{ fontSize: '13px', color: 'var(--text2)' }}>Nadie inscripto todavía</div>
                        ) : (() => {
                          const PAGE = 8
                          const expandido = inscriptosExpandidos[c.id]
                          const visiblesInsc = expandido ? inscriptos : inscriptos.slice(0, PAGE)
                          const visiblesStand = expandido ? standFlama : standFlama.slice(0, Math.max(0, PAGE - inscriptos.length))
                          const hayMas = abierto.length > PAGE

                          const renderFila = (p, i, esStand) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', opacity: esStand ? 0.75 : 1 }}>
                              <div style={{
                                width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                                background: esStand ? 'rgba(255,45,45,0.08)' : 'rgba(255,45,45,0.15)', overflow: 'hidden',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 10, fontWeight: 700, color: 'var(--accent)',
                              }}>
                                {p.avatar_url
                                  ? <img src={p.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                                  : p.nombre?.[0]?.toUpperCase()
                                }
                              </div>
                              <span style={{ flex: 1, color: esStand ? 'var(--text2)' : 'var(--text)' }}>{p.nombre}</span>
                              {esStand && <span style={{ fontSize: '11px' }}>🧉</span>}
                              {!esStand && isAdmin && p.id && (!c.tipo_actividad || c.tipo_actividad === 'carrera') && (
                                <button
                                  onClick={() => setTransferenciaModal({ carreraId: c.id, carreraNombre: c.nombre, originalUserId: p.id })}
                                  title="Transferir lugar"
                                  style={{ background: 'none', border: 'none', color: 'var(--text2)', fontSize: '14px', cursor: 'pointer', padding: '2px 4px', lineHeight: 1 }}
                                >⇄</button>
                              )}
                            </div>
                          )

                          return (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                              {visiblesInsc.map((p, i) => renderFila(p, i, false))}
                              {visiblesStand.length > 0 && (
                                <>
                                  <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: '4px', paddingTop: '6px', borderTop: '1px solid var(--border)' }}>
                                    Stand Flama 🧉
                                  </div>
                                  {visiblesStand.map((p, i) => renderFila(p, i, true))}
                                </>
                              )}
                              {hayMas && (
                                <button
                                  onClick={() => setInscriptosExpandidos(prev => ({ ...prev, [c.id]: !prev[c.id] }))}
                                  style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: '12px', cursor: 'pointer', textAlign: 'left', padding: '2px 0', fontFamily: 'inherit' }}
                                >
                                  {expandido ? '▲ Ver menos' : `▼ Ver todos (${abierto.length})`}
                                </button>
                              )}
                            </div>
                          )
                        })()}
                      </div>
                    )}
                  </div>
                )
              })()}

            </div>
          )
        })}
      </div>

      {/* Botón sugerir carrera — usuarios no admin */}
      {!isAdmin && (
        <div style={{ textAlign: 'center', padding: '8px 0 20px' }}>
          <button
            onClick={() => setSugerenciaModal(true)}
            style={{ background: 'none', border: 'none', color: 'var(--text2)', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'underline', textDecorationStyle: 'dotted', textUnderlineOffset: '3px' }}
          >
            ¿Falta alguna? Sugerí una carrera
          </button>
        </div>
      )}

      {sugerenciaModal && (
        <SugerenciaModal
          userId={user.id}
          onClose={() => setSugerenciaModal(false)}
        />
      )}

      {/* Modal fotos — movido a Historial */}
      {fotosModal && false && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 150, background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: '15px' }}>{fotosModal.nombre}</div>
              <div style={{ fontSize: '12px', color: 'var(--text2)' }}>{fotos.length} foto{fotos.length !== 1 ? 's' : ''}</div>
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
            <div style={{ height: '3px', background: 'var(--border)', flexShrink: 0 }}>
              <div style={{ height: '100%', width: `${progreso}%`, background: 'var(--accent)', transition: 'width 0.3s' }} />
            </div>
          )}

          {/* Grid */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '2px' }}>
            {fotosLoading ? (
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
                style={{ padding: '10px 16px', background: 'rgba(0,0,0,0.6)', color: 'var(--text2)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', backdropFilter: 'blur(8px)' }}
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

      {confirmarEliminarCarrera && (
        <ConfirmModal
          mensaje="¿Eliminar esta carrera?"
          onConfirm={() => handleDelete(confirmarEliminarCarrera)}
          onCancel={() => setConfirmarEliminarCarrera(null)}
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

      {transferenciaModal && (
        <TransferenciaModal
          carreraId={transferenciaModal.carreraId}
          carreraNombre={transferenciaModal.carreraNombre}
          originalUserId={transferenciaModal.originalUserId}
          onClose={() => setTransferenciaModal(null)}
          onConfirm={(nuevoUserId, nuevoNombre) =>
            realizarTransferencia(transferenciaModal.carreraId, transferenciaModal.originalUserId, nuevoUserId, nuevoNombre)
          }
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