import { useState, useEffect } from 'react'
import Ventas from './Ventas'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'

// ─── DATOS ───────────────────────────────────────────────────────────────────

const BENEFICIOS = [
  { empresa: 'La Panera Rosa', lugar: 'Olivos', emoji: '🥐', descuento: '20% en todo el menú', instruccion: 'Presentar la app de Flama' },
  { empresa: 'La Pianca', emoji: '🍽', descuento: '15% en todo el menú', instruccion: 'Presentar la app de Flama' },
  { empresa: 'ANation', emoji: '👟', categoria: 'Calzado / Indumentaria', descuento: '15% en todos los productos', codigo: 'FLAMA', instruccion: 'Código válido en web' },
  { empresa: 'Fitnesas', emoji: '🏋️', categoria: 'Productos deportivos', descuento: '10% en todos los productos', codigo: 'FLAMA2025', instruccion: 'Válido en local y web' },
  { empresa: 'Pantro Indumentaria', emoji: '👕', categoria: 'Indumentaria', descuento: '35% en efectivo', instruccion: 'Por ser alumno de Flama' },
  { empresa: 'NC Body Therapy', emoji: '💆', categoria: 'Masajes', descuento: '10% en masajes y reflexología' },
  { empresa: 'Olmos Ortopedia', emoji: '🦶', categoria: 'Plantillas deportivas', descuento: '15% a 25% en plantillas deportivas' },
  { empresa: 'Fuel Store Arg', emoji: '⚡', categoria: 'Suplementos', descuento: 'Descuento en suplementos deportivos', codigo: 'FLAMA', instruccion: 'Pastillas de sal, geles, proteína y más' },
  { empresa: 'Brina Makeup Beauty Studio', emoji: '✨', descuento: '10% en todos los tratamientos faciales y corporales', codigo: 'FLAMA' },
]

const PROFESIONALES = [
  { nombre: 'Eugenia Gancedo', categoria: 'Nutrición', ig: null, wp: null },
  { nombre: 'Diego Dobler', categoria: 'Kinesiología', ig: null, wp: null },
  { nombre: 'NC Body Therapy (Nico)', categoria: 'Masajes', ig: null, wp: null },
]

const MARCAS = [
  { nombre: 'Fuel Store Arg', categoria: 'Suplementos', web: null, ig: null, wp: null },
  { nombre: 'Pantro Indumentaria', categoria: 'Indumentaria', web: null, ig: null, wp: null },
  { nombre: 'A Nation', categoria: 'Calzado', web: null, ig: null, wp: null },
  { nombre: 'Fitnesas', categoria: 'Productos deportivos', web: null, ig: null, wp: null },
  { nombre: 'Olmos Ortopedia', categoria: 'Plantillas deportivas', web: null, ig: null, wp: null },
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

// ─── TABS ────────────────────────────────────────────────────────────────────

const TABS = ['Partners', 'Beneficios', 'Inscripciones']

// ─── SECCIONES ───────────────────────────────────────────────────────────────

function Beneficios() {
  return (
    <div className="page">
      <div className="page-header"><h2>Beneficios</h2></div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {BENEFICIOS.map((b, i) => (
          <div key={i} className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
              <span style={{ fontSize: '22px' }}>{b.emoji}</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: '14px' }}>{b.empresa}</div>
                {b.categoria && <div style={{ fontSize: '11px', color: 'var(--text2)' }}>{b.categoria}</div>}
              </div>
            </div>
            <div style={{ fontSize: '14px', color: '#4ade80', fontWeight: 600, marginBottom: b.instruccion || b.codigo ? '6px' : 0 }}>
              {b.descuento}
            </div>
            {b.instruccion && <div style={{ fontSize: '12px', color: 'var(--text2)' }}>{b.instruccion}</div>}
            {b.codigo && (
              <div style={{ marginTop: '8px', display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(255,45,45,0.1)', border: '1px solid rgba(255,45,45,0.2)', borderRadius: '8px', padding: '4px 10px', fontSize: '13px', fontWeight: 700, color: 'var(--accent)', cursor: 'pointer' }}
                onClick={() => {
                  navigator.clipboard.writeText(b.codigo)
                  // El toast nativo de móvil es suficiente
                }}>
                🎟 {b.codigo}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function Partners() {
  return (
    <div className="page">
      <div className="page-header"><h2>Partners</h2></div>

      <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' }}>
        Profesionales
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px' }}>
        {PROFESIONALES.map((p, i) => (
          <div key={i} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: '14px' }}>{p.nombre}</div>
              <div style={{ fontSize: '12px', color: 'var(--text2)' }}>{p.categoria}</div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              {p.ig && <a href={p.ig} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text2)', display: 'flex' }}><IgIcon /></a>}
              {p.wp && <a href={`https://wa.me/${p.wp}`} target="_blank" rel="noopener noreferrer" style={{ color: '#4ade80', display: 'flex' }}><WpIcon /></a>}
            </div>
          </div>
        ))}
      </div>

      <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' }}>
        Marcas
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {MARCAS.map((m, i) => (
          <div key={i} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: '14px' }}>{m.nombre}</div>
              <div style={{ fontSize: '12px', color: 'var(--text2)' }}>{m.categoria}</div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              {m.web && <a href={m.web} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text2)', display: 'flex' }}><WebIcon /></a>}
              {m.ig && <a href={m.ig} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text2)', display: 'flex' }}><IgIcon /></a>}
              {m.wp && <a href={`https://wa.me/${m.wp}`} target="_blank" rel="noopener noreferrer" style={{ color: '#4ade80', display: 'flex' }}><WpIcon /></a>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── COMPONENTE PRINCIPAL ────────────────────────────────────────────────────

export default function Mas() {
  const { user } = useAuth()
  const [tab, setTab] = useState('Partners')
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
        {tab === 'Inscripciones' && <Ventas />}
        {tab === 'Beneficios' && <Beneficios />}
        {tab === 'Partners' && <Partners />}
      </div>
    </div>
  )
}
