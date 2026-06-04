import { supabase } from './supabase'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)))
}

export async function suscribirPush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return null

  // Registrar el SW de push (separado del SW de PWA)
  const reg = await navigator.serviceWorker.register('/sw-push.js', { scope: '/' })
  await navigator.serviceWorker.ready

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
  if (!user) return
  await supabase.from('push_subscriptions').upsert(
    { user_id: user.id, subscription: sub.toJSON() },
    { onConflict: 'user_id,subscription->endpoint' }
  )
}
