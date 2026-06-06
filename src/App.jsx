import { BrowserRouter, Routes, Route, NavLink, Navigate, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { AuthProvider, useAuth } from './lib/auth'
import { supabase } from './lib/supabase'
import Login from './pages/Login'
import Register from './pages/Register'
import Carreras from './pages/Carreras'
import Participaciones from './pages/Participaciones'
import Resumen from './pages/Resumen'
import Corredores from './pages/Corredores'
import MiPerfil from './pages/MiPerfil'
import Ventas from './pages/Ventas'
import Mas from './pages/Mas'
import Novedades from './pages/Novedades'
import ResetPassword from './pages/ResetPassword'

function OfertaAlert() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [oferta, setOferta] = useState(null)

  useEffect(() => {
    async function check() {
      const { data } = await supabase
        .from('ventas_inscripciones')
        .select('id, carrera:carreras(nombre)')
        .eq('ofertado_a', user.id)
        .in('estado', ['ofertada', 'contactada'])
        .maybeSingle()
      setOferta(data || null)
    }
    check()
  }, [user.id])

  if (!oferta) return null

  return (
    <div
      onClick={() => navigate('/mas')}
      style={{
        background: 'rgba(251,191,36,0.15)', borderBottom: '1px solid rgba(251,191,36,0.3)',
        padding: '10px 16px', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        fontSize: '13px', color: '#fbbf24',
      }}
    >
      <span>🔔 Hay una inscripción disponible para vos — <strong>{oferta.carrera?.nombre}</strong></span>
      <span style={{ fontSize: '11px', opacity: 0.8 }}>Ver →</span>
    </div>
  )
}

