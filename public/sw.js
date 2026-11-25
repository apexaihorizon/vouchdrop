self.addEventListener('push', (event) => {
  if (!event.data) return;
  const data = event.data.json();

  event.waitUntil(
    self.registration.showNotification(`${data.senderName} wants to send ${data.fileName}`, {
      body: 'Tap within 15 seconds to accept direct P2P transfer',
      tag: `vd-knock-${data.roomId}`,
      renotify: true,
      requireInteraction: true,
      data: { url: `/?room=${encodeURIComponent(data.roomId)}` },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if ('focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      return clients.openWindow(targetUrl);
    })
  );
});