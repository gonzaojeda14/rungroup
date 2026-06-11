import PageLoader from '../components/PageLoader'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { formatFecha, formatTelefonoWA } from '../lib/utils'

const ESTADOS = ['Inscripto', 'Quizás', 'No voy', 'Lista de espera', 'Pendiente']
const COLORS = { 'Inscripto': '#4ade80', 'Quizás': '#fbbf24', 'Lista de espera': '#60a5fa', 'No voy': '#f87171', 'Pendiente': '#94a3b8' }
const TIPO_COLOR = { 'Trail': '#fb923c', 'Calle': '#60a5fa' }

function StatsRow({ counts, total, estados = ESTADOS }) {
  return (
    <>
      <div className="summary-stats">
        {estados.map(e => (
          <div key={e} className="stat-item">
            <div className="stat-num" style={{ color: COLORS[e] }}>{counts[e] || 0}</div>
            <div className="stat-lbl">{e}</div>
          </div>
        ))}
      </div>
      {total > 0 && (
        <div className="progress-track">
          {estados.filter(e => counts[e] > 0).map(e => (
            <div
              key={e}
              className="progress-seg"
              style={{ width: `${((counts[e] || 0) / total) * 100}%`, background: COLORS[e] }}
              title={`${e}: ${counts[e]}`}
            />
          ))}
        </div>
      )}
    </>
  )
}

