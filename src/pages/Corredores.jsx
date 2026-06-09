import PageLoader from '../components/PageLoader'
import PerfilCorredor from '../components/PerfilCorredor'
import ConfirmModal from '../components/ConfirmModal'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'

export default function Corredores() {
  const { isAdmin } = useAuth()
  const [corredores, setCorredores] = useState([])
  const [loading, setLoading] = useState(true)
  const [newEmail, setNewEmail] = useState('')
  const [newNombre, setNewNombre] = useState('')
  const [msg, setMsg] = useState('')

  const [bugs, setBugs] = useState([])
  const [busqueda, setBusqueda] = useState('')
  const [perfilAbierto, setPerfilAbierto] = useState(null)
  const [confirmarBloquear, setConfirmarBloquear] = useState(null) // corredor a bloquear

  const [flamitasMap, setFlamitasMap] = useState({}) // { user_id: totalPuntos }

  useEffect(() => { fetchCorredores(); fetchBugs(); fetchFlamitas() }, [])

  async function fetchFlamitas() {
    const { data } = await supabase
      .from('puntos_carreras')
      .select('user_id, puntos')
      .eq('estado', 'validado')
    const map = {}
    for (const r of data || []) {
      map[r.user_id] = (map[r.user_id] || 0) + (r.puntos || 0)
    }
    setFlamitasMap(map)
  }

  async function fetchBugs() {
    const { data } = await supabase
      .from('bug_reports')
      .select('*, reporter:profiles(nombre)')
      .order('created_at', { ascending: false })
    setBugs(data || [])
  }

  async function resolverBug(id) {
    await supabase.from('bug_reports').update({ estado: 'resuelto', resuelto_at: new Date().toISOString() }).eq('id', id)
    fetchBugs()
  }

  async function eliminarBug(id) {
    await supabase.from('bug_reports').delete().eq('id', id)
    fetchBugs()
  }

  async function fetchCorredores() {
    const { data } = await supabase.from('profiles').select('*').order('nombre')
    setCorredores(data || [])
    setLoading(false)
  }

  async function handleBloquear(corredor) {
    const { error } = await supabase.from('emails_bloqueados').insert([{ email: corredor.email }])
    if (error) { setMsg('Error al bloquear: ' + error.message); return }
    setMsg(`🚫 ${corredor.email} bloqueado`)
    setConfirmarBloquear(null)
  }

  async function handleToggleAcceso(corredor) {
    const bloqueando = corredor.activo !== false
    const { error } = await supabase.from('profiles').update({ activo: !bloqueando }).eq('id', corredor.id)
    if (error) { setMsg('Error: ' + error.message); return }
    setMsg(bloqueando ? `🚫 ${corredor.nombre} bloqueado — no podrá ingresar` : `✅ ${corredor.nombre} desbloqueado`)
    fetchCorredores()
  }

  function generarLink(e) {
    e.preventDefault()
    const base = window.location.origin
    const params = new URLSearchParams({
      code: import.meta.env.VITE_INVITE_CODE || '',
      nombre: newNombre,
      email: newEmail,
    })
    const link = `${base}/registro?${params.toString()}`
    navigator.clipboard.writeText(link)
    const esMobile = /Android|iPhone|iPad/i.test(navigator.userAgent)
    if (!esMobile) { setMsg('📋 Link copiado — pegalo en WhatsApp'); setTimeout(() => setMsg(''), 3000) }
    setNewEmail('')
    setNewNombre('')
  }

  if (!isAdmin) {
    return (
      <div className="page">
        <div className="page-header"><h2>Corredores</h2></div>
        <div className="empty-state">Solo el administrador puede ver esta sección</div>
      </div>
    )
  }

  if (loading) return <PageLoader />

  return (
    <div className="page">
      <div className="page-header">
        <h2>Corredores ({corredores.length})</h2>
      </div>

      <form className="card form-card" onSubmit={generarLink}>
        <h3 style={{ marginBottom: '0.75rem', fontSize: '14px', fontWeight: 600 }}>Invitar corredor/a</h3>
        <div className="form-grid">
          <div className="field">
            <label>Nombre completo</label>
            <input value={newNombre} onChange={e => setNewNombre(e.target.value)} placeholder="Ana García" required />
          </div>
          <div className="field">
            <label>Email</label>
            <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="ana@email.com" required />
          </div>
        </div>
        {msg && <p className="success-msg">{msg}</p>}
        <div className="form-actions">
          <button type="submit" className="btn-primary">
            Generar link
          </button>
        </div>
      </form>

      <div style={{ marginBottom: '12px', position: 'relative' }}>
        <input
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          placeholder="Buscar por nombre..."
          style={{
            width: '100%', background: 'var(--bg2)', border: '1px solid var(--border)',
            borderRadius: '10px', color: 'var(--text)', padding: '10px 36px 10px 12px',
            fontSize: '14px', fontFamily: 'inherit',
          }}
        />
        {busqueda && (
          <button onClick={() => setBusqueda('')} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text2)', cursor: 'pointer', fontSize: '16px', lineHeight: 1 }}>✕</button>
        )}
      </div>

      <div className="cards-list">
        {corredores.filter(c => {
            if (!busqueda) return true
            const palabras = busqueda.toLowerCase().split(/\s+/).filter(Boolean)
            const nombre = c.nombre?.toLowerCase() || ''
            return palabras.every(p => nombre.includes(p))
          }).map(c => (
          <div key={c.id} className="card runner-card" style={{ cursor: c.role !== 'admin' ? 'pointer' : 'default', WebkitTapHighlightColor: 'transparent' }} onClick={() => c.role !== 'admin' && setPerfilAbierto(c)}>
            <div className="runner-avatar" style={{ overflow: 'hidden', padding: 0 }}>
              {c.avatar_url
                ? <img src={c.avatar_url} alt={c.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                : <span style={{ fontSize: 14, fontWeight: 600 }}>{(c.nombre || '?')[0].toUpperCase()}</span>
              }
            </div>
            <div style={{ flex: 1 }}>
              <div className="runner-name">{c.nombre}</div>
              <div className="runner-email">{c.email}</div>
            </div>
            {c.role === 'admin' && <span className="badge green">Admin</span>}
            {c.role !== 'admin' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {(() => {
                  const total = (flamitasMap[c.id] || 0) + (c.bonus_perfil_otorgado ? 5 : 0)
                  return total > 0 ? (
                    <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text2)', whiteSpace: 'nowrap' }}>💎 {total}</span>
                  ) : null
                })()}
                {c.lesion_actual && (
                  <span title="Tiene una lesión o molestia cargada" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, borderRadius: '50%', background: 'rgba(248,113,113,0.12)', border: '1px solid rgba(248,113,113,0.3)', flexShrink: 0 }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 8v8M8 12h8"/><rect x="4" y="4" width="16" height="16" rx="3"/></svg>
                  </span>
                )}
                {c.activo === false && <span style={{ fontSize: '11px', color: '#f87171', background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 6, padding: '2px 7px' }}>Bloqueado</span>}
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text2)', flexShrink: 0 }}><path d="M9 18l6-6-6-6"/></svg>
              </div>
            )}
          </div>
        ))}
      </div>

      {perfilAbierto && (
        <PerfilCorredor
          corredor={perfilAbierto}
          onClose={() => setPerfilAbierto(null)}
          onToggleAcceso={(id, bloqueado) => {
            setCorredores(prev => prev.map(c => c.id === id ? { ...c, activo: bloqueado ? false : true } : c))
          }}
        />
      )}

      {/* BUGS */}
      {bugs.length > 0 && (
        <div style={{ marginTop: '24px' }}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px' }}>
            🐛 Reportes de problemas
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {bugs.map(b => (
              <div key={b.id} className="card" style={{ borderLeft: b.estado === 'resuelto' ? '3px solid rgba(74,222,128,0.4)' : '3px solid rgba(251,191,36,0.4)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text2)', marginBottom: '2px' }}>{b.reporter?.nombre}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text2)' }}>{new Date(b.created_at).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</div>
                  </div>
                  <span style={{
                    fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '20px',
                    background: b.estado === 'resuelto' ? 'rgba(74,222,128,0.15)' : 'rgba(251,191,36,0.15)',
                    color: b.estado === 'resuelto' ? '#4ade80' : '#fbbf24',
                  }}>
                    {b.estado === 'resuelto' ? '✓ Resuelto' : '⏳ Pendiente'}
                  </span>
                </div>
                <div style={{ fontSize: '14px', marginBottom: b.foto_url ? '10px' : '10px' }}>{b.descripcion}</div>
                {b.foto_url && (
                  <img src={b.foto_url.replace('/upload/', '/upload/w_600,q_auto/')} alt="bug" style={{ width: '100%', borderRadius: '8px', marginBottom: '10px', cursor: 'pointer' }}
                    onClick={() => window.open(b.foto_url, '_blank')} />
                )}
                <div style={{ display: 'flex', gap: '8px' }}>
                  {b.estado === 'pendiente' && (
                    <button onClick={() => resolverBug(b.id)} className="btn-ghost" style={{ fontSize: '12px', height: 30, padding: '0 12px', color: '#4ade80', borderColor: 'rgba(74,222,128,0.3)' }}>
                      ✓ Marcar resuelto
                    </button>
                  )}
                  <button onClick={() => eliminarBug(b.id)} className="btn-icon danger" style={{ fontSize: '12px' }}>✕</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
