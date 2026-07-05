import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'

// Panel de plataforma (super-admin). Primer paso de la herramienta multi-equipo:
// por ahora solo lista los clubes existentes (Flama es el club #1). Crear clubes,
// impersonar y gestionar planes vienen en pasos siguientes.
const PLAN_LABEL = { free: 'Free', pro: 'Pro', premium: 'Premium' }
const ESTADO_COLOR = {
  activo: { bg: 'rgba(74,222,128,0.15)', fg: '#4ade80', br: 'rgba(74,222,128,0.3)' },
  suspendido: { bg: 'rgba(248,113,113,0.15)', fg: '#f87171', br: 'rgba(248,113,113,0.3)' },
  prueba: { bg: 'rgba(251,191,36,0.15)', fg: '#fbbf24', br: 'rgba(251,191,36,0.3)' },
}

export default function SuperAdmin() {
  const { esSuperAdmin, loading: authLoading } = useAuth()
  const [clubs, setClubs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!esSuperAdmin) return
    let vivo = true
    async function fetchClubs() {
      setLoading(true)
      const { data, error } = await supabase
        .from('clubs')
        .select('id, slug, nombre, plan, es_cortesia, estado, created_at')
        .order('created_at', { ascending: true })
      if (!vivo) return
      if (error) setError(error.message)
      else setClubs(data || [])
      setLoading(false)
    }
    fetchClubs()
    return () => { vivo = false }
  }, [esSuperAdmin])

  if (authLoading) return null

  if (!esSuperAdmin) {
    return (
      <div style={{ padding: '24px 16px' }}>
        <div className="empty-state">No tenés acceso a esta sección.</div>
      </div>
    )
  }

  return (
    <div style={{ padding: '16px', maxWidth: 720, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
        <h2 style={{ margin: 0 }}>Plataforma</h2>
        <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 7px', borderRadius: '20px', background: 'rgba(96,165,250,0.15)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.3)' }}>super-admin</span>
      </div>
      <div style={{ fontSize: '13px', color: 'var(--text2)', marginBottom: '18px' }}>
        Clubes en la plataforma. {clubs.length > 0 && `(${clubs.length})`}
      </div>

      {error && (
        <div className="empty-state" style={{ color: '#f87171' }}>
          No se pudieron cargar los clubes.<br />
          <span style={{ fontSize: '12px', color: 'var(--text2)' }}>
            ¿Corriste la migración de la fundación multi-tenant? ({error})
          </span>
        </div>
      )}

      {loading && !error && <div className="empty-state">Cargando...</div>}

      {!loading && !error && clubs.length === 0 && (
        <div className="empty-state">Todavía no hay clubes cargados.</div>
      )}

      {!loading && !error && clubs.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {clubs.map(c => {
            const est = ESTADO_COLOR[c.estado] || ESTADO_COLOR.activo
            return (
              <div key={c.id} className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: '15px' }}>{c.nombre}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text2)', marginTop: '2px' }}>
                    /{c.slug}{c.es_cortesia ? ' · cortesía' : ''}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 9px', borderRadius: '20px', background: 'var(--bg3)', color: 'var(--text2)', border: '1px solid var(--border)' }}>
                    {PLAN_LABEL[c.plan] || c.plan}
                  </span>
                  <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 9px', borderRadius: '20px', background: est.bg, color: est.fg, border: `1px solid ${est.br}` }}>
                    {c.estado}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div style={{ fontSize: '11px', color: 'var(--text2)', marginTop: '20px', lineHeight: 1.5, fontStyle: 'italic' }}>
        Próximos pasos: crear clubes, impersonar ("entrar como") y gestión de planes.
      </div>
    </div>
  )
}
