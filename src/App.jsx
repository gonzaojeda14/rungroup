import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/auth'
import Login from './pages/Login'
import Carreras from './pages/Carreras'
import Participaciones from './pages/Participaciones'
import Resumen from './pages/Resumen'
import Corredores from './pages/Corredores'
import Avisos from './pages/Avisos'

function Shell() {
  const { user, loading, isAdmin, signOut, avisosNuevos } = useAuth()

  if (loading) return (
    <div className="splash">
      <FlamaLogo height={36} />
    </div>
  )

  if (!user) return <Login />

  return (
    <div className="shell">
      <header className="topbar">
        <div className="topbar-logo">
          <FlamaLogo height={28} />
        </div>
        <button className="btn-ghost" onClick={signOut}>Salir</button>
      </header>

      <main className="main-content">
        <Routes>
          <Route path="/" element={<Navigate to="/carreras" replace />} />
          <Route path="/carreras" element={<Carreras />} />
          <Route path="/participaciones" element={<Participaciones />} />
          <Route path="/resumen" element={<Resumen />} />
          <Route path="/corredores" element={<Corredores />} />
          <Route path="/avisos" element={<Avisos />} />
        </Routes>
      </main>

      <nav className="bottom-nav">
        <NavLink to="/carreras" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>
          <span>Carreras</span>
        </NavLink>
        <NavLink to="/participaciones" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="8" x2="21" y1="6" y2="6"/><line x1="8" x2="21" y1="12" y2="12"/><line x1="8" x2="21" y1="18" y2="18"/><line x1="3" x2="3.01" y1="6" y2="6"/><line x1="3" x2="3.01" y1="12" y2="12"/><line x1="3" x2="3.01" y1="18" y2="18"/></svg>
          <span>Mis carreras</span>
        </NavLink>
        <NavLink to="/resumen" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="18" x2="18" y1="20" y2="10"/><line x1="12" x2="12" y1="20" y2="4"/><line x1="6" x2="6" y1="20" y2="14"/></svg>
          <span>Resumen</span>
        </NavLink>
        <NavLink to="/avisos" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
          <div style={{ position: 'relative', display: 'inline-flex' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/>
              <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>
            </svg>
            {avisosNuevos > 0 && (
              <span style={{
                position: 'absolute', top: '-5px', right: '-8px',
                background: 'var(--accent)', color: 'white',
                borderRadius: '10px', fontSize: '9px', fontWeight: 700,
                minWidth: '16px', height: '16px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '0 4px', lineHeight: 1,
              }}>
                {avisosNuevos > 9 ? '9+' : avisosNuevos}
              </span>
            )}
          </div>
          <span>Avisos</span>
        </NavLink>
        {isAdmin && (
          <NavLink to="/corredores" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            <span>Corredores</span>
          </NavLink>
        )}
      </nav>
    </div>
  )
}

function FlamaLogo({ height = 32 }) {
  return (
    <svg height={height} viewBox="0 0 120 36" fill="none" xmlns="http://www.w3.org/2000/svg">
      <text x="0" y="24" fontFamily="Arial Black, Arial, sans-serif" fontWeight="900" fontSize="26" fill="white" letterSpacing="-0.5">FLAMA</text>
      <text x="2" y="34" fontFamily="Arial, sans-serif" fontWeight="400" fontSize="9" fill="#94a3b8" letterSpacing="3">RUN</text>
    </svg>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Shell />
      </BrowserRouter>
    </AuthProvider>
  )
}
