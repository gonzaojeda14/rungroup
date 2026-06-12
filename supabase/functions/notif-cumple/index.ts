// Supabase Edge Function: notif-cumple
//
// Notifica a todos los admins cuando algún corredor cumple años hoy.
// Se ejecuta diariamente a las 03:00 UTC.
//
// Schedulear con cron: 0 3 * * *
// Deploy: npx supabase functions deploy notif-cumple --project-ref <ref>
//
// También puede dispararse manualmente: POST /functions/v1/notif-cumple

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

    // Día y mes de hoy en UTC
    const hoy = new Date()
    const mes = hoy.getUTCMonth() + 1  // 1–12
    const dia = hoy.getUTCDate()        // 1–31

    // Corredores no-admin con fecha_nacimiento que coincide con hoy (día y mes)
    const { data: perfiles, error } = await supabase
      .from('profiles')
      .select('id, nombre, fecha_nacimiento')
      .not('fecha_nacimiento', 'is', null)
      .neq('role', 'admin')

    if (error) return json({ error: error.message }, 500)

    const cumpleaneros = (perfiles || []).filter((p: any) => {
      const fn = new Date(p.fecha_nacimiento)
      return fn.getUTCMonth() + 1 === mes && fn.getUTCDate() === dia
    })

    if (!cumpleaneros.length) {
      return json({ ok: true, mensaje: 'Nadie cumple años hoy', enviadas: 0 })
    }

    // IDs de los admins
    const { data: admins } = await supabase
      .from('profiles')
      .select('id')
      .eq('role', 'admin')

    const adminIds = (admins || []).map((a: any) => a.id)
    if (!adminIds.length) return json({ ok: true, mensaje: 'Sin admins registrados', enviadas: 0 })

    // Una notificación por cada cumpleañero
    let totalEnviadas = 0
    for (const c of cumpleaneros) {
      const nombre = c.nombre || 'Un corredor'
      const res = await fetch(PUSH_NOTIF_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
          'apikey': SERVICE_ROLE_KEY,
        },
        body: JSON.stringify({
          title: `🎂 ¡Hoy cumple años ${nombre}!`,
          body: `No te olvides de felicitarlo/a 🎉`,
          url: '/corredores',
          user_ids: adminIds,
        }),
      })
      const result = await res.json().catch(() => ({}))
      totalEnviadas += result.sent ?? 0
      console.log(`[notif-cumple] ${nombre}: ${result.sent ?? 0} admins notificados`)
    }

    return json({ ok: true, cumpleaneros: cumpleaneros.length, enviadas: totalEnviadas })

  } catch (err) {
    console.error('[notif-cumple]', err)
    return json({ error: String(err) }, 500)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'content-type': 'application/json' },
  })
}
