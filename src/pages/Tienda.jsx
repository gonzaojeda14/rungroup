import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { notificar } from '../lib/push'
import ConfirmModal from '../components/ConfirmModal'

const CLOUD  = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME
const PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET

const TALLES_ROPA       = ['S', 'M', 'L', 'XL', 'XXL']
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
  if (config?.activa || TIENDA_BETA.includes(user?.email)) return <TiendaPublica config={config} />
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
  const [tab, setTab] = useState('Productos')
  const [productos, setProductos] = useState([])
  const [pedidos, setPedidos] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [confirmarEliminar, setConfirmarEliminar] = useState(null)
  const [fotoAmpliada, setFotoAmpliada] = useState(null)
  const [toast, setToast] = useState('')

  // Config draft
  const [alias, setAlias] = useState(config?.alias || '')
  const [cbu, setCbu] = useState(config?.cbu || '')
  const [activa, setActiva] = useState(config?.activa ?? false)
  const [guardandoConfig, setGuardandoConfig] = useState(false)

  useEffect(() => { fetchProductos(); fetchPedidos() }, [])

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
  }

  const pendientes = pedidos.filter(p => p.estado === 'pendiente').length

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>

      {/* Tabs */}
      <div style={{ padding:'12px 16px 0', flexShrink:0 }}>
        <div style={{ display:'inline-flex', background:'var(--bg3)', borderRadius:10, padding:3, gap:2 }}>
          {['Productos','Compras'].map(t => (
            <button key={t} onClick={() => setTab(t)}
              style={{ position:'relative', padding:'6px 18px', fontSize:13, fontWeight: tab===t ? 700 : 500, color: tab===t ? '#fff' : 'var(--text2)', background: tab===t ? 'var(--accent)' : 'transparent', border:'none', cursor:'pointer', borderRadius:8, transition:'all 0.15s' }}>
              {t}
              {t === 'Compras' && pendientes > 0 && (
                <span style={{ position:'absolute', top:2, right:2, background: tab==='Compras' ? '#fff' : 'var(--accent)', color: tab==='Compras' ? 'var(--accent)' : '#fff', fontSize:10, fontWeight:800, borderRadius:99, minWidth:16, height:16, display:'flex', alignItems:'center', justifyContent:'center', padding:'0 4px', lineHeight:1 }}>{pendientes}</span>
              )}
            </button>
          ))}
        </div>
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
                <input type="checkbox" checked={activa} onChange={e => setActiva(e.target.checked)} />
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
            <button className="btn-accent" style={{ height:34, padding:'0 14px', fontSize:13 }} onClick={() => setShowForm(v => !v)}>
              {showForm ? 'Cancelar' : '+ Nuevo'}
            </button>
          </div>

          {showForm && (
            <ProductoForm onSaved={() => { setShowForm(false); fetchProductos(); showToast('✅ Producto publicado') }} />
          )}

          {productos.length === 0 && !showForm && (
            <div style={{ textAlign:'center', color:'var(--text2)', fontSize:14, padding:'32px 0' }}>No hay productos.</div>
          )}

          {productos.map(p => (
            <ProductoCardAdmin key={p.id} p={p}
              onToggle={() => toggleDisponible(p)}
              onEliminar={() => setConfirmarEliminar(p)} />
          ))}
        </>}

        {/* ── COMPRAS ── */}
        {tab === 'Compras' && <>
          {pedidos.length === 0 && (
            <div style={{ textAlign:'center', color:'var(--text2)', fontSize:14, padding:'32px 0' }}>Todavía no hay pedidos.</div>
          )}
          {pedidos.map(p => (
            <PedidoAdminCard key={p.id} pedido={p}
              onVerFoto={url => setFotoAmpliada(url)}
              onEstado={estado => actualizarEstado(p.id, estado)} />
          ))}
        </>}

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
        </div>
      )}
    </div>
  )
}

// ─── FORM NUEVO PRODUCTO ──────────────────────────────────────────────────────

