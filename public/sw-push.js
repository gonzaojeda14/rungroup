self.addEventListener('push', event => {
  const title = 'Flama Run'
  const body = 'Hay una nueva novedad. Tocá para ver.'
  const url = '/novedades'
  event.waitUntil(
    self.registration.showNotification(title, {
      body: body || '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: { url: url || '/' },
    })
  )
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  const url = event.notification.data?.url || '/'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      const existing = list.find(c => c.url.includes(self.location.origin))
      if (existing) { existing.focus(); existing.navigate(url) }
      else clients.openWindow(url)
    })
  )
})
