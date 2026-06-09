// Supabase Edge Function: send-push
//
// Envía notificaciones push a uno o más usuarios via WebPush + VAPID.
//
// Body JSON esperado:
//   { title, body, url, user_ids?: string[], emails?: string[], all?: boolean }
//
// Si PUSH_TESTING_MODE=true (default), ignora los destinatarios pedidos y
// solo envía a TEST_EMAIL — así nunca molestamos a usuarios reales durante pruebas.
//
// Variables de entorno requeridas:
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_MAILTO
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//   PUSH_TESTING_MODE (default: "true")
//   TEST_EMAIL (default: "ojeda.gonza@hotmail.com")

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const SUPABASE_URL      = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const VAPID_PUBLIC_KEY  = Deno.env.get('VAPID_PUBLIC_KEY')!
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!
const VAPID_MAILTO      = Deno.env.get('VAPID_MAILTO') || 'mailto:admin@flamatraining.com'
const TEST_EMAIL        = Deno.env.get('TEST_EMAIL') || 'ojeda.gonza@hotmail.com'
const TESTING_MODE      = (Deno.env.get('PUSH_TESTING_MODE') ?? 'true').toLowerCase() !== 'false'

webpush.setVapidDetails(VAPID_MAILTO, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    // Verificar que el caller esté autenticado
    const authHeader = req.headers.get('Authorization')
    const token = authHeader?.replace('Bearer ', '')
    if (!token) return json({ error: 'No autorizado' }, 401)

    const { title, body, url = '/', user_ids, emails, all } = await req.json()
    if (!title || !body) return json({ error: 'Faltan title y/o body' }, 400)

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

    // Verificar usuario
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
    if (authErr || !user) return json({ error: 'Token inválido' }, 401)

    // Buscar suscripciones filtradas
    let query = supabase
      .from('push_subscriptions')
      .select('user_id, subscription, profiles!inner(email)')

    if (TESTING_MODE) {
      // ⚠️  Solo al email de prueba — no molestar a nadie más
      query = query.eq('profiles.email', TEST_EMAIL)
      console.log(`[send-push] TESTING_MODE activo — solo enviando a ${TEST_EMAIL}`)
    } else if (user_ids?.length) {
      query = query.in('user_id', user_ids)
    } else if (emails?.length) {
      query = query.in('profiles.email', emails)
    } else if (all) {
      // no filter — todos
    } else {
      return json({ error: 'Especificar user_ids, emails o all=true' }, 400)
    }

    const { data: subs, error: dbErr } = await query
    if (dbErr) return json({ error: dbErr.message }, 500)

    const payload = JSON.stringify({ title, body, url })
    const results = []

    for (const row of subs || []) {
      const sub = row.subscription as webpush.PushSubscription
      if (!sub?.endpoint) continue

      try {
        await webpush.sendNotification(sub, payload)
        results.push({ user_id: row.user_id, ok: true })
      } catch (e: unknown) {
        const err = e as { statusCode?: number; message?: string }
        console.warn(`[send-push] Error enviando a ${row.user_id}:`, err.message)
        results.push({ user_id: row.user_id, ok: false, status: err.statusCode, error: err.message })

        // Suscripción expirada → limpiar
        if (err.statusCode === 410 || err.statusCode === 404) {
          await supabase.from('push_subscriptions').delete().eq('user_id', row.user_id)
        }
      }
    }

    console.log(`[send-push] Enviado a ${results.filter(r => r.ok).length}/${results.length} suscripciones`)
    return json({ ok: true, sent: results.filter(r => r.ok).length, total: results.length, results, testing: TESTING_MODE })

  } catch (err) {
    console.error('[send-push] Error:', err)
    return json({ error: String(err) }, 500)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'content-type': 'application/json' },
  })
}
