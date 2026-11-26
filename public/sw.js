const SW_VERSION = 'v1.1.2';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

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
  const roomUrl = `/app?room=${encodeURIComponent(knock.roomId)}`;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      const visibleClient = windowClients.find((client) => client.visibilityState === 'visible');
      if (visibleClient) {
        visibleClient.postMessage({ type: 'INCOMING_KNOCK', knock, swVersion: SW_VERSION });
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
          url: roomUrl,
        },
      });
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const knock = event.notification.data?.knock;
  const fallbackRoomUrl = knock?.roomId ? `/app?room=${encodeURIComponent(knock.roomId)}` : '/app';
  const targetUrl =
    typeof event.notification.data?.url === 'string' && event.notification.data.url.startsWith('/app')
      ? event.notification.data.url
      : fallbackRoomUrl;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      const appClient =
        windowClients.find((c) => c.url.includes('/app') && c.visibilityState === 'visible') ||
        windowClients.find((c) => c.url.includes('/app')) ||
        windowClients[0];

      if (appClient) {
        if (knock) {
          appClient.postMessage({ type: 'INCOMING_KNOCK', knock, swVersion: SW_VERSION });
        }
        if ('focus' in appClient) {
          return appClient.focus();
        }
        return;
      }

      return clients.openWindow(targetUrl);
    })
  );
});
