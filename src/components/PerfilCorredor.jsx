import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import RecordsPersonales from './RecordsPersonales'
import { formatTelefonoWA } from '../lib/utils'
import { useAuth } from '../lib/auth'

const thisYear = new Date().getFullYear()

function calcularEdad(fechaNac) {
  if (!fechaNac) return null
  const hoy = new Date()
  const nac = new Date(fechaNac)
  let edad = hoy.getFullYear() - nac.getFullYear()
  if (hoy.getMonth() < nac.getMonth() || (hoy.getMonth() === nac.getMonth() && hoy.getDate() < nac.getDate())) edad--
  return edad
}

function formatFecha(f) {
  if (!f) return ''
  const [y, m, d] = f.split('-')
  return `${d}/${m}/${y}`
}

export default function PerfilCorredor({ corredor, onClose, onToggleAcceso }) {
  const { isAdmin } = useAuth()
  const [participaciones, setParticipaciones] = useState([])
  const [certUrl, setCertUrl] = useState(null)
  const [loading, setLoading] = useState(true)
  const [extra, setExtra] = useState({})
  const [bloqueado, setBloqueado] = useState(corredor.activo === false)
  const [totalFlamitas, setTotalFlamitas] = useState(null)
  const [metas, setMetas] = useState([])

  const hoy = new Date().toISOString().split('T')[0]

  useEffect(() => {
    fetchDatos()
  }, [corredor.id])

  async function fetchDatos() {
    setLoading(true)
    const [{ data: parts }, { data: cert }, { data: puntos }, { count: recordCount }] = await Promise.all([
      supabase.from('participaciones')
        .select('estado, distancia_elegida, carrera:carreras(id, nombre, fecha)')
        .eq('user_id', corredor.id)
        .neq('estado', 'Pendiente')
        .order('updated_at', { ascending: false }),
      supabase.from('profiles')
        .select('certificado_url, certificado_fecha, fecha_nacimiento, telefono, lesion_actual, bonus_perfil_otorgado, emergencia_nombre, emergencia_telefono')
        .eq('id', corredor.id)
        .single(),
      supabase.from('puntos_carreras')
        .select('puntos')
        .eq('user_id', corredor.id)
        .eq('estado', 'validado'),
      supabase.from('records_personales')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', corredor.id),
    ])
    setParticipaciones(parts || [])
    setExtra(cert || {})
    const base = (puntos || []).reduce((acc, r) => acc + (r.puntos || 0), 0)
    const tieneRec = (recordCount || 0) > 0
    const calificaBonus = tieneRec && !!cert?.certificado_url
    setTotalFlamitas(base + (calificaBonus ? 5 : 0))
    // Si califica pero el flag no está seteado, corregirlo en la DB
    if (calificaBonus && !cert?.bonus_perfil_otorgado) {
      supabase.from('profiles').update({ bonus_perfil_otorgado: true }).eq('id', corredor.id)
    }

    if (cert?.certificado_url) {
      if (cert.certificado_url.startsWith('http')) {
        setCertUrl(cert.certificado_url)
      } else {
        const { data } = await supabase.storage.from('certificados').createSignedUrl(cert.certificado_url, 60 * 60)
        if (data?.signedUrl) setCertUrl(data.signedUrl)
      }
    }

    const { data: metasData } = await supabase.from('metas_personales')
      .select('id, texto')
      .eq('user_id', corredor.id)
      .order('created_at', { ascending: true })
    setMetas(metasData || [])

    setLoading(false)
  }

  async function handleToggleAcceso() {
    const nuevoEstado = !bloqueado
    await supabase.from('profiles').update({ activo: !nuevoEstado }).eq('id', corredor.id)
    setBloqueado(nuevoEstado)
    if (onToggleAcceso) onToggleAcceso(corredor.id, nuevoEstado)
  }

  const edad = calcularEdad(extra.fecha_nacimiento)
  const certAnio = extra.certificado_fecha ? new Date(extra.certificado_fecha).getFullYear() : null
  const certVigente = certAnio === thisYear
  const certVencido = certAnio && certAnio < thisYear
  const tieneCert = !!extra.certificado_fecha

  const proximasCarreras = participaciones
    .filter(p => p.carrera?.fecha && p.carrera.fecha >= hoy && ['Inscripto', 'Quizás', 'Lista de espera'].includes(p.estado))
    .sort((a, b) => a.carrera.fecha.localeCompare(b.carrera.fecha))
  const ultimasCarreras = participaciones.filter(p => p.carrera?.fecha && p.carrera.fecha < hoy).slice(0, 5)

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 150, background: 'var(--bg)', display: 'flex', flexDirection: 'column', overflowY: 'auto', paddingBottom: 'env(safe-area-inset-bottom)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px', paddingTop: 'max(14px, env(safe-area-inset-top))', borderBottom: '1px solid var(--border)', flexShrink: 0, position: 'sticky', top: 0, background: 'var(--bg)', zIndex: 10 }}>
        <button onClick={onClose} className="btn-ghost" style={{ height: 34, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg>
          Volver
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: '15px' }}>{corredor.nombre}</div>
          {edad && <div style={{ fontSize: '12px', color: 'var(--text2)' }}>{edad} años</div>}
        </div>
        {isAdmin && (
          <button
            onClick={handleToggleAcceso}
            style={{
              fontSize: '12px', padding: '4px 10px', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0,
              background: bloqueado ? 'rgba(74,222,128,0.12)' : 'rgba(248,113,113,0.12)',
              color: bloqueado ? '#4ade80' : '#f87171',
            }}
          >
            {bloqueado ? 'Desbloquear' : 'Bloquear'}
          </button>
        )}
        {corredor.avatar_url
          ? <img src={corredor.avatar_url} style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} alt="" />
          : <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(255,45,45,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: 'var(--accent)', flexShrink: 0 }}>{(corredor.nombre || '?')[0].toUpperCase()}</div>
        }
      </div>

      {loading && (
        <div style={{ padding: '32px 16px', display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'var(--text2)', fontSize: '13px' }}>
          Cargando...
        </div>
      )}

      {!loading && <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>

        {/* DATOS DE CONTACTO */}
        <div className="card">
          <h3 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '12px' }}>Contacto</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
              <span style={{ color: 'var(--text2)' }}>Email</span>
              <span style={{ fontWeight: 500 }}>{corredor.email}</span>
            </div>
            {extra.telefono && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '14px' }}>
                <span style={{ color: 'var(--text2)' }}>Teléfono</span>
                <a
                  href={`https://wa.me/${formatTelefonoWA(extra.telefono)}`}
                  target="_blank" rel="noopener noreferrer"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#4ade80', fontWeight: 500, textDecoration: 'none' }}
                >
                  {extra.telefono}
                  <svg width="14" height="14" viewBox="0 0 32 32" fill="currentColor"><path d="M16 2C8.28 2 2 8.28 2 16c0 2.44.65 4.73 1.79 6.72L2 30l7.47-1.76A13.93 13.93 0 0 0 16 30c7.72 0 14-6.28 14-14S23.72 2 16 2zm0 25.5c-2.2 0-4.27-.6-6.04-1.64l-.43-.26-4.43 1.04 1.07-4.3-.28-.45A11.45 11.45 0 0 1 4.5 16C4.5 9.6 9.6 4.5 16 4.5S27.5 9.6 27.5 16 22.4 27.5 16 27.5zm6.27-8.57c-.34-.17-2.02-1-2.34-1.11-.32-.11-.55-.17-.78.17-.23.34-.9 1.11-1.1 1.34-.2.23-.4.26-.74.09-.34-.17-1.44-.53-2.74-1.69-1.01-.9-1.7-2.01-1.9-2.35-.2-.34-.02-.52.15-.69.15-.15.34-.4.51-.6.17-.2.23-.34.34-.57.11-.23.06-.43-.03-.6-.09-.17-.78-1.88-1.07-2.57-.28-.67-.57-.58-.78-.59h-.67c-.23 0-.6.09-.91.43-.32.34-1.2 1.17-1.2 2.86s1.23 3.32 1.4 3.55c.17.23 2.42 3.7 5.87 5.19.82.35 1.46.56 1.96.72.82.26 1.57.22 2.16.13.66-.1 2.02-.82 2.31-1.62.28-.8.28-1.48.2-1.62-.09-.14-.32-.23-.66-.4z"/></svg>
                </a>
              </div>
            )}
          </div>
        </div>

        {/* FLAMITAS */}
        {totalFlamitas !== null && (
          <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '13px', color: 'var(--text2)' }}>Flamitas acumuladas</span>
            <span style={{ fontSize: '20px', fontWeight: 800, color: 'var(--accent)' }}>💎 {totalFlamitas}</span>
          </div>
        )}

        {/* CERTIFICADO */}
        <div className="card">
          <h3 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '12px' }}>Certificado médico</h3>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{
              fontSize: '12px', fontWeight: 600, padding: '3px 10px', borderRadius: '20px',
              background: certVigente ? 'rgba(74,222,128,0.15)' : certVencido ? 'rgba(248,113,113,0.15)' : 'rgba(148,163,184,0.15)',
              color: certVigente ? '#4ade80' : certVencido ? '#f87171' : '#94a3b8',
            }}>
              {certVigente ? '✓ Vigente' : certVencido ? '⚠ Vencido' : 'Sin certificado'}
            </span>
            {tieneCert && extra.certificado_fecha && (
              <span style={{ fontSize: '12px', color: 'var(--text2)' }}>Subido el {formatFecha(extra.certificado_fecha.split('T')[0])}</span>
            )}
            {certUrl && (
              <a href={certUrl} target="_blank" rel="noopener noreferrer" className="btn-ghost" style={{ fontSize: '12px', height: 30, padding: '0 12px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>
                Ver →
              </a>
            )}
          </div>
        </div>

        {/* CONTACTO DE EMERGENCIA */}
        {(extra.emergencia_nombre || extra.emergencia_telefono) && (
          <div className="card">
            <h3 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '12px' }}>Contacto de emergencia</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {extra.emergencia_nombre && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                  <span style={{ color: 'var(--text2)' }}>Nombre</span>
                  <span style={{ fontWeight: 500 }}>{extra.emergencia_nombre}</span>
                </div>
              )}
              {extra.emergencia_telefono && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '14px' }}>
                  <span style={{ color: 'var(--text2)' }}>Teléfono</span>
                  <a
                    href={`https://wa.me/${formatTelefonoWA(extra.emergencia_telefono)}`}
                    target="_blank" rel="noopener noreferrer"
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#4ade80', fontWeight: 500, textDecoration: 'none' }}
                  >
                    {extra.emergencia_telefono}
                    <svg width="14" height="14" viewBox="0 0 32 32" fill="currentColor"><path d="M16 2C8.28 2 2 8.28 2 16c0 2.44.65 4.73 1.79 6.72L2 30l7.47-1.76A13.93 13.93 0 0 0 16 30c7.72 0 14-6.28 14-14S23.72 2 16 2zm0 25.5c-2.2 0-4.27-.6-6.04-1.64l-.43-.26-4.43 1.04 1.07-4.3-.28-.45A11.45 11.45 0 0 1 4.5 16C4.5 9.6 9.6 4.5 16 4.5S27.5 9.6 27.5 16 22.4 27.5 16 27.5zm6.27-8.57c-.34-.17-2.02-1-2.34-1.11-.32-.11-.55-.17-.78.17-.23.34-.9 1.11-1.1 1.34-.2.23-.4.26-.74.09-.34-.17-1.44-.53-2.74-1.69-1.01-.9-1.7-2.01-1.9-2.35-.2-.34-.02-.52.15-.69.15-.15.34-.4.51-.6.17-.2.23-.34.34-.57.11-.23.06-.43-.03-.6-.09-.17-.78-1.88-1.07-2.57-.28-.67-.57-.58-.78-.59h-.67c-.23 0-.6.09-.91.43-.32.34-1.2 1.17-1.2 2.86s1.23 3.32 1.4 3.55c.17.23 2.42 3.7 5.87 5.19.82.35 1.46.56 1.96.72.82.26 1.57.22 2.16.13.66-.1 2.02-.82 2.31-1.62.28-.8.28-1.48.2-1.62-.09-.14-.32-.23-.66-.4z"/></svg>
                  </a>
                </div>
              )}
            </div>
          </div>
        )}

        {/* LESIONES / MOLESTIAS */}
        {extra.lesion_actual && (
          <div className="card">
            <h3 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 8v8M8 12h8"/><rect x="4" y="4" width="16" height="16" rx="3"/></svg>
              Lesiones / molestias
            </h3>
            <div style={{ fontSize: '14px' }}>{extra.lesion_actual}</div>
          </div>
        )}

        {/* PRÓXIMAS CARRERAS */}
        {proximasCarreras.length > 0 && (
          <div className="card">
            <h3 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '12px' }}>Próximas carreras</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {proximasCarreras.map((p, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
                  <div>
                    <div style={{ fontWeight: 500 }}>{p.carrera.nombre}</div>
                    {p.carrera.fecha && <div style={{ fontSize: '11px', color: 'var(--text2)' }}>{formatFecha(p.carrera.fecha)}</div>}
                  </div>
                  <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '20px', background: p.estado === 'Inscripto' ? 'rgba(74,222,128,0.15)' : 'rgba(251,191,36,0.15)', color: p.estado === 'Inscripto' ? '#4ade80' : '#fbbf24' }}>
                    {p.estado}{p.distancia_elegida ? ` · ${p.distancia_elegida}` : ''}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ÚLTIMAS CARRERAS */}
        {ultimasCarreras.length > 0 && (
          <div className="card">
            <h3 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '12px' }}>Últimas carreras</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {ultimasCarreras.map((p, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
                  <div>
                    <div style={{ fontWeight: 500 }}>{p.carrera.nombre}</div>
                    {p.carrera.fecha && <div style={{ fontSize: '11px', color: 'var(--text2)' }}>{formatFecha(p.carrera.fecha)}</div>}
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--text2)' }}>{p.estado}{p.distancia_elegida ? ` · ${p.distancia_elegida}` : ''}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* RECORDS PERSONALES */}
        <RecordsPersonales userId={corredor.id} />

        {/* METAS PERSONALES */}
        {metas.length > 0 && (
          <div className="card">
            <h3 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '12px' }}>Metas personales</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {metas.map(m => (
                <div key={m.id} style={{ fontSize: '14px', display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                  <span style={{ color: 'var(--accent)', marginTop: '2px', flexShrink: 0 }}>🎯</span>
                  <span>{m.texto}</span>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>}
    </div>
  )
}
