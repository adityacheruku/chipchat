# ChirpChat Frontend: UI/UX & Design Guide

This document provides a comprehensive guide to the ChirpChat frontend, detailing its user interface (UI) components, user experience (UX) flows, styling principles, and interactive effects.

## 1. Core Design Philosophy

ChirpChat is designed to be an intimate, emotionally resonant space for two people. The UI/UX choices reflect this goal:

-   **Calm & Inviting**: The color palette uses soft blues, violets, and light grays to create a tranquil atmosphere.
-   **Fluid & Responsive**: Interactions are designed to be smooth and jank-free, with subtle animations providing feedback without being distracting.
-   **Intuitive & Accessible**: The interface is kept simple and predictable, ensuring that all features are easy to discover and use, including for users with disabilities.
-   **Dynamic & Expressive**: The chat's appearance dynamically changes based on the combined mood of the partners, making the interface a living reflection of their emotional state.

---

## 2. Styling & Theming

The application's visual identity is managed through a combination of Tailwind CSS and a custom theme defined in `src/app/globals.css`.

### 2.1. Color Palette

The theme uses HSL CSS variables for easy manipulation and consistency.

-   **Primary (`--primary`)**: `#90AFC5` (Soft Blue) - Used for primary buttons, selected states, and key interactive elements.
-   **Background (`--background`)**: `#F0F4F7` (Light Gray) - The clean, non-obtrusive backdrop for the entire application.
-   **Accent (`--accent`)**: `#A991B5` (Pale Violet) - Used for hover states, mood indicators, and secondary highlights.
-   **Card (`--card`)**: `hsl(0 0% 100%)` (White) - The background for the main chat window and modals, providing a clean canvas for content.
-   **Text (`--foreground`)**: A dark, grayish-blue for optimal readability.

### 2.2. Typography

-   **Font**: 'PT Sans' is used for all text (headlines and body) to provide a warm, modern, and highly readable feel. It's imported via Google Fonts in `src/app/layout.tsx`.

### 2.3. Iconography

-   **Icons**: [Lucide React](https://lucide.dev/icons/) is used for a consistent, modern, and lightweight icon set across the application.

---

## 3. Key UI Components & Interactions

### 3.1. Chat Header (`components/chat/ChatHeader.tsx`)

-   **Function**: Displays the partner's information and provides access to key actions.
-   **UI Elements**:
    -   Partner's avatar (with online/offline status indicator).
    -   Partner's display name and current mood.
    -   A "thinking of you" heart icon.
    -   A user profile icon to open the settings modal.
-   **Interactions & Effects**:
    -   The partner's avatar is a button that opens a full-screen view of their profile.
    -   The heart icon, when clicked, sends a "ping" and triggers a subtle pulse animation on the recipient's header.
    -   All icons have tooltips on hover for clarity and accessible `aria-label` attributes.
    -   A typing indicator (`...typing`) appears when the partner is typing a message.

### 3.2. Message Area (`components/chat/MessageArea.tsx`)

-   **Function**: The main scrollable view that displays the conversation history.
-   **UI Elements**:
    -   A collection of `MessageBubble` components.
    -   Dynamic background that changes based on the combined moods of the partners or the current chat mode (Fight/Incognito).
-   **Interactions & Effects**:
    -   Automatically scrolls to the bottom when a new message arrives (if the user is already at the bottom).
    -   Infinite scroll: A "Load Older Messages" button appears at the top to fetch previous messages on demand.
    -   The background color transitions smoothly when moods or modes change.

### 3.3. Message Bubble (`components/chat/MessageBubble.tsx`)

-   **Function**: Renders a single message with its content, timestamp, and reactions.
-   **UI Elements**:
    -   Content area for text, images, stickers, or voice messages.
    -   Timestamp and message status indicator (sending, sent, delivered, read).
    -   A cluster of emoji reactions.
-   **Interactions & Effects**:
    -   **Long-press/Click**: Opens a context menu with options like "React", "Copy", "Reply".
    -   **Stickers**: Appear with a subtle "pop" animation.
    -   **Images/Videos**: Clicking on media opens a full-screen modal for better viewing.
    -   **Voice Messages**: An interactive audio player with play/pause controls and a progress indicator.

### 3.4. Input Bar (`components/chat/InputBar.tsx`)

-   **Function**: The primary input area for creating and sending messages and attachments.
-   **UI Elements**:
    -   A multi-line textarea that grows with content.
    -   A "Send" button that appears when there is content to send.
    -   An attachment button (`+`) that opens a panel for sending files, voice notes, or changing chat modes.
    -   An emoji button that opens the emoji/sticker picker.
-   **Interactions & Effects**:
    -   **Attachment/Emoji Panel**: Slides up from the bottom on mobile (using a Sheet component) and appears as a Popover on desktop for an optimal experience on each form factor.
    -   **Voice Recording**: A long-press on the record button initiates recording. Releasing it stops and prepares the voice note for sending. Visual feedback (timer, pulsing icon) is provided during recording.

### 3.5. Modals

-   **User Profile Modal**: Allows users to update their name, mood, and avatar.
-   **Mood Entry Modal**: Prompts the user to confirm or set their mood upon first entering a chat session.
-   **Full-Screen Modals**: Used for viewing avatars and media without distraction.
-   **All modals**: Lazily loaded using `next/dynamic` to improve initial page load performance. They appear with a smooth fade-in and scale-up transition.

---

## 4. PWA Features & Mobile Experience

ChirpChat is a fully-featured Progressive Web App (PWA).

-   **Installability**: Users can "Add to Home Screen" on both mobile and desktop for a native-like experience. This is configured in `public/manifest.json`.
-   **Offline Support**: A service worker (`next-pwa` config) caches the application shell and static assets, allowing the app to load instantly even when offline. A connection status banner keeps the user informed of their connectivity state.
-   **Quick Actions**: The `manifest.json` defines shortcuts that appear when a user long-presses the app icon on their home screen. These include:
    -   **Set My Mood**: Opens a dedicated page (`/quick/mood`) to quickly update mood.
    -   **Send an Image**: Opens a page (`/quick/image`) to select and send an image to the partner.
    -   **Thinking of You**: Opens a page (`/quick/think`) that immediately sends a ping to the partner.
