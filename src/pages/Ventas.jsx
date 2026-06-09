import PageLoader from '../components/PageLoader'
import ConfirmModal from '../components/ConfirmModal'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { formatFecha, formatTelefonoWA, transferenciaCerrada } from '../lib/utils'
import { notificar } from '../lib/push'

function calcularHorasLimite(fechaCarrera) {
  if (!fechaCarrera) return 24
  const ahora = new Date()
  const carrera = new Date(fechaCarrera + 'T23:59:00')
  const diffHs = (carrera - ahora) / (1000 * 60 * 60)
  if (diffHs > 168) return 24
  if (diffHs > 96)  return 12
  if (diffHs > 24)  return 6
  return 2
}

function calcularExpiracion(fechaCarrera) {
  const hs = calcularHorasLimite(fechaCarrera)
  const exp = new Date()
  exp.setHours(exp.getHours() + hs)
  return exp.toISOString()
}

function tiempoRestante(expiresAt) {
  const diff = new Date(expiresAt) - new Date()
  if (diff <= 0) return 'Tiempo agotado'
  const hs = Math.floor(diff / (1000 * 60 * 60))
  const min = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
  if (hs > 0) return `${hs}h ${min}m restantes`
  return `${min} min restantes`
}

const WpIcon = () => (
  <svg width="14" height="14" viewBox="0 0 32 32" fill="currentColor">
    <path d="M16 2C8.28 2 2 8.28 2 16c0 2.44.65 4.73 1.79 6.72L2 30l7.47-1.76A13.93 13.93 0 0 0 16 30c7.72 0 14-6.28 14-14S23.72 2 16 2zm0 25.5c-2.2 0-4.27-.6-6.04-1.64l-.43-.26-4.43 1.04 1.07-4.3-.28-.45A11.45 11.45 0 0 1 4.5 16C4.5 9.6 9.6 4.5 16 4.5S27.5 9.6 27.5 16 22.4 27.5 16 27.5zm6.27-8.57c-.34-.17-2.02-1-2.34-1.11-.32-.11-.55-.17-.78.17-.23.34-.9 1.11-1.1 1.34-.2.23-.4.26-.74.09-.34-.17-1.44-.53-2.74-1.69-1.01-.9-1.7-2.01-1.9-2.35-.2-.34-.02-.52.15-.69.15-.15.34-.4.51-.6.17-.2.23-.34.34-.57.11-.23.06-.43-.03-.6-.09-.17-.78-1.88-1.07-2.57-.28-.67-.57-.58-.78-.59h-.67c-.23 0-.6.09-.91.43-.32.34-1.2 1.17-1.2 2.86s1.23 3.32 1.4 3.55c.17.23 2.42 3.7 5.87 5.19.82.35 1.46.56 1.96.72.82.26 1.57.22 2.16.13.66-.1 2.02-.82 2.31-1.62.28-.8.28-1.48.2-1.62-.09-.14-.32-.23-.66-.4z"/>
  </svg>
)

