
# ChirpChat: Project Status & Comprehensive Overview

This document provides a detailed snapshot of the ChirpChat application, covering its design, features, technical architecture, and roadmap.

---

### 1. Design & UX Status

**1.1 Which screens do you already have wireframed or mocked up?**

All core screens have been implemented as high-fidelity, functional components. There are no separate wireframes; the code is the design. Implemented screens include:
*   **Onboarding**: A multi-step flow for user registration (Phone -> OTP -> User Details) and Login.
*   **Partner Pairing**: A screen for users to find and send/receive partner requests.
*   **Chat Interface**: The primary real-time messaging screen.
*   **Mood Entry Modal**: A dialog for users to set their current mood.
*   **Settings Hub**: A central navigation page for all application settings.
*   **Settings Sub-Pages**: Dedicated pages for Account, Notifications, Appearance, and Privacy.
*   **PWA Quick Action Pages**: Simplified pages for "Set Mood," "Send Image," and "Thinking of You" actions.

**1.2 Do you have high-fidelity designs (Figma/Sketch) or just low-fi sketches?**

The project has **high-fidelity, functional components** built directly in code using Next.js, React, and ShadCN UI. It has moved beyond the static design phase.

**1.3 Have you defined your visual style (colors, typography, icon set)?**

Yes, the visual style is well-defined and consistently applied.
*   **Color Palette**: A custom, calming palette is defined in `src/app/globals.css` using HSL CSS variables.
    *   Primary: `#90AFC5` (Soft Blue)
    *   Background: `#F0F4F7` (Light Gray)
    *   Accent: `#A991B5` (Pale Violet)
*   **Typography**: The primary font is **'PT Sans'** from Google Fonts.
*   **Iconography**: **Lucide React** is used for a modern and consistent icon set.

**1.4 What navigation patterns are in place? Any known UX pain points?**

*   **Navigation Model**: A page-based routing system managed by the Next.js App Router. The primary user flow is linear: Onboarding -> Partner Pairing -> Chat.
*   **Gestures**: The UI is mobile-first, featuring intuitive touch interactions like **swipe-to-reply** and **long-press** to enter message selection mode.
*   **Known UX Pain Points**:
    *   The "read" status is currently chat-wide, not per-message.
    *   The real-time typing indicator does not function on the SSE (fallback) connection.
    *   Navigation is purely hierarchical; a bottom navigation bar could improve discoverability in the future.

---

### 2. Feature & Flow Implementation

**2.1 Which core features are already coded and working end-to-end?**

*   **Secure User Authentication**: Full end-to-end registration via Phone/OTP and login with JWTs.
*   **Partner System**: Users can send, receive, and accept/reject requests to form a unique partnership.
*   **Real-Time Chat**: The core messaging experience is fully functional, supporting:
    *   Text, images, documents, and voice messages.
    *   Emoji reactions and message status indicators (sent, delivered, read).
    *   Real-time typing indicators and online presence.
*   **Dynamic Moods**: Users can set their mood, which is visible to their partner.
*   **Multiple Chat Modes**: "Normal," "Fight," and ephemeral "Incognito" modes are implemented.
*   **PWA Quick Actions**: "Set Mood," "Send Image," and "Thinking of You" work from the device's home screen.

**2.2 Which features are in progress or stalled?**

*   **In Progress**: No major features are currently mid-development. The focus has been on stabilizing the core feature set.
*   **Stalled/Planned**:
    *   **GIF Integration**: The UI for this exists but is disabled pending a decision on the service provider.
    *   **Per-Message Read Receipts**: This is a known UX improvement to be addressed.
    *   **"View-Once" Media**: This feature has not been started.

**2.3 Any live integrations with third-party services?**

Yes, the backend is fully integrated with:
*   **Supabase**: For the PostgreSQL database.
*   **Redis**: For real-time event broadcasting and caching.
*   **Cloudinary**: For all user media storage (avatars, images, documents, voice notes).

---

