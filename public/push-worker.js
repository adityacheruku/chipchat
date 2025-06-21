// This service worker script handles incoming push notifications.

self.addEventListener('push', (event) => {
  // Fallback to a default message if payload is empty.
  const payload = event.data ? event.data.json() : {
    title: 'ChirpChat',
    body: 'You have a new message.',
    tag: 'chirpchat-notification'
  };

  const title = payload.title || 'ChirpChat';
  const options = {
    body: payload.body,
    icon: '/icons/icon-192.png', // Main app icon
    badge: '/icons/icon-96.png', // Badge for the notification bar (Android)
    tag: payload.tag || 'chirpchat-notification', // Groups notifications
    data: {
      url: payload.url || '/chat' // URL to open on click
    }
  };

  // Keep the service worker alive until the notification is shown.
  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Listener for notification click events.
self.addEventListener('notificationclick', (event) => {
  event.notification.close(); // Close the notification

  const urlToOpen = event.notification.data.url || '/';

  // This looks for an existing window/tab with the same URL and focuses it.
  // If not found, it opens a new one.
  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then((clientList) => {
      if (clientList.length > 0) {
        let client = clientList[0];
        for (let i = 0; i < clientList.length; i++) {
          if (clientList[i].focused) {
            client = clientList[i];
          }
        }
        return client.focus();
      }
      return clients.openWindow(urlToOpen);
    })
  );
});
