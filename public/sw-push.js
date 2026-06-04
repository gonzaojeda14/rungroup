self.addEventListener('push', event => {
  console.log('SW push recibido, data:', event.data?.text())
  if (!event.data) return
  let title = 'Flama Run', body = '', url = '/novedades'
  try {
    const data = event.data.json()
    title = data.title || title
    body = data.body || body
    url = data.url || url
  } catch {
    title = event.data.text() || title
  }
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