export default function Resumen() {
  const [carreras, setCarreras] = useState([])
  const [loading, setLoading] = useState(true)
  const [carreraFiltro, setCarreraFiltro] = useState('todas')
  const [mesFiltro, setMesFiltro] = useState('todos')
  const [tiempos, setTiempos] = useState([]) // todos los tiempos cargados
  const [rankingAbierto, setRankingAbierto] = useState({}) // carreraId_distancia -> bool

  useEffect(() => {
    fetchResumen()
    const channel = supabase.channel('resumen-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'carreras' }, fetchResumen)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'participaciones' }, fetchResumen)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [])

  async function fetchResumen() {
    const { data: cars } = await supabase.from('carreras').select('*').order('fecha')
    const { data: partsRaw } = await supabase.from('participaciones').select('carrera_id, estado, distancia_elegida, feedback, feedback_nota, user_id').range(0, 4999)
    const { data: tcRaw } = await supabase
      .from('tiempos_carreras')
      .select('carrera_id, distancia, tiempo_segundos, tiempo_texto, user_id')
    const tcUserIds = [...new Set((tcRaw || []).map(t => t.user_id))]
    const { data: tcPerfiles } = tcUserIds.length
      ? await supabase.from('profiles').select('id, nombre').in('id', tcUserIds)
      : { data: [] }
    const tcPerfilesMap = Object.fromEntries((tcPerfiles || []).map(p => [p.id, p]))
    setTiempos((tcRaw || []).map(t => ({ ...t, profiles: tcPerfilesMap[t.user_id] || null })))
    const userIds = [...new Set((partsRaw || []).map(p => p.user_id))]
    const { data: perfiles } = userIds.length
      ? await supabase.from('profiles').select('id, nombre, telefono').in('id', userIds)
      : { data: [] }
    const perfilesMap = Object.fromEntries((perfiles || []).map(p => [p.id, p]))
    const parts = (partsRaw || []).map(p => ({ ...p, profiles: perfilesMap[p.user_id] || null }))

    const enriched = (cars || []).map(c => {
      const ps = (parts || []).filter(p => p.carrera_id === c.id)
      const dists = c.distancias?.length ? c.distancias : (c.distancia ? [c.distancia] : [])
      const multiDist = dists.length > 1

      // Conteos globales
      const counts = {}
      ESTADOS.forEach(e => counts[e] = ps.filter(p => p.estado === e).length)

      // Conteos por distancia
      let porDistancia = null
      if (multiDist) {
        porDistancia = dists.map(d => {
          const psDist = ps.filter(p => p.distancia_elegida === d)
          const c2 = {}
          ESTADOS.forEach(e => c2[e] = psDist.filter(p => p.estado === e).length)
          return { distancia: d, counts: c2, total: psDist.length }
        })
        // Ignorar los que no eligieron distancia en el desglose
      }

      // Feedback
      const feedbacks = ps.filter(p => p.feedback)
      const porFeedback = {
        excelente: feedbacks.filter(p => p.feedback === 'excelente'),
        regular: feedbacks.filter(p => p.feedback === 'regular').map(p => ({ ...p, nombre: p.profiles?.nombre, telefono: p.profiles?.telefono })),
        mal: feedbacks.filter(p => p.feedback === 'mal').map(p => ({ ...p, nombre: p.profiles?.nombre, telefono: p.profiles?.telefono })),
      }

      return { ...c, counts, total: ps.length, dists, multiDist, porDistancia, feedbacks, porFeedback }
    })
    setCarreras(enriched)
    setLoading(false)
  }

  if (loading) return <PageLoader />

  return (
    <div className="page">
      <div className="page-header">
        <h2>Resumen</h2>
        {carreras.length > 1 && (
          <select
            value={carreraFiltro}
            onChange={e => { setCarreraFiltro(e.target.value); setMesFiltro('todos') }}
            style={{
              height: 34, fontSize: 13, padding: '0 10px', borderRadius: 8, maxWidth: 180,
              background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text)',
              fontFamily: 'inherit', cursor: 'pointer',
            }}
          >
            <option value="todas">Todas las carreras</option>
            {carreras.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        )}
      </div>
      {/* Filtro de meses */}
      {carreraFiltro === 'todas' && (() => {
        const meses = [...new Set(carreras.filter(c => c.fecha).map(c => c.fecha.slice(0, 7)))]
        if (meses.length <= 1) return null
        return (
          <div className="filtros-bar" style={{ marginBottom: '12px' }}>
            <div className="filtro-group">
              <button className={`filtro-btn ${mesFiltro === 'todos' ? 'active' : ''}`} onClick={() => setMesFiltro('todos')}>Todos</button>
              {meses.map(m => {
                const [y, mo] = m.split('-')
                const label = `${['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'][parseInt(mo)-1]} ${y}`
                return <button key={m} className={`filtro-btn ${mesFiltro === m ? 'active' : ''}`} onClick={() => setMesFiltro(m)}>{label}</button>
              })}
            </div>
          </div>
        )
      })()}

      {carreras.length === 0 && <div className="empty-state">No hay datos todavía</div>}
      {carreras.filter(c => {
        if (carreraFiltro !== 'todas') return c.id === carreraFiltro
        if (mesFiltro !== 'todos' && (!c.fecha || !c.fecha.startsWith(mesFiltro))) return false
        return true
      }).map(c => (
        <div key={c.id} className="card summary-card">
          <div className="summary-header">
            <div>
              <h3 style={{ margin: '0 0 4px 0' }}>{c.nombre}</h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {c.fecha && <span className="tag">📅 {formatFecha(c.fecha)}</span>}
                {c.tipo && (!c.tipo_actividad || c.tipo_actividad === 'carrera') && <span className="tag" style={{ background: TIPO_COLOR[c.tipo] + '22', color: TIPO_COLOR[c.tipo], border: `1px solid ${TIPO_COLOR[c.tipo]}44`, fontWeight: 600 }}>{c.tipo}</span>}
              </div>
            </div>
            <span className="summary-total">
              {c.total} corredores
            </span>
          </div>

          {(() => {
            const esEvento = c.tipo_actividad === 'evento' || c.tipo_actividad === 'entrenamiento'
            const estadosVista = esEvento ? ['Inscripto', 'Pendiente'] : ESTADOS
            const totalVista = esEvento
              ? (c.counts['Inscripto'] || 0) + (c.counts['Pendiente'] || 0)
              : c.total
            return c.multiDist && !esEvento ? (
              <>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text2)', marginBottom: '8px' }}>General</div>
                <StatsRow counts={c.counts} total={c.total} estados={estadosVista} />
                {c.porDistancia.filter(pd => pd.total > 0).map((pd) => (
                  <div key={pd.distancia} style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px solid var(--border)' }}>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text2)', marginBottom: '8px', display: 'flex', justifyContent: 'space-between' }}>
                      <span>📏 {pd.distancia}</span>
                      <span>{pd.total} eligieron</span>
                    </div>
                    <StatsRow counts={pd.counts} total={pd.total} estados={estadosVista} />
                  </div>
                ))}
              </>
            ) : (
              <StatsRow counts={c.counts} total={totalVista} estados={estadosVista} />
            )
          })()}
          {/* Ranking de tiempos — solo carreras pasadas con tiempos cargados */}
          {(!c.tipo_actividad || c.tipo_actividad === 'carrera') && (() => {
            const today = new Date().toISOString().split('T')[0]
            if (!c.fecha || c.fecha >= today) return null
            const tiemposCarrera = tiempos.filter(t => t.carrera_id === c.id)
            if (tiemposCarrera.length === 0) return null
            const distanciasConTiempos = [...new Set(tiemposCarrera.map(t => t.distancia))].sort()
            return (
              <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px solid var(--border)' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text2)', marginBottom: '10px' }}>
                  🏆 Ranking de tiempos
                </div>
                {distanciasConTiempos.map(dist => {
                  const key = `${c.id}_${dist}`
                  const abierto = rankingAbierto[key]
                  const lista = tiemposCarrera
                    .filter(t => t.distancia === dist)
                    .sort((a, b) => a.tiempo_segundos - b.tiempo_segundos)
                  return (
                    <div key={dist} style={{ marginBottom: '8px' }}>
                      <button
                        onClick={() => setRankingAbierto(prev => ({ ...prev, [key]: !prev[key] }))}
                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0', fontFamily: 'inherit' }}
                      >
                        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text)' }}>📏 {dist} <span style={{ color: 'var(--text2)', fontWeight: 400 }}>({lista.length} tiempo{lista.length !== 1 ? 's' : ''})</span></span>
                        <span style={{ fontSize: '11px', color: 'var(--text2)' }}>{abierto ? '▲' : '▼'}</span>
                      </button>
                      {abierto && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '6px' }}>
                          {lista.map((t, i) => (
                            <div key={t.user_id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', padding: '5px 8px', borderRadius: '8px', background: i === 0 ? 'rgba(251,191,36,0.08)' : 'transparent' }}>
                              <span style={{ width: 20, textAlign: 'center', fontWeight: 700, color: i === 0 ? '#fbbf24' : i === 1 ? '#94a3b8' : i === 2 ? '#fb923c' : 'var(--text2)', fontSize: i < 3 ? '14px' : '12px' }}>
                                {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`}
                              </span>
                              <span style={{ flex: 1 }}>{t.profiles?.nombre || '—'}</span>
                              <span style={{ fontWeight: 600, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{t.tiempo_texto}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )
          })()}

          {(!c.tipo_actividad || c.tipo_actividad === 'carrera') && c.feedbacks?.length > 0 && (
            <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px solid var(--border)' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text2)', marginBottom: '8px' }}>
                Feedback post-carrera
              </div>
              <div style={{ display: 'flex', gap: '16px', marginBottom: c.porFeedback.mal.length > 0 ? '10px' : 0 }}>
                {[['excelente','😍'],['regular','😐'],['mal','😞']].map(([val, emoji]) => (
                  c.porFeedback[val].length > 0 && (
                    <span key={val} style={{ fontSize: '13px', color: 'var(--text2)' }}>
                      {emoji} <strong style={{ color: 'var(--text)' }}>{c.porFeedback[val].length}</strong>
                    </span>
                  )
                ))}
              </div>
              {(c.porFeedback.mal.length > 0 || c.porFeedback.regular.length > 0) && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>
                  {[['mal', '😞', '#f87171'], ['regular', '😐', '#fbbf24']].map(([key, emoji, color]) =>
                    c.porFeedback[key].length > 0 && (
                      <div key={key} style={{ background: color + '11', border: `1px solid ${color}33`, borderRadius: '8px', padding: '8px 12px' }}>
                        <div style={{ fontSize: '11px', color, fontWeight: 600, marginBottom: '6px' }}>{emoji} Hablar con:</div>
                        {c.porFeedback[key].map((p, i) => (
                          <div key={i} style={{ fontSize: '12px', color: 'var(--text2)', marginBottom: '4px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span>• {p.nombre || '—'}</span>
                              {p.telefono && (
                                <a
                                  href={`https://wa.me/${formatTelefonoWA(p.telefono)}`}
                                  target="_blank" rel="noopener noreferrer"
                                  style={{ display: 'inline-flex', alignItems: 'center', color: '#4ade80', flexShrink: 0 }}
                                  title={`Escribir a ${p.nombre} por WhatsApp`}
                                >
                                  <svg width="13" height="13" viewBox="0 0 32 32" fill="currentColor"><path d="M16 2C8.28 2 2 8.28 2 16c0 2.44.65 4.73 1.79 6.72L2 30l7.47-1.76A13.93 13.93 0 0 0 16 30c7.72 0 14-6.28 14-14S23.72 2 16 2zm0 25.5c-2.2 0-4.27-.6-6.04-1.64l-.43-.26-4.43 1.04 1.07-4.3-.28-.45A11.45 11.45 0 0 1 4.5 16C4.5 9.6 9.6 4.5 16 4.5S27.5 9.6 27.5 16 22.4 27.5 16 27.5zm6.27-8.57c-.34-.17-2.02-1-2.34-1.11-.32-.11-.55-.17-.78.17-.23.34-.9 1.11-1.1 1.34-.2.23-.4.26-.74.09-.34-.17-1.44-.53-2.74-1.69-1.01-.9-1.7-2.01-1.9-2.35-.2-.34-.02-.52.15-.69.15-.15.34-.4.51-.6.17-.2.23-.34.34-.57.11-.23.06-.43-.03-.6-.09-.17-.78-1.88-1.07-2.57-.28-.67-.57-.58-.78-.59h-.67c-.23 0-.6.09-.91.43-.32.34-1.2 1.17-1.2 2.86s1.23 3.32 1.4 3.55c.17.23 2.42 3.7 5.87 5.19.82.35 1.46.56 1.96.72.82.26 1.57.22 2.16.13.66-.1 2.02-.82 2.31-1.62.28-.8.28-1.48.2-1.62-.09-.14-.32-.23-.66-.4z"/></svg>
                                </a>
                              )}
                            </div>
                            {p.feedback_nota && <div style={{ color: 'var(--text2)', paddingLeft: '10px', fontStyle: 'italic' }}>"{p.feedback_nota}"</div>}
                          </div>
                        ))}
                      </div>
                    )
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}