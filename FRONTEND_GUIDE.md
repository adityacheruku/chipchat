# ChirpChat Frontend: UI/UX & Design Guide

This document provides a comprehensive guide to the ChirpChat frontend, detailing its user interface (UI) components, user experience (UX) flows, styling principles, and interactive effects.

## 1. Design & UX Overview

This section provides a high-level summary of the project's current design status.

### 1.1. Implemented Screens & Fidelity

All core screens of the application have been implemented as **high-fidelity, functional components** using Next.js, React, and ShadCN UI. They are beyond the wireframe/mockup stage and are fully interactive.

Key implemented screens include:
*   **Onboarding**: A multi-step flow for user registration (Phone -> OTP -> User Details) and Login.
*   **Partner Pairing**: A screen for users to find and send/receive partner requests.
*   **Chat Interface**: The primary real-time messaging screen.
*   **Mood Entry Modal**: A dialog for users to set their current mood.
*   **Settings Hub**: A central navigation page for all application settings.
*   **Settings Sub-Pages**: Dedicated pages for Account, Notifications, Appearance, and Privacy.
*   **PWA Quick Action Pages**: Simplified pages for "Set Mood," "Send Image," and "Thinking of You" actions initiated from the device's home screen.

### 1.2. Visual Style Guide

The visual style is well-defined and consistently applied throughout the application.

*   **Color Palette**: The application uses a custom, calming color palette defined with HSL CSS variables for easy theming and consistency. The primary file for this is `src/app/globals.css`.
    *   **Primary (`--primary`)**: `#90AFC5` (Soft Blue)
    *   **Background (`--background`)**: `#F0F4F7` (Light Gray)
    *   **Accent (`--accent`)**: `#A991B5` (Pale Violet)
*   **Typography**: The primary font is **'PT Sans'**, imported from Google Fonts, used for both headlines and body text to provide a warm and modern feel.
*   **Iconography**: The application uses **Lucide React** for a consistent, lightweight, and modern icon set.

### 1.3. Navigation & UX Patterns

*   **Navigation Model**: The app uses a **page-based routing system** managed by the Next.js App Router. The primary user flow is linear: Onboarding -> Partner Pairing -> Chat. Settings are a sub-section accessible from the main app areas.
*   **Mobile-First Gestures**: The UI is designed with mobile users in mind, featuring intuitive touch interactions like **swipe-to-reply** and **long-press** to enter message selection mode.
*   **UI Patterns**: For actions like picking attachments or emojis, the application consistently uses a bottom `Sheet` component, which is an ergonomic and common pattern on mobile devices.
*   **Known UX Pain Points**:
    *   The "read" status is currently chat-wide, not per-message.
    *   The real-time typing indicator does not function on the SSE (fallback) connection.
    *   Navigation is purely hierarchical; a bottom navigation bar for mobile could improve quick access to different app sections in the future.

---

## 2. Core Design Philosophy

ChirpChat is designed to be an intimate, emotionally resonant space for two people. The UI/UX choices reflect this goal:

-   **Calm & Inviting**: The color palette uses soft blues, violets, and light grays to create a tranquil atmosphere.
-   **Fluid & Responsive**: Interactions are designed to be smooth and jank-free, with subtle animations providing feedback without being distracting.
-   **Intuitive & Accessible**: The interface is kept simple and predictable, ensuring that all features are easy to discover and use, including for users with disabilities.
-   **Dynamic & Expressive**: The chat's appearance dynamically changes based on the combined mood of the partners, making the interface a living reflection of their emotional state.

---

## 3. The Messaging Area: A Deep Dive

The messaging area is the core of the ChirpChat experience. It's designed to be a fluid, interactive, and emotionally resonant canvas for conversation. This section details its design, functionality, and behavior.

### 3.1 User Actions & System Feedback

The message area supports a rich set of interactions, each with immediate and intuitive feedback:

| Action                    | User Interaction                                                                                                 | System Feedback & UI Updates                                                                                                                                                                                            |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Send Text**             | Type in the input bar and press the "Send" button.                                                               | The "Send" button appears with a pop animation when text is entered. Upon sending, the message optimistically appears in the chat area with a "sending" status (clock icon). The input field clears.                     |
| **Send Attachments**      | Tap the paperclip icon to open a bottom sheet (mobile) or popover (desktop). Select camera, gallery, or document. | Selected files appear in a "staging area" above the input bar. The user can add text before sending. Upon sending, the message appears with an upload progress indicator before transitioning to the "sending" status. |
| **Record Voice Note**     | Press and hold the microphone icon in the attachment panel.                                                      | A timer and a pulsing red mic icon appear during recording. Releasing stops the recording. The user can then preview the note with a fully functional audio player before sending.                                     |
| **React to Message**      | Long-press a message bubble and select an emoji from the quick-reaction menu.                                    | The selected emoji appears on the message bubble with a counter. The user's own reaction is highlighted. Others in the chat see the reaction appear in real-time. Tapping the reaction shows who reacted.         |
| **Copy Message Text**     | Long-press a message bubble and select "Copy" from the context menu.                                             | A toast notification confirms that the text has been copied to the clipboard.                                                                                                                                           |
| **View Media**            | Tap on an image or video thumbnail in the chat.                                                                  | A full-screen, immersive modal opens, displaying the media. Users can pinch-to-zoom on images and use standard video controls. A download button is provided.                                                          |
| **Load Older Messages**   | Scroll to the top of the chat and click the "Load Older Messages" button.                                        | A loading spinner appears on the button. Once loaded, older messages are prepended to the chat history, and the scroll position is maintained to prevent jarring jumps.                                                |
| **Retry Failed Message**  | A message that fails to send displays a "Failed to send. Retry" message with a clickable button.                  | Clicking "Retry" changes the message status back to "sending" and re-attempts the send operation.                                                                                                                       |

