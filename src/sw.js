import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching'
import { clientsClaim } from 'workbox-core'
import { registerRoute } from 'workbox-routing'
import { NetworkFirst } from 'workbox-strategies'

cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)
clientsClaim()
self.skipWaiting()

// Cache Supabase requests (excepto notif_payload)
registerRoute(
  ({ url }) => url.hostname.includes('supabase.co') && !url.pathname.includes('notif_payload'),
  new NetworkFirst({ cacheName: 'supabase-cache', networkTimeoutSeconds: 10 })
)

// Push notifications
const SUPABASE_URL = 'https://dsanxuaadoytmuqfpjda.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRzYW54dWFhZG95dG11cWZwamRhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzNTI4OTksImV4cCI6MjA5NTkyODg5OX0.srHQwvrVNcMwD3WJLuyfaS5sX0CHN5UPx5XxGqCdiTc'

async function mostrarNotificacion() {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/notif_payload?id=eq.1&select=titulo,contenido`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
    })
    const data = await res.json()
    const payload = data?.[0]
    const title = payload?.titulo ? `Flama Run: ${payload.titulo}` : 'Flama Run'
    const body = payload?.contenido || 'Tocá para ver la novedad.'
    await self.registration.showNotification(title, {
      body,
      icon: '/icon-notif.png',
      badge: '/badge-f.png',
      image: '/icon-512.png',
      vibrate: [200, 100, 200],
      data: { url: '/novedades' }
    })
  } catch(e) {
    await self.registration.showNotification('Flama Run', {
      body: 'Tocá para ver la novedad.',
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
