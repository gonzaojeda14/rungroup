// Supabase Edge Function: push-notif
//
// Envía notificaciones push con payload encriptado (aesgcm) a usuarios específicos.
// Usa WebCrypto puro — sin dependencias externas. Misma firma VAPID que send-push.
//
// Body JSON: { title, body, url?, user_ids?, emails?, all? }
//
// Si PUSH_TESTING_MODE=true (default), solo envía a TEST_EMAIL sin importar los targets.
//
// Secrets requeridos: mismos que send-push (VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT)
// + PUSH_TESTING_MODE (default "true"), TEST_EMAIL (default "ojeda.gonza@hotmail.com")

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL      = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const VAPID_PUBLIC_KEY  = Deno.env.get('VAPID_PUBLIC_KEY')!
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!
const VAPID_SUBJECT     = Deno.env.get('VAPID_SUBJECT')!
const TEST_EMAIL        = Deno.env.get('TEST_EMAIL') || 'ojeda.gonza@hotmail.com'
const TESTING_MODE      = (Deno.env.get('PUSH_TESTING_MODE') ?? 'true').toLowerCase() !== 'false'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey',
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function b64url(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function b64urlDecode(s: string): Uint8Array {
  s = s.replace(/-/g, '+').replace(/_/g, '/')
  while (s.length % 4) s += '='
  return Uint8Array.from(atob(s), c => c.charCodeAt(0))
}

function concat(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((n, a) => n + a.length, 0)
  const out = new Uint8Array(total)
  let i = 0
  for (const a of arrays) { out.set(a, i); i += a.length }
  return out
}

function lengthPrefix(arr: Uint8Array): Uint8Array {
  const out = new Uint8Array(2 + arr.length)
  out[0] = arr.length >> 8; out[1] = arr.length & 0xff
  out.set(arr, 2)
  return out
}

// ── VAPID JWT (copiado del send-push existente que ya funciona) ───────────────

async function makeVapidHeaders(endpoint: string) {
  const url = new URL(endpoint)
  const audience = `${url.protocol}//${url.host}`
  const exp = Math.floor(Date.now() / 1000) + 12 * 3600

  const header  = b64url(new TextEncoder().encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })))
  const payload = b64url(new TextEncoder().encode(JSON.stringify({ aud: audience, exp, sub: VAPID_SUBJECT })))
  const unsigned = `${header}.${payload}`

  const pubKeyBytes = b64urlDecode(VAPID_PUBLIC_KEY)
  const x = b64url(pubKeyBytes.slice(1, 33).buffer)
  const y = b64url(pubKeyBytes.slice(33, 65).buffer)

  const key = await crypto.subtle.importKey(
    'jwk',
    { kty: 'EC', crv: 'P-256', d: VAPID_PRIVATE_KEY.replace(/=+$/, ''), x, y },
    { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']
  )

  const sig = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    new TextEncoder().encode(unsigned)
  )

  const jwt = `${unsigned}.${b64url(sig)}`
  return {
    Authorization: `vapid t=${jwt}, k=${VAPID_PUBLIC_KEY}`,
    TTL: '86400',
  }
}

// ── aesgcm payload encryption (RFC 7516 / Web Push) ─────────────────────────

async function hkdf(ikm: Uint8Array, salt: Uint8Array, info: Uint8Array, len: number): Promise<Uint8Array> {
  const saltKey = await crypto.subtle.importKey('raw', salt, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const prk = new Uint8Array(await crypto.subtle.sign('HMAC', saltKey, ikm))
  const prkKey = await crypto.subtle.importKey('raw', prk, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const T1 = new Uint8Array(await crypto.subtle.sign('HMAC', prkKey, concat(info, new Uint8Array([1]))))
  return T1.slice(0, len)
}

async function encryptPayload(
  p256dh: string, auth: string, plaintext: string
): Promise<{ ciphertext: Uint8Array; salt: Uint8Array; serverPublicKey: Uint8Array }> {
  const clientPubBytes = b64urlDecode(p256dh)
  const authBytes      = b64urlDecode(auth)

  // Server ECDH key pair
  const serverKP = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])
  const serverPubRaw = new Uint8Array(await crypto.subtle.exportKey('raw', serverKP.publicKey))

  // Import client public key
  const clientPub = await crypto.subtle.importKey('raw', clientPubBytes, { name: 'ECDH', namedCurve: 'P-256' }, false, [])

  // Shared secret via ECDH
  const sharedSecret = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: clientPub }, serverKP.privateKey, 256))

  const salt = crypto.getRandomValues(new Uint8Array(16))

  // PRK = HKDF-Extract(auth, sharedSecret)
  const prk = await hkdf(sharedSecret, authBytes, new TextEncoder().encode('Content-Encoding: auth\0'), 32)

  // Context for aesgcm
  const context = concat(
    new TextEncoder().encode('P-256\0'),
    lengthPrefix(clientPubBytes),
    lengthPrefix(serverPubRaw),
  )
  const cek   = await hkdf(prk, salt, concat(new TextEncoder().encode('Content-Encoding: aesgcm\0'),  context), 16)
  const nonce = await hkdf(prk, salt, concat(new TextEncoder().encode('Content-Encoding: nonce\0'), context), 12)

  // AES-128-GCM encrypt — 2-byte padding prefix (zeros = no padding)
  const cekKey = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt'])
  const padded = concat(new Uint8Array([0, 0]), new TextEncoder().encode(plaintext))
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, cekKey, padded))

  return { ciphertext, salt, serverPublicKey: serverPubRaw }
}