function Shell() {
  const { user, loading, isAdmin, esRealmenteAdmin, vistaCorredor, setVistaCorredor, signOut, profile } = useAuth()
  const [adminMenu, setAdminMenu] = useState(false)
  const [avisosNoLeidos, setAvisosNoLeidos] = useState(0)
  const [ventasDisponibles, setVentasDisponibles] = useState(0)
  const [modoClaro, setModoClaro] = useState(() => document.body.classList.contains('light'))

  useEffect(() => {
    const observer = new MutationObserver(() => setModoClaro(document.body.classList.contains('light')))
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!user || profile === null) return
    async function checkAvisos() {
      const ahora = new Date().toISOString()
      const leidoHasta = profile?.avisos_leido_hasta
      let query = supabase
        .from('novedades')
        .select('id', { count: 'exact', head: true })
        .or(`publicar_en.is.null,publicar_en.lte.${ahora}`)
      if (leidoHasta) query = query.gt('created_at', leidoHasta)
      const { count } = await query
      setAvisosNoLeidos(count || 0)
    }
    checkAvisos()
  }, [user, profile?.avisos_leido_hasta])

  useEffect(() => {
    if (!user) return
    async function checkVentas() {
      const { count } = await supabase
        .from('ventas_inscripciones')
        .select('id', { count: 'exact', head: true })
        .eq('estado', 'disponible')
        .neq('vendedor_id', user.id)
      setVentasDisponibles(count || 0)
    }
    checkVentas()
  }, [user])

  if (loading) return (
    <div className="splash">
      <FlamaLogo height={36} light={modoClaro} />
    </div>
  )

  if (!user) return <Login />

  return (
    <div className="shell">
      <header className="topbar">
        <div className="topbar-logo">
          <FlamaLogo height={28} light={modoClaro} />
        </div>
        <div className="topbar-social">
          <a href="https://www.instagram.com/flama.training/" target="_blank" rel="noopener noreferrer" className="social-btn" title="Instagram">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="0.5" fill="currentColor"/></svg>
          </a>
          <a href="https://wa.me/5491137764685" target="_blank" rel="noopener noreferrer" className="social-btn" title="WhatsApp">
            <svg width="18" height="18" viewBox="0 0 32 32" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
              <path d="M16 2C8.28 2 2 8.28 2 16c0 2.44.65 4.73 1.79 6.72L2 30l7.47-1.76A13.93 13.93 0 0 0 16 30c7.72 0 14-6.28 14-14S23.72 2 16 2zm0 25.5c-2.2 0-4.27-.6-6.04-1.64l-.43-.26-4.43 1.04 1.07-4.3-.28-.45A11.45 11.45 0 0 1 4.5 16C4.5 9.6 9.6 4.5 16 4.5S27.5 9.6 27.5 16 22.4 27.5 16 27.5zm6.27-8.57c-.34-.17-2.02-1-2.34-1.11-.32-.11-.55-.17-.78.17-.23.34-.9 1.11-1.1 1.34-.2.23-.4.26-.74.09-.34-.17-1.44-.53-2.74-1.69-1.01-.9-1.7-2.01-1.9-2.35-.2-.34-.02-.52.15-.69.15-.15.34-.4.51-.6.17-.2.23-.34.34-.57.11-.23.06-.43-.03-.6-.09-.17-.78-1.88-1.07-2.57-.28-.67-.57-.58-.78-.59h-.67c-.23 0-.6.09-.91.43-.32.34-1.2 1.17-1.2 2.86s1.23 3.32 1.4 3.55c.17.23 2.42 3.7 5.87 5.19.82.35 1.46.56 1.96.72.82.26 1.57.22 2.16.13.66-.1 2.02-.82 2.31-1.62.28-.8.28-1.48.2-1.62-.09-.14-.32-.23-.66-.4z"/>
            </svg>
          </a>
          <a href="https://open.spotify.com/playlist/1Q83iE2CurTGon2DYjRrIO?si=ACitIqvpS_uoakWDODSL8w&nd=1" target="_blank" rel="noopener noreferrer" className="social-btn" title="Spotify">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 13.5a8 8 0 0 1 8 0"/><path d="M6.5 10.5a11 11 0 0 1 11 0"/><path d="M9.5 16.5a5 5 0 0 1 5 0"/></svg>
          </a>
        </div>
        <button className="btn-ghost" onClick={signOut}>Salir</button>
      </header>

      {vistaCorredor && (
        <div
          onClick={() => setVistaCorredor(false)}
          style={{
            background: 'rgba(251,191,36,0.15)', borderBottom: '1px solid rgba(251,191,36,0.3)',
            padding: '8px 16px', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            fontSize: '13px', color: '#fbbf24',
          }}
        >
          <span>👁 Modo vista corredor</span>
          <span style={{ fontWeight: 600 }}>Volver a admin →</span>
        </div>
      )}

      <main className="main-content">
        <OfertaAlert />
        <Routes>
          <Route path="/" element={<Navigate to="/novedades" replace />} />
          <Route path="/carreras" element={<Carreras />} />
          <Route path="/participaciones" element={<Participaciones />} />
          <Route path="/resumen" element={<Resumen />} />
          <Route path="/corredores" element={<Corredores />} />
          <Route path="/perfil" element={<MiPerfil />} />
          <Route path="/ventas" element={<Ventas />} />
          <Route path="/mas" element={<Mas />} />
          <Route path="/novedades" element={<Novedades />} />
        </Routes>
      </main>

      {/* Admin drawer */}
      {esRealmenteAdmin && adminMenu && (
        <>
          <div onClick={() => setAdminMenu(false)} style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,0.5)' }} />
          <div style={{
            position: 'fixed', bottom: 'var(--nav-h)', left: 0, right: 0, zIndex: 70,
            background: 'var(--bg2)', borderTop: '1px solid var(--border)',
            borderRadius: '16px 16px 0 0', padding: '16px',
          }}>
            <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px' }}>Admin</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              {[
                ['/resumen', 'Resumen', <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><line x1="18" x2="18" y1="20" y2="10"/><line x1="12" x2="12" y1="20" y2="4"/><line x1="6" x2="6" y1="20" y2="14"/></svg>],
                ['/corredores', 'Corredores', <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>],
              ].map(([path, label, icon]) => (
                <NavLink key={path} to={path} onClick={() => setAdminMenu(false)}
                  className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}
                  style={{ background: 'var(--bg3)', borderRadius: '10px', padding: '12px 8px', height: 'auto', gap: '6px' }}
                >
                  {icon}<span>{label}</span>
                </NavLink>
              ))}
              <button
                onClick={() => { setVistaCorredor(true); setAdminMenu(false) }}
                className="nav-item"
                style={{ background: 'var(--bg3)', borderRadius: '10px', padding: '12px 8px', height: 'auto', gap: '6px', border: 'none', cursor: 'pointer', flexDirection: 'column' }}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                <span>Vista corredor</span>
              </button>
            </div>
          </div>
        </>
      )}

      <nav className="bottom-nav">
        <NavLink to="/novedades" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
          <div style={{ position: 'relative', display: 'inline-flex' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
            {avisosNoLeidos > 0 && (
              <span style={{
                position: 'absolute', top: -4, right: -6,
                minWidth: 16, height: 16, padding: '0 4px',
                background: '#ff2d2d', borderRadius: '999px',
                border: '1.5px solid var(--bg2)',
                fontSize: 10, fontWeight: 700, color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                lineHeight: 1,
              }}>
                {avisosNoLeidos > 99 ? '99+' : avisosNoLeidos}
              </span>
            )}
          </div>
          <span>Avisos</span>
        </NavLink>
        <NavLink to="/carreras" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>
          <span>Carreras</span>
        </NavLink>
        <NavLink to="/participaciones" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="8" x2="21" y1="6" y2="6"/><line x1="8" x2="21" y1="12" y2="12"/><line x1="8" x2="21" y1="18" y2="18"/><line x1="3" x2="3.01" y1="6" y2="6"/><line x1="3" x2="3.01" y1="12" y2="12"/><line x1="3" x2="3.01" y1="18" y2="18"/></svg>
          <span>Historial</span>
        </NavLink>
        <NavLink to="/mas" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
          <div style={{ position: 'relative', display: 'inline-flex' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>
            {ventasDisponibles > 0 && (
              <span style={{
                position: 'absolute', top: -4, right: -6,
                minWidth: 16, height: 16, padding: '0 4px',
                background: '#ff2d2d', borderRadius: '999px',
                border: '1.5px solid var(--bg2)',
                fontSize: 10, fontWeight: 700, color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                lineHeight: 1,
              }}>
                {ventasDisponibles > 99 ? '99+' : ventasDisponibles}
              </span>
            )}
          </div>
          <span>Más</span>
        </NavLink>
        <NavLink to="/perfil" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 1 0-16 0"/></svg>
          <span>Mi perfil</span>
        </NavLink>
        {isAdmin && (
          <button className="nav-item" onClick={() => setAdminMenu(v => !v)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: adminMenu ? 'var(--accent)' : 'var(--text2)' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M2 12h3M19 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12"/></svg>
            <span>Admin</span>
          </button>
        )}
      </nav>
    </div>
  )
}

function FlamaLogo({ height = 32, light = false }) {
  return (
    <img src="/logo-flama.png" alt="Flama Run" style={{ height, width: 'auto', filter: light ? 'invert(1)' : 'none' }} />
  )
}

function GuestOnly({ children }) {
  const { user, loading } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!loading && user) {
      const t = setTimeout(() => navigate('/novedades', { replace: true }), 2000)
      return () => clearTimeout(t)
    }
  }, [user, loading])

  if (loading) return null
  if (user) return (
    <div className="login-wrapper">
      <div className="login-card" style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '40px', marginBottom: '16px' }}>👟</div>
        <h1 style={{ fontSize: '20px', marginBottom: '8px' }}>Ya estás logueado</h1>
        <p style={{ color: '#94a3b8', fontSize: '14px' }}>Te llevamos a la app...</p>
      </div>
    </div>
  )
  return children
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/registro" element={<GuestOnly><Register /></GuestOnly>} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="*" element={<Shell />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
