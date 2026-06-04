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
self.addEventListener('push', event => {
  const SUPABASE_URL = 'https://dsanxuaadoytmuqfpjda.supabase.co'
  const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRzYW54dWFhZG95dG11cWZwamRhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzNTI4OTksImV4cCI6MjA5NTkyODg5OX0.srHQwvrVNcMwD3WJLuyfaS5sX0CHN5UPx5XxGqCdiTc'

  event.waitUntil(
    fetch(`${SUPABASE_URL}/rest/v1/novedades?select=titulo,contenido,tipo&order=created_at.desc&limit=1`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
    })
    .then(r => r.json())
    .then(data => {
      const novedad = data?.[0]
      const title = novedad?.titulo ? `Flama Run: ${novedad.titulo}` : 'Flama Run'
      const body = novedad?.contenido || 'Hay una nueva novedad. Tocá para ver.'
      return self.registration.showNotification(title, {
        body,
        icon: '/icon-notif.png',
        badge: '/badge-f.png',
        image: '/icon-512.png',
        vibrate: [200, 100, 200],
        data: { url: '/novedades' }
      })
    })
    .catch(() => self.registration.showNotification('Flama Run', {
      body: 'Hay una nueva novedad. Tocá para ver.',
      icon: '/icon-notif.png',
      badge: '/badge-f.png',
      data: { url: '/novedades' }
    }))
  )
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
