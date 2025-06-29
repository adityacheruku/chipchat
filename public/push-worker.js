// public/push-worker.js

self.addEventListener('push', (event) => {
  const data = event.data?.json() || { title: "Kuchlu", options: { body: "You have a new notification." } };
  const { title, options } = data;

  const finalOptions = {
    body: options.body || "You have a new notification.",
    icon: options.icon || '/icons/icon-192x192.png',
    badge: options.badge || '/icons/badge-96x96.png',
    vibrate: [200, 100, 200],
    tag: options.tag || 'kuchlu-notification',
    data: options.data || { conversationId: null },
    actions: options.actions || []
  };

  event.waitUntil(
    self.registration.showNotification(title, finalOptions)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      const conversationId = event.notification.data?.conversationId;
      const urlToOpen = conversationId ? `/chat?id=${conversationId}` : '/chat';

      for (const client of clientList) {
        if (client.url.includes('/chat') && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