### 3.2 Visual & Functional Design

*   **Chat Bubbles**: Messages are enclosed in rounded bubbles. The sender's messages are aligned to the right with the primary brand color, while the partner's messages are on the left with a secondary color. A small "tail" on each bubble points towards the sender.
*   **Message Grouping**: While not currently implemented, a future enhancement would group consecutive messages from the same user to reduce visual clutter. Timestamps would appear less frequently.
*   **Timestamps & Status**: The time is displayed below each message bubble. For messages sent by the current user, a status indicator (clock, single check, double check) appears next to the time.
    *   **Sending (Clock icon)**: The message is on its way to the server.
    *   **Sent (Single check)**: The server has received the message.
    *   **Delivered (Double check)**: The message has been delivered to the recipient's device.
    *   **Read (Blue double check)**: The recipient has opened the chat and seen the message.
*   **Scrolling Behavior**: The chat area automatically scrolls to the bottom when a new message arrives, but only if the user is already near the bottom. This prevents disrupting a user who is reading older messages.

### 3.3 Accessibility Features

Accessibility is a core consideration, not an afterthought.

*   **Screen Reader Support**: All interactive elements (buttons, inputs) have `aria-label` attributes for clear screen reader announcements. Message content is readable in a logical order.
*   **Keyboard Navigation**: The entire message area, including the input bar and message actions, is navigable via the keyboard using standard Tab, Shift+Tab, and Enter/Space keys.
*   **Contrast & Theming**: The color palette is designed to meet WCAG AA contrast ratios. A dark mode is also available, inheriting from the same well-defined color tokens.
*   **Font Scaling**: The UI uses relative units (rem), allowing it to respect the user's system-level font size settings for better readability.

### 3.4 Usability & UX Considerations

*   **Known Issues/Improvements**:
    *   **Lack of Swipe Gestures**: On mobile, users often expect to swipe-to-reply on a message. This is a high-impact feature for a future iteration.
    *   **No "Is Read" on a Per-Message Basis**: The current "Read" status applies to the whole chat. A more granular, per-message read receipt system would provide more precise feedback.
    *   **No Typing Indicator for SSE Fallback**: The typing indicator currently only works over a WebSocket connection. A solution for the SSE fallback (e.g., a short-lived API call) would improve consistency.
*   **Strengths**:
    *   The separation of the attachment/emoji pickers into a Sheet on mobile is a major UX win, feeling much more native than a popover.
    *   The message staging area prevents accidental sends and allows for the composition of richer, multi-part messages.
    *   The explicit "Retry" button for failed messages empowers the user and removes ambiguity.

### 3.5 Platform-Specific Experience

The application is designed as a Progressive Web App (PWA) to ensure a consistent core experience across all platforms. However, there are subtle, platform-aware enhancements:

*   **Mobile (iOS/Android via PWA)**:
    *   Utilizes the bottom `Sheet` component for pickers, which is a common mobile UI pattern.
    *   Leverages `navigator.vibrate()` for haptic feedback on actions like long-pressing a message.
    *   The "Invite" feature uses the native Web Share API for seamless integration with the OS sharing dialog.
*   **Web (Desktop)**:
    *   Uses `Popover` components for pickers, which is more conventional for desktop UIs.
    *   Makes full use of hover states for tooltips and interactive elements.
    *   Supports drag-and-drop for file attachments directly onto the input bar area.

This detailed approach ensures that ChirpChat feels thoughtfully designed and robust, regardless of how the user accesses it.

---

## 4. PWA Features & Mobile Experience

ChirpChat is a fully-featured Progressive Web App (PWA).

-   **Installability**: Users can "Add to Home Screen" on both mobile and desktop for a native-like experience. This is configured in `public/manifest.json`.
-   **Offline Support**: A service worker (`next-pwa` config) caches the application shell and static assets, allowing the app to load instantly even when offline. A connection status banner keeps the user informed of their connectivity state.
-   **Quick Actions**: The `manifest.json` defines shortcuts that appear when a user long-presses the app icon on their home screen. These include:
    -   **Set My Mood**: Opens a dedicated page (`/quick/mood`) to quickly update mood.
    -   **Send an Image**: Opens a page (`/quick/image`) to select and send an image to the partner.
    -   **Thinking of You**: Opens a page (`/quick/think`) that immediately sends a ping to the partner.
