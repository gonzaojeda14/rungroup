import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'

const DISTANCIAS_CALLE = ['3K', '5K', '8K', '10K', '15K', '21K', '25K', '30K', '42K']
const CARRERAS_TRAIL = ['Patagonia Run', 'El Cruce', 'La Etapa', 'UTACCH', 'Champanqui']

function tiempoASegundos(texto) {
  const partes = texto.split(':').map(Number)
  if (partes.some(isNaN)) return null
  if (partes.length === 3) return partes[0] * 3600 + partes[1] * 60 + partes[2]
  if (partes.length === 2) return partes[0] * 60 + partes[1]
  return null
}

function segundosATiempo(seg) {
  const h = Math.floor(seg / 3600)
  const m = Math.floor((seg % 3600) / 60)
  const s = seg % 60
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
}

function validarTiempo(texto) {
  return /^\d{1,2}:\d{2}(:\d{2})?$/.test(texto.trim())
}

function autoformatTiempo(valor) {
  // Siempre trabajar con dígitos puros para evitar bugs con el modo manual
  let nums = valor.replace(/\D/g, '')
  // Bloquear dígito inválido en posición de decenas de minutos (pos 2) y segundos (pos 4)
  if (nums.length >= 3 && parseInt(nums[2]) > 5) nums = nums.slice(0, 2)
  if (nums.length >= 5 && parseInt(nums[4]) > 5) nums = nums.slice(0, 4)
  nums = nums.slice(0, 6)
  if (nums.length <= 2) return nums
  if (nums.length <= 4) return `${nums.slice(0,2)}:${nums.slice(2)}`
  return `${nums.slice(0,2)}:${nums.slice(2,4)}:${nums.slice(4)}`
}

function autoformatK(valor) {
  const limpio = valor.replace(/[^0-9]/g, '')
  return limpio
}

