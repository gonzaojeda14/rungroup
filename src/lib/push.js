import { supabase } from './supabase'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY
const SUPABASE_URL     = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON    = import.meta.env.VITE_SUPABASE_ANON_KEY

// Llama a la Edge Function send-push.
// targets: { all: true } | { user_ids: [...] } | { emails: [...] }
export async function notificar(title, body, url = '/', targets = {}) {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    const res = await fetch(`${SUPABASE_URL}/functions/v1/push-notif`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
        'apikey': SUPABASE_ANON,
      },
      body: JSON.stringify({ title, body, url, ...targets }),
    })
    return res.ok
  } catch (e) {
    console.error('[notificar] Error:', e)
    return false
  }
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)))
}

export async function suscribirPush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null

  // Solo suscribir desde la PWA instalada, no desde el navegador
  const esPWA = window.matchMedia('(display-mode: standalone)').matches
  if (!esPWA) return null

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return null

  // Usar el SW de Vite PWA (no uno separado)
  const reg = await navigator.serviceWorker.ready

  const existing = await reg.pushManager.getSubscription()
  if (existing) {
    await guardarSuscripcion(existing)
    return existing
  }

  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
  })

  await guardarSuscripcion(sub)
  return sub
}

async function guardarSuscripcion(sub) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No hay usuario autenticado')

  const endpoint = sub.toJSON().endpoint

  // Borramos la suscripción anterior del mismo endpoint si existe, y reinsertamos
  await supabase.from('push_subscriptions')
    .delete()
    .eq('user_id', user.id)
    .filter('subscription->>endpoint', 'eq', endpoint)

  const { error } = await supabase.from('push_subscriptions')
    .insert({ user_id: user.id, subscription: sub.toJSON() })

  if (error) throw error
}
