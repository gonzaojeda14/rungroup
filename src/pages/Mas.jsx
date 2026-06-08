import { useEffect, useState, useRef } from 'react'
import Ventas from './Ventas'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { yaEmpezo, enVentanaPreAprobacion, dentroDePlazo } from '../lib/utils'

const PLAZO_RECLAMO_DIAS = 7

const CLOUD = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME
const PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET
const PUNTOS_POR_CARRERA = 10

// ─── HELPERS ─────────────────────────────────────────────────────────────────

const WP_MSG = encodeURIComponent('Hola! Te escribo de parte de Flama Training')
const wp = (num) => `https://wa.me/${num.replace(/\D/g, '')}?text=${WP_MSG}`
const ig = (user) => `https://instagram.com/${user.replace('@', '')}`

// ─── DATOS ───────────────────────────────────────────────────────────────────

const ALIANZAS = [
  // Profesionales
  { nombre: 'Eugenia Gancedo', categoria: 'Nutrición', emoji: '🥗', wp: wp('+5491164860148'), ig: ig('@eg.nutriciondeportiva'), web: null, descuento: null, codigo: null, ubicacion: null },
  { nombre: 'Diego Dobler', categoria: 'Kinesiología', emoji: '🦴', wp: wp('+5491163081610'), ig: null, web: null, descuento: null, codigo: null, ubicacion: null },
  { nombre: 'NC Body Therapy', categoria: 'Masajes', emoji: '💆', wp: wp('+5491166874129'), ig: ig('@nc.bodytherapy'), web: null, descuento: '10% en masajes y reflexología', codigo: null, ubicacion: null },
  // Marcas
  { nombre: 'Fuel Store Arg', categoria: 'Suplementos', emoji: '⚡', wp: wp('+5491126816998'), ig: ig('@fuelstorearg'), web: 'https://www.fuelstorearg.com', descuento: 'Descuento en suplementos', codigo: 'FLAMA', ubicacion: null },
  { nombre: 'Pantro Indumentaria', categoria: 'Indumentaria', emoji: '👕', wp: wp('+5491125039851'), ig: ig('@pantrotienda'), web: 'https://www.pantrotienda.com.ar', descuento: '35% en efectivo', codigo: null, ubicacion: 'Iberá 3168, Núñez' },
  { nombre: 'A Nation', categoria: 'Calzado', emoji: '👟', wp: null, ig: ig('@anationoficial'), web: 'https://www.anation.com.ar', descuento: '15% en todos los productos', codigo: 'FLAMA', ubicacion: null },
  { nombre: 'Fitnesas', categoria: 'Productos deportivos', emoji: '🏋️', wp: wp('+5491168599619'), ig: ig('@fitnesas.ar'), web: 'https://www.fitnesas.com.ar', descuento: '10% en local y web', codigo: 'FLAMA2025', ubicacion: ['Bulnes 2026, Palermo', 'Guillermo White 4335, Munro'] },
  { nombre: 'Olmos Ortopedia', categoria: 'Plantillas deportivas', emoji: '🦶', wp: wp('+5491126280043'), ig: ig('@ortopediaolmos'), web: null, descuento: '15% a 25% en plantillas', codigo: null, ubicacion: null },
  // Gastronomía
  { nombre: 'La Panera Rosa', categoria: 'Gastronomía', emoji: '🥐', wp: null, ig: null, web: null, descuento: '20% en todo el menú', codigo: null, ubicacion: 'Arenales 511, Vicente López' },
  { nombre: 'La Pianca', categoria: 'Gastronomía', emoji: '🍽', wp: null, ig: null, web: null, descuento: '15% en todo el menú', codigo: null, ubicacion: 'Tapiales 1136, Vicente López' },
  // Próximamente
  { nombre: 'Brina Makeup Beauty Studio', categoria: 'Belleza', emoji: '✨', wp: wp('+5491168552470'), ig: ig('@brinamakeup'), web: null, descuento: '10% en tratamientos faciales y corporales', codigo: 'FLAMA', ubicacion: 'Gral. Juan Lavalle 1800, Vicente López' },
]

// ─── ICONOS ──────────────────────────────────────────────────────────────────

const IgIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="0.5" fill="currentColor"/>
  </svg>
)

