import PageLoader from '../components/PageLoader'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { formatFecha } from '../lib/utils'

const ESTADOS = ['Inscripto', 'Quizás', 'No voy', 'Lista de espera', 'Pendiente']
const COLORS = { 'Inscripto': '#4ade80', 'Quizás': '#fbbf24', 'Lista de espera': '#60a5fa', 'No voy': '#f87171', 'Pendiente': '#94a3b8' }
const TIPO_COLOR = { 'Trail': '#fb923c', 'Calle': '#60a5fa' }

function StatsRow({ counts, total }) {
  return (
    <>
      <div className="summary-stats">
        {ESTADOS.map(e => (
          <div key={e} className="stat-item">
            <div className="stat-num" style={{ color: COLORS[e] }}>{counts[e] || 0}</div>
            <div className="stat-lbl">{e}</div>
          </div>
        ))}
      </div>
      {total > 0 && (
        <div className="progress-track">
          {ESTADOS.filter(e => counts[e] > 0).map(e => (
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
    const { data: partsRaw } = await supabase.from('participaciones').select('carrera_id, estado, distancia_elegida, feedback, feedback_nota, user_id')
    const userIds = [...new Set((partsRaw || []).map(p => p.user_id))]
    const { data: perfiles } = userIds.length
      ? await supabase.from('profiles').select('id, nombre').in('id', userIds)
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
        regular: feedbacks.filter(p => p.feedback === 'regular').map(p => ({ ...p, nombre: p.profiles?.nombre })),
        mal: feedbacks.filter(p => p.feedback === 'mal').map(p => ({ ...p, nombre: p.profiles?.nombre })),
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
                {c.tipo && <span className="tag" style={{ background: TIPO_COLOR[c.tipo] + '22', color: TIPO_COLOR[c.tipo], border: `1px solid ${TIPO_COLOR[c.tipo]}44`, fontWeight: 600 }}>{c.tipo}</span>}
              </div>
            </div>
            <span className="summary-total">{c.total} corredores</span>
          </div>

          {c.multiDist ? (
            <>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text2)', marginBottom: '8px' }}>General</div>
              <StatsRow counts={c.counts} total={c.total} />
              {c.porDistancia.filter(pd => pd.total > 0).map((pd, i) => (
                <div key={pd.distancia} style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text2)', marginBottom: '8px', display: 'flex', justifyContent: 'space-between' }}>
                    <span>📏 {pd.distancia}</span>
                    <span>{pd.total} eligieron</span>
                  </div>
                  <StatsRow counts={pd.counts} total={pd.total} />
                </div>
              ))}
            </>
          ) : (
            <StatsRow counts={c.counts} total={c.total} />
          )}
          {c.feedbacks?.length > 0 && (
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
                          <div key={i} style={{ fontSize: '12px', color: 'var(--text2)', marginBottom: p.feedback_nota ? '2px' : '0' }}>
                            • {p.nombre || '—'}
                            {p.feedback_nota && <span style={{ color: 'var(--text2)' }}> — "{p.feedback_nota}"</span>}
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