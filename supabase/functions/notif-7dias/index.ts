// Supabase Edge Function: notif-7dias
//
// Busca carreras que ocurren dentro de exactamente 7 días (±12hs de margen)
// y envía una notificación push a todos los participantes con estado
// Inscripto, Quizás o Stand Flama.
//
// Schedulear con:
//   npx supabase functions deploy notif-7dias --project-ref <ref>
//   (y activar el cron desde el dashboard de Supabase → Edge Functions → Schedule)
// O manualmente: POST /functions/v1/notif-7dias con la service role key.

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

    // Ventana: carreras entre hoy+6d12h y hoy+7d12h (±12hs alrededor de los 7 días)
    const ahora = new Date()
    const desde = new Date(ahora.getTime() + 6.5 * 24 * 60 * 60 * 1000)
    const hasta = new Date(ahora.getTime() + 7.5 * 24 * 60 * 60 * 1000)

    const { data: carreras, error: errCar } = await supabase
      .from('carreras')
      .select('id, nombre, fecha')
      .eq('tipo_actividad', 'carrera')
      .gte('fecha', desde.toISOString().split('T')[0])
      .lte('fecha', hasta.toISOString().split('T')[0])

    if (errCar) return json({ error: errCar.message }, 500)
    if (!carreras?.length) return json({ ok: true, mensaje: 'Sin carreras en 7 días', carreras: 0 })

    let totalEnviadas = 0

    for (const carrera of carreras) {
      const { data: participaciones } = await supabase
        .from('participaciones')
        .select('user_id')
        .eq('carrera_id', carrera.id)
        .in('estado', ['Inscripto', 'Quizás', 'Stand Flama'])

      if (!participaciones?.length) continue

      const userIds = participaciones.map((p: any) => p.user_id)

      const res = await fetch(PUSH_NOTIF_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
          'apikey': SERVICE_ROLE_KEY,
        },
        body: JSON.stringify({
          title: `🏃 ¡Faltan 7 días! ${carrera.nombre}`,
          body: 'La carrera se acerca. Revisá los detalles y preparate.',
          url: '/carreras',
          user_ids: userIds,
        }),
      })

      const resultText = await res.text()
      console.log(`[notif-7dias] push-notif status: ${res.status}, body: ${resultText}`)
      const result = JSON.parse(resultText)
      console.log(`[notif-7dias] ${carrera.nombre}: ${result.sent ?? 0} enviadas`)
      totalEnviadas += result.sent ?? 0
    }

    return json({ ok: true, carreras: carreras.length, enviadas: totalEnviadas })

  } catch (err) {
    console.error('[notif-7dias]', err)
    return json({ error: String(err) }, 500)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'content-type': 'application/json' },
  })
}
