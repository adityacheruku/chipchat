'use strict';

// Service worker for handling push notifications.

// Helper to generate the message body for a notification
function generateMessageBody(payload) {
  switch (payload.type) {
    case 'message':
      return payload.content ?
        (payload.content.length > 50 ? payload.content.substring(0, 50) + "..." : payload.content) :
        'New message';
    case 'voice_message':
      return 'Sent you a voice message';
    case 'media':
      return `Sent a ${payload.mediaType || 'file'}`;
    case 'mood_update':
      return `Is now feeling ${payload.moodValue || 'different'}`;
    case 'thinking_of_you':
      return 'Is thinking of you ❤️';
    default:
      return 'Sent you an update.';
  }
}

// Helper to define actions based on notification type
function getNotificationActions(type) {
  switch (type) {
    case 'message':
      return [
        { action: 'view_chat', title: 'View & Reply' }
      ];
    case 'voice_message':
       return [
        { action: 'view_chat', title: 'Listen & Reply' }
      ];
    case 'thinking_of_you':
      return [
        { action: 'heart_back', title: '❤️ Send one back' },
        { action: 'view_chat', title: 'View & Call' }
      ];
    default:
      return [{ action: 'view_chat', title: 'Open ChirpChat' }];
  }
}


self.addEventListener('push', (event) => {
  let payload;
  try {
    payload = event.data.json();
  } catch (e) {
    console.error('Push event payload is not valid JSON:', event.data.text());
    // Create a fallback payload if parsing fails
    payload = {
        type: 'message',
        senderName: 'ChirpChat',
        content: event.data.text() || 'You have a new notification.',
        conversationId: 'default'
    };
  }
  
  const title = payload.senderName || 'ChirpChat';
  const notificationOptions = {
    body: generateMessageBody(payload),
    icon: '/icons/icon-192.png', // A default icon for all notifications
    tag: `conversation-${payload.conversationId}`, // Groups notifications from the same chat
    renotify: true, // Allow new notifications to replace old ones in the same group
    data: {
      url: `/chat?chatId=${payload.conversationId}`, // URL to open on click
      ...payload // Pass the full payload for action handling
    },
    actions: getNotificationActions(payload.type),
    requireInteraction: payload.priority === 'high' || false
  };

  event.waitUntil(
    self.registration.showNotification(title, notificationOptions)
  );
});


self.addEventListener('notificationclick', (event) => {
  const notification = event.notification;
  const action = event.action; // The ID of the action button that was clicked
  const data = notification.data;

  notification.close(); // Close the notification

  const openChatWindow = async () => {
    const chatUrl = data.url || '/chat';
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    
    // Check if a window for this chat is already open and focus it
    for (const client of clients) {
      if (client.url.includes('/chat') && 'focus' in client) {
        return client.focus();
      }
    }
    // If no window is open, open a new one
    if (self.clients.openWindow) {
      return self.clients.openWindow(chatUrl);
    }
  };

  // Perform different actions based on which button was clicked
  if (action === 'heart_back') {
    // This would require background sync capabilities or a fetch call to an API endpoint
    // to send the "heart back" message. For now, we'll just open the chat.
    console.log("Action 'heart_back' triggered. (Requires backend endpoint)");
    event.waitUntil(openChatWindow());
  } else {
    // Default action (clicking the notification body or 'view_chat') is to open the chat
    event.waitUntil(openChatWindow());
  }
});
