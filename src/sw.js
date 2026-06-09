import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching'
import { clientsClaim } from 'workbox-core'
import { registerRoute } from 'workbox-routing'
import { NetworkFirst } from 'workbox-strategies'

cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)
clientsClaim()
self.skipWaiting()

// Cache Supabase requests
registerRoute(
  ({ url }) => url.hostname.includes('supabase.co'),
  new NetworkFirst({ cacheName: 'supabase-cache', networkTimeoutSeconds: 10 })
)

// Push notifications
const SUPABASE_URL = 'https://dsanxuaadoytmuqfpjda.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRzYW54dWFhZG95dG11cWZwamRhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzNTI4OTksImV4cCI6MjA5NTkyODg5OX0.srHQwvrVNcMwD3WJLuyfaS5sX0CHN5UPx5XxGqCdiTc'

async function mostrarNotificacion() {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/notif_payload?id=eq.1&select=titulo,contenido,tipo`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
    })
    const data = await res.json()
    const payload = data?.[0]
    const esPlan = payload?.tipo === 'plan'
    const esPush = payload?.tipo === 'push'
    const title = esPush ? (payload?.titulo || 'Flama Run')
                : esPlan ? '¡A entrenar! 💪'
                : 'Nuevo aviso 📢'
    const body  = esPush ? (payload?.contenido || 'Tocá para ver.')
                : esPlan ? 'Ya está el nuevo plan semanal.'
                : (payload?.titulo || 'Tocá para ver el aviso.')
    const url   = payload?.url || '/novedades'
    return self.registration.showNotification(title, {
      body,
      icon: '/icon-notif.png',
      badge: '/badge-f.png',
      vibrate: [200, 100, 200],
      data: { url }
    })
  } catch {
    return self.registration.showNotification('Flama Run', {
      body: 'Nuevo aviso. Tocá para ver.',
      icon: '/icon-notif.png',
      badge: '/badge-f.png',
      data: { url: '/novedades' }
    })
  }
}

self.addEventListener('push', event => {
  event.waitUntil(mostrarNotificacion())
})

// Al tocar la notificación, abrir la app
self.addEventListener('notificationclick', event => {
  event.notification.close()
  const url = event.notification.data?.url || '/novedades'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      for (const client of windowClients) {
        if ('focus' in client) { client.focus(); return }
      }
      if (clients.openWindow) return clients.openWindow(url)
    })
  )
})