function ProductoForm({ onSaved }) {
  const [nombre, setNombre]           = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [precio, setPrecio]           = useState('')
  const [tipoTalle, setTipoTalle]     = useState('unico')
  const [talles, setTalles]           = useState([])
  const [genero, setGenero]           = useState('Unisex')
  const [fotoFile, setFotoFile]       = useState(null)
  const [fotoPreview, setFotoPreview] = useState(null)
  const [saving, setSaving]           = useState(false)
  const fotoRef = useRef()

  function onTipoChange(tipo) {
    setTipoTalle(tipo)
    setTalles(tallesDefecto(tipo))
  }

  function toggleTalle(t) {
    setTalles(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!nombre || !precio) return
    setSaving(true)

    let foto_url = null, foto_public_id = null
    if (fotoFile) {
      const d = await uploadCloudinary(fotoFile, 'flamarun/tienda')
      foto_url = d.secure_url || null
      foto_public_id = d.public_id || null
    }

    const { error } = await supabase.from('productos').insert([{
      nombre,
      descripcion: descripcion || null,
      precio: parseFloat(precio),
      tipo_talle: tipoTalle,
      talles_disponibles: talles,
      genero,
      foto_url,
      foto_public_id,
    }])

    setSaving(false)
    if (error) { alert('Error al publicar: ' + error.message); return }
    onSaved()
  }

  const allTalles = tipoTalle === 'ropa' ? TALLES_ROPA : tipoTalle === 'zapatillas' ? TALLES_ZAPATILLAS : []

  return (
    <div className="card" style={{ padding:16 }}>
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
              <option value="ropa">Ropa (S–XXL)</option>
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
            <div style={{ fontSize:13, color:'var(--text2)', marginBottom:6 }}>Talles disponibles (desmarcar los que no hay)</div>
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

        {/* Foto */}
        <div className="field">
          <label>Foto del producto</label>
          {fotoPreview ? (
            <div style={{ position:'relative', width:120 }}>
              <img src={fotoPreview} alt="" style={{ width:120, height:120, objectFit:'cover', borderRadius:8, border:'1px solid var(--border)' }} />
              <button type="button" onClick={() => { setFotoFile(null); setFotoPreview(null); fotoRef.current.value = '' }}
                style={{ position:'absolute', top:4, right:4, width:22, height:22, borderRadius:'50%', background:'rgba(0,0,0,0.6)', border:'none', color:'#fff', cursor:'pointer', fontSize:12 }}>✕</button>
            </div>
          ) : (
            <button type="button" onClick={() => fotoRef.current?.click()}
              style={{ padding:10, border:'1px dashed var(--border)', borderRadius:8, background:'transparent', color:'var(--text2)', cursor:'pointer', fontSize:13, width:'100%' }}>
              📷 Elegir foto
            </button>
          )}
          <input ref={fotoRef} type="file" accept="image/*" style={{ display:'none' }} onChange={e => {
            const f = e.target.files[0]
            if (f) { setFotoFile(f); setFotoPreview(URL.createObjectURL(f)) }
          }} />
        </div>

        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? 'Publicando...' : 'Publicar producto'}
        </button>
      </form>
    </div>
  )
}

// ─── CARD PRODUCTO (admin) ────────────────────────────────────────────────────

function ProductoCardAdmin({ p, onToggle, onEliminar }) {
  const talles = p.talles_disponibles || []
  return (
    <div className="card" style={{ padding:'14px 16px', display:'flex', gap:14, opacity: p.disponible ? 1 : 0.55 }}>
      {p.foto_url && (
        <img src={p.foto_url.replace('/upload/', '/upload/w_100,q_auto/')} alt={p.nombre}
          style={{ width:72, height:72, objectFit:'cover', borderRadius:8, flexShrink:0 }} />
      )}
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontWeight:700, fontSize:15 }}>{p.nombre}</div>
        {p.descripcion && <div style={{ fontSize:13, color:'var(--text2)', marginTop:2 }}>{p.descripcion}</div>}
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
        <button onClick={onEliminar} style={btnDangerStyle}>Eliminar</button>
      </div>
    </div>
  )
}

// ─── CARD PEDIDO (admin) ──────────────────────────────────────────────────────