const WpIcon = () => (
  <svg width="16" height="16" viewBox="0 0 32 32" fill="currentColor">
    <path d="M16 2C8.28 2 2 8.28 2 16c0 2.44.65 4.73 1.79 6.72L2 30l7.47-1.76A13.93 13.93 0 0 0 16 30c7.72 0 14-6.28 14-14S23.72 2 16 2zm0 25.5c-2.2 0-4.27-.6-6.04-1.64l-.43-.26-4.43 1.04 1.07-4.3-.28-.45A11.45 11.45 0 0 1 4.5 16C4.5 9.6 9.6 4.5 16 4.5S27.5 9.6 27.5 16 22.4 27.5 16 27.5zm6.27-8.57c-.34-.17-2.02-1-2.34-1.11-.32-.11-.55-.17-.78.17-.23.34-.9 1.11-1.1 1.34-.2.23-.4.26-.74.09-.34-.17-1.44-.53-2.74-1.69-1.01-.9-1.7-2.01-1.9-2.35-.2-.34-.02-.52.15-.69.15-.15.34-.4.51-.6.17-.2.23-.34.34-.57.11-.23.06-.43-.03-.6-.09-.17-.78-1.88-1.07-2.57-.28-.67-.57-.58-.78-.59h-.67c-.23 0-.6.09-.91.43-.32.34-1.2 1.17-1.2 2.86s1.23 3.32 1.4 3.55c.17.23 2.42 3.7 5.87 5.19.82.35 1.46.56 1.96.72.82.26 1.57.22 2.16.13.66-.1 2.02-.82 2.31-1.62.28-.8.28-1.48.2-1.62-.09-.14-.32-.23-.66-.4z"/>
  </svg>
)

const WebIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
  </svg>
)

const MapIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
  </svg>
)

// ─── TABS ─────────────────────────────────────────────────────────────────────

const TABS = ['Alianzas', 'Flama Points', 'Inscripciones']

const ESTADO_INFO = {
  pendiente: { label: 'En revisión', color: '#fbbf24', bg: 'rgba(251,191,36,0.12)', icon: '⏳' },
  validado: { label: 'Validado', color: '#4ade80', bg: 'rgba(74,222,128,0.12)', icon: '✓' },
  rechazado: { label: 'Rechazado', color: '#f87171', bg: 'rgba(248,113,113,0.12)', icon: '✕' },
  revision_admin: { label: 'Revisión final del profe', color: '#fbbf24', bg: 'rgba(251,191,36,0.12)', icon: '👀' },
}

// ─── SECCIÓN ALIANZAS ─────────────────────────────────────────────────────────

