// Supabase Edge Function: notif-cert-vencido
//
// Notifica a los corredores cuyo certificado médico venció (año anterior).
// Se ejecuta una vez por año el 8 de enero (para no molestar el 1/1 a las 00hs).
//
// Schedulear con cron: 0 10 8 1 *  (8 de enero a las 10am UTC)
// Deploy: npx supabase functions deploy notif-cert-vencido --project-ref <ref>
//
// También puede dispararse manualmente: POST /functions/v1/notif-cert-vencido

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
    const anioActual = new Date().getFullYear()

    // Corredores con certificado del año anterior (vencido) y activos
    const { data: perfiles, error } = await supabase
      .from('profiles')
      .select('id, nombre, certificado_fecha')
      .not('certificado_url', 'is', null)
      .not('certificado_fecha', 'is', null)
      .neq('activo', false)
      .lt('certificado_fecha', `${anioActual}-01-01`)

    if (error) return json({ error: error.message }, 500)
    if (!perfiles?.length) return json({ ok: true, mensaje: 'Ningún certificado vencido', enviadas: 0 })

    const userIds = perfiles.map((p: any) => p.id)

    const res = await fetch(PUSH_NOTIF_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'apikey': SERVICE_ROLE_KEY,
      },
      body: JSON.stringify({
        title: '⚠️ Tu certificado médico venció',
        body: 'Renovalo en Mi Perfil para seguir participando en carreras.',
        url: '/perfil?tab=salud',
        user_ids: userIds,
      }),
    })

    const result = await res.json().catch(() => ({}))
    console.log(`[notif-cert-vencido] ${result.sent ?? 0} notificaciones enviadas a ${userIds.length} usuarios`)

    return json({ ok: true, usuarios: userIds.length, enviadas: result.sent ?? 0 })

  } catch (err) {
    console.error('[notif-cert-vencido]', err)
    return json({ error: String(err) }, 500)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'content-type': 'application/json' },
  })
}