export default function Ventas() {
  const { user } = useAuth()
  const [ventas, setVentas] = useState([])
  const [carreras, setCarreras] = useState([])
  const [miOferta, setMiOferta] = useState(null)   // oferta activa donde soy el comprador
  const [form, setForm] = useState({ carrera_id: '', distancia: '', precio: '', nota: '' })
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [editandoVenta, setEditandoVenta] = useState(null)
  const [editForm, setEditForm] = useState({ precio: '', nota: '', distancia: '' })
  const [confirmarCancelar, setConfirmarCancelar] = useState(null) // id a cancelar

  const avanzarCola = useCallback(async (venta, rechazadoId) => {
    const yaRechazados = [...(venta.rechazados || []), rechazadoId].filter(Boolean)

    let query = supabase
      .from('participaciones')
      .select('user_id, updated_at, distancia_elegida')
      .eq('carrera_id', venta.carrera_id)
      .eq('estado', 'Lista de espera')
      .neq('user_id', venta.vendedor_id)
      .order('updated_at')

    const { data: espera } = await query

    // Si la venta tiene distancia, filtrar por esa distancia
    const esperaFiltrada = venta.distancia
      ? (espera || []).filter(p => p.distancia_elegida === venta.distancia)
      : (espera || [])

    const siguiente = esperaFiltrada.find(p => !yaRechazados.includes(p.user_id))

    if (siguiente) {
      const expira = calcularExpiracion(venta.carrera?.fecha || venta.carreraFecha)
      await supabase.from('ventas_inscripciones').update({
        ofertado_a: siguiente.user_id,
        oferta_expira_at: expira,
        rechazados: yaRechazados,
        estado: 'ofertada',
      }).eq('id', venta.id)
      notificar(
        '🎉 ¡Hay un cupo disponible para vos!',
        `Alguien liberó su inscripción en ${venta.carrera?.nombre || 'una carrera'}. Entrá antes de que se agote.`,
        '/mas',
        { user_ids: [siguiente.user_id] }
      )
    } else {
      await supabase.from('ventas_inscripciones').update({
        ofertado_a: null,
        oferta_expira_at: null,
        rechazados: yaRechazados,
        estado: 'disponible',
      }).eq('id', venta.id)
    }
  }, [])

  const fetchAll = useCallback(async () => {
    const [{ data: cars }, { data: vsRaw }] = await Promise.all([
      supabase.from('carreras').select('id, nombre, fecha, distancias, distancia').gte('fecha', new Date().toISOString().split('T')[0]).order('fecha'),
      supabase.from('ventas_inscripciones')
        .select('*, carrera:carreras(nombre, fecha, hora)')
        .in('estado', ['disponible', 'ofertada', 'contactada'])
        .order('created_at'),
    ])

    // Las publicaciones de transferencia se ocultan automáticamente 2hs antes
    // del inicio de la carrera — pasado ese punto ya no tiene sentido ofrecer
    // o tomar un lugar (no llegaría a confirmarse a tiempo).
    const vsVigentes = (vsRaw || []).filter(v => !transferenciaCerrada(v.carrera?.fecha, v.carrera?.hora))

    // Enriquecer con datos del vendedor desde profiles
    const vendedorIds = [...new Set(vsVigentes.map(v => v.vendedor_id))]
    const { data: perfiles } = vendedorIds.length
      ? await supabase.from('profiles').select('id, nombre, telefono').in('id', vendedorIds)
      : { data: [] }
    const perfilesMap = Object.fromEntries((perfiles || []).map(p => [p.id, p]))
    const vs = vsVigentes.map(v => ({ ...v, vendedor: perfilesMap[v.vendedor_id] || null }))

    setCarreras(cars || [])
    setVentas(vs || [])

    // Verificar si hay oferta activa para mí
    const { data: ofertaRaw } = await supabase
      .from('ventas_inscripciones')
      .select('*, carrera:carreras(nombre, fecha)')
      .eq('ofertado_a', user.id)
      .in('estado', ['ofertada', 'contactada'])
      .maybeSingle()
    let oferta = ofertaRaw
    if (ofertaRaw) {
      const { data: vendedorPerfil } = await supabase
        .from('profiles').select('nombre, telefono').eq('id', ofertaRaw.vendedor_id).single()
      oferta = { ...ofertaRaw, vendedor: vendedorPerfil }
    }

    if (oferta && new Date(oferta.oferta_expira_at) < new Date()) {
      await avanzarCola(oferta, null)
      setMiOferta(null)
    } else {
      setMiOferta(oferta || null)
    }

    setLoading(false)
  }, [user.id, avanzarCola])

  useEffect(() => { fetchAll() }, [fetchAll])

  async function handlePublicar(e) {
    e.preventDefault()
    if (!form.carrera_id) { setError('Tenés que elegir una carrera'); return }
    setSaving(true)
    setError('')
    const carrera = carreras.find(c => c.id === form.carrera_id)

    const { data: espera } = await supabase
      .from('participaciones')
      .select('user_id, updated_at')
      .eq('carrera_id', form.carrera_id)
      .eq('estado', 'Lista de espera')
      .neq('user_id', user.id)
      .order('updated_at')

    // Filtrar cola por distancia si aplica
    const esperaFiltrada = form.distancia
      ? (espera || []).filter(p => p.distancia_elegida === form.distancia)
      : (espera || [])
    const primero = esperaFiltrada[0] || null
    const expira = primero ? calcularExpiracion(carrera?.fecha) : null

    const { error: insertError } = await supabase.from('ventas_inscripciones').insert([{
      carrera_id: form.carrera_id,
      distancia: form.distancia || null,
      vendedor_id: user.id,
      precio: parseFloat(form.precio) || null,
      nota: form.nota || null,
      estado: primero ? 'ofertada' : 'disponible',
      ofertado_a: primero?.user_id || null,
      oferta_expira_at: expira,
      rechazados: primero ? [primero.user_id] : [],
    }])

    if (insertError) {
      setError('Error al publicar: ' + insertError.message)
      setSaving(false)
      return
    }

    if (primero) {
      notificar(
        '🎉 ¡Hay un cupo disponible para vos!',
        `Alguien liberó su inscripción en ${carrera?.nombre || 'una carrera'}. Entrá antes de que se agote.`,
        '/mas',
        { user_ids: [primero.user_id] }
      )
    }

    setForm({ carrera_id: '', distancia: '', precio: '', nota: '' })
    setShowForm(false)
    setSaving(false)
    fetchAll()
  }

  // El interesado indica que se va a contactar → cambia estado a "contactada"
  async function handleMeInteresa(venta) {
    await supabase.from('ventas_inscripciones')
      .update({ estado: 'contactada' })
      .eq('id', venta.id)
    fetchAll()
  }

  // El interesado descarta la oferta
  async function handleNoMeInteresa(venta) {
    await avanzarCola(venta, user.id)
    setMiOferta(null)
    fetchAll()
  }

  // El VENDEDOR confirma que se vendió
  async function handleConfirmarVenta(venta) {
    await supabase.from('ventas_inscripciones').update({ estado: 'vendida' }).eq('id', venta.id)
    await supabase.from('participaciones')
      .update({ estado: 'Inscripto' })
      .eq('carrera_id', venta.carrera_id)
      .eq('user_id', venta.ofertado_a)
    fetchAll()
  }

  // El VENDEDOR indica que no se concretó → avanzar cola
  async function handleNoConcretada(venta) {
    await avanzarCola(venta, venta.ofertado_a)
    fetchAll()
  }

  function abrirEdicion(v) {
    setEditandoVenta(v.id)
    setEditForm({ precio: v.precio || '', nota: v.nota || '', distancia: v.distancia || '' })
  }

  async function handleGuardarEdicion(v) {
    setSaving(true)
    // Solo actualiza campos editables, sin tocar estado/cola/ofertado_a
    await supabase.from('ventas_inscripciones').update({
      precio: parseFloat(editForm.precio) || null,
      nota: editForm.nota || null,
      distancia: editForm.distancia || null,
    }).eq('id', v.id)
    setEditandoVenta(null)
    setSaving(false)
    fetchAll()
  }

  async function handleCancelarVenta(ventaId) {
    await supabase.from('ventas_inscripciones').update({ estado: 'cancelada' }).eq('id', ventaId)
    setConfirmarCancelar(null)
    fetchAll()
  }

  const misVentas = ventas.filter(v => v.vendedor_id === user.id)
  const ventasOtros = ventas.filter(v => v.vendedor_id !== user.id && v.estado === 'disponible')

  if (loading) return <PageLoader />

  return (
    <div className="page">
      <div className="page-header">
        <h2>Inscripciones</h2>
        <button className="btn-accent" onClick={() => setShowForm(s => !s)}>
          {showForm ? 'Cancelar' : '+ Transferir inscripción'}
        </button>
      </div>

      <div style={{ fontSize: '13px', color: 'var(--text2)', marginBottom: '16px', marginTop: '-8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <p style={{ margin: 0 }}>🔁 <strong>Para quien transfiere:</strong> Publicá tu lugar si no podés correr. El primer interesado de la lista de espera puede contactarte por WhatsApp. Si no lo hace, pasa al siguiente.</p>
        <p style={{ margin: 0 }}>⏳ <strong>Para quien espera:</strong> Se notificará a las personas de la lista de espera según el orden en el que se anotaron.</p>
      </div>

      {/* ALERTA: oferta activa para mí como comprador */}
      {miOferta && (
        <div className="card" style={{ marginBottom: '12px', border: '1px solid rgba(251,191,36,0.4)', background: 'rgba(251,191,36,0.06)' }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#fbbf24', marginBottom: '10px' }}>
            🔔 ¡Hay una inscripción disponible para vos!
          </div>
          <div style={{ fontWeight: 600, marginBottom: '4px' }}>{miOferta.carrera?.nombre}</div>
          {miOferta.carrera?.fecha && <span className="tag" style={{ display: 'inline-block', marginBottom: '8px' }}>📅 {formatFecha(miOferta.carrera.fecha)}</span>}
          {miOferta.distancia && <div style={{ fontSize: '13px', color: 'var(--text2)', marginBottom: '4px' }}>📏 {miOferta.distancia}</div>}
          {miOferta.precio && <div style={{ fontSize: '14px', margin: '6px 0' }}>💰 ${Number(miOferta.precio).toLocaleString()}</div>}
          {miOferta.nota && <div style={{ fontSize: '13px', color: 'var(--text2)', marginBottom: '8px' }}>📝 {miOferta.nota}</div>}
          <div style={{ fontSize: '12px', color: 'var(--text2)', marginBottom: '4px' }}>
            Vendedor: <strong style={{ color: 'var(--text)' }}>{miOferta.vendedor?.nombre}</strong>
          </div>
          <div style={{ fontSize: '11px', color: '#fbbf24', marginBottom: '12px' }}>
            ⏱ {tiempoRestante(miOferta.oferta_expira_at)}
          </div>

          {miOferta.estado === 'ofertada' && (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <a
                href={`https://wa.me/${formatTelefonoWA(miOferta.vendedor?.telefono || '')}`}
                target="_blank" rel="noopener noreferrer"
                className="btn-primary"
                style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px', height: '40px', padding: '0 16px', fontSize: '14px' }}
                onClick={() => handleMeInteresa(miOferta)}
              >
                <WpIcon /> Me interesa — contactar
              </a>
              <button className="btn-ghost" onClick={() => handleNoMeInteresa(miOferta)}>No me interesa</button>
            </div>
          )}

          {miOferta.estado === 'contactada' && (
            <div>
              <div style={{ fontSize: '13px', color: '#4ade80', marginBottom: '8px' }}>
                ✅ Ya te contactaste con el vendedor. Una vez que lo confirme, quedará registrado.
              </div>
              <button className="btn-ghost" style={{ fontSize: '12px' }} onClick={() => handleNoMeInteresa(miOferta)}>
                No llegamos a un acuerdo
              </button>
            </div>
          )}
        </div>
      )}

      {/* FORM */}
      {showForm && (
        <form className="card form-card" onSubmit={handlePublicar} noValidate>
          <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '14px' }}>Transferir inscripción</h3>
          <div className="form-grid">
            <div className="field full">
              <label>Carrera *</label>
              <select value={form.carrera_id} onChange={e => setForm({ ...form, carrera_id: e.target.value, distancia: '' })} required>
                <option value="">— Elegí una carrera —</option>
                {carreras.map(c => (
                  <option key={c.id} value={c.id}>{c.nombre}{c.fecha ? ` — ${formatFecha(c.fecha)}` : ''}</option>
                ))}
              </select>
            </div>
            {(() => {
              const carreraSeleccionada = carreras.find(c => c.id === form.carrera_id)
              const dists = carreraSeleccionada?.distancias?.length > 1 ? carreraSeleccionada.distancias : null
              if (!dists) return null
              return (
                <div className="field full">
                  <label>Distancia *</label>
                  <select value={form.distancia} onChange={e => setForm({ ...form, distancia: e.target.value })} required>
                    <option value="">— Elegí la distancia —</option>
                    {dists.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
              )
            })()}
            <div className="field">
              <label>Precio ($)</label>
              <input type="number" min="0" value={form.precio} onChange={e => setForm({ ...form, precio: e.target.value })} placeholder="Lo que pagaste" />
            </div>
            <div className="field full">
              <label>Detalle (opcional)</label>
              <input value={form.nota} onChange={e => setForm({ ...form, nota: e.target.value })} placeholder="Con remera talle M, sin kit, etc." />
            </div>
          </div>
          {error && <div className="error-msg" style={{ marginTop: '8px' }}>{error}</div>}
          <div className="form-actions">
            <button type="button" className="btn-ghost" onClick={() => setShowForm(false)}>Cancelar</button>
            <button type="submit" className="btn-primary" disabled={saving} style={{ height: '40px', padding: '0 20px', fontSize: '14px' }}>{saving ? 'Publicando...' : 'Publicar'}</button>
          </div>
        </form>
      )}

      {/* MIS PUBLICACIONES (vendedor) */}
      {misVentas.length > 0 && (
        <>
          <h3 style={{ fontSize: '13px', color: 'var(--text2)', margin: '16px 0 8px' }}>Mis publicaciones</h3>
          {misVentas.map(v => (
            <div key={v.id} className="card" style={{ marginBottom: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, marginBottom: '4px' }}>{v.carrera?.nombre}</div>
                  {v.carrera?.fecha && <span className="tag">📅 {formatFecha(v.carrera.fecha)}</span>}
                  {v.precio && <div style={{ fontSize: '14px', marginTop: '6px' }}>💰 ${Number(v.precio).toLocaleString()}</div>}
                  {v.nota && <div style={{ fontSize: '12px', color: 'var(--text2)', marginTop: '4px' }}>📝 {v.nota}</div>}
                  <div style={{ fontSize: '12px', marginTop: '8px' }}>
                    {v.estado === 'disponible' && <span style={{ color: '#4ade80' }}>✅ Disponible — sin interesados aún</span>}
                    {v.estado === 'ofertada' && <span style={{ color: '#fbbf24' }}>⏳ Ofrecida — esperando respuesta</span>}
                    {v.estado === 'contactada' && (
                      <div>
                        <div style={{ color: '#60a5fa', marginBottom: '8px' }}>📞 Alguien se contactó con vos. ¿Se concretó?</div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button className="btn-primary" style={{ height: 32, fontSize: 12, padding: '0 12px' }} onClick={() => handleConfirmarVenta(v)}>
                            ✓ Sí, se vendió
                          </button>
                          <button className="btn-ghost" style={{ height: 32, fontSize: 12, padding: '0 12px' }} onClick={() => handleNoConcretada(v)}>
                            No se concretó
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    className="btn-ghost"
                    style={{ height: 30, fontSize: 11, padding: '0 10px' }}
                    onClick={() => editandoVenta === v.id ? setEditandoVenta(null) : abrirEdicion(v)}
                  >
                    {editandoVenta === v.id ? 'Cancelar' : 'Editar'}
                  </button>
                  <button className="btn-icon danger" onClick={() => setConfirmarCancelar(v.id)} title="Cancelar publicación">✕</button>
                </div>
              </div>

              {editandoVenta === v.id && (
                <div style={{ marginTop: '12px', borderTop: '1px solid var(--border)', paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {(() => {
                    const carreraSeleccionada = carreras.find(c => c.id === v.carrera_id)
                    const dists = carreraSeleccionada?.distancias?.length > 1 ? carreraSeleccionada.distancias : null
                    if (!dists) return null
                    return (
                      <div>
                        <label style={{ fontSize: '12px', color: 'var(--text2)', display: 'block', marginBottom: '4px' }}>Distancia</label>
                        <select value={editForm.distancia} onChange={e => setEditForm(f => ({ ...f, distancia: e.target.value }))} style={{ fontSize: '13px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text)', padding: '6px 10px', width: '100%' }}>
                          <option value="">— Sin especificar —</option>
                          {dists.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                      </div>
                    )
                  })()}
                  <div>
                    <label style={{ fontSize: '12px', color: 'var(--text2)', display: 'block', marginBottom: '4px' }}>Precio ($)</label>
                    <input type="number" min="0" value={editForm.precio} onChange={e => setEditForm(f => ({ ...f, precio: e.target.value }))} placeholder="Lo que pagaste" style={{ fontSize: '13px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text)', padding: '6px 10px', width: '100%', boxSizing: 'border-box', fontFamily: 'inherit' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', color: 'var(--text2)', display: 'block', marginBottom: '4px' }}>Detalle</label>
                    <input value={editForm.nota} onChange={e => setEditForm(f => ({ ...f, nota: e.target.value }))} placeholder="Con remera talle M, sin kit, etc." style={{ fontSize: '13px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text)', padding: '6px 10px', width: '100%', boxSizing: 'border-box', fontFamily: 'inherit' }} />
                  </div>
                  <button className="btn-primary" style={{ height: 34, fontSize: 13, padding: '0 16px', alignSelf: 'flex-end' }} disabled={saving} onClick={() => handleGuardarEdicion(v)}>
                    {saving ? '...' : 'Guardar cambios'}
                  </button>
                </div>
              )}
            </div>
          ))}
        </>
      )}

      {/* DISPONIBLES (otros vendedores, sin lista de espera activa) */}
      {ventasOtros.length > 0 && (
        <>
          <h3 style={{ fontSize: '13px', color: 'var(--text2)', margin: '16px 0 8px' }}>Disponibles</h3>
          {ventasOtros.map(v => (
            <div key={v.id} className="card" style={{ marginBottom: '8px' }}>
              <div style={{ fontWeight: 600, marginBottom: '4px' }}>{v.carrera?.nombre}</div>
              {v.carrera?.fecha && <span className="tag">📅 {formatFecha(v.carrera.fecha)}</span>}
              {v.precio && <div style={{ fontSize: '14px', marginTop: '6px' }}>💰 ${Number(v.precio).toLocaleString()}</div>}
              {v.nota && <div style={{ fontSize: '12px', color: 'var(--text2)', marginTop: '6px' }}>📝 {v.nota}</div>}
              <div style={{ fontSize: '12px', color: 'var(--text2)', marginTop: '6px' }}>
                Transfiere: <strong style={{ color: 'var(--text)' }}>{v.vendedor?.nombre}</strong>
              </div>
              {v.vendedor?.telefono && (
                <a
                  href={`https://wa.me/${formatTelefonoWA(v.vendedor.telefono)}`}
                  target="_blank" rel="noopener noreferrer"
                  className="race-link"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginTop: '8px' }}
                >
                  <WpIcon /> Contactar por WhatsApp
                </a>
              )}
            </div>
          ))}
        </>
      )}

      {misVentas.length === 0 && ventasOtros.length === 0 && !miOferta && (
        <div className="empty-state">No hay inscripciones disponibles para transferir</div>
      )}

      {confirmarCancelar && (
        <ConfirmModal
          mensaje="¿Cancelar la publicación de tu inscripción?"
          onConfirm={() => handleCancelarVenta(confirmarCancelar)}
          onCancel={() => setConfirmarCancelar(null)}
        />
      )}
    </div>
  )
}
