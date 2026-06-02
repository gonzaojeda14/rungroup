import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/auth'
import Login from './pages/Login'
import Carreras from './pages/Carreras'
import Participaciones from './pages/Participaciones'
import Resumen from './pages/Resumen'
import Corredores from './pages/Corredores'

function Shell() {
  const { user, loading, isAdmin, signOut } = useAuth()

  if (loading) return (
    <div className="splash">
      <svg width="40" height="40" viewBox="0 0 36 36" fill="none">
        <circle cx="18" cy="18" r="18" fill="#e8ff47"/>
        <path d="M11 22 L15 14 L18 19 L21 12 L25 22" stroke="#0f172a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
      </svg>
    </div>
  )

  if (!user) return <Login />

  return (
    <div className="shell">
      <header className="topbar">
        <div className="topbar-logo">
          <svg width="22" height="22" viewBox="0 0 36 36" fill="none">
            <circle cx="18" cy="18" r="18" fill="#e8ff47"/>
            <path d="M11 22 L15 14 L18 19 L21 12 L25 22" stroke="#0f172a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
          </svg>
          <span>RunGroup</span>
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

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Shell />
      </BrowserRouter>
    </AuthProvider>
  )
}
