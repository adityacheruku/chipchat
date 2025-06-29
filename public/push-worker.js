
'use strict';

self.addEventListener('push', function (event) {
    if (!event.data) {
        console.log('Push event but no data');
        return;
    }
    const data = event.data.json();
    const { title, options } = data;
    
    const promiseChain = self.registration.showNotification(title, {
        body: options.body,
        icon: options.icon || '/icons/icon-192x192.png',
        badge: options.badge || '/icons/badge-96x96.png', // A smaller monochrome icon
        tag: options.tag,
        data: options.data,
    });

    event.waitUntil(promiseChain);
});

self.addEventListener('notificationclick', function (event) {
    event.notification.close();

    const conversationId = event.notification.data?.conversationId;
    // Fallback to home if no specific URL is provided
    const urlToOpen = conversationId ? `/chat?conversationId=${conversationId}` : '/chat';
    
    const promiseChain = clients.matchAll({
        type: 'window',
        includeUncontrolled: true
    }).then(function(windowClients) {
        let matchingClient = null;
        for (let i = 0; i < windowClients.length; i++) {
            const client = windowClients[i];
            const clientUrl = new URL(client.url);
            const targetUrl = new URL(urlToOpen, self.location.origin);

            // Check if the client is already on the target URL path
            if (clientUrl.pathname === targetUrl.pathname) {
                matchingClient = client;
                break;
            }
        }

        if (matchingClient) {
            return matchingClient.focus();
        } else if (clients.openWindow) {
            return clients.openWindow(urlToOpen);
        }
    });

    event.waitUntil(promiseChain);
});
