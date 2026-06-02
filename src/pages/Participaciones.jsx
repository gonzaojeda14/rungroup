import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'

const ESTADO_COLOR = {
  'Inscripto': '#4ade80',
  'No voy': '#f87171',
  'Tal vez': '#fbbf24',
  'Pendiente': '#64748b',
}

const ESTADO_ICON = {
  'Inscripto': '✓',
  'No voy': '✕',
  'Tal vez': '?',
  'Pendiente': '—',
}

export default function Participaciones() {
  const { user, isAdmin } = useAuth()
  const [carreras, setCarreras] = useState([])
  const [carreraId, setCarreraId] = useState('')
  const [participaciones, setParticipaciones] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingParts, setLoadingParts] = useState(false)

  useEffect(() => { fetchCarreras() }, [])

  useEffect(() => {
    if (carreraId) fetchParticipaciones()
  }, [carreraId])

  async function fetchCarreras() {
    const { data } = await supabase.from('carreras').select('id, nombre, fecha').order('fecha')
    setCarreras(data || [])
    if (data?.length) setCarreraId(data[0].id)
    setLoading(false)
  }

  async function fetchParticipaciones() {
    setLoadingParts(true)
    const { data } = await supabase
      .from('participaciones')
      .select('*, profiles(nombre)')
      .eq('carrera_id', carreraId)
      .order('profiles(nombre)')
    setParticipaciones(data || [])
    setLoadingParts(false)
  }

  // Contadores para el resumen rápido
  const counts = participaciones.reduce((acc, p) => {
    acc[p.estado] = (acc[p.estado] || 0) + 1
    return acc
  }, {})

  const inscriptos = participaciones.filter(p => p.estado === 'Inscripto')
  const talvez = participaciones.filter(p => p.estado === 'Tal vez')
  const noVan = participaciones.filter(p => p.estado === 'No voy')
  const pendientes = participaciones.filter(p => p.estado === 'Pendiente')

  if (loading) return <div className="page-loading">Cargando...</div>

  return (
    <div className="page">
      <div className="page-header">
        <h2>Mis carreras</h2>
      </div>

      {carreras.length === 0 && (
        <div className="empty-state">No hay carreras cargadas todavía</div>
      )}

      {carreras.length > 0 && (
        <>
          <div className="field" style={{ marginBottom: '1.25rem' }}>
            <label>Carrera</label>
            <select value={carreraId} onChange={e => setCarreraId(e.target.value)}>
              {carreras.map(c => (
                <option key={c.id} value={c.id}>{c.nombre}{c.fecha ? ` — ${c.fecha}` : ''}</option>
              ))}
            </select>
          </div>

          {loadingParts ? (
            <div className="page-loading">Cargando...</div>
          ) : (
            <>
              {/* Resumen rápido */}
              {participaciones.length > 0 && (
                <div className="card" style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                  {[['Inscripto', '#4ade80'], ['Tal vez', '#fbbf24'], ['No voy', '#f87171'], ['Pendiente', '#64748b']].map(([e, color]) =>
                    counts[e] ? (
                      <div key={e} style={{ textAlign: 'center', flex: 1 }}>
                        <div style={{ fontSize: '1.5rem', fontWeight: 700, color }}>{counts[e]}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{e}</div>
                      </div>
                    ) : null
                  )}
                </div>
              )}

              {/* Grupos por estado */}
              {participaciones.length === 0 && (
                <div className="em