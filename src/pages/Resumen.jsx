import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { formatFecha } from '../lib/utils'

const ESTADOS = ['Inscripto', 'Tal vez', 'Lista de espera', 'No voy', 'Pendiente']
const COLORS = { 'Inscripto': '#4ade80', 'Tal vez': '#fbbf24', 'Lista de espera': '#60a5fa', 'No voy': '#f87171', 'Pendiente': '#94a3b8' }
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

  useEffect(() => { fetchResumen() }, [])

  async function fetchResumen() {
    const { data: cars } = await supabase.from('carreras').select('*').order('fecha')
    const { data: parts } = await supabase.from('participaciones').select('carrera_id, estado, distancia_elegida')

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

      return { ...c, counts, total: ps.length, dists, multiDist, porDistancia }
    })
    setCarreras(enriched)
    setLoading(false)
  }

  if (loading) return <div className="page-loading">Cargando...</div>

  return (
    <div className="page">
      <div className="page-header"><h2>Resumen</h2></div>
      {carreras.length === 0 && <div className="empty-state">No hay datos todavía</div>}
      {carreras.map(c => (
        <div key={c.id} className="card summary-card">
          <div className="summary-header">
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '4px' }}>
                <h3 style={{ margin: 0 }}>{c.nombre}</h3>
                {c.tipo && (
                  <span className="tag" style={{ background: TIPO_COLOR[c.tipo] + '22', color: TIPO_COLOR[c.tipo], border: `1px solid ${TIPO_COLOR[c.tipo]}44`, fontWeight: 600 }}>
                    {c.tipo}
                  </span>
                )}
              </div>
              {c.fecha && <span className="tag">📅 {formatFecha(c.fecha)}</span>}
            </div>
            <span className="summary-total">{c.total} corredores</span>
          </div>

          {c.multiDist ? (
            <>
              <StatsRow counts={c.counts} total={c.total} />
              {c.porDistancia.filter(pd => pd.total > 0).map((pd, i) => (
                <div key={pd.distancia} style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#94a3b8', marginBottom: '8px', display: 'flex', justifyContent: 'space-between' }}>
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
        </div>
      ))}
    </div>
  )
}