### 3. Technical Architecture

**3.1 What front-end framework(s) are you using?**

The frontend is a **Progressive Web App (PWA)** built with:
*   **Next.js 15** (App Router)
*   **React** & **TypeScript**
*   **ShadCN UI** for components
*   **Tailwind CSS** for styling
*   **Capacitor** is configured for potential future native builds.

**3.2 How is your backend organized?**

The backend is a high-performance, asynchronous API built with **FastAPI (Python)**.
*   **Architecture**: RESTful endpoints for standard operations, with a hybrid real-time system.
*   **Real-Time**: Uses **WebSockets** as the primary connection, with a graceful fallback to **Server-Sent Events (SSE)**. The system is horizontally scalable via a **Redis Pub/Sub** message broker.
*   **Database**: Supabase (PostgreSQL).
*   **Hosting**: The configuration (`apphosting.yaml`) is set up for **Firebase App Hosting**.

**3.3 Any existing CI/CD, testing, or deployment pipelines?**

*   **Local Development**: A `docker-compose.yml` file is available for a consistent local setup.
*   **Testing**: The project includes `pytest` as a dependency, but no unit or UI tests have been implemented yet.
*   **CI/CD**: No formal CI/CD pipelines are currently configured.

---

### 4. Cross-Platform & Performance

**4.1 Which OS versions and devices are you targeting? Have you tested on both iOS and Android?**

The application is built as a PWA, targeting **modern evergreen browsers** on both desktop and mobile platforms (iOS and Android). While no formal testing has been conducted on specific OS versions, the web-native approach ensures broad compatibility.

**4.2 Are there performance bottlenecks or crashes logged?**

There is no integrated crash logging service like Firebase Crashlytics. The backend uses `Prometheus` for performance monitoring, but there is no client-side performance tracking. The known UX pain points (e.g., SSE typing indicator) are the only identified "bottlenecks."

---

### 5. User Feedback & Analytics

**5.1 Do you have any beta users or testers? What feedback have they given?**

No formal beta testing program is currently active.

**5.2 Are you tracking usage (events, screens, custom metrics)?**

No user-level analytics (e.g., Google Analytics, Mixpanel) are currently being tracked.

---

### 6. Roadmap & Priorities

**6.1 What’s your next major milestone?**

The next logical milestone is a **stable MVP release for a closed beta**, allowing for initial user feedback on the core feature set.

**6.2 What blockers are you facing right now—design, dev, or product decisions?**

The primary focus has been on stabilizing the backend and ensuring end-to-end feature correctness. With the core systems now hardened, the main blockers have been resolved. The next steps will involve product decisions based on user feedback from the beta.

---

### 7. Customization & Branding

**7.1 Have you built the “custom app icon” feature yet?**

No, this feature has not been implemented.

**7.2 Any other personalization options live or planned?**

Yes, the following options are live in the "Appearance" settings:
*   **Theme**: Light, Dark, or System.
*   **Text Size**: A slider to adjust the application's font size.
*   **Dynamic Backgrounds**: An option to toggle the mood-based chat backgrounds on or off.

---

### 8. Stretch Goals & Nice-to-Haves

**8.1 Are there any experiments you’d love to trial later?**

*   **AI-Powered Mood Suggestions**: This feature is fully implemented using Genkit but is currently disabled via a feature flag (`ENABLE_AI_MOOD_SUGGESTION`). It can be activated for testing at any time.
*   **GIFs**: The UI anticipates this feature, which could be integrated via a service like Giphy or Tenor.
*   **Stickers**: A full sticker system (packs, search, favorites) is already implemented.

**8.2 What would “delight” your users beyond the basics?**

Given the app's focus on emotional connection, delightful features could include:
*   **Shared Music/Playlists**: A Spotify integration to listen to music together.
*   **Collaborative Journal**: A shared space for partners to write down thoughts and memories.
*   **More Interactive Backgrounds**: Backgrounds that react to touch or have subtle animations.