function PedidoAdminCard({ pedido: p, onVerFoto, onEstado }) {
  const items = p.items || []
  const fecha = new Date(p.created_at).toLocaleDateString('es-AR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' })
  const estadoColor = p.estado === 'confirmado' ? '#4ade80' : p.estado === 'cancelado' ? '#f87171' : 'var(--accent)'

  return (
    <div className="card" style={{ padding:'14px 16px' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:10 }}>
        <div>
          <div style={{ fontWeight:700, fontSize:14 }}>{p.perfil?.nombre || 'Usuario'}</div>
          <div style={{ fontSize:11, color:'var(--text2)', marginTop:2 }}>{fecha}</div>
        </div>
        <span style={{ fontSize:12, padding:'3px 10px', borderRadius:20, background:`${estadoColor}22`, color:estadoColor, fontWeight:600, flexShrink:0 }}>{p.estado}</span>
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
        <div style={{ display:'flex', justifyContent:'flex-end', borderTop:'1px solid var(--border)', marginTop:4, paddingTop:4, fontWeight:700, fontSize:14 }}>
          Total: ${Number(p.total).toLocaleString('es-AR')}
        </div>
      </div>

      {p.comprobante_url && (
        <button onClick={() => onVerFoto(p.comprobante_url)}
          style={{ marginTop:10, display:'flex', alignItems:'center', gap:6, padding:'8px 12px', borderRadius:8, border:'1px solid var(--border)', background:'var(--bg3)', color:'var(--text)', fontSize:13, cursor:'pointer', width:'100%' }}>
          🧾 Ver comprobante
        </button>
      )}

      {p.estado === 'pendiente' && (
        <div style={{ display:'flex', gap:8, marginTop:10 }}>
          <button onClick={() => onEstado('confirmado')}
            style={{ flex:1, padding:8, fontSize:13, borderRadius:8, border:'1px solid rgba(74,222,128,0.3)', background:'rgba(74,222,128,0.1)', color:'#4ade80', cursor:'pointer', fontWeight:600 }}>
            ✓ Confirmar
          </button>
          <button onClick={() => onEstado('cancelado')}
            style={{ flex:1, padding:8, fontSize:13, borderRadius:8, border:'1px solid rgba(248,113,113,0.3)', background:'rgba(248,113,113,0.1)', color:'#f87171', cursor:'pointer' }}>
            Cancelar
          </button>
        </div>
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
  const [cart, setCart]             = useState([])  // [{ key, producto, talle }]
  const [cartOpen, setCartOpen]     = useState(false)
  const [talleModal, setTalleModal] = useState(null) // producto que está esperando talle
  const [toast, setToast]           = useState('')

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 2500) }

  useEffect(() => {
    supabase.from('productos').select('*').eq('disponible', true).order('created_at', { ascending: false })
      .then(({ data }) => { setProductos(data || []); setLoading(false) })
  }, [])

  function agregarAlCarrito(producto, talle = null) {
    setCart(prev => [...prev, { key: Math.random().toString(36).slice(2), producto, talle }])
    showToast('✓ Agregado al carrito')
  }

  function quitarDelCarrito(key) {
    setCart(prev => prev.filter(i => i.key !== key))
  }

  function handleAgregar(producto) {
    const necesitaTalle = (producto.talles_disponibles || []).length > 0
    if (necesitaTalle) {
      setTalleModal(producto)
    } else {
      agregarAlCarrito(producto, null)
    }
  }

  if (loading) return <Cargando />

  return (
    <div style={{ padding:16, display:'flex', flexDirection:'column', gap:14, paddingBottom:80 }}>

      {/* Datos de pago */}
      {(config?.alias || config?.cbu) && (
        <div className="card" style={{ padding:'12px 16px' }}>
          <div style={{ fontSize:12, color:'var(--text2)', marginBottom:6 }}>💳 Datos de pago</div>
          {config.alias && <CopiableRow label="Alias" value={config.alias} />}
          {config.cbu   && <CopiableRow label="CBU"   value={config.cbu} />}
        </div>
      )}

      {productos.length === 0 && (
        <div style={{ textAlign:'center', color:'var(--text2)', fontSize:14, padding:'32px 0' }}>No hay productos disponibles.</div>
      )}

      {productos.map(p => (
        <ProductoCardPublica key={p.id} p={p} onAgregar={() => handleAgregar(p)} />
      ))}

      {/* Botón carrito flotante */}
      {cart.length > 0 && (
        <button onClick={() => setCartOpen(true)}
          style={{ position:'fixed', bottom:72, right:16, width:56, height:56, borderRadius:'50%', background:'var(--accent)', border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, boxShadow:'0 4px 16px rgba(0,0,0,0.4)', zIndex:50 }}>
          🛒
          <span style={{ position:'absolute', top:2, right:2, background:'#fff', color:'var(--accent)', fontSize:11, fontWeight:900, borderRadius:99, minWidth:18, height:18, display:'flex', alignItems:'center', justifyContent:'center', padding:'0 4px', lineHeight:1 }}>
            {cart.length}
          </span>
        </button>
      )}

      {/* Modal: elegir talle antes de agregar */}
      {talleModal && (
        <TallePickerModal
          producto={talleModal}
          onConfirmar={talle => { agregarAlCarrito(talleModal, talle); setTalleModal(null) }}
          onClose={() => setTalleModal(null)} />
      )}

      {/* Sheet carrito */}
      {cartOpen && (
        <CartSheet
          cart={cart}
          config={config}
          user={user}
          profile={profile}
          onQuitar={quitarDelCarrito}
          onClose={() => setCartOpen(false)}
          onPedidoEnviado={() => { setCart([]); setCartOpen(false); showToast('✅ Pedido enviado') }} />
      )}

      {toast && <Toast msg={toast} />}
    </div>
  )
}

