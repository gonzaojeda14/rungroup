// Supabase Edge Function: notif-flamitas-recordatorio
//
// Recordatorio para quienes TIENEN la recompensa de Flamitas disponible pero
// todavía NO la usaron (no subieron su foto). Distinto de notif-flamitas-auto,
// que avisa ~2hs después de la carrera que ya se puede reclamar.
//
// Lógica:
//   - Busca carreras con flama_points=true, no es_prueba, que ocurrieron hace
//     ~3 días (ventana 3..PLAZO_RECLAMO_DIAS para tolerar runs perdidos) y que
//     todavía no tienen flamitas_recordatorio_enviada=true.
//   - Para cada una, toma los Inscriptos / Stand Flama y les resta los que ya
//     tienen una fila en puntos_carreras (= ya hicieron uso de la recompensa).
//   - Notifica solo a los que faltan y marca la carrera como recordatorio enviado.
//
// Schedulear con cron: 0 15 * * *  (todos los días a las 15:00 UTC)
// Deploy: npx supabase functions deploy notif-flamitas-recordatorio --project-ref <ref>

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL     = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const PUSH_NOTIF_URL    = `${SUPABASE_URL}/functions/v1/push-notif`

// Mismo plazo de reclamo que usa el frontend (App.jsx / Mas.jsx).
const PLAZO_RECLAMO_DIAS = 7
// A los cuántos días post-carrera se manda el recordatorio.
const DIAS_RECORDATORIO  = 3

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })

  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
    const ahora = new Date()

    // Ventana de fechas elegibles: de hace PLAZO_RECLAMO_DIAS a hace DIAS_RECORDATORIO.
    // El flag flamitas_recordatorio_enviada garantiza un único envío por carrera,
    // así que la ventana amplia solo sirve para recuperar runs perdidos.
    const dia = 24 * 60 * 60 * 1000
    const desdeFecha = new Date(ahora.getTime() - PLAZO_RECLAMO_DIAS * dia).toISOString().split('T')[0]
    const hastaFecha = new Date(ahora.getTime() - DIAS_RECORDATORIO * dia).toISOString().split('T')[0]

    const { data: carreras, error: errCar } = await supabase
      .from('carreras')
      .select('id, nombre, fecha, flama_points, es_prueba, flamitas_recordatorio_enviada')
      .eq('flama_points', true)
      .eq('flamitas_recordatorio_enviada', false)
      .gte('fecha', desdeFecha)
      .lte('fecha', hastaFecha)

    if (errCar) return json({ error: errCar.message }, 500)
    if (!carreras?.length) return json({ ok: true, mensaje: 'Sin carreras elegibles', enviadas: 0 })

    let totalEnviadas = 0

    for (const carrera of carreras) {
      // Igual que el frontend: NULL o false => no es prueba (elegible). Solo se
      // excluyen las marcadas explícitamente como es_prueba=true.
      if (carrera.es_prueba === true) {
        await supabase.from('carreras')
          .update({ flamitas_recordatorio_enviada: true })
          .eq('id', carrera.id)
        continue
      }
      // Quiénes tienen la recompensa disponible (Inscripto / Stand Flama).
      const { data: participaciones } = await supabase
        .from('participaciones')
        .select('user_id')
        .eq('carrera_id', carrera.id)
        .in('estado', ['Inscripto', 'Stand Flama'])

      // Quiénes YA hicieron uso (tienen fila en puntos_carreras para esa carrera).
      const { data: envios } = await supabase
        .from('puntos_carreras')
        .select('user_id')
        .eq('carrera_id', carrera.id)

      const yaUsaron = new Set((envios ?? []).map((e: any) => e.user_id))
      const pendientes = (participaciones ?? [])
        .map((p: any) => p.user_id)
        .filter((uid: string) => !yaUsaron.has(uid))

      if (pendientes.length) {
        const res = await fetch(PUSH_NOTIF_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
            'apikey': SERVICE_ROLE_KEY,
          },
          body: JSON.stringify({
            title: '⏰ ¡No pierdas tus Flamitas!',
            body: `Todavía no subiste tu foto de ${carrera.nombre}. Te quedan pocos días para reclamarlas.`,
            url: '/mas',
            user_ids: pendientes,
          }),
        })

        const result = await res.json().catch(() => ({}))
        console.log(`[notif-flamitas-recordatorio] ${carrera.nombre}: ${result.sent ?? 0} enviadas (${pendientes.length} pendientes)`)
        totalEnviadas += result.sent ?? 0
      }

      // Marcar como recordatorio enviado aunque no hubiera pendientes, para no reintentar.
      await supabase.from('carreras')
        .update({ flamitas_recordatorio_enviada: true })
        .eq('id', carrera.id)
    }

    return json({ ok: true, enviadas: totalEnviadas })

  } catch (err) {
    console.error('[notif-flamitas-recordatorio]', err)
    return json({ error: String(err) }, 500)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'content-type': 'application/json' },
  })
}
