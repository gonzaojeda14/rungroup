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

async function mostrarNotificacion(push) {
  try {
    // Si el push trae payload encriptado (push-notif), usarlo directo:
    // ya viene con { title, body, url } finales. Así cada notificación
    // navega a su pantalla correcta en vez de caer siempre en /novedades.
    if (push?.title) {
      return self.registration.showNotification(push.title, {
        body: push.body || 'Tocá para ver.',
        icon: '/icon-notif.png',
        badge: '/badge-f.png',
        vibrate: [200, 100, 200],
        data: { url: push.url || '/novedades' }
      })
    }
    // Fallback: push sin payload → leer última notif de notif_payload
    const res = await fetch(`${SUPABASE_URL}/rest/v1/notif_payload?id=eq.1&select=titulo,contenido,tipo,url`, {
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
  let payload = null
  try { payload = event.data?.json() } catch { payload = null }
  event.waitUntil(mostrarNotificacion(payload))
})

// Al tocar la notificación, abrir la app
self.addEventListener('notificationclick', event => {
  event.notification.close()
  const url = event.notification.data?.url || '/novedades'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      // Si ya hay una ventana de la app abierta, la enfocamos Y la navegamos al url
      // (antes solo enfocaba y quedaba en la última pantalla donde estabas).
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin)) {
          client.focus()
          if ('navigate' in client) return client.navigate(url)
          return
        }
      }
      if (clients.openWindow) return clients.openWindow(url)
    })
  )
})
