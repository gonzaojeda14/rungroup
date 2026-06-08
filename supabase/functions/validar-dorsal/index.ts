// Supabase Edge Function: validar-dorsal
//
// Recibe { envio_id }, busca la foto en `puntos_carreras`, le pide a Claude
// (visión) que confirme si en la imagen se ve un dorsal y una medalla, y decide:
//   • dorsal y medalla visibles, confianza no-baja → estado = 'validado' (se acreditan los puntos)
//   • si no                       , intento 1      → estado = 'rechazado' (el corredor puede reintentar 1 vez)
//   • si no                       , intento 2      → estado = 'revision_admin' (veredicto final manual,
//                                                     el admin ve AMBAS fotos — ya no hay más reintentos)
//
// Ya NO se compara contra ningún "dorsal declarado": un valor autoreportado en el
// mismo momento en que se sube la prueba no aporta nada para verificar — la propia
// foto (dorsal + medalla a la vista) es la prueba. El número que la IA detecta se
// guarda solo como dato informativo.
//
// MODO SIMULACIÓN (SIMULAR_IA=true): no llama a la API de Anthropic — no gasta
// absolutamente nada — y devuelve un resultado de prueba DETERMINÍSTICO según
// el ID del envío (alterna validado/rechazado), para poder probar el flujo
// completo (intento 1 rechazado → reintento → escalado, o validación directa)
// sin gastar en llamadas reales.
//
// Cada corrida (real o simulada) queda registrada en `validaciones_log`, para que
// puedas auditar cuántas llamadas REALES a la API se hicieron (debería ser como
// máximo 1 por intento, o sea, 2 como tope absoluto por solicitud).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
const SIMULAR_IA = (Deno.env.get('SIMULAR_IA') || '').toLowerCase() === 'true'
const MODEL = 'claude-haiku-4-5-20251001'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const { envio_id } = await req.json()
    if (!envio_id) return json({ error: 'Falta envio_id' }, 400)

    const supabase = createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!)

    const { data: envio, error: errEnvio } = await supabase
      .from('puntos_carreras')
      .select('id, foto_url, estado, intentos, user_id, carrera_id')
      .eq('id', envio_id)
      .single()

    if (errEnvio || !envio) return json({ error: 'Envío no encontrado' }, 404)

    // Idempotencia: si ya se resolvió (por esta misma función o por el admin),
    // NO se genera ninguna llamada nueva — esto es lo que evita que un reintento
    // de invocación o un doble click termine gastando de más.
    if (envio.estado !== 'pendiente') {
      return json({ ok: true, info: 'Ya estaba resuelto — no se generó ninguna llamada a la IA' })
    }

    // ── PRE-APROBACIÓN ──
    // Si el profe ya marcó "llegó" durante la ventana de pre-aprobación
    // (Flama Points → "Carrera actual"), no hace falta gastar en análisis de
    // IA: ya hay confirmación humana directa de que corrió. Se aprueba sin
    // pasar la foto por Claude.
    //
    // Aun así — y esto es a pedido explícito — NO se aprueba al instante:
    // se espera ~1 minuto antes de pasar a "validado", para que en la UI se
    // vea primero "En revisión" y luego "Aprobado", igual que en el flujo con
    // IA. Si se aprobara de inmediato se notaría que hubo un "atajo" manual,
    // y eso podría dar la sensación de favoritismo o trampa.
    const { data: participacion } = await supabase
      .from('participaciones')
      .select('asistencia_confirmada, asistencia_no_vino')
      .eq('user_id', envio.user_id)
      .eq('carrera_id', envio.carrera_id)
      .maybeSingle()

    if (participacion?.asistencia_confirmada) {
      await supabase.from('validaciones_log').insert({
        envio_id: envio.id,
        intento: envio.intentos,
        modo: 'pre_aprobado',
        resultado: JSON.stringify({ asistencia_confirmada: true }),
      })

      // Demora artificial: que se vea "En revisión" durante 1 minuto antes de "Aprobado"
      await new Promise(resolve => setTimeout(resolve, 60_000))

      await supabase.from('puntos_carreras').update({
        estado: 'validado',
        revisado_at: new Date().toISOString(),
      }).eq('id', envio_id)
      return json({ ok: true, resultado: 'validado', via: 'pre_aprobado' })
    }

    // ── PRE-RECHAZO ──
    // Lógica inversa: si el profe marcó "No vino", ya hay confirmación humana
    // de que no corrió, así que no tiene sentido gastar en análisis de IA —
    // se rechaza directo. Misma demora artificial de ~1 minuto para que se
    // vea primero "En revisión" y después el rechazo, en vez de un rechazo
    // instantáneo que delataría el atajo manual.
    if (participacion?.asistencia_no_vino) {
      await supabase.from('validaciones_log').insert({
        envio_id: envio.id,
        intento: envio.intentos,
        modo: 'pre_rechazado',
        resultado: JSON.stringify({ asistencia_no_vino: true }),
      })

      await new Promise(resolve => setTimeout(resolve, 60_000))

      await supabase.from('puntos_carreras').update({
        estado: 'rechazado',
        motivo: 'Según el registro del profe, no corriste esta carrera',
        revisado_at: new Date().toISOString(),
      }).eq('id', envio_id)
      return json({ ok: true, resultado: 'rechazado', via: 'pre_rechazado' })
    }

    let analisis: { dorsal_visible: boolean; numero_detectado: string | null; medalla_visible: boolean; confianza: string } | null

    if (SIMULAR_IA) {
      // ── MODO SIMULACIÓN — cero costo, cero llamadas a Anthropic ──
      // Alterna validado/rechazado según un dígito del UUID, para poder probar
      // el flujo completo eligiendo distintos envíos.
      const ultimoDigito = [...envio.id].reverse().find(ch => /\d/.test(ch))
      const ok = ultimoDigito === undefined || Number(ultimoDigito) % 2 === 0
      analisis = {
        dorsal_visible: ok,
        numero_detectado: ok ? '1234' : null,
        medalla_visible: ok,
        confianza: ok ? 'alta' : 'baja',
      }
    } else {
      // ── MODO REAL — descarga la imagen y se la manda a Claude ──
      const imgRes = await fetch(envio.foto_url)
      const imgBuffer = new Uint8Array(await imgRes.arrayBuffer())
      const base64 = btoa(String.fromCharCode(...imgBuffer))
      const mediaType = imgRes.headers.get('content-type') || 'image/jpeg'

      const prompt = `Esta es una foto que un corredor subió como comprobante de haber completado una carrera. Debe mostrar su número de dorsal (el cartel/etiqueta numerada que se usa durante la carrera) y, opcionalmente, una medalla de finisher. Puede ser una selfie o una foto sacada por otra persona — ambas son válidas.

Respondé ÚNICAMENTE con un JSON (sin texto adicional, sin markdown) con esta forma exacta:
{"dorsal_visible": true|false, "numero_detectado": "string o null", "medalla_visible": true|false, "confianza": "alta"|"media"|"baja"}

- "dorsal_visible": si se puede ver con claridad un dorsal de carrera puesto sobre la persona.
- "numero_detectado": el código de dorsal que ves en la imagen, tal cual aparece (puede ser solo números o alfanumérico, ej. "1234" o "A1234"), como string. Si no podés leerlo con claridad, poné null. Esto es solo informativo, no se usa para validar.
- "medalla_visible": si se puede ver con claridad una medalla de finisher.
- "confianza": qué tan seguro estás de que la foto efectivamente muestra a una persona con su dorsal puesto (y, si aplica, su medalla).`

      const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': ANTHROPIC_API_KEY!,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 300,
          messages: [{
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
              { type: 'text', text: prompt },
            ],
          }],
        }),
      })

      const aiData = await aiRes.json()
      const textoRespuesta = aiData?.content?.[0]?.text?.trim() || ''
      try {
        analisis = JSON.parse(textoRespuesta.replace(/^```json\s*|\s*```$/g, ''))
      } catch {
        analisis = null
      }
    }

    // Dejar registro de esta corrida — real o simulada — para poder auditar después
    // cuántas llamadas REALES se hicieron (select count(*) from validaciones_log where modo = 'real')
    await supabase.from('validaciones_log').insert({
      envio_id: envio.id,
      intento: envio.intentos,
      modo: SIMULAR_IA ? 'simulado' : 'real',
      resultado: JSON.stringify(analisis),
    })

    // Validación basada PURAMENTE en lo que se ve en la foto — sin comparar
    // contra ningún número "declarado" (eso ya no existe: no aporta nada
    // verificar un autoreporte hecho en el mismo momento que la prueba).
    const aprueba = !!(analisis && analisis.dorsal_visible && analisis.medalla_visible && analisis.confianza !== 'baja')

    if (aprueba) {
      await supabase.from('puntos_carreras').update({
        estado: 'validado',
        revisado_at: new Date().toISOString(),
      }).eq('id', envio_id)
      return json({ ok: true, resultado: 'validado', via: SIMULAR_IA ? 'simulado' : 'ia' })
    }

    if (envio.intentos >= 2) {
      // Segundo intento sin éxito: ya no hay más reintentos — queda para
      // veredicto final manual del admin, que va a ver ambas fotos.
      await supabase.from('puntos_carreras').update({
        estado: 'revision_admin',
        motivo: 'La IA no pudo confirmar dorsal y medalla en los 2 intentos — necesita veredicto final del admin',
      }).eq('id', envio_id)
      return json({ ok: true, resultado: 'revision_admin', via: SIMULAR_IA ? 'simulado' : 'ia' })
    }

    // Primer intento sin éxito: el corredor puede reintentar una vez más
    const motivo = !analisis
      ? 'No se pudo analizar la imagen — probá con otra foto'
      : !analisis.dorsal_visible
        ? 'No se pudo confirmar el dorsal en la foto'
        : !analisis.medalla_visible
          ? 'No se pudo confirmar la medalla en la foto'
          : 'La confianza del análisis fue baja — probá con una foto más clara'

    await supabase.from('puntos_carreras').update({
      estado: 'rechazado',
      motivo,
    }).eq('id', envio_id)
    return json({ ok: true, resultado: 'rechazado', via: SIMULAR_IA ? 'simulado' : 'ia' })

  } catch (err) {
    console.error(err)
    return json({ error: String(err) }, 500)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'content-type': 'application/json' },
  })
}