// ─── CARD PRODUCTO (público) ──────────────────────────────────────────────────

function ProductoCardPublica({ p, onAgregar }) {
  const talles = p.talles_disponibles || []
  return (
    <div className="card" style={{ padding:'14px 16px', display:'flex', gap:14 }}>
      {p.foto_url && (
        <img src={p.foto_url.replace('/upload/', '/upload/w_120,q_auto/')} alt={p.nombre}
          style={{ width:80, height:80, objectFit:'cover', borderRadius:8, flexShrink:0 }} />
      )}
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontWeight:700, fontSize:15 }}>{p.nombre}</div>
        {p.descripcion && <div style={{ fontSize:13, color:'var(--text2)', marginTop:2 }}>{p.descripcion}</div>}
        <div style={{ fontWeight:700, fontSize:16, color:'var(--accent)', marginTop:6 }}>
          ${Number(p.precio).toLocaleString('es-AR')}
        </div>
        {talles.length > 0 && (
          <div style={{ fontSize:12, color:'var(--text2)', marginTop:4 }}>Talles: {talles.join(' · ')}</div>
        )}
        <button onClick={onAgregar} className="btn-accent"
          style={{ marginTop:10, height:32, padding:'0 14px', fontSize:13, width:'100%' }}>
          + Agregar al carrito
        </button>
      </div>
    </div>
  )
}

// ─── TALLE PICKER MODAL ───────────────────────────────────────────────────────

function TallePickerModal({ producto, onConfirmar, onClose }) {
  const [talle, setTalle] = useState(null)
  const talles = producto.talles_disponibles || []

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', zIndex:100, display:'flex', alignItems:'flex-end', justifyContent:'center' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background:'var(--bg2)', borderRadius:'16px 16px 0 0', width:'100%', maxWidth:480, padding:20, display:'flex', flexDirection:'column', gap:14 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div style={{ fontWeight:700, fontSize:16 }}>{producto.nombre}</div>
          <button onClick={onClose} style={{ background:'transparent', border:'none', color:'var(--text2)', fontSize:20, cursor:'pointer' }}>✕</button>
        </div>
        <div style={{ fontSize:14, fontWeight:600 }}>Elegí tu talle</div>
        <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
          {talles.map(t => (
            <button key={t} onClick={() => setTalle(t)}
              style={{ padding:'8px 16px', fontSize:14, borderRadius:20, border:`1px solid ${talle === t ? 'var(--accent)' : 'var(--border)'}`, background: talle === t ? 'var(--accent)' : 'transparent', color: talle === t ? '#fff' : 'var(--text)', cursor:'pointer', fontWeight: talle === t ? 700 : 400 }}>
              {t}
            </button>
          ))}
        </div>
        <button onClick={() => talle && onConfirmar(talle)} disabled={!talle} className="btn-primary" style={{ opacity: talle ? 1 : 0.4 }}>
          Agregar al carrito
        </button>
      </div>
    </div>
  )
}

