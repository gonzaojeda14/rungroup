// Supabase Edge Function: notif-1dia
//
// Busca carreras que ocurren mañana (±6hs de margen para evitar doble envío)
// y envía una notificación push solo a los Inscriptos.
//
// Schedulear con cron diario a las 09:00 UTC (igual que notif-7dias).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL     = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const PUSH_NOTIF_URL   = `${SUPABASE_URL}/functions/v1/push-notif`

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })

  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

    // Ventana: ±6hs alrededor de 1 día exacto, para apuntar a una sola fecha.
    const ahora = new Date()
    const desde = new Date(ahora.getTime() + 0.75 * 24 * 60 * 60 * 1000)
    const hasta = new Date(ahora.getTime() + 1.25 * 24 * 60 * 60 * 1000)

    const { data: carreras, error: errCar } = await supabase
      .from('carreras')
      .select('id, nombre, fecha')
      .eq('tipo_actividad', 'carrera')
      .gte('fecha', desde.toISOString().split('T')[0])
      .lte('fecha', hasta.toISOString().split('T')[0])

    if (errCar) return json({ error: errCar.message }, 500)
    if (!carreras?.length) return json({ ok: true, mensaje: 'Sin carreras mañana', carreras: 0 })

    let totalEnviadas = 0

    for (const carrera of carreras) {
      const { data: participaciones } = await supabase
        .from('participaciones')
        .select('user_id')
        .eq('carrera_id', carrera.id)
        .eq('estado', 'Inscripto')

      if (!participaciones?.length) continue

      const ids = participaciones.map((p: any) => p.user_id)

      const res = await fetch(PUSH_NOTIF_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
          'apikey': SERVICE_ROLE_KEY,
        },
        body: JSON.stringify({
          title: `🏁 ¡Mañana es el día! ${carrera.nombre}`,
          body: 'Descansá bien esta noche. ¡Mañana a correr!',
          url: '/carreras',
          user_ids: ids,
        }),
      })

      const result = JSON.parse(await res.text())
      console.log(`[notif-1dia] ${carrera.nombre}: ${result.sent ?? 0} enviadas`)
      totalEnviadas += result.sent ?? 0
    }

    return json({ ok: true, carreras: carreras.length, enviadas: totalEnviadas })

  } catch (err) {
    console.error('[notif-1dia]', err)
    return json({ error: String(err) }, 500)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'content-type': 'application/json' },
  })
}
