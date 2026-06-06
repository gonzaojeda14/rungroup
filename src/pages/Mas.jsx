import { useState, useEffect } from 'react'
import Ventas from './Ventas'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'

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
  { nombre: 'Pantro Indumentaria', categoria: 'Indumentaria', emoji: '👕', wp: wp('+5491125039851'), ig: ig('@pantrotienda'), web: 'https://www.pantrotienda.com.ar', descuento: '35% en efectivo', codigo: null, ubicacion: null },
  { nombre: 'A Nation', categoria: 'Calzado', emoji: '👟', wp: null, ig: ig('@anationoficial'), web: 'https://www.anation.com.ar', descuento: '15% en todos los productos', codigo: 'FLAMA', ubicacion: null },
  { nombre: 'Fitnesas', categoria: 'Productos deportivos', emoji: '🏋️', wp: wp('+5491168599619'), ig: ig('@fitnesas.ar'), web: 'https://www.fitnesas.com.ar', descuento: '10% en local y web', codigo: 'FLAMA2025', ubicacion: null },
  { nombre: 'Olmos Ortopedia', categoria: 'Plantillas deportivas', emoji: '🦶', wp: wp('+5491126280043'), ig: ig('@ortopediaolmos'), web: null, descuento: '15% a 25% en plantillas', codigo: null, ubicacion: null },
  // Gastronomía
  { nombre: 'La Panera Rosa', categoria: 'Gastronomía', emoji: '🥐', wp: null, ig: null, web: null, descuento: '20% en todo el menú', codigo: null, ubicacion: 'Arenales 511, Vicente López' },
  { nombre: 'La Pianca', categoria: 'Gastronomía', emoji: '🍽', wp: null, ig: null, web: null, descuento: '15% en todo el menú', codigo: null, ubicacion: 'Tapiales 1136, Vicente López' },
  // Próximamente
  { nombre: 'Brina Makeup Beauty Studio', categoria: 'Belleza', emoji: '✨', wp: null, ig: null, web: null, descuento: '10% en tratamientos', codigo: 'FLAMA', ubicacion: null },
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

const TABS = ['Alianzas', 'Inscripciones']

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
      <div className="page-header"><h2>Alianzas</h2></div>
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
                {copiado === a.nombre && <span style={{ fontSize: '11px', color: '#4ade80', fontWeight: 400 }}>✓ copiado</span>}
              </div>
            )}

            {/* Ubicación */}
            {a.ubicacion && (
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(a.ubicacion)}`}
                target="_blank" rel="noopener noreferrer"
                style={{ marginTop: '6px', display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: 'var(--text2)', textDecoration: 'none' }}
              >
                <MapIcon /> {a.ubicacion}
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────

export default function Mas() {
  const { user } = useAuth()
  const [tab, setTab] = useState('Alianzas')
  const [ventasDisponibles, setVentasDisponibles] = useState(0)

  useEffect(() => {
    if (!user) return
    supabase.from('ventas_inscripciones')
      .select('id', { count: 'exact', head: true })
      .eq('estado', 'disponible')
      .neq('vendedor_id', user.id)
      .then(({ count }) => setVentasDisponibles(count || 0))
  }, [user])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      {/* Tab bar */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: 'var(--bg)', flexShrink: 0 }}>
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
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
          </button>
        ))}
      </div>

      {/* Contenido */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {tab === 'Alianzas' && <Alianzas />}
        {tab === 'Inscripciones' && <Ventas />}
      </div>
    </div>
  )
}