function RecordRow({ distancia, tipo, carreraNombre, esPropio, rec, esteEditando, form, setForm, setEditando, msg, saving, validarTiempo, autoformatTiempo, guardarRecord }) {
  if (!esPropio) {
    return (
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
        <span style={{ fontSize: '14px' }}>{distancia}</span>
        <span style={{ fontSize: '14px', fontWeight: 600, color: rec ? '#4ade80' : 'var(--text2)' }}>
          {rec ? rec.tiempo_texto : '—'}
        </span>
      </div>
    )
  }

  return (
    <div style={{ borderBottom: '1px solid var(--border)', padding: '8px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '14px' }}>{distancia}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {rec && <span style={{ fontSize: '14px', fontWeight: 700, color: '#4ade80' }}>{rec.tiempo_texto}</span>}
          {rec?.fecha && <span style={{ fontSize: '11px', color: 'var(--text2)' }}>{rec.fecha}</span>}
          {!esteEditando && (
            <button
              onClick={() => { setEditando(distancia); setForm({ tiempo: rec?.tiempo_texto || '', fecha: rec?.fecha || '' }) }}
              style={{ fontSize: '11px', color: 'var(--text2)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px' }}
            >
              {rec ? 'Editar' : '+ Agregar'}
            </button>
          )}
        </div>
      </div>

      {esteEditando && (
        <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {msg && <p style={{ fontSize: '12px', color: '#f87171', margin: 0 }}>{msg}</p>}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <input
              value={form.tiempo}
              onChange={e => setForm(f => ({ ...f, tiempo: autoformatTiempo(e.target.value) }))}
              placeholder="HH:MM:SS"
              inputMode="numeric"
              style={{ width: '120px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text)', padding: '6px 10px', fontSize: '14px', fontFamily: 'inherit' }}
            />
            <input
              type="date"
              value={form.fecha}
              onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))}
              style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text)', padding: '6px 10px', fontSize: '13px', fontFamily: 'inherit' }}
            />
            <button
              className="btn-primary"
              style={{ height: 34, fontSize: 12, padding: '0 14px' }}
              disabled={saving || !validarTiempo(form.tiempo)}
              onClick={() => guardarRecord(distancia, tipo, carreraNombre)}
            >
              {saving ? '...' : 'Guardar'}
            </button>
            <button
              onClick={() => setEditando(null)}
              className="btn-ghost"
              style={{ height: 34, fontSize: 12, padding: '0 12px' }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function RecordsPersonales({ userId }) {
  const { user } = useAuth()
  const uid = userId || user.id
  const esPropio = uid === user.id

  const [records, setRecords] = useState({}) // { distancia: { tiempo_texto, tiempo_segundos, fecha } }
  const [editando, setEditando] = useState(null) // distancia key que se está editando
  const [form, setForm] = useState({ tiempo: '', fecha: '' })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  // Para custom calle
  const [customCalle, setCustomCalle] = useState('')
  const [showCustomCalle, setShowCustomCalle] = useState(false)

  // Para trail: { carreraNombre: { distancia: '', tiempo: '', fecha: '' } }
  const [trailForms, setTrailForms] = useState({})
  const [trailEditando, setTrailEditando] = useState(null)

  useEffect(() => { fetchRecords() }, [uid])

  async function fetchRecords() {
    const { data } = await supabase
      .from('records_personales')
      .select('*')
      .eq('user_id', uid)
    const map = {}
    ;(data || []).forEach(r => { map[r.distancia] = r })
    setRecords(map)
  }

  async function guardarRecord(distancia, tipo, carreraNombre = null) {
    if (!validarTiempo(form.tiempo)) { setMsg('Formato inválido'); return }
    const seg = tiempoASegundos(form.tiempo)
    if (!seg) return
    const tiempoTexto = segundosATiempo(seg)
    setSaving(true)

    // Bloquear solo si el tiempo nuevo es peor que el existente
    const existente = records[distancia]
    if (existente && seg > existente.tiempo_segundos) {
      setMsg('Ya tenés un mejor tiempo registrado')
      setSaving(false)
      return
    }

    await supabase.from('records_personales').upsert({
      user_id: uid,
      distancia,
      tipo,
      tiempo_segundos: seg,
      tiempo_texto: tiempoTexto,
      carrera_nombre: carreraNombre,
      fecha: form.fecha || null,
      fuente: 'manual',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,distancia' })

    await fetchRecords()
    setEditando(null)
    setTrailEditando(null)
    setForm({ tiempo: '', fecha: '' })
    setMsg('')
    setSaving(false)
  }

  async function guardarTrail(carreraNombre) {
    const tf = trailForms[carreraNombre] || {}
    if (!tf.distancia) { setMsg('Ingresá la distancia'); return }
    if (!validarTiempo(tf.tiempo || '')) { setMsg('Formato de tiempo inválido'); return }

    const distK = tf.distancia.endsWith('K') ? tf.distancia : `${tf.distancia}K`
    const distancia = `${carreraNombre} ${distK}`
    const seg = tiempoASegundos(tf.tiempo)
    const tiempoTexto = segundosATiempo(seg)

    const existente = records[distancia]
    if (existente && seg >= existente.tiempo_segundos) {
      setMsg('Ya tenés un mejor tiempo registrado')
      return
    }

    setSaving(true)
    await supabase.from('records_personales').upsert({
      user_id: uid,
      distancia,
      tipo: 'trail',
      tiempo_segundos: seg,
      tiempo_texto: tiempoTexto,
      carrera_nombre: carreraNombre,
      fecha: tf.fecha || null,
      fuente: 'manual',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,distancia' })

    await fetchRecords()
    setTrailEditando(null)
    setTrailForms(prev => ({ ...prev, [carreraNombre]: {} }))
    setMsg('')
    setSaving(false)
  }

  async function guardarCustomCalle() {
    if (!customCalle) return
    const distK = customCalle.endsWith('K') ? customCalle : `${customCalle}K`
    setEditando(distK)
    setShowCustomCalle(false)
    setCustomCalle('')
  }

  // Registros trail del usuario (para mostrar los ya cargados)
  const trailKeys = Object.keys(records).filter(k => records[k].tipo === 'trail')

  // Todas las distancias de calle ordenadas de menor a mayor
  const customCalle2 = Object.keys(records).filter(k => records[k].tipo === 'calle' && !DISTANCIAS_CALLE.includes(k))
  const todasDistanciasCalle = [...new Set([...DISTANCIAS_CALLE, ...customCalle2])]
    .sort((a, b) => parseFloat(a) - parseFloat(b))

  return (
    <div className="card" style={{ marginBottom: '12px' }}>
      <h3 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '16px' }}>🏅 Records personales</h3>

      {/* CALLE */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>🏃 Calle</div>
        {todasDistanciasCalle.map(d => (
          <RecordRow
            key={d}
            distancia={d}
            tipo="calle"
            esPropio={esPropio}
            rec={records[d]}
            esteEditando={editando === d}
            form={form}
            setForm={setForm}
            setEditando={setEditando}
            msg={msg}
            saving={saving}
            validarTiempo={validarTiempo}
            autoformatTiempo={autoformatTiempo}
            guardarRecord={guardarRecord}
          />
        ))}

        {esPropio && (
          showCustomCalle ? (
            <div style={{ display: 'flex', gap: '8px', marginTop: '8px', alignItems: 'center' }}>
              <input
                value={customCalle}
                onChange={e => setCustomCalle(autoformatK(e.target.value))}
                onBlur={() => {
                  if (customCalle && !customCalle.endsWith('K'))
                    setCustomCalle(customCalle + 'K')
                }}
                placeholder="Ej: 12"
                inputMode="numeric"
                style={{ width: '80px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text)', padding: '6px 10px', fontSize: '14px', fontFamily: 'inherit' }}
              />
              <span style={{ fontSize: '13px', color: 'var(--text2)' }}>K</span>
              <button className="btn-primary" style={{ height: 32, fontSize: 12, padding: '0 12px' }} onClick={guardarCustomCalle}>OK</button>
              <button onClick={() => { setShowCustomCalle(false); setCustomCalle('') }} style={{ height: 32, fontSize: 12, padding: '0 12px', background: 'rgba(248,113,113,0.12)', color: '#f87171', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit' }}>Cancelar</button>
            </div>
          ) : (
            <button onClick={() => setShowCustomCalle(true)} style={{ marginTop: '8px', fontSize: '12px', color: 'var(--text2)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
              + Otra distancia
            </button>
          )
        )}
      </div>

      {/* TRAIL */}
      <div>
        <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>🏔 Trail</div>
        {CARRERAS_TRAIL.map(carrera => {
          // Encontrar records de esta carrera
          const recsDeEstaCarrera = trailKeys.filter(k => k.startsWith(carrera + ' '))
          const esteTrailEditando = trailEditando === carrera
          const tf = trailForms[carrera] || {}

          return (
            <div key={carrera} style={{ borderBottom: '1px solid var(--border)', padding: '8px 0' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: recsDeEstaCarrera.length > 0 ? '6px' : '0' }}>{carrera}</div>

              {recsDeEstaCarrera.map(k => {
                const r = records[k]
                const dist = k.replace(carrera + ' ', '')
                return (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingLeft: '8px', marginBottom: '4px' }}>
                    <span style={{ fontSize: '13px', color: 'var(--text2)' }}>{dist}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: '#4ade80' }}>{r.tiempo_texto}</span>
                      {r.fecha && <span style={{ fontSize: '11px', color: 'var(--text2)' }}>{r.fecha}</span>}
                      {r.fuente === 'automatico' && <span style={{ fontSize: '10px', color: '#60a5fa', background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.2)', borderRadius: '4px', padding: '1px 5px' }}>auto</span>}
                    </div>
                  </div>
                )
              })}

              {esPropio && (
                esteTrailEditando ? (
                  <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px', paddingLeft: '8px' }}>
                    {msg && <p style={{ fontSize: '12px', color: '#f87171', margin: 0 }}>{msg}</p>}
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <input
                          value={tf.distancia || ''}
                          onChange={e => setTrailForms(prev => ({ ...prev, [carrera]: { ...tf, distancia: autoformatK(e.target.value) } }))}
                          onBlur={() => {
                            if (tf.distancia && !tf.distancia.endsWith('K'))
                              setTrailForms(prev => ({ ...prev, [carrera]: { ...tf, distancia: tf.distancia + 'K' } }))
                          }}
                          placeholder="Dist"
                          inputMode="numeric"
                          style={{ width: '60px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text)', padding: '6px 8px', fontSize: '13px', fontFamily: 'inherit' }}
                        />
                        <span style={{ fontSize: '12px', color: 'var(--text2)' }}>K</span>
                      </div>
                      <input
                        value={tf.tiempo || ''}
                        onChange={e => setTrailForms(prev => ({ ...prev, [carrera]: { ...tf, tiempo: autoformatTiempo(e.target.value) } }))}
                        placeholder="HH:MM:SS"
                        inputMode="numeric"
                        style={{ width: '110px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text)', padding: '6px 10px', fontSize: '13px', fontFamily: 'inherit' }}
                      />
                      <input
                        type="date"
                        value={tf.fecha || ''}
                        onChange={e => setTrailForms(prev => ({ ...prev, [carrera]: { ...tf, fecha: e.target.value } }))}
                        style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text)', padding: '6px 8px', fontSize: '12px', fontFamily: 'inherit' }}
                      />
                      <button
                        className="btn-primary"
                        style={{ height: 32, fontSize: 12, padding: '0 12px' }}
                        disabled={saving || !tf.distancia || !validarTiempo(tf.tiempo || '')}
                        onClick={() => guardarTrail(carrera)}
                      >
                        {saving ? '...' : 'Guardar'}
                      </button>
                      <button onClick={() => { setTrailEditando(null); setMsg('') }} className="btn-ghost" style={{ height: 32, fontSize: 12, padding: '0 12px' }}>Cancelar</button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => { setTrailEditando(carrera); setMsg('') }}
                    style={{ fontSize: '12px', color: 'var(--text2)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0 0 8px' }}
                  >
                    + Agregar tiempo
                  </button>
                )
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