function Alianzas() {
  const [copiado, setCopiado] = useState(null)

  function copiarCodigo(codigo, nombre) {
    navigator.clipboard.writeText(codigo)
    const esMobile = /Android|iPhone|iPad/i.test(navigator.userAgent)
    if (!esMobile) {
      setCopiado(nombre)
      setTimeout(() => setCopiado(null), 2000)
    }
  }

  return (
    <div className="page">
      <div className="page-header" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '2px' }}>
        <h2>Alianzas</h2>
        <span style={{ fontSize: '12px', color: 'var(--text2)', fontWeight: 400 }}>Profesionales y beneficios</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {ALIANZAS.map((a, i) => (
          <div key={i} className="card">
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '22px' }}>{a.emoji}</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '14px' }}>{a.nombre}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text2)' }}>{a.categoria}</div>
                </div>
              </div>
              {/* Links */}
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                {a.wp && (
                  <a href={a.wp} target="_blank" rel="noopener noreferrer" style={{ color: '#4ade80', display: 'flex' }}>
                    <WpIcon />
                  </a>
                )}
                {a.ig && (
                  <a href={a.ig} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text2)', display: 'flex' }}>
                    <IgIcon />
                  </a>
                )}
                {a.web && (
                  <a href={a.web} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text2)', display: 'flex' }}>
                    <WebIcon />
                  </a>
                )}
              </div>
            </div>

            {/* Descuento */}
            {a.descuento && (
              <div style={{ marginTop: '8px', fontSize: '13px', color: '#4ade80', fontWeight: 600 }}>
                {a.descuento}
              </div>
            )}

            {/* Cupón */}
            {a.codigo && (
              <div
                style={{ marginTop: '6px', display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(255,45,45,0.1)', border: '1px solid rgba(255,45,45,0.2)', borderRadius: '8px', padding: '4px 10px', fontSize: '13px', fontWeight: 700, color: 'var(--accent)', cursor: 'pointer' }}
                onClick={() => copiarCodigo(a.codigo, a.nombre)}
              >
                🎟 {a.codigo}
                {copiado === a.nombre
                  ? <span style={{ fontSize: '11px', color: '#4ade80', fontWeight: 400 }}>✓</span>
                  : <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.7 }}><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                }
              </div>
            )}

            {/* Ubicación */}
            {a.ubicacion && (
              <div style={{ marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                {(Array.isArray(a.ubicacion) ? a.ubicacion : [a.ubicacion]).map((u, j) => (
                  <a key={j}
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(u)}`}
                    target="_blank" rel="noopener noreferrer"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: 'var(--text2)', textDecoration: 'none' }}
                  >
                    <MapIcon /> {u}
                  </a>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── CARRERA ACTUAL (pre-marcado de asistencia) ─────────────────────────────
// El profe puede marcar acá a quienes ve llegar a entrenar/correr ANTES de que
// suban su foto. Si ya están marcados como "llegó" cuando piden los Flama
// Points, se aprueban directo (sin pasar por el análisis de la IA) — ver la
// rama de "pre-aprobación" en validar-dorsal.ts.
// La sección solo se muestra dentro de la ventana habilitada: desde 3hs antes
// del inicio (para ir marcando a los que llegan) y durante el resto del día.
function CarreraActual() {
  const [carrera, setCarrera] = useState(null)
  const [inscriptos, setInscriptos] = useState([])
  const [loading, setLoading] = useState(true)
  const [marcando, setMarcando] = useState({})

  useEffect(() => {
    fetchCarreraActual()
    const channel = supabase.channel('carrera-actual-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'participaciones' }, fetchCarreraActual)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [])

  async function fetchCarreraActual() {
    const ahora = new Date()
    const desde = new Date(ahora); desde.setDate(desde.getDate() - 1)
    const hasta = new Date(ahora); hasta.setDate(hasta.getDate() + 2)
    const fmt = d => d.toISOString().split('T')[0]

    const { data: candidatas } = await supabase
      .from('carreras')
      .select('id, nombre, fecha, hora, flama_points')
      .eq('flama_points', true)
      .gte('fecha', fmt(desde))
      .lte('fecha', fmt(hasta))
      .order('fecha', { ascending: true })

    const actual = (candidatas || []).find(c => enVentanaPreAprobacion(c.fecha, c.hora))
    if (!actual) { setCarrera(null); setInscriptos([]); setLoading(false); return }

    setCarrera(actual)
    // OJO: se evita el join embebido `corredor:profiles!user_id(...)` porque
    // PostgREST no reconoce esa relación para `participaciones` (sí funciona
    // para `puntos_carreras`, que es otra tabla) — la consulta entera fallaba
    // en silencio y devolvía vacío. Se trae todo por separado, igual que en
    // "Ver quiénes van" de Carreras.jsx, que funciona sin problemas.
    const { data: parts } = await supabase
      .from('participaciones')
      .select('user_id, asistencia_confirmada')
      .eq('carrera_id', actual.id)
      .eq('estado', 'Inscripto')
    const userIds = (parts || []).map(p => p.user_id)
    let perfilMap = {}
    let aprobadosSet = new Set()
    if (userIds.length > 0) {
      const { data: perfiles } = await supabase.from('profiles').select('id, nombre').in('id', userIds)
      perfilMap = Object.fromEntries((perfiles || []).map(p => [p.id, p]))

      // Si ya se le aprobaron los puntos para esta carrera, se bloquea el
      // marcado de asistencia — de lo contrario el admin podría desmarcar
      // "Llegó" después de haber pagado el premio, lo cual no tiene sentido
      // (y podría confundir o generar reclamos).
      const { data: puntosAprobados } = await supabase
        .from('puntos_carreras')
        .select('user_id')
        .eq('carrera_id', actual.id)
        .eq('estado', 'validado')
        .in('user_id', userIds)
      aprobadosSet = new Set((puntosAprobados || []).map(p => p.user_id))
    }
    const ordenados = (parts || [])
      .map(p => ({ ...p, corredor: perfilMap[p.user_id] || null, aprobado: aprobadosSet.has(p.user_id) }))
      .sort((a, b) => (a.corredor?.nombre || '').localeCompare(b.corredor?.nombre || '', 'es'))
    setInscriptos(ordenados)
    setLoading(false)
  }

  async function toggleAsistencia(userId, valorActual) {
    setMarcando(prev => ({ ...prev, [userId]: true }))
    await supabase.from('participaciones')
      .update({ asistencia_confirmada: !valorActual })
      .eq('carrera_id', carrera.id)
      .eq('user_id', userId)
    setMarcando(prev => { const n = { ...prev }; delete n[userId]; return n })
  }

  if (loading || !carrera) return null

  return (
    <div className="card" style={{ marginBottom: '14px' }}>
      <div style={{ fontSize: '12px', fontWeight: 700, color: '#4ade80', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>
        🏁 Carrera actual — {carrera.nombre}
      </div>
      <div style={{ fontSize: '12px', color: 'var(--text2)', marginBottom: '10px', lineHeight: 1.4 }}>
        Marcá a quienes ya viste llegar. Cuando suban su foto pidiendo los puntos, se les va a
        aprobar directo — sin pasar por el análisis de la IA.
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {inscriptos.map(it => (
          <div key={it.user_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', padding: '8px 10px', background: 'var(--bg3)', borderRadius: '8px' }}>
            <span style={{ fontSize: '13px', textDecoration: it.aprobado ? 'line-through' : 'none', color: it.aprobado ? 'var(--text2)' : 'inherit' }}>
              {it.corredor?.nombre || '—'}
            </span>
            {it.aprobado ? (
              <span style={{ fontSize: '11px', fontWeight: 600, color: '#4ade80', background: 'rgba(74,222,128,0.12)', border: '1px solid rgba(74,222,128,0.3)', borderRadius: '6px', padding: '4px 10px', flexShrink: 0, whiteSpace: 'nowrap' }}>
                🏅 Premio reclamado y aprobado
              </span>
            ) : (
              <button
                disabled={marcando[it.user_id]}
                onClick={() => toggleAsistencia(it.user_id, it.asistencia_confirmada)}
                className={it.asistencia_confirmada ? 'btn-accent' : 'btn-ghost'}
                style={{ fontSize: '12px', height: 28, padding: '0 12px', flexShrink: 0 }}
              >
                {it.asistencia_confirmada ? '✓ Llegó' : 'Marcar que llegó'}
              </button>
            )}
          </div>
        ))}
        {inscriptos.length === 0 && <div style={{ fontSize: '12px', color: 'var(--text2)' }}>Todavía no hay inscriptos para esta carrera.</div>}
      </div>
    </div>
  )
}

// ─── REVISIÓN ADMIN ──────────────────────────────────────────────────────────
// La IA resuelve la gran mayoría sola (validado / rechazado en el intento 1).
// Acá solo llegan los casos que necesitan ojo humano:
//   • "revision_admin" → la IA no pudo confirmar la foto (dorsal + medalla) en NINGUNO de los 2
//     intentos. Se ven ambas fotos lado a lado y el admin da el veredicto final
//     (no hay más reintentos posibles para el corredor).
//   • "pendiente" colgado → quedó sin resolver (p. ej. la función falló). Sirve
//     como red de seguridad para que nada quede en el limbo.

// Tiempo de gracia antes de considerar que una solicitud "pendiente" puede
// estar trabada. Cubre el peor caso normal: el flujo con preaprobación tiene
// una demora artificial de ~60s, y el análisis por IA suele resolver en
// segundos — pasados ~2 minutos sin resolverse, recién ahí vale la pena
// alertar al admin de que algo puede haberse trabado.
const UMBRAL_TRABADO_MS = 2 * 60 * 1000

function RevisionAdmin() {
  const { user } = useAuth()
  const [items, setItems] = useState([])
  const [procesando, setProcesando] = useState({})
  const [verTrabados, setVerTrabados] = useState(false)
  const [ahora, setAhora] = useState(() => Date.now())

  useEffect(() => {
    fetchPendientes()
    const channel = supabase.channel('puntos-carreras-admin-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'puntos_carreras' }, fetchPendientes)
      .subscribe()
    // Recalcula cada 15s cuáles "pendiente" ya pasaron el umbral — sin esto,
    // una solicitud trabada no aparecería hasta el próximo cambio en la tabla.
    const intervalo = setInterval(() => setAhora(Date.now()), 15_000)
    return () => { supabase.removeChannel(channel); clearInterval(intervalo) }
  }, [])

  async function fetchPendientes() {
    const { data, error } = await supabase.from('puntos_carreras')
      .select('*, corredor:profiles!user_id(nombre), carrera:carreras(nombre)')
      .in('estado', ['pendiente', 'revision_admin'])
      .order('created_at', { ascending: true })
    if (error) console.error('RevisionAdmin — error al traer solicitudes:', error)
    setItems(data || [])
  }

  async function resolver(id, estado) {
    setProcesando(prev => ({ ...prev, [id]: true }))
    await supabase.from('puntos_carreras').update({
      estado,
      revisado_at: new Date().toISOString(),
      revisado_por: user.id,
    }).eq('id', id)
    setProcesando(prev => { const n = { ...prev }; delete n[id]; return n })
  }

  // Las "revision_admin" siempre necesitan tu veredicto — se muestran ya.
  // Las "pendiente" están en proceso normal (IA o preaprobación con demora);
  // solo se consideran "posiblemente trabadas" — y se muestran — si ya
  // pasaron el umbral de gracia.
  const escalados = items.filter(it => it.estado === 'revision_admin')
  const trabados = items.filter(it => {
    if (it.estado !== 'pendiente') return false
    const creado = it.created_at ? new Date(it.created_at).getTime() : 0
    return ahora - creado > UMBRAL_TRABADO_MS
  })

  if (escalados.length === 0 && trabados.length === 0) return null

  const Foto = ({ url, label }) => (
    <div style={{ flex: 1, minWidth: 0 }}>
      <img src={url.replace('/upload/', '/upload/w_300,q_auto/')} alt=""
        style={{ width: '100%', aspectRatio: '1', borderRadius: '10px', objectFit: 'cover', cursor: 'pointer' }}
        onClick={() => window.open(url, '_blank')} />
      {label && <div style={{ fontSize: '10px', color: 'var(--text2)', marginTop: '4px', textAlign: 'center' }}>{label}</div>}
    </div>
  )

  const Item = ({ it, escalado }) => (
    <div className="card">
      <div style={{ fontSize: '11px', fontWeight: 700, color: escalado ? '#fbbf24' : 'var(--text2)', marginBottom: '8px' }}>
        {escalado
          ? '⚠️ La IA no pudo confirmar la foto en sus 2 intentos — necesita tu veredicto final'
          : '⏳ Lleva más de 2 minutos sin resolverse — puede haberse trabado'}
      </div>
      <div style={{ display: 'flex', gap: '12px' }}>
        {escalado ? (
          <>
            <Foto url={it.foto_url_anterior} label="Intento 1" />
            <Foto url={it.foto_url} label="Intento 2" />
          </>
        ) : (
          <Foto url={it.foto_url} />
        )}
      </div>
      <div style={{ marginTop: '10px', fontSize: '13px' }}>
        <div style={{ fontWeight: 700 }}>{it.corredor?.nombre}</div>
        <div style={{ color: 'var(--text2)', fontSize: '12px' }}>{it.carrera?.nombre}</div>
        {it.motivo && <div style={{ fontSize: '11px', color: '#fbbf24', marginTop: '4px' }}>{it.motivo}</div>}
      </div>
      <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
        <button className="btn-ghost" disabled={procesando[it.id]} onClick={() => resolver(it.id, 'validado')}
          style={{ fontSize: '12px', height: 32, flex: 1, color: '#4ade80', borderColor: 'rgba(74,222,128,0.3)' }}>
          ✓ Aprobar (+{it.puntos})
        </button>
        <button className="btn-ghost" disabled={procesando[it.id]} onClick={() => resolver(it.id, 'rechazado')}
          style={{ fontSize: '12px', height: 32, flex: 1, color: '#f87171', borderColor: 'rgba(248,113,113,0.3)' }}>
          ✕ Rechazar
        </button>
      </div>
    </div>
  )

  return (
    <div style={{ marginBottom: '18px' }}>
      <div style={{ fontSize: '12px', fontWeight: 700, color: '#fbbf24', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' }}>
        ⏳ Solicitudes de Flama Points por revisar ({escalados.length + trabados.length})
      </div>

      {escalados.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: trabados.length > 0 ? '10px' : 0 }}>
          {escalados.map(it => <Item key={it.id} it={it} escalado />)}
        </div>
      )}

      {trabados.length > 0 && (
        <div>
          <button className="btn-ghost" onClick={() => setVerTrabados(v => !v)}
            style={{ fontSize: '12px', height: 36, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 14px', color: 'var(--text2)' }}>
            <span>⏳ Posiblemente trabadas ({trabados.length})</span>
            <span>{verTrabados ? '▲ ocultar' : '▼ ver'}</span>
          </button>
          {verTrabados && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' }}>
              {trabados.map(it => <Item key={it.id} it={it} escalado={false} />)}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── SECCIÓN FLAMA POINTS ─────────────────────────────────────────────────────

function FlamaPoints() {
  const { user, isAdmin } = useAuth()
  const [loading, setLoading] = useState(true)
  const [pendientes, setPendientes] = useState([])  // carreras completadas, sin ningún envío todavía
  const [envios, setEnvios] = useState([])          // envíos ya hechos (cualquier estado)
  // accion: { tipo: 'nuevo', carrera } | { tipo: 'reintento', envio } | null
  const [accion, setAccion] = useState(null)
  const [archivo, setArchivo] = useState(null)
  const [fotoPreview, setFotoPreview] = useState(null)
  const [subiendo, setSubiendo] = useState(false)
  const [toast, setToast] = useState('')
  const inputRef = useRef(null)

  useEffect(() => {
    fetchTodo()
    const channel = supabase.channel('puntos-carreras-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'puntos_carreras', filter: `user_id=eq.${user.id}` }, fetchTodo)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [])

  async function fetchTodo() {
    const [{ data: parts }, { data: env }] = await Promise.all([
      supabase.from('participaciones')
        .select('carrera_id, carrera:carreras(id, nombre, fecha, hora, distancia, tipo, flama_points)')
        .eq('user_id', user.id)
        .eq('estado', 'Inscripto'),
      supabase.from('puntos_carreras')
        .select('*, carrera:carreras(id, nombre, fecha)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),
    ])

    const enviadasIds = new Set((env || []).map(e => e.carrera_id))
    // Habilitada para pedir Flama Points desde el horario de INICIO de la carrera
    // (no recién al día siguiente) y solo dentro del plazo de reclamo.
    const elegibles = (parts || [])
      .filter(p => p.carrera && p.carrera.flama_points
        && yaEmpezo(p.carrera.fecha, p.carrera.hora)
        && dentroDePlazo(p.carrera.fecha, PLAZO_RECLAMO_DIAS)
        && !enviadasIds.has(p.carrera_id))
      .map(p => ({ ...p.carrera }))
      .sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''))

    setPendientes(elegibles)
    setEnvios(env || [])
    setLoading(false)
  }

  // Genera (y limpia) una vista previa local de la foto elegida — así el corredor
  // puede confirmar que subió la imagen correcta antes de enviar (no se puede cancelar después)
  useEffect(() => {
    if (!archivo) { setFotoPreview(null); return }
    const url = URL.createObjectURL(archivo)
    setFotoPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [archivo])

  function iniciarNuevo(carrera) {
    setAccion({ tipo: 'nuevo', carrera })
    setArchivo(null)
  }

  function iniciarReintento(envio) {
    setAccion({ tipo: 'reintento', envio })
    setArchivo(null)
  }

  // Mensaje flotante de 3 segundos (validaciones, confirmaciones, errores)
  function avisar(mensaje) {
    setToast(mensaje)
    setTimeout(() => setToast(''), 3000)
  }

  // Sube la foto a Cloudinary, crea o actualiza la fila en `puntos_carreras`
  // (1 sola por corredor/carrera) y dispara la validación. No hay forma de
  // cancelar una vez enviada.
  async function enviar() {
    if (!accion) return
    if (!archivo) {
      avisar('⚠️ Te falta cargar la foto')
      return
    }
    setSubiendo(true)

    const esReintento = accion.tipo === 'reintento'
    const carrera = esReintento ? accion.envio.carrera : accion.carrera
    const carreraId = esReintento ? accion.envio.carrera_id : accion.carrera.id
    const folder = `flamarun/puntos/${carrera?.nombre?.replace(/\s+/g, '_') || carreraId}`

    const fd = new FormData()
    fd.append('file', archivo)
    fd.append('upload_preset', PRESET)
    fd.append('folder', folder)

    try {
      const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD}/image/upload`, { method: 'POST', body: fd })
      const data = await res.json()
      if (!data.secure_url) throw new Error('No se pudo subir la imagen')

      let envioId
      if (esReintento) {
        const previo = accion.envio
        const { error } = await supabase.from('puntos_carreras').update({
          intentos: 2,
          estado: 'pendiente',
          motivo: null,
          foto_url_anterior: previo.foto_url,
          foto_public_id_anterior: previo.foto_public_id,
          foto_url: data.secure_url,
          foto_public_id: data.public_id,
        }).eq('id', previo.id)
        if (error) throw error
        envioId = previo.id
      } else {
        const { data: inserted, error } = await supabase.from('puntos_carreras').insert({
          user_id: user.id,
          carrera_id: carreraId,
          puntos: PUNTOS_POR_CARRERA,
          intentos: 1,
          foto_url: data.secure_url,
          foto_public_id: data.public_id,
          estado: 'pendiente',
        }).select('id').single()
        if (error) throw error
        envioId = inserted.id
      }

      // Dispara la validación — 1 sola llamada por intento, nunca más
      // (la propia función es idempotente: si el envío ya no está "pendiente", no hace nada)
      supabase.functions.invoke('validar-dorsal', { body: { envio_id: envioId } }).catch(() => {})

      avisar('📸 Solicitud enviada — la estamos revisando')
      setAccion(null)
      setArchivo(null)
      fetchTodo()
    } catch (e) {
      avisar('❌ Error al enviar: ' + e.message)
    }
    setSubiendo(false)
  }

  const totalPuntos = envios.filter(e => e.estado === 'validado').reduce((acc, e) => acc + (e.puntos || 0), 0)

  if (loading) return <div className="empty-state">Cargando...</div>

  // Formulario de carga (compartido entre "solicitar por primera vez" y "reintentar").
  // OJO: esto es JSX directo, NO un componente función — si fuera `const Formulario = () => (...)`,
  // cada tecleo en el input recrearía la función y React desmontaría/remontaría el <input>,
  // sacándote del campo después de cada carácter (y reseteando el selector de archivo).
  const formulario = (
    <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div>
        <label style={{ fontSize: '12px', color: 'var(--text2)', display: 'block', marginBottom: '6px' }}>
          Foto con tu dorsal y tu medalla — selfie o que te la saquen, las dos valen
        </label>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {fotoPreview && (
            <img src={fotoPreview} alt="Vista previa de la foto" style={{ width: 56, height: 56, borderRadius: '8px', objectFit: 'cover', border: '1px solid var(--border)', flexShrink: 0 }} />
          )}
          <input ref={inputRef} type="file" accept="image/*"
            onChange={e => setArchivo(e.target.files?.[0] || null)}
            style={{ fontSize: '12px', color: 'var(--text2)', minWidth: 0 }} />
        </div>
        {archivo && (
          <div style={{ fontSize: '11px', color: 'var(--text2)', marginTop: '6px' }}>✅ Foto cargada: {archivo.name}</div>
        )}
      </div>
      <button className="btn-accent" disabled={subiendo} onClick={enviar} style={{ fontSize: '13px', height: 36 }}>
        {subiendo ? 'Enviando...' : 'Enviar solicitud'}
      </button>
      <div style={{ fontSize: '11px', color: 'var(--text2)' }}>
        ⚠️ Una vez enviada no se puede cancelar — revisá que se vea bien el dorsal y la medalla antes de mandarla.
      </div>
    </div>
  )

  return (
    <div className="page">
      <div className="page-header" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '2px' }}>
        <h2>Flama Points</h2>
        <span style={{ fontSize: '12px', color: 'var(--text2)', fontWeight: 400 }}>Sumá puntos corriendo</span>
      </div>

      {isAdmin && <CarreraActual />}
      {isAdmin && <RevisionAdmin />}

      {/* Explicación */}
      <div className="card" style={{ marginBottom: '14px', fontSize: '13px', color: 'var(--text2)', lineHeight: 1.5 }}>
        <div style={{ fontWeight: 700, color: 'var(--text)', marginBottom: '4px', fontSize: '14px' }}>¿Qué es esto?</div>
        Cada vez que completás una carrera en la que estabas anotado/a como "Inscripto" (a partir de Adidas 15K en
        adelante), podés solicitar <strong style={{ color: 'var(--text)' }}>{PUNTOS_POR_CARRERA} Flama Points</strong>{' '}
        subiendo una foto (selfie o que te la saquen) donde se vean tu <strong style={{ color: 'var(--text)' }}>dorsal y tu medalla</strong>.
        Una IA revisa la foto al toque: si los confirma, los puntos se acreditan en el momento. Si no logra
        confirmarlos, tenés <strong style={{ color: 'var(--text)' }}>una segunda oportunidad</strong> para volver a
        subir la foto — y si tampoco se puede confirmar esa vez, el profe lo revisa a mano y da el veredicto final.
        <br /><br />
        ⚠️ <strong style={{ color: 'var(--text)' }}>Es obligatorio cargar la foto si querés sumar tus puntos</strong> — tenés{' '}
        <strong style={{ color: 'var(--text)' }}>hasta {PLAZO_RECLAMO_DIAS} días después de la carrera</strong> para hacerlo.
        Pasado ese plazo, ya no se puede reclamar.
      </div>

      {/* Total */}
      <div className="card" style={{ marginBottom: '14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '13px', color: 'var(--text2)' }}>Tus puntos acumulados</span>
        <span style={{ fontSize: '24px', fontWeight: 800, color: 'var(--accent)' }}>🔥 {totalPuntos}</span>
      </div>

      {/* Carreras completadas sin ningún envío todavía */}
      {pendientes.length > 0 && (
        <div style={{ marginBottom: '18px' }}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' }}>
            Carreras completadas
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {pendientes.map(c => (
              <div key={c.id} className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '14px' }}>{c.nombre}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text2)' }}>{formatFechaCorta(c.fecha)}</div>
                  </div>
                  {accion?.tipo !== 'nuevo' || accion.carrera.id !== c.id ? (
                    <button className="btn-accent" style={{ fontSize: '12px', height: 32, padding: '0 14px', flexShrink: 0 }}
                      onClick={() => iniciarNuevo(c)}>
                      🏅 Solicitar recompensa
                    </button>
                  ) : null}
                </div>
                {accion?.tipo === 'nuevo' && accion.carrera.id === c.id && formulario}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Historial de envíos (acá también vive el reintento, si corresponde) */}
      {envios.length > 0 && (
        <div>
          <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' }}>
            Mis envíos
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {envios.map(e => {
              const info = ESTADO_INFO[e.estado] || ESTADO_INFO.pendiente
              const puedeReintentar = e.estado === 'rechazado' && e.intentos === 1
              const enReintento = accion?.tipo === 'reintento' && accion.envio.id === e.id
              return (
                <div key={e.id} className="card">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <img src={e.foto_url.replace('/upload/', '/upload/w_120,h_120,c_fill,q_auto/')} alt="" style={{ width: 52, height: 52, borderRadius: '10px', objectFit: 'cover', flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.carrera?.nombre}</div>
                      {e.intentos === 2 && <div style={{ fontSize: '12px', color: 'var(--text2)' }}>2do intento</div>}
                      {e.motivo && (e.estado === 'rechazado' || e.estado === 'revision_admin') && (
                        <div style={{ fontSize: '11px', color: '#f87171', marginTop: '2px' }}>{e.motivo}</div>
                      )}
                    </div>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: '4px', flexShrink: 0,
                      fontSize: '11px', fontWeight: 700, padding: '4px 9px', borderRadius: '20px',
                      background: info.bg, color: info.color,
                    }}>
                      {info.icon} {e.estado === 'validado' ? `Aprobado +${e.puntos}` : info.label}
                    </span>
                  </div>

                  {puedeReintentar && (
                    <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--border)' }}>
                      {!enReintento ? (
                        <>
                          <div style={{ fontSize: '12px', color: 'var(--text2)', marginBottom: '8px' }}>
                            Tenés <strong style={{ color: 'var(--text)' }}>un último intento</strong> para volver a subir la foto de esta carrera.
                          </div>
                          <button className="btn-accent" style={{ fontSize: '12px', height: 32 }} onClick={() => iniciarReintento(e)}>
                            🔁 Volver a subir foto
                          </button>
                        </>
                      ) : formulario}
                    </div>
                  )}

                  {e.estado === 'revision_admin' && (
                    <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--border)', fontSize: '12px', color: 'var(--text2)' }}>
                      No se pudo confirmar la foto en ninguno de los 2 intentos — el profe va a revisar ambas fotos a mano y darte el veredicto final.
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {pendientes.length === 0 && envios.length === 0 && (
        <div className="empty-state">Todavía no completaste carreras como "Inscripto". ¡Cuando termines una, vas a poder cargar tu foto acá!</div>
      )}

      {toast && (
        <div style={{ position: 'fixed', bottom: '90px', left: '50%', transform: 'translateX(-50%)', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '10px', padding: '10px 16px', fontSize: '13px', boxShadow: '0 4px 16px rgba(0,0,0,0.3)', zIndex: 100, maxWidth: '90%', textAlign: 'center' }}>
          {toast}
        </div>
      )}
    </div>
  )
}

function formatFechaCorta(fecha) {
  if (!fecha) return ''
  const [y, m, d] = fecha.split('-')
  return `${d}/${m}/${y}`
}

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────

export default function Mas({ ventasDisponibles = 0 }) {
  const { user } = useAuth()
  // Recordamos la última pestaña elegida (en sessionStorage) para que, al
  // navegar a otra sección y volver a "Más", no se reinicie en "Alianzas".
  const [tab, setTab] = useState(() => {
    const guardada = sessionStorage.getItem('mas_tab')
    return TABS.includes(guardada) ? guardada : 'Alianzas'
  })
  // Carreras completadas a las que todavía no le mandaste la prueba de dorsal —
  // se muestra como notificación (igual que "Inscripciones") para que no se te pase.
  // OJO: se calcula acá (no dentro de FlamaPoints) y de forma independiente de la
  // pestaña activa — si dependiera de que el usuario abra "Flama Points" para
  // calcularse, la notificación tardaría en aparecer y no reflejaría la cantidad real.
  const [flamaPendientes, setFlamaPendientes] = useState(0)

  useEffect(() => {
    let activo = true
    async function calcularFlamaPendientes() {
      const [{ data: parts }, { data: env }] = await Promise.all([
        supabase.from('participaciones')
          .select('carrera_id, carrera:carreras(id, fecha, hora, flama_points)')
          .eq('user_id', user.id)
          .eq('estado', 'Inscripto'),
        supabase.from('puntos_carreras')
          .select('carrera_id')
          .eq('user_id', user.id),
      ])
      const enviadasIds = new Set((env || []).map(e => e.carrera_id))
      const cantidad = (parts || [])
        .filter(p => p.carrera && p.carrera.flama_points
          && yaEmpezo(p.carrera.fecha, p.carrera.hora)
          && dentroDePlazo(p.carrera.fecha, PLAZO_RECLAMO_DIAS)
          && !enviadasIds.has(p.carrera_id))
        .length
      if (activo) setFlamaPendientes(cantidad)
    }
    calcularFlamaPendientes()
    const channel = supabase.channel('mas-flama-badge')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'puntos_carreras', filter: `user_id=eq.${user.id}` }, calcularFlamaPendientes)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'participaciones', filter: `user_id=eq.${user.id}` }, calcularFlamaPendientes)
      .subscribe()
    return () => { activo = false; supabase.removeChannel(channel) }
  }, [user.id])

  function cambiarTab(t) {
    setTab(t)
    sessionStorage.setItem('mas_tab', t)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      {/* Tab bar */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: 'var(--bg)', flexShrink: 0 }}>
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => cambiarTab(t)}
            style={{
              flex: 1, padding: '12px 4px', border: 'none', background: 'none', cursor: 'pointer',
              fontSize: '13px', fontWeight: tab === t ? 700 : 400,
              color: tab === t ? 'var(--accent)' : 'var(--text2)',
              borderBottom: tab === t ? '2px solid var(--accent)' : '2px solid transparent',
              fontFamily: 'inherit', transition: 'all .15s',
            }}
          >
            {t}
            {t === 'Inscripciones' && ventasDisponibles > 0 && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                marginLeft: '4px', verticalAlign: 'middle',
                minWidth: 14, height: 14, padding: '0 3px',
                background: '#ff2d2d', borderRadius: '999px',
                fontSize: 9, fontWeight: 700, color: '#fff',
              }}>
                {ventasDisponibles > 9 ? '9+' : ventasDisponibles}
              </span>
            )}
            {t === 'Flama Points' && flamaPendientes > 0 && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                marginLeft: '4px', verticalAlign: 'middle',
                minWidth: 14, height: 14, padding: '0 3px',
                background: '#ff2d2d', borderRadius: '999px',
                fontSize: 9, fontWeight: 700, color: '#fff',
              }}>
                {flamaPendientes > 9 ? '9+' : flamaPendientes}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Contenido */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {tab === 'Alianzas' && <Alianzas />}
        {tab === 'Flama Points' && <FlamaPoints />}
        {tab === 'Inscripciones' && <Ventas />}
      </div>
    </div>
  )
}
