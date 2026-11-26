self.addEventListener('push', (event) => {
  if (!event.data) return;
  const data = event.data.json();
  const knock = {
    roomId: data.roomId,
    senderName: data.senderName,
    fileName: data.fileName,
    fileSize: data.fileSize,
    fileType: data.fileType,
  };

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      const visibleClient = windowClients.find((client) => client.visibilityState === 'visible');
      if (visibleClient) {
        visibleClient.postMessage({ type: 'INCOMING_KNOCK', knock });
        if ('focus' in visibleClient) {
          return visibleClient.focus();
        }
        return;
      }

      return self.registration.showNotification(`${knock.senderName} wants to send ${knock.fileName}`, {
        body: 'Tap within 15 seconds to accept direct P2P transfer',
        tag: `vd-knock-${knock.roomId}`,
        renotify: true,
        requireInteraction: true,
        data: {
          knock,
          url: `/app?room=${encodeURIComponent(knock.roomId)}`,
        },
      });
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const knock = event.notification.data?.knock;
  const targetUrl = event.notification.data?.url || '/app';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      if (windowClients.length > 0) {
        const client =
          windowClients.find((windowClient) => windowClient.visibilityState === 'visible') || windowClients[0];
        if (knock) {
          client.postMessage({ type: 'INCOMING_KNOCK', knock });
        }
        if ('focus' in client) {
          return client.focus();
        }
        return;
      }
      return clients.openWindow(targetUrl);
    })
  );
});
