import PageLoader from '../components/PageLoader'
import PerfilCorredor from '../components/PerfilCorredor'
import ConfirmModal from '../components/ConfirmModal'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'

const DISTANCIAS_RANKING = ['5K', '10K', '15K', '21K', '42K']
const MEDALLAS = ['🥇', '🥈', '🥉']

function formatTiempo(segundos) {
  if (!segundos || segundos <= 0) return '—'
  const h = Math.floor(segundos / 3600)
  const m = Math.floor((segundos % 3600) / 60)
  const s = segundos % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function esCumpleaños(fecha_nacimiento) {
  if (!fecha_nacimiento) return false
  const hoy = new Date()
  const parts = fecha_nacimiento.split('-')
  return parseInt(parts[1]) === hoy.getMonth() + 1 && parseInt(parts[2]) === hoy.getDate()
}

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
  const [confirmarBloquear, setConfirmarBloquear] = useState(null)
  const [flamitasMap, setFlamitasMap] = useState({})
  const [tab, setTab] = useState('corredores')
  const [ranking, setRanking] = useState({})

  useEffect(() => {
    fetchCorredores(); fetchBugs(); fetchFlamitas(); fetchRanking()

    // Realtime: actualizar lista cuando cambia un perfil
    const ch = supabase.channel('corredores-profiles-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
        fetchCorredores()
        fetchFlamitas()
        fetchRanking()
      })
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [])

  function abrirPerfil(corredor) {
    history.pushState({ perfil: corredor.id }, '')
    setPerfilAbierto(corredor)
  }

  function cerrarPerfil() {
    if (history.state?.perfil) { history.back() } else { setPerfilAbierto(null) }
  }

  useEffect(() => {
    function onPopState() { setPerfilAbierto(null) }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  async function fetchFlamitas() {
    const [{ data: puntos }, { data: perfiles }, { data: records }] = await Promise.all([
      supabase.from('puntos_carreras').select('user_id, puntos').eq('estado', 'validado'),
      supabase.from('profiles').select('id, bonus_perfil_otorgado, certificado_url'),
      supabase.from('records_personales').select('user_id'),
    ])
    const usersConRecord = new Set((records || []).map(r => r.user_id))
    const map = {}
    for (const r of puntos || []) { map[r.user_id] = (map[r.user_id] || 0) + (r.puntos || 0) }
    for (const p of perfiles || []) {
      const califica = p.bonus_perfil_otorgado || (!!p.certificado_url && usersConRecord.has(p.id))
      if (califica) map[p.id] = (map[p.id] || 0) + 5
    }
    setFlamitasMap(map)
  }

  async function fetchRanking() {
    const [{ data: records }, { data: perfiles }] = await Promise.all([
      supabase
        .from('records_personales')
        .select('user_id, distancia, tiempo_segundos, tiempo_texto')
        .in('distancia', DISTANCIAS_RANKING)
        .eq('tipo', 'calle')
        .gt('tiempo_segundos', 0),
      supabase.from('profiles').select('id, nombre, avatar_url'),
    ])
    const perfilMap = {}
    ;(perfiles || []).forEach(p => { perfilMap[p.id] = p })
    const agrupado = {}
    DISTANCIAS_RANKING.forEach(d => { agrupado[d] = [] })
    ;(records || []).forEach(r => {
      const perfil = perfilMap[r.user_id]
      if (!perfil || !agrupado[r.distancia]) return
      agrupado[r.distancia].push({
        nombre: perfil.nombre,
        avatar_url: perfil.avatar_url,
        tiempo_texto: r.tiempo_texto,
        tiempo_segundos: r.tiempo_segundos,
      })
    })
    DISTANCIAS_RANKING.forEach(d => {
      agrupado[d] = agrupado[d].sort((a, b) => a.tiempo_segundos - b.tiempo_segundos).slice(0, 10)
    })
    setRanking(agrupado)
  }

  async function fetchBugs() {
    const { data } = await supabase.from('bug_reports').select('*').order('created_at', { ascending: false })
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
    const { data } = await supabase.from('profiles').select('*').neq('role', 'admin').order('nombre')
    setCorredores(data || [])
    setLoading(false)
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
        <h2>{tab === 'ranking' ? 'Ranking general' : `Corredores (${corredores.length})`}</h2>
      </div>

      <div className="filtro-group" style={{ marginBottom: '16px', display: 'flex' }}>
        <button className={`filtro-btn ${tab === 'corredores' ? 'active' : ''}`} onClick={() => setTab('corredores')} style={{ flex: 1 }}>Corredores</button>
        <button className={`filtro-btn ${tab === 'ranking' ? 'active' : ''}`} onClick={() => setTab('ranking')} style={{ flex: 1 }}>Ranking</button>
      </div>

      {tab === 'corredores' && (
        <>
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
              <button type="submit" className="btn-primary">Generar link</button>
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
              <div key={c.id} className="card runner-card" style={{ cursor: c.role !== 'admin' ? 'pointer' : 'default', WebkitTapHighlightColor: 'transparent' }} onClick={() => c.role !== 'admin' && abrirPerfil(c)}>
                <div className="runner-avatar" style={{ overflow: 'hidden', padding: 0 }}>
                  {c.avatar_url
                    ? <img src={c.avatar_url} alt={c.nombre} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                    : <span style={{ fontSize: 14, fontWeight: 600 }}>{(c.nombre || '?')[0].toUpperCase()}</span>
                  }
                </div>
                <div style={{ flex: 1 }}>
                  <div className="runner-name">{c.nombre}{esCumpleaños(c.fecha_nacimiento) && ' 🎂'}</div>
                  <div className="runner-email">{c.email}</div>
                </div>
                {c.role === 'admin' && <span className="badge green">Admin</span>}
                {c.role !== 'admin' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {(() => {
                      const total = flamitasMap[c.id] || 0
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
                    <div style={{ fontSize: '14px', marginBottom: '10px' }}>{b.descripcion}</div>
                    {b.foto_url && (
                      <img src={b.foto_url.replace('/upload/', '/upload/w_600,q_auto/')} alt="bug" loading="lazy" style={{ width: '100%', borderRadius: '8px', marginBottom: '10px', cursor: 'pointer' }}
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
        </>
      )}

      {tab === 'ranking' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {DISTANCIAS_RANKING.map(dist => {
            const entradas = ranking[dist] || []
            return (
              <div key={dist} className="card" style={{ padding: '16px' }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px' }}>
                  🏃 {dist}
                </div>
                {entradas.length === 0 ? (
                  <div style={{ fontSize: '13px', color: 'var(--text2)' }}>Sin registros aún</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {entradas.map((e, i) => (
                      <div key={i} style={{
                        display: 'flex', alignItems: 'center', gap: '10px',
                        padding: '9px 0',
                        borderBottom: i < entradas.length - 1 ? '1px solid var(--border)' : 'none',
                      }}>
                        <div style={{
                          width: 24, textAlign: 'center', flexShrink: 0,
                          fontSize: i < 3 ? '16px' : '13px',
                          fontWeight: 700,
                          color: i < 3 ? 'inherit' : 'var(--text2)',
                        }}>
                          {i < 3 ? MEDALLAS[i] : `${i + 1}`}
                        </div>
                        <div style={{
                          width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                          background: 'rgba(255,45,45,0.15)', overflow: 'hidden',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 11, fontWeight: 700, color: 'var(--accent)',
                        }}>
                          {e.avatar_url
                            ? <img src={e.avatar_url} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                            : e.nombre?.[0]?.toUpperCase()
                          }
                        </div>
                        <span style={{ flex: 1, fontSize: '14px', fontWeight: i === 0 ? 600 : 400 }}>{e.nombre}</span>
                        <span style={{
                          fontSize: '13px', fontWeight: 700, fontVariantNumeric: 'tabular-nums',
                          color: i === 0 ? '#4ade80' : 'var(--text)',
                        }}>
                          {formatTiempo(e.tiempo_segundos)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {perfilAbierto && (
        <PerfilCorredor
          corredor={perfilAbierto}
          onClose={cerrarPerfil}
          onToggleAcceso={(id, bloqueado) => {
            setCorredores(prev => prev.map(c => c.id === id ? { ...c, activo: bloqueado ? false : true } : c))
          }}
        />
      )}
    </div>
  )
}
