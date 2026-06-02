import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const ESTADOS = ['Inscripto', 'Tal vez', 'Lista de espera', 'No voy', 'Pendiente']
const COLORS = { 'Inscripto': '#4ade80', 'Tal vez': '#fbbf24', 'Lista de espera': '#60a5fa', 'No voy': '#f87171', 'Pendiente': '#94a3b8' }

export default function Resumen() {
  const [carreras, setCarreras] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchResumen() }, [])

  async function fetchResumen() {
    const { data: cars } = await supabase.from('carreras').select('*').order('fecha')
    const { data: parts } = await supabase.from('participaciones').select('carrera_id, estado')
    const enriched = (cars || []).map(c => {
      const ps = (parts || []).filter(p => p.carrera_id === c.id)
      const counts = {}
      ESTADOS.forEach(e => counts[e] = ps.filter(p => p.estado === e).length)
      return { ...c, counts, total: ps.length }
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
              <h3>{c.nombre}</h3>
              {c.fecha && <span className="tag">📅 {c.fecha}</span>}
            </div>
            <span className="summary-total">{c.total} corredores</span>
          </div>
          <div className="summary-stats">
            {ESTADOS.map(e => (
              <div key={e} className="stat-item">
                <div className="stat-num" style={{ color: COLORS[e] }}>{c.counts[e]}</div>
                <div className="stat-lbl">{e}</div>
              </div>
            ))}
          </div>
          {c.total > 0 && (
            <div className="progress-track">
              {ESTADOS.filter(e => c.counts[e] > 0).map(e => (
                <div
                  key={e}
                  className="progress-seg"
                  style={{ width: `${(c.counts[e] / c.total) * 100}%`, background: COLORS[e] }}
                  title={`${e}: ${c.counts[e]}`}
                />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
