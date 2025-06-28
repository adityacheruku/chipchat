# ChirpChat: Messaging Interface Guide

This document provides a comprehensive guide to the ChirpChat messaging interface, detailing its user interface (UI) components, user experience (UX) flows, styling principles, and interactive effects.

## 1. Core Design Philosophy

The messaging area is designed to be an intimate, emotionally resonant space for two people. The UI/UX choices reflect this goal:

-   **Calm & Inviting**: The color palette uses soft blues, violets, and light grays to create a tranquil atmosphere.
-   **Fluid & Responsive**: Interactions are designed to be smooth and jank-free, with subtle animations providing feedback without being distracting.
-   **Intuitive & Accessible**: The interface is kept simple and predictable, ensuring that all features are easy to discover and use, including for users with disabilities.
-   **Dynamic & Expressive**: The chat's appearance dynamically changes based on the combined mood of the partners, making the interface a living reflection of their emotional state.

---

## 2. The Messaging Area: A Deep Dive

The messaging area is the core of the ChirpChat experience. It's designed to be a fluid, interactive, and emotionally resonant canvas for conversation. This section details its design, functionality, and behavior.

### 2.1 User Actions & System Feedback

The message area supports a rich set of interactions, each with immediate and intuitive feedback:

| Action                    | User Interaction                                                                                                 | System Feedback & UI Updates                                                                                                                                                                                            |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Send Text**             | Type in the input bar and press the "Send" button.                                                               | The "Send" button appears with a pop animation when text is entered. Upon sending, the message optimistically appears in the chat area with a "sending" status (clock icon). The input field clears.                     |
| **Send Attachments**      | Tap the paperclip icon to open a bottom sheet. Select camera, gallery, or document. | Selected files appear in a "staging area" above the input bar. The user can add text before sending. Upon sending, the message appears with an upload progress indicator before transitioning to the "sending" status. |
| **Record Voice Note**     | Press and hold the microphone icon in the attachment panel.                                                      | A timer and a pulsing red mic icon appear during recording. Releasing stops the recording. The user can then preview the note with a fully functional audio player before sending.                                     |
| **React to Message**      | Long-press a message bubble and select an emoji from the quick-reaction menu. Or, double-tap to ❤️.                | The selected emoji appears on the message bubble with a counter. The user's own reaction is highlighted. Others in the chat see the reaction appear in real-time. Tapping the reaction shows who reacted.         |
| **Copy Message Text**     | Long-press a message bubble and select "Copy" from the context menu.                                             | A toast notification confirms that the text has been copied to the clipboard.                                                                                                                                           |
| **View Media**            | Tap on an image or video thumbnail in the chat.                                                                  | A full-screen, immersive modal opens, displaying the media. Users can pinch-to-zoom on images and use standard video controls. A download button is provided.                                                          |
| **Load Older Messages**   | Scroll to the top of the chat and click the "Load Older Messages" button.                                        | A loading spinner appears on the button. Once loaded, older messages are prepended to the chat history, and the scroll position is maintained to prevent jarring jumps.                                                |
| **Retry Failed Message**  | A message that fails to send displays a "Failed to send. Retry" message with a clickable button.                  | Clicking "Retry" changes the message status back to "sending" and re-attempts the send operation.                                                                                                                       |
| **Swipe to Reply**        | Swipe a message bubble to the right.                                                                             | The message being replied to appears in a preview area above the input bar. Sending the next message will link it as a reply.                                                                                             |
| **Delete Message**        | Swipe a message bubble to the left, or use the long-press context menu.                                          | A confirmation dialog appears, offering to "Delete for Me" or "Delete for Everyone" (if the user is the sender).                                                                                                        |

### 2.2 Visual & Functional Design

*   **Chat Bubbles**: Messages are enclosed in rounded bubbles. The sender's messages are aligned to the right with the primary brand color, while the partner's messages are on the left with a secondary color. A small "tail" on each bubble points towards the sender.
*   **Message Status**: For messages sent by the current user, a status indicator appears next to the time.
    *   **Sending (Clock icon)**: The message is on its way to the server.
    *   **Sent (Single check)**: The server has received the message.
    *   **Delivered (Double check)**: The message has been delivered to the recipient's device.
    *   **Read (Blue double check)**: The recipient has opened the chat and seen the message.
    *   **Failed (Red alert triangle)**: The message failed to send.
*   **Scrolling Behavior**: The chat area automatically scrolls to the bottom when a new message arrives, but only if the user is already near the bottom. This prevents disrupting a user who is reading older messages.
*   **Dynamic Backgrounds**: The chat area background subtly changes based on the combined mood of the two users (e.g., warm yellows for "Happy," cool blues for "Sad"). This can be disabled in Settings.
*   **Special Chat Modes**:
    *   **Fight Mode**: The background shifts to a reddish hue, and bubbles have a sharper appearance to visually distinguish the conversation.
    *   **Incognito Mode**: The background becomes a dark gray. Messages sent in this mode disappear after 30 seconds and are not saved to history.

### 2.3 Accessibility Features

Accessibility is a core consideration, not an afterthought.

*   **Screen Reader Support**: All interactive elements (buttons, inputs) have `aria-label` attributes for clear screen reader announcements. Message content is readable in a logical order.
*   **Keyboard Navigation**: The entire message area, including the input bar and message actions, is navigable via the keyboard using standard Tab, Shift+Tab, and Enter/Space keys.
*   **Contrast & Theming**: The color palette is designed to meet WCAG AA contrast ratios. A dark mode is also available, inheriting from the same well-defined color tokens.
*   **Font Scaling**: The UI uses relative units (rem), allowing it to respect the user's system-level font size settings for better readability. This can also be adjusted in Settings.

### 2.4 Platform-Specific Experience (Mobile-First)

The application is designed as a Progressive Web App (PWA) with a mobile-first philosophy.

*   **Mobile (iOS/Android via PWA)**:
    *   Utilizes the bottom `Sheet` component for pickers (attachments, emojis), which is a common and ergonomic mobile UI pattern.
    *   Leverages `navigator.vibrate()` for haptic feedback on actions like long-pressing a message.
    *   Swipe-to-reply is a core gesture for quick interaction.
*   **Tablet/Web (Desktop)**:
    *   The interface scales gracefully, maintaining the mobile-first layout to ensure consistency.
    *   Makes full use of hover states for tooltips and interactive elements.
    *   Supports drag-and-drop for file attachments directly onto the input bar area.

This detailed approach ensures that ChirpChat feels thoughtfully designed and robust, regardless of how the user accesses it.
