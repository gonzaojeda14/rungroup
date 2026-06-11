// Supabase Edge Function: notif-flamitas-auto
//
// Busca carreras con flama_points=true que arrancaron hace ~2 horas y
// todavía no tienen flamitas_notif_enviada=true. Notifica a los Inscriptos
// y Stand Flama que ya pueden reclamar sus Flamitas.
//
// Schedulear con cron: */30 * * * *  (cada 30 minutos)
// Deploy: npx supabase functions deploy notif-flamitas-auto --project-ref <ref>

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
    const ahora = new Date()

    // Ventana: carreras que empezaron entre hace 1h45m y hace 4h
    // (margen amplio para que ningún cron run la pierda)
    const desdeMs = ahora.getTime() - 4 * 60 * 60 * 1000
    const hastaMs = ahora.getTime() - 1.75 * 60 * 60 * 1000

    // Buscamos carreras en un rango de ±1 día para cubrir el desfasaje UTC/local
    const desdeFecha = new Date(desdeMs).toISOString().split('T')[0]
    const hastaFecha = new Date(hastaMs + 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    const { data: carreras, error: errCar } = await supabase
      .from('carreras')
      .select('id, nombre, fecha, hora, flama_points, flamitas_notif_enviada')
      .eq('flama_points', true)
      .eq('flamitas_notif_enviada', false)
      .gte('fecha', desdeFecha)
      .lte('fecha', hastaFecha)

    if (errCar) return json({ error: errCar.message }, 500)
    if (!carreras?.length) return json({ ok: true, mensaje: 'Sin carreras elegibles', enviadas: 0 })

    let totalEnviadas = 0

    for (const carrera of carreras) {
      // Calcular timestamp de inicio de la carrera
      // hora viene de Postgres como "HH:MM:SS" en hora Argentina (UTC-3) — convertir a UTC
      const horaStr = (carrera.hora ?? '00:00').substring(0, 5)
      const inicioCarreraLocal = new Date(`${carrera.fecha}T${horaStr}:00`)
      const inicioCarrera = new Date(inicioCarreraLocal.getTime() + 3 * 60 * 60 * 1000)

      // Solo notificar si ya pasaron al menos 1h45m desde el inicio
      if (inicioCarrera.getTime() > hastaMs) continue
      // No notificar si pasaron más de 4 horas (ventana vencida)
      if (inicioCarrera.getTime() < desdeMs) continue

      const { data: participaciones } = await supabase
        .from('participaciones')
        .select('user_id')
        .eq('carrera_id', carrera.id)
        .in('estado', ['Inscripto', 'Stand Flama'])

      if (!participaciones?.length) {
        // Marcar como enviada igual para no reintentar
        await supabase.from('carreras').update({ flamitas_notif_enviada: true }).eq('id', carrera.id)
        continue
      }

      const userIds = participaciones.map((p: any) => p.user_id)

      const res = await fetch(PUSH_NOTIF_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
          'apikey': SERVICE_ROLE_KEY,
        },
        body: JSON.stringify({
          title: '💎 ¡Ya podés sumar tus Flamitas!',
          body: `Subí tu foto de ${carrera.nombre} antes de que pasen 7 días.`,
          url: '/mas',
          user_ids: userIds,
        }),
      })

      const result = await res.json().catch(() => ({}))
      console.log(`[notif-flamitas-auto] ${carrera.nombre}: ${result.sent ?? 0} enviadas`)
      totalEnviadas += result.sent ?? 0

      await supabase.from('carreras').update({ flamitas_notif_enviada: true }).eq('id', carrera.id)
    }

    return json({ ok: true, enviadas: totalEnviadas })

  } catch (err) {
    console.error('[notif-flamitas-auto]', err)
    return json({ error: String(err) }, 500)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'content-type': 'application/json' },
  })
}
