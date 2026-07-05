import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { formatFecha } from '../lib/utils'
import { createPortal } from 'react-dom'

// Modal reutilizable con el histórico de Flamitas de un usuario.
// Autosuficiente: solo necesita userId. Muestra cada acreditación validada
// en orden cronológico con el acumulado corriendo, más la línea del bonus de
// perfil completo (+5), y el total arriba. Mismo criterio de suma que el total
// que se ve en MiPerfil / PerfilCorredor (validado + bonus).
export default function HistorialFlamitas({ userId, nombre, onClose }) {
  const [loading, setLoading] = useState(true)
  const [entradas, setEntradas] = useState([])
  const [bonus, setBonus] = useState(0)

  useEffect(() => {
    let vivo = true
    async function fetchHistorial() {
      setLoading(true)
      const [{ data: puntos }, { data: prof }, { count: recCount }] = await Promise.all([
        supabase.from('puntos_carreras')
          .select('id, puntos, tipo_participacion, created_at, carrera:carreras(nombre, fecha, destacada)')
          .eq('user_id', userId)
          .eq('estado', 'validado'),
        supabase.from('profiles').select('certificado_url').eq('id', userId).single(),
        supabase.from('records_personales').select('*', { count: 'exact', head: true }).eq('user_id', userId),
      ])
      if (!vivo) return
      const orden = (puntos || []).slice().sort((a, b) => {
        const fa = a.carrera?.fecha || a.created_at || ''
        const fb = b.carrera?.fecha || b.created_at || ''
        return fa.localeCompare(fb)
      })
      setEntradas(orden)
      setBonus(((recCount || 0) > 0 && !!prof?.certificado_url) ? 5 : 0)
      setLoading(false)
    }
    fetchHistorial()
    return () => { vivo = false }
  }, [userId])

  const totalCarreras = entradas.reduce((s, e) => s + (e.puntos || 0), 0)
  const total = totalCarreras + bonus
  let acum = 0

  const fila = (contenido) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--bg)', borderRadius: '10px', border: '1px solid var(--border)' }}>
      {contenido}
    </div>
  )

  return createPortal(
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 200 }} />
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 201,
        background: 'var(--bg2)', borderRadius: '16px 16px 0 0',
        padding: '20px', borderTop: '1px solid var(--border)',
        maxHeight: '80vh', overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
          <div style={{ fontSize: '16px', fontWeight: 700 }}>Historial de Flamitas</div>
          <button onClick={onClose} className="btn-ghost" style={{ padding: '4px 12px', fontSize: '13px', height: 'auto' }}>Cerrar</button>
        </div>
        {nombre && <div style={{ fontSize: '12px', color: 'var(--text2)', marginBottom: '2px' }}>{nombre}</div>}
        <div style={{ fontSize: '13px', color: 'var(--text2)', marginBottom: '14px' }}>
          Total acumulado: <strong style={{ color: 'var(--accent)' }}>{total} 💎</strong>
        </div>

        {loading ? (
          <div style={{ fontSize: '13px', color: 'var(--text2)', padding: '12px 0' }}>Cargando...</div>
        ) : (entradas.length === 0 && bonus === 0) ? (
          <div style={{ fontSize: '13px', color: 'var(--text2)', padding: '12px 0' }}>Todavía no sumó Flamitas.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {entradas.map(e => {
              acum += (e.puntos || 0)
              const esStand = e.tipo_participacion === 'Stand Flama'
              const acumAqui = acum
              return (
                <div key={e.id}>
                  {fila(
                    <>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {e.carrera?.destacada ? '⭐ ' : ''}{e.carrera?.nombre || 'Carrera'}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text2)', marginTop: '2px' }}>
                          {e.carrera?.fecha ? formatFecha(e.carrera.fecha) : ''}{e.carrera?.fecha ? ' · ' : ''}{esStand ? 'Stand Flama' : 'Inscripto'}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: '12px' }}>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--accent)' }}>+{e.puntos} 💎</div>
                        <div style={{ fontSize: '10px', color: 'var(--text2)' }}>{acumAqui} acum.</div>
                      </div>
                    </>
                  )}
                </div>
              )
            })}
            {bonus > 0 && fila(
              <>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '13px' }}>Perfil completo</div>
                  <div style={{ fontSize: '11px', color: 'var(--text2)', marginTop: '2px' }}>Beneficio único</div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: '12px' }}>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--accent)' }}>+{bonus} 💎</div>
                  <div style={{ fontSize: '10px', color: 'var(--text2)' }}>{acum + bonus} acum.</div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </>,
    document.body
  )
}
