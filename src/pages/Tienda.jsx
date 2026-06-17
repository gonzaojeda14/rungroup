import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { notificar } from '../lib/push'
import ConfirmModal from '../components/ConfirmModal'

const CLOUD  = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME
const PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET

const TALLES_ROPA       = ['XS', 'S', 'M', 'L', 'XL', 'XXL']
const TALLES_ZAPATILLAS = ['35','36','37','38','39','40','41','42','43','44']

function tallesDefecto(tipo) {
  if (tipo === 'ropa')       return [...TALLES_ROPA]
  if (tipo === 'zapatillas') return [...TALLES_ZAPATILLAS]
  return []
}

async function uploadCloudinary(file, folder) {
  const fd = new FormData()
  fd.append('file', file)
  fd.append('upload_preset', PRESET)
  fd.append('folder', folder)
  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD}/image/upload`, { method: 'POST', body: fd })
  return res.json()
}

// ─── ROOT ─────────────────────────────────────────────────────────────────────

const TIENDA_BETA = ['ojeda.gonza@hotmail.com']

export default function Tienda() {
  const { isAdmin, user } = useAuth()
  const [config, setConfig] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('tienda_config').select('*').eq('id', 1).maybeSingle()
      .then(({ data }) => { setConfig(data || {}); setLoading(false) })
  }, [])

  if (loading) return <Cargando />
  if (isAdmin) return <TiendaAdmin config={config} onConfigChange={setConfig} />
  if (config?.activa) return <TiendaPublica config={config} />
  return <TiendaProximamente />
}

// ─── PRÓXIMAMENTE ─────────────────────────────────────────────────────────────

function TiendaProximamente() {
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:'50vh', gap:12, padding:24, textAlign:'center' }}>
      <span style={{ fontSize:48 }}>🛍️</span>
      <div style={{ fontWeight:700, fontSize:20 }}>Tienda</div>
      <div style={{ color:'var(--text2)', fontSize:14, maxWidth:260 }}>
        Próximamente vas a poder comprar merch de Flama directamente desde acá.
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN
// ─────────────────────────────────────────────────────────────────────────────

function TiendaAdmin({ config, onConfigChange }) {
  const [tab, setTab] = useState(() => {
    const p = new URLSearchParams(window.location.search)
    return p.get('subtab') === 'Compras' ? 'Compras' : 'Productos'
  })
  const [productos, setProductos] = useState([])
  const [pedidos, setPedidos] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [editandoProducto, setEditandoProducto] = useState(null)
  const [confirmarEliminar, setConfirmarEliminar] = useState(null)
  const [fotoAmpliada, setFotoAmpliada] = useState(null)
  const [toast, setToast] = useState('')

  // Config draft
  const [alias, setAlias] = useState(config?.alias || '')
  const [cbu, setCbu] = useState(config?.cbu || '')
  const [activa, setActiva] = useState(config?.activa ?? false)
  const [guardandoConfig, setGuardandoConfig] = useState(false)

  useEffect(() => {
    fetchProductos()
    fetchPedidos()
    const ch = supabase.channel('tienda-pedidos-admin-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos' }, fetchPedidos)
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [])

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 2500) }

  async function fetchProductos() {
    const { data } = await supabase.from('productos').select('*').order('created_at', { ascending: false })
    setProductos(data || [])
  }

  async function fetchPedidos() {
    const { data } = await supabase
      .from('pedidos')
      .select('*, perfil:user_id(nombre)')
      .order('created_at', { ascending: false })
    setPedidos(data || [])
  }

  async function guardarConfig() {
    setGuardandoConfig(true)
    const updated = { id:1, alias:alias||null, cbu:cbu||null, activa, updated_at: new Date().toISOString() }
    await supabase.from('tienda_config').upsert(updated)
    onConfigChange(updated)
    setGuardandoConfig(false)
    showToast('✅ Configuración guardada')
  }

  async function toggleDisponible(p) {
    await supabase.from('productos').update({ disponible: !p.disponible }).eq('id', p.id)
    setProductos(prev => prev.map(x => x.id === p.id ? { ...x, disponible: !x.disponible } : x))
  }

  async function eliminarProducto(p) {
    await supabase.from('productos').delete().eq('id', p.id)
    setProductos(prev => prev.filter(x => x.id !== p.id))
    setConfirmarEliminar(null)
    showToast('🗑 Producto eliminado')
  }

  async function actualizarEstado(pedidoId, estado) {
    await supabase.from('pedidos').update({ estado }).eq('id', pedidoId)
    setPedidos(prev => prev.map(p => p.id === pedidoId ? { ...p, estado } : p))
    const pedido = pedidos.find(p => p.id === pedidoId)
    if (estado === 'confirmado' && pedido?.user_id) {
      notificar(
        '✅ Pago confirmado',
        'Recibimos tu pago. Pronto te contactamos para coordinar la entrega 📦',
        '/mas?tab=Tienda',
        { user_ids: [pedido.user_id] }
      )
    }
  }

  async function solicitarSaldo(pedidoId) {
    const pedido = pedidos.find(p => p.id === pedidoId)
    if (!pedido?.user_id) return
    notificar(
      '🎉 Ya falta poco para tener tu pedido',
      'Podés abonar el saldo restante cuando quieras desde Mis Pedidos.',
      '/mas?tab=Tienda&vista=pedidos',
      { user_ids: [pedido.user_id] }
    )
  }

  const pendientes = pedidos.filter(p => p.estado === 'pendiente').length
  const senados    = pedidos.filter(p => p.estado === 'senado').length
  const [filtroCompras, setFiltroCompras] = useState('pendiente')

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>

      {/* Tabs — ancho completo con subrayado */}
      <div style={{ display:'flex', borderBottom:'1px solid var(--border)', flexShrink:0 }}>
        {['Productos','Compras','🧹'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{ position:'relative', flex:1, padding:'12px 4px', border:'none', background:'none', cursor:'pointer', fontSize:13, fontWeight: tab===t ? 700 : 400, color: tab===t ? 'var(--accent)' : 'var(--text2)', borderBottom: tab===t ? '2px solid var(--accent)' : '2px solid transparent', fontFamily:'inherit', transition:'all .15s' }}>
            {t}
            {t === 'Compras' && pendientes > 0 && (
              <span style={{ position:'absolute', top:6, marginLeft:4, background:'var(--accent)', color:'#fff', fontSize:9, fontWeight:800, borderRadius:99, minWidth:14, height:14, display:'inline-flex', alignItems:'center', justifyContent:'center', padding:'0 3px', lineHeight:1 }}>{pendientes}</span>
            )}
          </button>
        ))}
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:16, display:'flex', flexDirection:'column', gap:16 }}>

        {/* ── PRODUCTOS ── */}
        {tab === 'Productos' && <>

          {/* Config */}
          <div className="card" style={{ padding:'14px 16px', display:'flex', flexDirection:'column', gap:10 }}>
            <div style={{ fontWeight:700, fontSize:13, color:'var(--text2)', textTransform:'uppercase', letterSpacing:1 }}>Configuración</div>
            <div style={{ display:'flex', gap:8 }}>
              <input value={alias} onChange={e => setAlias(e.target.value)} placeholder="Alias MP" style={iStyle} />
              <input value={cbu} onChange={e => setCbu(e.target.value)} placeholder="CBU" style={iStyle} />
            </div>
            {(config?.alias || config?.cbu) && (
              <div style={{ fontSize:12, color:'var(--text2)', display:'flex', gap:16 }}>
                {config.alias && <span>Alias guardado: <strong style={{ color:'var(--text)' }}>{config.alias}</strong></span>}
                {config.cbu   && <span>CBU guardado: <strong style={{ color:'var(--text)' }}>{config.cbu}</strong></span>}
              </div>
            )}
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <label style={{ display:'flex', alignItems:'center', gap:8, fontSize:13, cursor:'pointer' }}>
                <input type="checkbox" checked={activa} onChange={e => setActiva(e.target.checked)}
                  style={{ width:15, height:15, accentColor:'var(--accent)', cursor:'pointer' }} />
                Tienda visible para corredores
              </label>
              <button onClick={guardarConfig} disabled={guardandoConfig} className="btn-accent" style={{ height:32, padding:'0 14px', fontSize:12 }}>
                {guardandoConfig ? '...' : 'Guardar'}
              </button>
            </div>
          </div>

          {/* Lista productos */}
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <div style={{ fontWeight:700, fontSize:15 }}>Productos ({productos.length})</div>
            <button className="btn-accent" style={{ height:34, padding:'0 14px', fontSize:13 }} onClick={() => {
              setEditandoProducto(null)
              setShowForm(v => !v)
            }}>
              {showForm ? 'Cancelar' : '+ Nuevo'}
            </button>
          </div>

          {showForm && (
            <ProductoForm
              key={editandoProducto?.id || 'nuevo'}
              producto={editandoProducto}
              onSaved={() => {
                setShowForm(false)
                setEditandoProducto(null)
                fetchProductos()
                showToast(editandoProducto ? '✅ Producto actualizado' : '✅ Producto publicado')
              }}
              onCancel={() => { setShowForm(false); setEditandoProducto(null) }}
            />
          )}

          {productos.length === 0 && !showForm && (
            <div style={{ textAlign:'center', color:'var(--text2)', fontSize:14, padding:'32px 0' }}>No hay productos.</div>
          )}

          {productos.map(p => (
            <ProductoCardAdmin key={p.id} p={p}
              onToggle={() => toggleDisponible(p)}
              onEditar={() => { setEditandoProducto(p); setShowForm(true) }}
              onEliminar={() => setConfirmarEliminar(p)}
              onVerFoto={setFotoAmpliada} />
          ))}
        </>}

        {/* ── COMPRAS ── */}
        {tab === 'Compras' && <>
          {/* Filtro — ancho completo */}
          <div style={{ display:'flex', background:'var(--bg3)', borderRadius:10, padding:3, gap:2 }}>
            {['pendiente','senado','confirmado','entregado'].map(f => {
              const labels = { pendiente:'Pendientes', senado:'Señados', confirmado:'Confirmados', entregado:'Entregados' }
              const activo = filtroCompras === f
              const badge  = f === 'pendiente' ? pendientes : f === 'senado' ? senados : 0
              return (
                <button key={f} onClick={() => setFiltroCompras(f)}
                  style={{ flex:1, padding:'6px 0', fontSize:11, fontWeight: activo ? 700 : 500, color: activo ? '#fff' : 'var(--text2)', background: activo ? 'var(--accent)' : 'transparent', border:'none', cursor:'pointer', borderRadius:8, position:'relative' }}>
                  {labels[f]}
                  {badge > 0 && (
                    <span style={{ position:'absolute', top:2, right:4, background: activo ? '#fff' : 'var(--accent)', color: activo ? 'var(--accent)' : '#fff', fontSize:9, fontWeight:800, borderRadius:99, minWidth:14, height:14, display:'inline-flex', alignItems:'center', justifyContent:'center', padding:'0 3px' }}>{badge}</span>
                  )}
                </button>
              )
            })}
          </div>

          {(() => {
            const filtrados = pedidos.filter(p => p.estado === filtroCompras)
            const vacioLabel = { pendiente:'pendientes', senado:'señados', confirmado:'confirmados', entregado:'entregados' }
            if (filtrados.length === 0) return (
              <div style={{ textAlign:'center', color:'var(--text2)', fontSize:14, padding:'32px 0' }}>
                No hay pedidos {vacioLabel[filtroCompras] || filtroCompras}.
              </div>
            )
            return filtrados.map(p => (
              <PedidoAdminCard key={p.id} pedido={p}
                onVerFoto={url => setFotoAmpliada(url)}
                onEstado={estado => actualizarEstado(p.id, estado)}
                onSolicitarSaldo={() => solicitarSaldo(p.id)} />
            ))
          })()}
        </>}

        {/* ── LIMPIEZA ── */}
        {tab === '🧹' && <LimpiezaPanel />}

      </div>

      {toast && <Toast msg={toast} />}

      {confirmarEliminar && (
        <ConfirmModal
          mensaje={`¿Eliminar "${confirmarEliminar.nombre}"?`}
          onConfirm={() => eliminarProducto(confirmarEliminar)}
          onCancel={() => setConfirmarEliminar(null)} />
      )}

      {fotoAmpliada && (
        <div onClick={() => setFotoAmpliada(null)}
          style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.9)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
          <img src={fotoAmpliada} alt="" style={{ maxWidth:'100%', maxHeight:'90vh', borderRadius:8, objectFit:'contain' }} />
          <button onClick={() => setFotoAmpliada(null)}
            style={{ position:'absolute', top:16, right:16, width:36, height:36, borderRadius:'50%', background:'rgba(255,255,255,0.15)', border:'none', color:'#fff', fontSize:18, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>✕</button>
        </div>
      )}
    </div>
  )
}

// ─── LIMPIEZA DE DATOS ───────────────────────────────────────────────────────

function LimpiezaPanel() {
  const ITEMS = [
    {
      tipo:       'comprobantes',
      titulo:     '🧾 Comprobantes de pago',
      desc:       'Fotos de transferencia de pedidos entregados hace más de 90 días.',
      accion:     'Eliminar imágenes + limpiar URLs en pedidos',
    },
    {
      tipo:       'flamitas',
      titulo:     '🔥 Fotos de Flamitas',
      desc:       'Fotos de validación de puntos enviadas hace más de 1 año.',
      accion:     'Eliminar imágenes + limpiar URLs en puntos_carreras',
    },
    {
      tipo:       'fotos',
      titulo:     '📷 Fotos de carreras',
      desc:       'Fotos de carreras subidas hace más de 1 año.',
      accion:     'Eliminar registros + imágenes en Cloudinary',
    },
  ]

  // Estado por tipo: { count: null|number, calculando: bool, limpiando: bool, confirmando: bool, resultado: null|number }
  const [estado, setEstado] = useState(() =>
    Object.fromEntries(ITEMS.map(i => [i.tipo, { count: null, calculando: false, limpiando: false, confirmando: false, resultado: null }]))
  )

  function set(tipo, patch) {
    setEstado(prev => ({ ...prev, [tipo]: { ...prev[tipo], ...patch } }))
  }

  async function calcular(tipo) {
    set(tipo, { calculando: true, count: null, resultado: null, confirmando: false })
    const { data, error } = await supabase.functions.invoke('cleanup-images', {
      body: { tipo, dry_run: true }
    })
    if (error || data?.error) {
      set(tipo, { calculando: false, count: -1 })
    } else {
      set(tipo, { calculando: false, count: data.count ?? 0 })
    }
  }

  async function ejecutar(tipo) {
    set(tipo, { limpiando: true, confirmando: false })
    const { data, error } = await supabase.functions.invoke('cleanup-images', {
      body: { tipo, dry_run: false }
    })
    if (error || data?.error) {
      set(tipo, { limpiando: false, resultado: -1 })
    } else {
      set(tipo, { limpiando: false, resultado: data.deleted ?? 0, count: null })
    }
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
      <div style={{ fontSize:13, color:'var(--text2)', lineHeight:1.5 }}>
        Elimina imágenes de Cloudinary que ya no son necesarias y libera espacio de almacenamiento. La limpieza automática de suscripciones push (+6 meses) y carritos abandonados (+30 días) ya está configurada.
      </div>

      {ITEMS.map(item => {
        const e = estado[item.tipo]
        return (
          <div key={item.tipo} className="card" style={{ padding:'14px 16px', display:'flex', flexDirection:'column', gap:10 }}>
            <div style={{ fontWeight:700, fontSize:14 }}>{item.titulo}</div>
            <div style={{ fontSize:13, color:'var(--text2)' }}>{item.desc}</div>
            <div style={{ fontSize:11, color:'var(--text2)', fontStyle:'italic' }}>{item.accion}</div>

            {/* Resultado previo */}
            {e.resultado !== null && e.resultado >= 0 && (
              <div style={{ fontSize:13, color:'#4ade80' }}>✅ {e.resultado} {e.resultado === 1 ? 'imagen eliminada' : 'imágenes eliminadas'}</div>
            )}
            {(e.count === -1 || e.resultado === -1) && (
              <div style={{ fontSize:13, color:'#f87171' }}>⚠️ Error al conectar con el servidor</div>
            )}

            {/* Count preview */}
            {e.count !== null && e.count >= 0 && e.resultado === null && (
              <div style={{ fontSize:13, color: e.count === 0 ? 'var(--text2)' : '#fbbf24' }}>
                {e.count === 0 ? '✓ Nada para limpiar por ahora' : `${e.count} ${e.count === 1 ? 'imagen encontrada' : 'imágenes encontradas'}`}
              </div>
            )}

            <div style={{ display:'flex', gap:8 }}>
              <button onClick={() => calcular(item.tipo)} disabled={e.calculando || e.limpiando}
                style={{ flex:1, height:34, fontSize:12, fontWeight:600, border:'1px solid var(--border)', background:'transparent', color:'var(--text)', borderRadius:8, cursor:'pointer', opacity: e.calculando ? 0.6 : 1 }}>
                {e.calculando ? 'Calculando…' : 'Calcular'}
              </button>

              {!e.confirmando && !e.limpiando && e.count > 0 && e.resultado === null && (
                <button onClick={() => set(item.tipo, { confirmando: true })} disabled={e.limpiando}
                  style={{ flex:1, height:34, fontSize:12, fontWeight:600, border:'none', background:'#ef4444', color:'#fff', borderRadius:8, cursor:'pointer' }}>
                  Limpiar
                </button>
              )}

              {e.confirmando && (
                <>
                  <button onClick={() => set(item.tipo, { confirmando: false })}
                    style={{ flex:1, height:34, fontSize:12, border:'1px solid var(--border)', background:'transparent', color:'var(--text2)', borderRadius:8, cursor:'pointer' }}>
                    Cancelar
                  </button>
                  <button onClick={() => ejecutar(item.tipo)}
                    style={{ flex:1, height:34, fontSize:12, fontWeight:700, border:'none', background:'#ef4444', color:'#fff', borderRadius:8, cursor:'pointer' }}>
                    ¿Confirmar?
                  </button>
                </>
              )}

              {e.limpiando && (
                <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, color:'var(--text2)' }}>Limpiando…</div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── FORM NUEVO PRODUCTO ──────────────────────────────────────────────────────

function ProductoForm({ producto, onSaved, onCancel }) {
  const editando = !!producto
  const [nombre, setNombre]           = useState(producto?.nombre || '')
  const [descripcion, setDescripcion] = useState(producto?.descripcion || '')
  const [precio, setPrecio]           = useState(producto?.precio != null ? String(producto.precio) : '')
  const [tipoTalle, setTipoTalle]     = useState(producto?.tipo_talle || 'unico')
  const [talles, setTalles]           = useState(producto?.talles_disponibles || [])
  const [genero, setGenero]           = useState(producto?.genero || 'Unisex')
  // Fotos ya subidas en Cloudinary (solo URLs)
  const [fotosExistentes, setFotosExistentes] = useState(
    producto ? ((producto.fotos || []).length > 0 ? producto.fotos : (producto.foto_url ? [producto.foto_url] : [])) : []
  )
  // Fotos nuevas a subir
  const [fotosNuevas, setFotosNuevas] = useState([]) // [{file, preview}]
  const [saving, setSaving]           = useState(false)
  const fotoRef = useRef()

  function onTipoChange(tipo) {
    setTipoTalle(tipo)
    if (!editando) setTalles(tallesDefecto(tipo))
  }

  function toggleTalle(t) {
    setTalles(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])
  }

  function agregarFotos(e) {
    const files = Array.from(e.target.files)
    const nuevas = files.map(f => ({ file: f, preview: URL.createObjectURL(f) }))
    setFotosNuevas(prev => [...prev, ...nuevas])
    fotoRef.current.value = ''
  }

  function quitarExistente(idx) {
    setFotosExistentes(prev => prev.filter((_, i) => i !== idx))
  }

  function quitarNueva(idx) {
    setFotosNuevas(prev => prev.filter((_, i) => i !== idx))
  }

  const totalFotos = fotosExistentes.length + fotosNuevas.length

  async function handleSubmit(e) {
    e.preventDefault()
    if (!nombre || !precio) return
    setSaving(true)

    try {
      // Subir fotos nuevas
      const urlsNuevas = await Promise.all(
        fotosNuevas.map(f => uploadCloudinary(f.file, 'flamarun/tienda').then(d => d.secure_url).catch(() => null))
      )
      const fotosUrls = [...fotosExistentes, ...urlsNuevas.filter(Boolean)]

      const payload = {
        nombre,
        descripcion: descripcion || null,
        precio:      parseFloat(precio),
        tipo_talle:  tipoTalle,
        talles_disponibles: talles,
        genero,
        foto_url: fotosUrls[0] || null,
        fotos:    fotosUrls,
      }

      let error
      if (editando) {
        ;({ error } = await supabase.from('productos').update(payload).eq('id', producto.id))
      } else {
        ;({ error } = await supabase.from('productos').insert([payload]))
      }

      if (error) throw new Error(error.message)

      // Notificar nuevo producto (máx 1 notif por hora aunque se suban varios)
      if (!editando) {
        const { data: cfg } = await supabase.from('tienda_config').select('ultima_notif_producto').eq('id', 1).maybeSingle()
        const ultima = cfg?.ultima_notif_producto ? new Date(cfg.ultima_notif_producto) : null
        const haceUnaHora = new Date(Date.now() - 60 * 60 * 1000)
        if (!ultima || ultima < haceUnaHora) {
          notificar(
            '🛍️ ¡Nuevo en la Tienda!',
            `${payload.nombre} ya está disponible. ¡Miralo!`,
            '/mas?tab=Tienda',
            { all: true }
          )
          await supabase.from('tienda_config').upsert({ id: 1, ultima_notif_producto: new Date().toISOString() })
        }
      }

      onSaved()
    } catch (err) {
      alert('Error: ' + (err.message || 'error desconocido'))
    } finally {
      setSaving(false)
    }
  }

  const allTalles = tipoTalle === 'ropa' ? TALLES_ROPA : tipoTalle === 'zapatillas' ? TALLES_ZAPATILLAS : []

  return (
    <div className="card" style={{ padding:16 }}>
      {editando && (
        <div style={{ fontSize:12, fontWeight:700, color:'var(--text2)', textTransform:'uppercase', letterSpacing:1, marginBottom:12 }}>
          Editando producto
        </div>
      )}
      <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:12 }}>

        <div className="field">
          <label>Nombre *</label>
          <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Remera Flama" required />
        </div>

        <div className="field">
          <label>Descripción</label>
          <textarea value={descripcion} onChange={e => setDescripcion(e.target.value)} placeholder="Remera técnica unisex..." rows={2} style={{ resize:'vertical' }} />
        </div>

        <div style={{ display:'flex', gap:10 }}>
          <div className="field" style={{ flex:1 }}>
            <label>Precio *</label>
            <input type="number" min="0" step="0.01" value={precio} onChange={e => setPrecio(e.target.value)} placeholder="5000" required />
          </div>
          <div className="field" style={{ flex:2 }}>
            <label>Tipo de talle</label>
            <select value={tipoTalle} onChange={e => onTipoChange(e.target.value)} style={selectStyle}>
              <option value="unico">Talle único</option>
              <option value="ropa">De XS a XXL</option>
              <option value="zapatillas">Zapatillas (35–44)</option>
            </select>
          </div>
          <div className="field" style={{ flex:1 }}>
            <label>Género</label>
            <select value={genero} onChange={e => setGenero(e.target.value)} style={selectStyle}>
              <option value="Unisex">Unisex</option>
              <option value="Hombre">Hombre</option>
              <option value="Mujer">Mujer</option>
            </select>
          </div>
        </div>

        {allTalles.length > 0 && (
          <div>
            <div style={{ fontSize:13, color:'var(--text2)', marginBottom:6 }}>Talles disponibles</div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
              {allTalles.map(t => {
                const on = talles.includes(t)
                return (
                  <button key={t} type="button" onClick={() => toggleTalle(t)}
                    style={{ padding:'5px 12px', fontSize:13, borderRadius:20, border:`1px solid ${on ? 'var(--accent)' : 'var(--border)'}`, background: on ? 'var(--accent)' : 'transparent', color: on ? '#fff' : 'var(--text2)', cursor:'pointer', fontWeight: on ? 700 : 400 }}>
                    {t}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Fotos */}
        <div className="field">
          <label>Fotos del producto</label>
          <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom: totalFotos ? 8 : 0 }}>
            {/* Existentes */}
            {fotosExistentes.map((url, i) => (
              <div key={`ex-${i}`} style={{ position:'relative', width:80, height:80 }}>
                <img src={url.replace('/upload/', '/upload/w_160,q_auto/')} alt="" style={{ width:80, height:80, objectFit:'cover', borderRadius:8, border:'1px solid var(--border)' }} />
                <button type="button" onClick={() => quitarExistente(i)}
                  style={{ position:'absolute', top:3, right:3, width:20, height:20, borderRadius:'50%', background:'rgba(0,0,0,0.7)', border:'none', color:'#fff', cursor:'pointer', fontSize:11, display:'flex', alignItems:'center', justifyContent:'center' }}>✕</button>
                {i === 0 && fotosNuevas.length === 0 && <span style={{ position:'absolute', bottom:3, left:3, fontSize:9, background:'rgba(0,0,0,0.7)', color:'#fff', padding:'1px 5px', borderRadius:4 }}>Principal</span>}
              </div>
            ))}
            {/* Nuevas */}
            {fotosNuevas.map((f, i) => (
              <div key={`nv-${i}`} style={{ position:'relative', width:80, height:80 }}>
                <img src={f.preview} alt="" style={{ width:80, height:80, objectFit:'cover', borderRadius:8, border:'2px dashed var(--accent)' }} />
                <button type="button" onClick={() => quitarNueva(i)}
                  style={{ position:'absolute', top:3, right:3, width:20, height:20, borderRadius:'50%', background:'rgba(0,0,0,0.7)', border:'none', color:'#fff', cursor:'pointer', fontSize:11, display:'flex', alignItems:'center', justifyContent:'center' }}>✕</button>
                {fotosExistentes.length === 0 && i === 0 && <span style={{ position:'absolute', bottom:3, left:3, fontSize:9, background:'rgba(0,0,0,0.7)', color:'#fff', padding:'1px 5px', borderRadius:4 }}>Principal</span>}
              </div>
            ))}
            <button type="button" onClick={() => fotoRef.current?.click()}
              style={{ width:80, height:80, border:'1px dashed var(--border)', borderRadius:8, background:'transparent', color:'var(--text2)', cursor:'pointer', fontSize:22, display:'flex', alignItems:'center', justifyContent:'center' }}>
              +
            </button>
          </div>
          <input ref={fotoRef} type="file" accept="image/*" multiple style={{ display:'none' }} onChange={agregarFotos} />
          <div style={{ fontSize:11, color:'var(--text2)' }}>
            {editando ? 'Las fotos con borde sólido ya están guardadas. Las punteadas son nuevas.' : 'Podés agregar varias fotos y la tabla de talles como imagen.'}
          </div>
        </div>

        <div style={{ display:'flex', gap:8 }}>
          {onCancel && (
            <button type="button" onClick={onCancel} style={{ flex:1, padding:10, borderRadius:8, border:'1px solid var(--border)', background:'transparent', color:'var(--text2)', cursor:'pointer', fontSize:14 }}>
              Cancelar
            </button>
          )}
          <button type="submit" className="btn-primary" disabled={saving} style={{ flex:2 }}>
            {saving ? (fotosNuevas.length ? 'Subiendo fotos...' : 'Guardando...') : editando ? 'Guardar cambios' : 'Publicar producto'}
          </button>
        </div>
      </form>
    </div>
  )
}

const TALLES_ORDEN = [...TALLES_ROPA, ...TALLES_ZAPATILLAS]
function sortTalles(talles) {
  return [...talles].sort((a, b) => {
    const ia = TALLES_ORDEN.indexOf(a), ib = TALLES_ORDEN.indexOf(b)
    if (ia === -1 && ib === -1) return a.localeCompare(b)
    if (ia === -1) return 1
    if (ib === -1) return -1
    return ia - ib
  })
}

// ─── CARD PRODUCTO (admin) ────────────────────────────────────────────────────

function ProductoCardAdmin({ p, onToggle, onEditar, onEliminar, onVerFoto }) {
  const talles = sortTalles(p.talles_disponibles || [])
  const fotos = p.fotos && p.fotos.length > 0 ? p.fotos : p.foto_url ? [p.foto_url] : []
  const thumb = fotos[0]
  const [descAbierta, setDescAbierta] = useState(false)
  return (
    <div className="card" style={{ padding:'14px 16px', display:'flex', gap:14, opacity: p.disponible ? 1 : 0.55 }}>
      {thumb && (
        <div style={{ position:'relative', flexShrink:0 }}>
          <img src={thumb.replace('/upload/', '/upload/w_100,q_auto/')} alt={p.nombre} loading="lazy"
            onClick={() => onVerFoto && onVerFoto(thumb)}
            style={{ width:72, height:72, objectFit:'cover', borderRadius:8, cursor:'pointer' }} />
          {fotos.length > 1 && (
            <span onClick={() => onVerFoto && onVerFoto(thumb)}
              style={{ position:'absolute', bottom:3, right:3, fontSize:10, background:'rgba(0,0,0,0.7)', color:'#fff', padding:'1px 5px', borderRadius:4, cursor:'pointer' }}>{fotos.length} 📷</span>
          )}
        </div>
      )}
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontWeight:700, fontSize:15 }}>{p.nombre}</div>
        {p.descripcion && (
          <>
            <button onClick={() => setDescAbierta(v => !v)}
              style={{ fontSize:12, color:'var(--accent)', background:'none', border:'none', padding:'2px 0', cursor:'pointer', marginTop:2 }}>
              {descAbierta ? 'Ocultar descripción ▲' : 'Ver descripción ▼'}
            </button>
            {descAbierta && <div style={{ fontSize:13, color:'var(--text2)', marginTop:4 }}>{p.descripcion}</div>}
          </>
        )}
        <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginTop:6, alignItems:'center' }}>
          <span style={{ fontWeight:700, fontSize:14, color:'var(--accent)' }}>${Number(p.precio).toLocaleString('es-AR')}</span>
          {talles.length > 0 && <span style={{ fontSize:12, color:'var(--text2)' }}>{talles.join(' · ')}</span>}
          {p.genero && <span style={{ fontSize:11, padding:'2px 8px', borderRadius:20, background:'var(--bg3)', color:'var(--text2)' }}>{p.genero}</span>}
          <span style={{ fontSize:11, padding:'2px 8px', borderRadius:20, background: p.disponible ? 'rgba(74,222,128,0.15)' : 'var(--bg3)', color: p.disponible ? '#4ade80' : 'var(--text2)' }}>
            {p.disponible ? 'Visible' : 'Oculto'}
          </span>
        </div>
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:6, flexShrink:0 }}>
        <button onClick={onToggle} style={btnSecStyle}>{p.disponible ? 'Ocultar' : 'Mostrar'}</button>
        <button onClick={onEditar} style={btnSecStyle}>Editar</button>
        <button onClick={onEliminar} style={btnDangerStyle}>Eliminar</button>
      </div>
    </div>
  )
}

// ─── CARD PEDIDO (admin) ──────────────────────────────────────────────────────

function PedidoAdminCard({ pedido: p, onVerFoto, onEstado, onSolicitarSaldo }) {
  const items = p.items || []
  const fecha = new Date(p.created_at).toLocaleDateString('es-AR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' })
  const estadoColor = p.estado === 'confirmado' ? '#4ade80' : p.estado === 'cancelado' ? '#f87171' : p.estado === 'entregado' ? '#60a5fa' : p.estado === 'senado' ? '#f59e0b' : 'var(--accent)'
  const saldoPendiente = !!p.comprobante_url_2

  return (
    <div className="card" style={{ padding:'14px 16px' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:10 }}>
        <div>
          <div style={{ fontWeight:700, fontSize:14 }}>{p.perfil?.nombre || 'Usuario'}</div>
          <div style={{ fontSize:11, color:'var(--text2)', marginTop:2 }}>{fecha}</div>
        </div>
        <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:4 }}>
          <span style={{ fontSize:12, padding:'3px 10px', borderRadius:20, background:`${estadoColor}22`, color:estadoColor, fontWeight:600 }}>{p.estado}</span>
          {p.es_sena && !saldoPendiente && (
            <span style={{ fontSize:11, padding:'2px 8px', borderRadius:20, background:'rgba(245,158,11,0.15)', color:'#f59e0b', fontWeight:600 }}>Seña 50%</span>
          )}
          {saldoPendiente && (
            <span style={{ fontSize:11, padding:'2px 8px', borderRadius:20, background:'rgba(96,165,250,0.15)', color:'#60a5fa', fontWeight:600 }}>Saldo enviado</span>
          )}
        </div>
      </div>

      {/* Items */}
      <div style={{ marginTop:10, display:'flex', flexDirection:'column', gap:4 }}>
        {items.map((it, i) => (
          <div key={i} style={{ display:'flex', justifyContent:'space-between', fontSize:13 }}>
            <span style={{ color:'var(--text)' }}>
              {it.nombre}{it.talle ? <span style={{ color:'var(--text2)' }}> · {it.talle}</span> : null}
            </span>
            <span style={{ color:'var(--text2)', flexShrink:0 }}>${Number(it.precio).toLocaleString('es-AR')}</span>
          </div>
        ))}
        <div style={{ display:'flex', justifyContent:'space-between', borderTop:'1px solid var(--border)', marginTop:4, paddingTop:4, fontWeight:700, fontSize:14 }}>
          <span>Total</span><span>${Number(p.total).toLocaleString('es-AR')}</span>
        </div>
        {p.es_sena && (
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, color:'#f59e0b' }}>
            <span>Seña transferida</span><span>${Number(p.monto_sena).toLocaleString('es-AR')}</span>
          </div>
        )}
      </div>

      {/* Comprobantes */}
      <div style={{ display:'flex', gap:8, marginTop:10 }}>
        {p.comprobante_url && (
          <button onClick={() => onVerFoto(p.comprobante_url)}
            style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:6, padding:'8px 12px', borderRadius:8, border:'1px solid var(--border)', background:'var(--bg3)', color:'var(--text)', fontSize:13, cursor:'pointer' }}>
            {p.es_sena ? 'Comprobante seña' : 'Ver comprobante'}
          </button>
        )}
        {p.comprobante_url_2 && (
          <button onClick={() => onVerFoto(p.comprobante_url_2)}
            style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:6, padding:'8px 12px', borderRadius:8, border:'1px solid rgba(96,165,250,0.4)', background:'rgba(96,165,250,0.08)', color:'#60a5fa', fontSize:13, cursor:'pointer' }}>
            Comprobante saldo
          </button>
        )}
      </div>

      {p.estado === 'pendiente' && !saldoPendiente && (
        <div style={{ display:'flex', gap:8, marginTop:10 }}>
          <button onClick={() => onEstado(p.es_sena ? 'senado' : 'confirmado')}
            style={{ flex:2, padding:8, fontSize:13, borderRadius:8, border:'1px solid rgba(74,222,128,0.3)', background:'rgba(74,222,128,0.1)', color:'#4ade80', cursor:'pointer', fontWeight:600 }}>
            {p.es_sena ? 'Seña recibida' : 'Confirmar pago'}
          </button>
          <button onClick={() => onEstado('cancelado')}
            style={{ flex:1, padding:8, fontSize:13, borderRadius:8, border:'1px solid rgba(248,113,113,0.3)', background:'transparent', color:'#f87171', cursor:'pointer' }}>
            Cancelar
          </button>
        </div>
      )}
      {p.estado === 'senado' && !saldoPendiente && (
        <button onClick={onSolicitarSaldo}
          style={{ marginTop:10, width:'100%', padding:8, fontSize:13, borderRadius:8, border:'1px solid rgba(245,158,11,0.3)', background:'rgba(245,158,11,0.1)', color:'#f59e0b', cursor:'pointer', fontWeight:600 }}>
          Solicitar saldo
        </button>
      )}
      {saldoPendiente && (
        <button onClick={() => onEstado('confirmado')}
          style={{ marginTop:10, width:'100%', padding:8, fontSize:13, borderRadius:8, border:'1px solid rgba(74,222,128,0.3)', background:'rgba(74,222,128,0.1)', color:'#4ade80', cursor:'pointer', fontWeight:600 }}>
          Confirmar pago completo
        </button>
      )}
      {p.estado === 'confirmado' && (
        <button onClick={() => onEstado('entregado')}
          style={{ marginTop:10, width:'100%', padding:8, fontSize:13, borderRadius:8, border:'1px solid rgba(96,165,250,0.3)', background:'rgba(96,165,250,0.1)', color:'#60a5fa', cursor:'pointer', fontWeight:600 }}>
          Marcar como entregado
        </button>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// TIENDA PÚBLICA (no-admin) con carrito
// ─────────────────────────────────────────────────────────────────────────────

function TiendaPublica({ config }) {
  const { user, profile } = useAuth()
  const [productos, setProductos]   = useState([])
  const [loading, setLoading]       = useState(true)
  const [cart, setCart]         = useState([])
  const [cartOpen, setCartOpen] = useState(false)
  const [toast, setToast]       = useState('')
  const [generoFiltro, setGeneroFiltro] = useState(null)
  const [talleFiltro, setTalleFiltro]   = useState(null)
  const [vistaPublica, setVistaPublica] = useState('productos')
  const [misPedidos, setMisPedidos]     = useState([])
  const [loadingPedidos, setLoadingPedidos] = useState(false)
  const saveTimer = useRef(null)

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 2500) }

  useEffect(() => {
    async function init() {
      const [{ data: prods }, { data: carrito }] = await Promise.all([
        supabase.from('productos').select('*').eq('disponible', true).order('created_at', { ascending: false }),
        user ? supabase.from('carritos').select('items').eq('user_id', user.id).maybeSingle() : Promise.resolve({ data: null }),
      ])
      setProductos(prods || [])
      if (carrito?.items?.length) setCart(carrito.items)
      setLoading(false)
    }
    init()
  }, [])

  // Guardar carrito en DB con debounce
  useEffect(() => {
    if (!user || loading) return
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      supabase.from('carritos').upsert({ user_id: user.id, items: cart, updated_at: new Date().toISOString() })
    }, 600)
    return () => clearTimeout(saveTimer.current)
  }, [cart])

  // Realtime: actualizar "Mis Pedidos" cuando el admin cambia el estado
  useEffect(() => {
    if (!user) return
    const ch = supabase.channel('tienda-pedidos-buyer-rt')
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'pedidos',
        filter: `user_id=eq.${user.id}`,
      }, payload => {
        setMisPedidos(prev => prev.map(p => p.id === payload.new.id ? { ...p, ...payload.new } : p))
      })
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [user])

  function agregarAlCarrito(producto, talle = null) {
    setCart(prev => {
      const existe = prev.find(i => i.producto.id === producto.id && i.talle === talle)
      if (existe) return prev.map(i => i === existe ? { ...i, cantidad: i.cantidad + 1 } : i)
      return [...prev, { key: Math.random().toString(36).slice(2), producto, talle, cantidad: 1 }]
    })
    showToast('✓ Agregado al carrito')
  }

  function cambiarCantidad(key, delta) {
    setCart(prev => prev
      .map(i => i.key === key ? { ...i, cantidad: i.cantidad + delta } : i)
      .filter(i => i.cantidad > 0)
    )
  }

  function quitarDelCarrito(key) {
    setCart(prev => prev.filter(i => i.key !== key))
  }

  async function abrirPedidos() {
    setVistaPublica('pedidos')
    setLoadingPedidos(true)
    const { data } = await supabase.from('pedidos').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
    setMisPedidos(data || [])
    setLoadingPedidos(false)
  }

  if (loading) return <Cargando />

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>

      {/* Pill switcher Productos / Pedidos */}
      <div style={{ padding:'12px 16px 0', flexShrink:0 }}>
        <div style={{ display:'inline-flex', background:'var(--bg3)', borderRadius:10, padding:3, gap:2 }}>
          {['productos','pedidos'].map(v => {
            const activo = vistaPublica === v
            return (
              <button key={v} onClick={() => v === 'pedidos' ? abrirPedidos() : setVistaPublica('productos')}
                style={{ padding:'6px 18px', fontSize:13, fontWeight: activo ? 700 : 500, color: activo ? '#fff' : 'var(--text2)', background: activo ? 'var(--accent)' : 'transparent', border:'none', cursor:'pointer', borderRadius:8, textTransform:'capitalize' }}>
                {v === 'productos' ? 'Productos' : 'Mis Pedidos'}
              </button>
            )
          })}
        </div>
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:16, display:'flex', flexDirection:'column', gap:14, paddingBottom:80 }}>

      {/* ── PEDIDOS DEL COMPRADOR ── */}
      {vistaPublica === 'pedidos' && (
        loadingPedidos ? <Cargando /> : misPedidos.length === 0 ? (
          <div style={{ textAlign:'center', color:'var(--text2)', fontSize:14, padding:'32px 0' }}>Todavía no hiciste ningún pedido.</div>
        ) : (
          misPedidos.map(p => <PedidoCompradorCard key={p.id} pedido={p} onPedidoActualizado={(id, cambios) => setMisPedidos(prev => prev.map(x => x.id === id ? { ...x, ...cambios } : x))} />)
        )
      )}

      {/* ── PRODUCTOS ── */}
      {vistaPublica === 'productos' && <>

      {/* Datos de pago */}
      {(config?.alias || config?.cbu) && (
        <div className="card" style={{ padding:'12px 16px' }}>
          <div style={{ fontSize:12, color:'var(--text2)', marginBottom:6 }}>💳 Datos de pago</div>
          {config.alias && <CopiableRow label="Alias" value={config.alias} />}
          {config.cbu   && <CopiableRow label="CBU"   value={config.cbu} />}
        </div>
      )}

      {/* Filtros */}
      {productos.length > 0 && (() => {
        const generos = [...new Set(productos.map(p => p.genero).filter(Boolean))]
        const tallesSet = new Set()
        productos.forEach(p => (p.talles_disponibles || []).forEach(t => tallesSet.add(t)))
        const tallesOrden = [...TALLES_ROPA, ...TALLES_ZAPATILLAS]
        const talles = [...tallesSet].sort((a, b) => {
          const ia = tallesOrden.indexOf(a), ib = tallesOrden.indexOf(b)
          if (ia !== -1 && ib !== -1) return ia - ib
          if (ia !== -1) return -1
          if (ib !== -1) return 1
          return a.localeCompare(b)
        })
        if (generos.length < 2 && talles.length === 0) return null
        const chip = (label, activo, onClick) => (
          <button key={label} onClick={onClick}
            style={{ padding:'4px 12px', fontSize:12, borderRadius:20, border:`1px solid ${activo ? 'var(--accent)' : 'var(--border)'}`, background: activo ? 'var(--accent)' : 'transparent', color: activo ? '#fff' : 'var(--text2)', cursor:'pointer', fontWeight: activo ? 700 : 400, whiteSpace:'nowrap' }}>
            {label}
          </button>
        )
        return (
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {generos.length >= 2 && (
              <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                {chip('Todos', !generoFiltro, () => setGeneroFiltro(null))}
                {generos.map(g => chip(g, generoFiltro === g, () => setGeneroFiltro(f => f === g ? null : g)))}
              </div>
            )}
            {talles.length > 0 && (
              <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                {chip('Todos los talles', !talleFiltro, () => setTalleFiltro(null))}
                {talles.map(t => chip(t, talleFiltro === t, () => setTalleFiltro(f => f === t ? null : t)))}
              </div>
            )}
          </div>
        )
      })()}

      {(() => {
        const filtrados = productos.filter(p =>
          (!generoFiltro || p.genero === generoFiltro) &&
          (!talleFiltro || (p.talles_disponibles || []).includes(talleFiltro))
        )
        if (filtrados.length === 0) return (
          <div style={{ textAlign:'center', color:'var(--text2)', fontSize:14, padding:'32px 0' }}>No hay productos con ese filtro.</div>
        )
        return filtrados.map(p => (
          <ProductoCardPublica key={p.id} p={p} onAgregar={(talle) => agregarAlCarrito(p, talle)} />
        ))
      })()}

      {/* Botón carrito flotante */}
      {cart.length > 0 && (
        <button onClick={() => setCartOpen(true)}
          style={{ position:'fixed', bottom:72, right:16, width:56, height:56, borderRadius:'50%', background:'var(--accent)', border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, boxShadow:'0 4px 16px rgba(0,0,0,0.4)', zIndex:50 }}>
          🛒
          <span style={{ position:'absolute', top:2, right:2, background:'#fff', color:'var(--accent)', fontSize:11, fontWeight:900, borderRadius:99, minWidth:18, height:18, display:'flex', alignItems:'center', justifyContent:'center', padding:'0 4px', lineHeight:1 }}>
            {cart.reduce((s, i) => s + i.cantidad, 0)}
          </span>
        </button>
      )}

      {/* Sheet carrito */}
      {cartOpen && (
        <CartSheet
          cart={cart}
          config={config}
          user={user}
          profile={profile}
          onQuitar={quitarDelCarrito}
          onCambiarCantidad={cambiarCantidad}
          onClose={() => setCartOpen(false)}
          onActualizarPrecios={productosActuales => {
            setCart(prev => prev
              .filter(item => productosActuales.find(p => p.id === item.producto.id && p.disponible))
              .map(item => {
                const actual = productosActuales.find(p => p.id === item.producto.id)
                return actual ? { ...item, producto: { ...item.producto, precio: actual.precio } } : item
              })
            )
          }}
          onPedidoEnviado={() => {
            setCart([])
            setCartOpen(false)
            showToast('✅ Pedido enviado')
            if (user) supabase.from('carritos').upsert({ user_id: user.id, items: [], updated_at: new Date().toISOString() })
            setMisPedidos([])
          }} />
      )}

      </>}

      </div>{/* end flex scroll */}

      {toast && <Toast msg={toast} />}
    </div>
  )
}

// ─── CARD PEDIDO (comprador) ──────────────────────────────────────────────────

function PedidoCompradorCard({ pedido: p, onPedidoActualizado }) {
  const items = p.items || []
  const fecha = new Date(p.created_at).toLocaleDateString('es-AR', { day:'2-digit', month:'2-digit', year:'2-digit', hour:'2-digit', minute:'2-digit' })
  const [estado, setEstado]       = useState(p.estado)
  const [marcando, setMarcando]   = useState(false)
  const [saldoOpen, setSaldoOpen] = useState(false)

  useEffect(() => { setEstado(p.estado) }, [p.estado])

  const ESTADO_COMPRADOR = {
    pendiente:  { label:'Pendiente',     color:'#fbbf24', bg:'rgba(251,191,36,0.12)' },
    senado:     { label:'Seña recibida', color:'#f59e0b', bg:'rgba(245,158,11,0.12)' },
    confirmado: { label:'Acreditado',    color:'#4ade80', bg:'rgba(74,222,128,0.12)' },
    entregado:  { label:'Entregado',     color:'#60a5fa', bg:'rgba(96,165,250,0.12)' },
    cancelado:  { label:'Cancelado',     color:'#f87171', bg:'rgba(248,113,113,0.12)' },
  }
  const info           = ESTADO_COMPRADOR[estado] || ESTADO_COMPRADOR.pendiente
  const saldoRestante  = p.es_sena ? (Number(p.total) - Number(p.monto_sena)) : 0
  const yaEnvioSaldo   = !!p.comprobante_url_2

  async function marcarEntregado() {
    setMarcando(true)
    const { error } = await supabase.from('pedidos').update({ estado: 'entregado' }).eq('id', p.id)
    if (!error) setEstado('entregado')
    else alert('No se pudo actualizar el pedido. Intenta de nuevo.')
    setMarcando(false)
  }

  return (
    <>
    <div className="card" style={{ padding:'14px 16px' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:10, marginBottom:10 }}>
        <div style={{ fontSize:11, color:'var(--text2)' }}>{fecha}</div>
        <span style={{ fontSize:12, padding:'3px 10px', borderRadius:20, background:info.bg, color:info.color, fontWeight:600, flexShrink:0 }}>{info.label}</span>
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
        {items.map((it, i) => (
          <div key={i} style={{ display:'flex', justifyContent:'space-between', fontSize:13 }}>
            <span>{it.nombre}{it.talle ? <span style={{ color:'var(--text2)' }}> · {it.talle}</span> : null}{it.cantidad > 1 ? <span style={{ color:'var(--text2)' }}> x {it.cantidad}</span> : null}</span>
            <span style={{ color:'var(--text2)', flexShrink:0 }}>${(Number(it.precio) * (it.cantidad || 1)).toLocaleString('es-AR')}</span>
          </div>
        ))}
        <div style={{ display:'flex', justifyContent:'space-between', borderTop:'1px solid var(--border)', marginTop:4, paddingTop:4, fontWeight:700, fontSize:14 }}>
          <span>Total</span><span>${Number(p.total).toLocaleString('es-AR')}</span>
        </div>
        {p.es_sena && (
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, color:'#f59e0b' }}>
            <span>Seña abonada</span><span>${Number(p.monto_sena).toLocaleString('es-AR')}</span>
          </div>
        )}
        {estado === 'senado' && !yaEnvioSaldo && (
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, color:'var(--text2)' }}>
            <span>Saldo pendiente</span><span>${saldoRestante.toLocaleString('es-AR')}</span>
          </div>
        )}
      </div>
      {estado === 'senado' && !yaEnvioSaldo && (
        <button onClick={() => setSaldoOpen(true)}
          style={{ marginTop:10, width:'100%', padding:8, fontSize:13, borderRadius:8, border:'1px solid rgba(245,158,11,0.3)', background:'rgba(245,158,11,0.1)', color:'#f59e0b', cursor:'pointer', fontWeight:600 }}>
          Transferir restante (${saldoRestante.toLocaleString('es-AR')})
        </button>
      )}
      {estado === 'senado' && yaEnvioSaldo && (
        <div style={{ marginTop:10, padding:'8px 12px', borderRadius:8, background:'rgba(96,165,250,0.08)', color:'#60a5fa', fontSize:13, textAlign:'center' }}>
          Saldo enviado - esperando confirmacion del admin
        </div>
      )}
      {estado === 'confirmado' && (
        <button onClick={marcarEntregado} disabled={marcando}
          style={{ marginTop:10, width:'100%', padding:8, fontSize:13, borderRadius:8, border:'1px solid rgba(96,165,250,0.3)', background:'rgba(96,165,250,0.1)', color:'#60a5fa', cursor:'pointer', fontWeight:600 }}>
          {marcando ? '...' : 'Lo recibi - marcar como entregado'}
        </button>
      )}
    </div>
    {saldoOpen && (
      <TransferirSaldoSheet
        pedidoId={p.id}
        monto={saldoRestante}
        onClose={() => setSaldoOpen(false)}
        onEnviado={() => {
          setSaldoOpen(false)
          if (onPedidoActualizado) onPedidoActualizado(p.id, { comprobante_url_2: 'enviado' })
        }} />
    )}
    </>
  )
}

function TransferirSaldoSheet({ pedidoId, monto, onClose, onEnviado }) {
  const [comprFile, setComprFile]       = useState(null)
  const [comprPreview, setComprPreview] = useState(null)
  const [sending, setSending]           = useState(false)
  const comprRef = useRef()

  async function handleEnviar() {
    if (!comprFile) return
    setSending(true)
    try {
      const data = await uploadCloudinary(comprFile, 'flamarun/comprobantes')
      if (!data?.secure_url) throw new Error('Error al subir el comprobante')
      const { error } = await supabase.from('pedidos').update({ comprobante_url_2: data.secure_url, estado: 'senado' }).eq('id', pedidoId)
      if (error) throw new Error(error.message)
      onEnviado()
    } catch (err) {
      alert('No se pudo enviar: ' + (err.message || 'error desconocido'))
    }
    setSending(false)
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', zIndex:100, display:'flex', alignItems:'flex-end', justifyContent:'center' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background:'var(--bg2)', borderRadius:'16px 16px 0 0', width:'100%', maxWidth:480, padding:20, display:'flex', flexDirection:'column', gap:16 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div style={{ fontWeight:700, fontSize:16 }}>Transferir saldo restante</div>
          <button onClick={onClose} style={{ background:'transparent', border:'none', color:'var(--text2)', fontSize:20, cursor:'pointer' }}>X</button>
        </div>
        <div style={{ background:'var(--bg3)', borderRadius:10, padding:'12px 14px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <span style={{ fontSize:14, color:'var(--text2)' }}>Monto a transferir</span>
          <span style={{ fontWeight:700, fontSize:18, color:'var(--accent)' }}>${monto.toLocaleString('es-AR')}</span>
        </div>
        <div>
          <div style={{ fontSize:13, fontWeight:600, marginBottom:8 }}>Comprobante de transferencia</div>
          {comprPreview ? (
            <div style={{ position:'relative' }}>
              <img src={comprPreview} alt="comprobante" style={{ width:'100%', maxHeight:200, objectFit:'contain', borderRadius:8, border:'1px solid var(--border)' }} />
              <button onClick={() => { setComprFile(null); setComprPreview(null); comprRef.current.value = '' }}
                style={{ position:'absolute', top:8, right:8, width:26, height:26, borderRadius:'50%', background:'rgba(0,0,0,0.7)', border:'none', color:'#fff', cursor:'pointer', fontSize:14 }}>X</button>
            </div>
          ) : (
            <button onClick={() => comprRef.current?.click()}
              style={{ width:'100%', padding:12, border:'1px dashed var(--border)', borderRadius:8, background:'transparent', color:'var(--text2)', cursor:'pointer', fontSize:13 }}>
              Adjuntar comprobante
            </button>
          )}
          <input ref={comprRef} type="file" accept="image/*" style={{ display:'none' }} onChange={e => {
            const f = e.target.files[0]
            if (f) { setComprFile(f); setComprPreview(URL.createObjectURL(f)) }
          }} />
        </div>
        <button onClick={handleEnviar} disabled={!comprFile || sending} className="btn-primary" style={{ opacity: comprFile ? 1 : 0.4 }}>
          {sending ? 'Enviando...' : 'Enviar comprobante'}
        </button>
      </div>
    </div>
  )
}

// ─── CARD PRODUCTO (público) ──────────────────────────────────────────────────

function ProductoCardPublica({ p, onAgregar }) {
  const talles  = sortTalles(p.talles_disponibles || [])
  const fotos   = (p.fotos || []).length > 0 ? p.fotos : (p.foto_url ? [p.foto_url] : [])
  const [talle, setTalle]     = useState(null)
  const [galeria, setGaleria] = useState(null)
  const [showDesc, setShowDesc] = useState(false)

  const puedeAgregar = talles.length === 0 || talle !== null

  return (
    <>
      <div className="card" style={{ padding:'14px 16px' }}>
        <div style={{ display:'flex', gap:14 }}>
          {fotos.length > 0 && (
            <div style={{ position:'relative', flexShrink:0 }} onClick={() => setGaleria(0)}>
              <img src={fotos[0].replace('/upload/', '/upload/w_160,q_auto/')} alt={p.nombre} loading="lazy"
                style={{ width:90, height:90, objectFit:'cover', borderRadius:8, cursor:'pointer' }} />
              {fotos.length > 1 && (
                <span style={{ position:'absolute', bottom:4, right:4, fontSize:10, background:'rgba(0,0,0,0.7)', color:'#fff', padding:'2px 6px', borderRadius:4, pointerEvents:'none' }}>
                  {fotos.length} 📷
                </span>
              )}
            </div>
          )}
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ display:'flex', alignItems:'flex-start', gap:6, flexWrap:'wrap' }}>
              <div style={{ fontWeight:700, fontSize:15, flex:1 }}>{p.nombre}</div>
              {p.genero && (
                <span style={{ fontSize:11, padding:'2px 8px', borderRadius:20, background:'var(--bg3)', color:'var(--text2)', flexShrink:0, whiteSpace:'nowrap' }}>{p.genero}</span>
              )}
            </div>
            {p.descripcion && (
              <>
                <button onClick={() => setShowDesc(v => !v)}
                  style={{ fontSize:12, color:'var(--accent)', background:'transparent', border:'none', cursor:'pointer', padding:0, marginTop:4, display:'block' }}>
                  {showDesc ? 'Ocultar ▲' : 'Ver descripción ▼'}
                </button>
                {showDesc && <div style={{ fontSize:13, color:'var(--text2)', marginTop:4 }}>{p.descripcion}</div>}
              </>
            )}
            <div style={{ fontWeight:700, fontSize:16, color:'var(--accent)', marginTop:6 }}>
              ${Number(p.precio).toLocaleString('es-AR')}
            </div>
          </div>
        </div>

        {/* Selector de talle inline */}
        {talles.length > 0 && (
          <div style={{ marginTop:12 }}>
            <div style={{ fontSize:12, color:'var(--text2)', marginBottom:6 }}>Talle</div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
              {talles.map(t => (
                <button key={t} onClick={() => setTalle(t === talle ? null : t)}
                  style={{ padding:'5px 14px', fontSize:13, borderRadius:20, border:`1px solid ${talle === t ? 'var(--accent)' : 'var(--border)'}`, background: talle === t ? 'var(--accent)' : 'transparent', color: talle === t ? '#fff' : 'var(--text)', cursor:'pointer', fontWeight: talle === t ? 700 : 400 }}>
                  {t}
                </button>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={() => { onAgregar(talle); setTalle(null) }}
          disabled={!puedeAgregar}
          className="btn-accent"
          style={{ marginTop:12, height:34, padding:'0 14px', fontSize:13, width:'100%', opacity: puedeAgregar ? 1 : 0.4 }}>
          {talles.length > 0 && !talle ? 'Elegí un talle' : '+ Agregar al carrito'}
        </button>
      </div>

      {galeria !== null && (
        <GaleriaModal fotos={fotos} inicial={galeria} onClose={() => setGaleria(null)} />
      )}
    </>
  )
}

// ─── GALERÍA MODAL ────────────────────────────────────────────────────────────

function GaleriaModal({ fotos, inicial, onClose }) {
  const [idx, setIdx] = useState(inicial)

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'ArrowLeft')  setIdx(i => Math.max(0, i - 1))
      if (e.key === 'ArrowRight') setIdx(i => Math.min(fotos.length - 1, i + 1))
      if (e.key === 'Escape')     onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [fotos.length, onClose])

  const prev = idx > 0
  const next = idx < fotos.length - 1

  return (
    <div onClick={onClose}
      style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.95)', zIndex:200, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }}>

      {/* Foto */}
      <div onClick={e => e.stopPropagation()} style={{ position:'relative', display:'flex', alignItems:'center', justifyContent:'center', width:'100%', maxWidth:600, padding:'0 48px' }}>
        <img src={fotos[idx]} alt="" style={{ maxWidth:'100%', maxHeight:'80vh', objectFit:'contain', borderRadius:8 }} />

        {prev && (
          <button onClick={e => { e.stopPropagation(); setIdx(i => i - 1) }}
            style={{ position:'absolute', left:4, top:'50%', transform:'translateY(-50%)', width:36, height:36, borderRadius:'50%', background:'rgba(255,255,255,0.15)', border:'none', color:'#fff', fontSize:20, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>‹</button>
        )}
        {next && (
          <button onClick={e => { e.stopPropagation(); setIdx(i => i + 1) }}
            style={{ position:'absolute', right:4, top:'50%', transform:'translateY(-50%)', width:36, height:36, borderRadius:'50%', background:'rgba(255,255,255,0.15)', border:'none', color:'#fff', fontSize:20, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>›</button>
        )}
      </div>

      {/* Contador + miniaturas */}
      <div onClick={e => e.stopPropagation()} style={{ marginTop:16, display:'flex', gap:8, alignItems:'center' }}>
        {fotos.map((f, i) => (
          <img key={i} src={f.replace('/upload/', '/upload/w_60,q_auto/')} alt="" onClick={() => setIdx(i)}
            style={{ width:44, height:44, objectFit:'cover', borderRadius:6, cursor:'pointer', opacity: i === idx ? 1 : 0.45, border: i === idx ? '2px solid #fff' : '2px solid transparent', transition:'opacity 0.15s' }} />
        ))}
      </div>

      <button onClick={onClose}
        style={{ position:'absolute', top:16, right:16, background:'rgba(255,255,255,0.15)', border:'none', color:'#fff', width:36, height:36, borderRadius:'50%', fontSize:18, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>✕</button>
    </div>
  )
}

// ─── CART SHEET ───────────────────────────────────────────────────────────────

function CartSheet({ cart, config, user, profile, onQuitar, onCambiarCantidad, onClose, onActualizarPrecios, onPedidoEnviado }) {
  const [comprFile, setComprFile]     = useState(null)
  const [comprPreview, setComprPreview] = useState(null)
  const [step, setStep]               = useState('carrito')  // 'carrito' | 'confirmar'
  const [sending, setSending]         = useState(false)
  const [esSena, setEsSena]           = useState(false)
  const comprRef = useRef()

  const total       = cart.reduce((s, i) => s + Number(i.producto.precio) * i.cantidad, 0)
  const montoSena   = Math.round(total / 2)
  const montoAPagar = esSena ? montoSena : total

  async function handleEnviar() {
    if (!comprFile) return
    setSending(true)

    try {
      // Verificar precios y disponibilidad contra la DB antes de proceder
      const productoIds = [...new Set(cart.map(i => i.producto.id))]
      const { data: productosActuales } = await supabase
        .from('productos')
        .select('id, precio, disponible, nombre')
        .in('id', productoIds)

      if (productosActuales) {
        const noDisponibles = cart.filter(item =>
          !productosActuales.find(p => p.id === item.producto.id && p.disponible)
        )
        if (noDisponibles.length > 0) {
          const nombres = noDisponibles.map(i => `"${i.producto.nombre}"`).join(', ')
          throw new Error(`${nombres} ${noDisponibles.length === 1 ? 'ya no está disponible' : 'ya no están disponibles'}. Removelo del carrito e intentá de nuevo.`)
        }

        const preciosCambiaron = cart.some(item => {
          const actual = productosActuales.find(p => p.id === item.producto.id)
          return actual && Number(actual.precio) !== Number(item.producto.precio)
        })
        if (preciosCambiaron) {
          onActualizarPrecios(productosActuales)
          throw new Error('Los precios se actualizaron. Revisá el total y volvé a confirmar.')
        }
      }

      const data = await uploadCloudinary(comprFile, 'flamarun/comprobantes')
      if (!data?.secure_url) throw new Error('Error al subir el comprobante')

      const items = cart.map(i => ({
        producto_id: i.producto.id,
        nombre:      i.producto.nombre,
        talle:       i.talle || null,
        precio:      Number(i.producto.precio),
        cantidad:    i.cantidad,
      }))

      const { error } = await supabase.from('pedidos').insert([{
        user_id:               user.id,
        items,
        total,
        comprobante_url:       data.secure_url,
        comprobante_public_id: data.public_id || null,
        estado:                'pendiente',
        es_sena:               esSena || false,
        monto_sena:            esSena ? montoSena : null,
      }])

      if (error) throw new Error(error.message)

      // Notificar admins
      const { data: admins } = await supabase.from('profiles').select('id').eq('role', 'admin')
      const adminIds = (admins || []).map(a => a.id)
      if (adminIds.length) {
        const resumen = cart.length === 1
          ? `${cart[0].producto.nombre}${cart[0].talle ? ` (${cart[0].talle})` : ''}`
          : `${cart.length} productos`
        notificar(
          '🛍️ Nuevo pedido',
          `${profile?.nombre || 'Alguien'} pidió ${resumen}${esSena ? ' (seña)' : ''}`,
          '/mas?tab=Tienda&subtab=Compras',
          { user_ids: adminIds }
        )
      }

      setSending(false)
      onPedidoEnviado()
    } catch (err) {
      setSending(false)
      alert('No se pudo enviar el pedido: ' + (err.message || 'error desconocido'))
    }
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', zIndex:100, display:'flex', alignItems:'flex-end', justifyContent:'center' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background:'var(--bg2)', borderRadius:'16px 16px 0 0', width:'100%', maxWidth:480, maxHeight:'90vh', overflowY:'auto', padding:20, display:'flex', flexDirection:'column', gap:16 }}>

        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div style={{ fontWeight:700, fontSize:16 }}>Carrito ({cart.reduce((s, i) => s + i.cantidad, 0)})</div>
          <button onClick={onClose} style={{ background:'transparent', border:'none', color:'var(--text2)', fontSize:20, cursor:'pointer' }}>✕</button>
        </div>

        {/* Items */}
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          {cart.map(item => (
            <div key={item.key} style={{ display:'flex', gap:12, alignItems:'center' }}>
              {((item.producto.fotos?.[0]) || item.producto.foto_url) && (
                <img src={((item.producto.fotos?.[0]) || item.producto.foto_url).replace('/upload/', '/upload/w_80,q_auto/')} alt="" loading="lazy"
                  style={{ width:52, height:52, objectFit:'cover', borderRadius:8, flexShrink:0 }} />
              )}
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:14, fontWeight:600 }}>{item.producto.nombre}</div>
                {item.talle && <div style={{ fontSize:12, color:'var(--text2)' }}>Talle {item.talle}</div>}
                <div style={{ fontSize:13, color:'var(--accent)', fontWeight:700 }}>
                  ${(Number(item.producto.precio) * item.cantidad).toLocaleString('es-AR')}
                  {item.cantidad > 1 && <span style={{ fontWeight:400, color:'var(--text2)', fontSize:12 }}> ({item.cantidad} × ${Number(item.producto.precio).toLocaleString('es-AR')})</span>}
                </div>
              </div>
              {/* Controles cantidad */}
              <div style={{ display:'flex', alignItems:'center', gap:4, flexShrink:0 }}>
                <button onClick={() => onCambiarCantidad(item.key, -1)}
                  style={{ width:26, height:26, borderRadius:'50%', border:'1px solid var(--border)', background:'transparent', color:'var(--text)', cursor:'pointer', fontSize:15, display:'flex', alignItems:'center', justifyContent:'center' }}>−</button>
                <span style={{ fontSize:14, fontWeight:600, minWidth:16, textAlign:'center' }}>{item.cantidad}</span>
                <button onClick={() => onCambiarCantidad(item.key, 1)}
                  style={{ width:26, height:26, borderRadius:'50%', border:'1px solid var(--border)', background:'transparent', color:'var(--text)', cursor:'pointer', fontSize:15, display:'flex', alignItems:'center', justifyContent:'center' }}>+</button>
                <button onClick={() => onQuitar(item.key)}
                  style={{ marginLeft:4, background:'transparent', border:'none', color:'var(--text2)', fontSize:16, cursor:'pointer', padding:'4px', lineHeight:1 }}>🗑️</button>
              </div>
            </div>
          ))}
        </div>

        {/* Total + opcion sena */}
        <div style={{ borderTop:'1px solid var(--border)', paddingTop:10, display:'flex', flexDirection:'column', gap:8 }}>
          <div style={{ display:'flex', justifyContent:'space-between', fontWeight:700, fontSize:16 }}>
            <span>Total</span>
            <span style={{ color: esSena ? 'var(--text2)' : 'var(--accent)', textDecoration: esSena ? 'line-through' : 'none', fontSize: esSena ? 14 : 16 }}>${total.toLocaleString('es-AR')}</span>
          </div>
          <label style={{ display:'flex', alignItems:'flex-start', gap:10, cursor:'pointer', padding:'10px 12px', borderRadius:10, background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.25)' }}>
            <input type="checkbox" checked={esSena} onChange={e => setEsSena(e.target.checked)}
              style={{ width:16, height:16, accentColor:'#f59e0b', cursor:'pointer', marginTop:2, flexShrink:0 }} />
            <div>
              <div style={{ fontSize:13, fontWeight:600, color:'#f59e0b' }}>Abonar seña (50%)</div>
              <div style={{ fontSize:12, color:'var(--text2)', marginTop:2 }}>El resto lo abonas cuando el admin lo solicite</div>
            </div>
          </label>
          {esSena && (
            <div style={{ display:'flex', justifyContent:'space-between', fontWeight:700, fontSize:16, color:'var(--accent)' }}>
              <span>A transferir ahora</span>
              <span>${montoSena.toLocaleString('es-AR')}</span>
            </div>
          )}
        </div>

        {/* Datos de pago */}
        {(config?.alias || config?.cbu) && (
          <div style={{ background:'var(--bg3)', borderRadius:10, padding:'12px 14px' }}>
            <div style={{ fontSize:12, color:'var(--text2)', marginBottom:6 }}>💳 Realizá la transferencia a</div>
            {config.alias && <CopiableRow label="Alias" value={config.alias} />}
            {config.cbu   && <CopiableRow label="CBU"   value={config.cbu} />}
          </div>
        )}

        {/* Comprobante */}
        <div>
          <div style={{ fontSize:13, fontWeight:600, marginBottom:8 }}>Comprobante de transferencia</div>
          {comprPreview ? (
            <div style={{ position:'relative' }}>
              <img src={comprPreview} alt="comprobante" style={{ width:'100%', maxHeight:200, objectFit:'contain', borderRadius:8, border:'1px solid var(--border)' }} />
              <button onClick={() => { setComprFile(null); setComprPreview(null); comprRef.current.value = '' }}
                style={{ position:'absolute', top:8, right:8, width:26, height:26, borderRadius:'50%', background:'rgba(0,0,0,0.7)', border:'none', color:'#fff', cursor:'pointer', fontSize:14 }}>✕</button>
            </div>
          ) : (
            <button onClick={() => comprRef.current?.click()}
              style={{ width:'100%', padding:12, border:'1px dashed var(--border)', borderRadius:8, background:'transparent', color:'var(--text2)', cursor:'pointer', fontSize:13 }}>
              📎 Adjuntar comprobante
            </button>
          )}
          <input ref={comprRef} type="file" accept="image/*" style={{ display:'none' }} onChange={e => {
            const f = e.target.files[0]
            if (f) { setComprFile(f); setComprPreview(URL.createObjectURL(f)) }
          }} />
        </div>

        {/* Confirmar */}
        {step === 'carrito' && (
          <button onClick={() => setStep('confirmar')} disabled={!comprFile} className="btn-primary" style={{ opacity: comprFile ? 1 : 0.4 }}>
            Revisar pedido →
          </button>
        )}

        {step === 'confirmar' && (
          <div style={{ background:'var(--bg3)', borderRadius:12, padding:14, display:'flex', flexDirection:'column', gap:10 }}>
            <div style={{ fontWeight:700, fontSize:14 }}>¿Confirmás el pedido?</div>
            <div style={{ fontSize:13, color:'var(--text2)' }}>
              {cart.map((item, i) => (
                <div key={i}>{item.producto.nombre}{item.talle ? ` · talle ${item.talle}` : ''}{item.cantidad > 1 ? ` × ${item.cantidad}` : ''}</div>
              ))}
              <div style={{ marginTop:6, fontWeight:700, color:'var(--accent)' }}>
                {esSena
                  ? 'Sena (50%): $' + montoSena.toLocaleString('es-AR') + ' de $' + total.toLocaleString('es-AR') + ' total'
                  : 'Total: $' + total.toLocaleString('es-AR')}
              </div>
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={() => setStep('carrito')} style={{ flex:1, padding:10, borderRadius:8, border:'1px solid var(--border)', background:'transparent', color:'var(--text2)', cursor:'pointer', fontSize:13 }}>
                Modificar
              </button>
              <button onClick={handleEnviar} disabled={sending} className="btn-primary" style={{ flex:2 }}>
                {sending ? 'Enviando...' : '✓ Enviar pedido'}
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SHARED
// ─────────────────────────────────────────────────────────────────────────────

function CopiableRow({ label, value }) {
  const [copied, setCopied] = useState(false)
  function copiar() {
    navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:4 }}>
      <span style={{ fontSize:12, color:'var(--text2)', width:40 }}>{label}</span>
      <span style={{ flex:1, fontSize:14, fontWeight:600, letterSpacing:1 }}>{value}</span>
      <button onClick={copiar}
        style={{ padding:'4px 10px', fontSize:12, borderRadius:6, border:'1px solid var(--border)', background: copied ? 'rgba(74,222,128,0.15)' : 'transparent', color: copied ? '#4ade80' : 'var(--text2)', cursor:'pointer' }}>
        {copied ? '✓ Copiado' : 'Copiar'}
      </button>
    </div>
  )
}

function Toast({ msg }) {
  return (
    <div style={{ position:'fixed', bottom:80, left:'50%', transform:'translateX(-50%)', background:'#1f1f1f', border:'1px solid rgba(255,255,255,0.12)', color:'#f1f5f9', padding:'10px 18px', borderRadius:10, fontSize:13, fontWeight:500, zIndex:300, whiteSpace:'nowrap' }}>
      {msg}
    </div>
  )
}

function Cargando() {
  return <div style={{ padding:24, color:'var(--text2)', fontSize:14 }}>Cargando...</div>
}

// Shared style objects
const iStyle = { flex:1, padding:'8px 10px', borderRadius:8, border:'1px solid var(--border)', background:'var(--bg3)', color:'var(--text)', fontSize:14 }
const selectStyle = { padding:'8px 10px', borderRadius:8, border:'1px solid var(--border)', background:'var(--bg3)', color:'var(--text)', fontSize:14, width:'100%' }
const btnSecStyle = { padding:'5px 10px', fontSize:12, borderRadius:6, border:'1px solid var(--border)', background:'transparent', color:'var(--text2)', cursor:'pointer' }
const btnDangerStyle = { padding:'5px 10px', fontSize:12, borderRadius:6, border:'1px solid rgba(248,113,113,0.3)', background:'rgba(248,113,113,0.1)', color:'#f87171', cursor:'pointer' }