// ── Send one push ─────────────────────────────────────────────────────────────

async function sendOne(
  sub: { endpoint: string; keys?: { p256dh?: string; auth?: string } },
  payload: { title: string; body: string; url: string },
): Promise<{ ok: boolean; status?: number; error?: string }> {
  try {
    const vapid = await makeVapidHeaders(sub.endpoint)

    let body: BodyInit | undefined
    let extraHeaders: Record<string, string> = {}

    if (sub.keys?.p256dh && sub.keys?.auth) {
      const { ciphertext, salt, serverPublicKey } = await encryptPayload(
        sub.keys.p256dh, sub.keys.auth, JSON.stringify(payload)
      )
      body = ciphertext
      extraHeaders = {
        'Content-Type': 'application/octet-stream',
        'Content-Encoding': 'aesgcm',
        'Encryption': `salt=${b64url(salt)}`,
        'Crypto-Key': `dh=${b64url(serverPublicKey)};p256ecdsa=${VAPID_PUBLIC_KEY}`,
      }
    }
    // Si no hay keys, manda push vacío (igual que el send-push existente)

    const res = await fetch(sub.endpoint, {
      method: 'POST',
      headers: { Authorization: vapid.Authorization, TTL: vapid.TTL, ...extraHeaders },
      body,
    })

    return { ok: res.ok, status: res.status }
  } catch (e) {
    return { ok: false, error: String(e) }
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })

  try {
    // Verificar auth
    const token = req.headers.get('Authorization')?.replace('Bearer ', '')
    if (!token) return json({ error: 'No autorizado' }, 401)

    const { title, body, url = '/novedades', user_ids, emails, all } = await req.json()
    if (!title || !body) return json({ error: 'Faltan title y/o body' }, 400)

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

    const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
    if (authErr || !user) return json({ error: 'Token inválido' }, 401)

    // Construir query de suscripciones
    let query = supabase
      .from('push_subscriptions')
      .select('user_id, subscription, profiles!inner(email)')

    if (TESTING_MODE) {
      query = query.eq('profiles.email', TEST_EMAIL)
      console.log(`[push-notif] TESTING_MODE — solo a ${TEST_EMAIL}`)
    } else if (user_ids?.length) {
      query = query.in('user_id', user_ids)
    } else if (emails?.length) {
      query = query.in('profiles.email', emails)
    } else if (!all) {
      return json({ error: 'Especificar user_ids, emails o all=true' }, 400)
    }

    const { data: subs, error: dbErr } = await query
    if (dbErr) return json({ error: dbErr.message }, 500)

    const payload = { title, body, url }
    const results = await Promise.allSettled(
      (subs || []).map(async row => {
        const sub = row.subscription as { endpoint: string; keys?: { p256dh?: string; auth?: string } }
        if (!sub?.endpoint) return

        const r = await sendOne(sub, payload)
        console.log(`[push-notif] ${row.user_id}: ${r.ok ? '✓' : '✗'} (${r.status ?? r.error})`)

        // Limpiar suscripciones expiradas
        if (r.status === 410 || r.status === 404) {
          await supabase.from('push_subscriptions').delete().eq('user_id', row.user_id)
        }
        return r
      })
    )

    const sent = results.filter(r => r.status === 'fulfilled' && (r.value as { ok: boolean })?.ok).length
    return json({ ok: true, sent, total: subs?.length ?? 0, testing: TESTING_MODE })

  } catch (err) {
    console.error('[push-notif]', err)
    return json({ error: String(err) }, 500)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'content-type': 'application/json' },
  })
}