// ─── CART SHEET ───────────────────────────────────────────────────────────────

function CartSheet({ cart, config, user, profile, onQuitar, onClose, onPedidoEnviado }) {
  const [comprFile, setComprFile]     = useState(null)
  const [comprPreview, setComprPreview] = useState(null)
  const [step, setStep]               = useState('carrito')  // 'carrito' | 'confirmar'
  const [sending, setSending]         = useState(false)
  const comprRef = useRef()

  const total = cart.reduce((s, i) => s + Number(i.producto.precio), 0)

  async function handleEnviar() {
    if (!comprFile) return
    setSending(true)

    const data = await uploadCloudinary(comprFile, 'flamarun/comprobantes')

    const items = cart.map(i => ({
      producto_id: i.producto.id,
      nombre:      i.producto.nombre,
      talle:       i.talle || null,
      precio:      Number(i.producto.precio),
    }))

    const { error } = await supabase.from('pedidos').insert([{
      user_id:              user.id,
      items,
      total,
      comprobante_url:      data.secure_url || null,
      comprobante_public_id: data.public_id || null,
      estado:               'pendiente',
    }])

    if (!error) {
      const { data: admins } = await supabase.from('profiles').select('id').eq('role', 'admin')
      const adminIds = (admins || []).map(a => a.id)
      if (adminIds.length) {
        const resumen = cart.length === 1
          ? `${cart[0].producto.nombre}${cart[0].talle ? ` (${cart[0].talle})` : ''}`
          : `${cart.length} productos`
        notificar(
          '🛍️ Nuevo pedido',
          `${profile?.nombre || 'Alguien'} pidió ${resumen}`,
          '/mas',
          { user_ids: adminIds }
        )
      }
    }

    setSending(false)
    onPedidoEnviado()
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', zIndex:100, display:'flex', alignItems:'flex-end', justifyContent:'center' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background:'var(--bg2)', borderRadius:'16px 16px 0 0', width:'100%', maxWidth:480, maxHeight:'90vh', overflowY:'auto', padding:20, display:'flex', flexDirection:'column', gap:16 }}>

        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div style={{ fontWeight:700, fontSize:16 }}>Carrito ({cart.length})</div>
          <button onClick={onClose} style={{ background:'transparent', border:'none', color:'var(--text2)', fontSize:20, cursor:'pointer' }}>✕</button>
        </div>

        {/* Items */}
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {cart.map(item => (
            <div key={item.key} style={{ display:'flex', gap:12, alignItems:'center' }}>
              {item.producto.foto_url && (
                <img src={item.producto.foto_url.replace('/upload/', '/upload/w_80,q_auto/')} alt=""
                  style={{ width:52, height:52, objectFit:'cover', borderRadius:8, flexShrink:0 }} />
              )}
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:14, fontWeight:600 }}>{item.producto.nombre}</div>
                {item.talle && <div style={{ fontSize:12, color:'var(--text2)' }}>Talle {item.talle}</div>}
                <div style={{ fontSize:13, color:'var(--accent)', fontWeight:700 }}>${Number(item.producto.precio).toLocaleString('es-AR')}</div>
              </div>
              <button onClick={() => onQuitar(item.key)}
                style={{ background:'transparent', border:'none', color:'var(--text2)', fontSize:18, cursor:'pointer', padding:'4px 8px' }}>✕</button>
            </div>
          ))}
        </div>

        {/* Total */}
        <div style={{ display:'flex', justifyContent:'flex-end', borderTop:'1px solid var(--border)', paddingTop:10, fontWeight:700, fontSize:16 }}>
          Total: <span style={{ color:'var(--accent)', marginLeft:6 }}>${total.toLocaleString('es-AR')}</span>
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
                <div key={i}>{item.producto.nombre}{item.talle ? ` · talle ${item.talle}` : ''}</div>
              ))}
              <div style={{ marginTop:6, fontWeight:700, color:'var(--accent)' }}>
                Total: ${total.toLocaleString('es-AR')}
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
