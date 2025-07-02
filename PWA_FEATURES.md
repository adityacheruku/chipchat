# ChirpChat PWA Features: Functionality When The App is Closed

This document provides a detailed overview of ChirpChat's Progressive Web App (PWA) features, which allow the application to provide value even when it is not actively open. This is achieved through background functionalities like push notifications and home screen quick actions.

## 1. Push Notifications

### Capabilities & Implementation
-   **Purpose**: To keep users connected by delivering timely alerts for important events.
-   **Implementation**: The app uses a service worker (configured via `next-pwa`) to listen for push events from the backend. The backend uses the standard Web Push protocol with VAPID keys for secure communication. When an event occurs (e.g., new message), the backend sends a push message to the registered service worker, which then displays the notification.
-   **Supported Events**:
    -   **New Messages**: Notifies the user of a new message from their partner. To avoid notification spam, these are tagged by conversation, so multiple messages in a short period will update a single notification rather than creating many.
    -   **Mood Updates**: Alerts the user when their partner updates their mood.
    -   **"Thinking of You" Pings**: A gentle, non-intrusive notification to let the user know their partner is thinking of them.

### Accessibility
-   **Clear Content**: Notification titles and bodies are designed to be concise and easily understood by screen readers (e.g., "New message from [Partner Name]").
-   **Contextual Icons**: Each notification type has a distinct icon (the partner's avatar for messages, a heart for pings) to provide immediate visual context.
-   **Badges**: A monochrome badge icon is provided for display in system UIs like the Android status bar, ensuring visibility in different contexts.
-   **User Control**: Users can manage which notifications they receive from the in-app settings, and have ultimate control through their device's OS-level notification settings.

---

## 2. Home Screen Quick Actions

### Capabilities & Implementation
-   **Purpose**: To provide shortcuts to common actions directly from the device's home screen, allowing users to interact with the app without fully launching it.
-   **Implementation**: These actions are defined in the `public/manifest.json` file as `shortcuts`. When a user long-presses the PWA icon on their home screen, the OS displays these shortcuts. Tapping one opens the app directly to a dedicated, streamlined page for that action.
-   **Available Actions**:
    -   **Set My Mood**: Opens a dedicated page (`/quick/mood`) to quickly update mood.
    -   **Send an Image**: Opens a page (`/quick/image`) to select and send an image to the partner.
    -   **Send a Snap**: Opens a page (`/quick/snap`) to send a disappearing photo or video.
    -   **Thinking of You**: Opens a page (`/quick/think`) that immediately sends a ping to the partner.

### Accessibility
-   **Descriptive Names**: The action names (`name` and `short_name` in the manifest) are human-readable and descriptive (e.g., "Set My Mood"), ensuring they are announced clearly by screen readers.
-   **Iconography**: Each shortcut has a unique icon, providing visual distinction in the OS menu.
-   **OS Integration**: The presentation and interaction with these shortcuts are handled by the native operating system (iOS or Android), inheriting its accessibility features like font scaling and screen reader support.
