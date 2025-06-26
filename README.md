
# ChirpChat: Comprehensive Project Documentation

## 1. Project Overview

ChirpChat is a modern, real-time messaging application designed to foster deep emotional connection between two partners. It goes beyond simple text messaging by integrating features like shared moods, "thinking of you" pings, and dynamic chat interfaces that reflect the users' emotional states.

The application is built as a Progressive Web App (PWA), ensuring a seamless, native-like experience on both desktop and mobile devices, with offline capabilities and push notifications.

### Core Features

*   **One-to-One Partner Chat**: A dedicated, private chat space for two users.
*   **Real-Time Messaging**: Instantaneous message delivery, typing indicators, and presence status (online/offline).
*   **Rich Media Sharing**: Send text, stickers, images, documents, and voice messages.
*   **Message Reactions**: React to messages with emojis.
*   **Dynamic Mood System**: Users can set their mood, which is visible to their partner and dynamically changes the chat's background theme to reflect the combined emotional state.
*   **Multiple Chat Modes**:
    *   **Normal Mode**: Standard chat experience with persistent history.
    *   **Fight Mode**: A visually distinct mode for arguments, also saved to history.
    *   **Incognito Mode**: Ephemeral messages that disappear after 30 seconds and are not saved.
*   **"Thinking of You" Pings**: Send a gentle, non-intrusive notification to your partner.
*   **PWA Functionality**: Installable on mobile and desktop, with offline access and quick-action shortcuts from the home screen.
*   **Push Notifications**: Receive alerts for new messages, mood updates, and pings even when the app is closed.

---

## 2. Technical Architecture

ChirpChat uses a modern, decoupled architecture with a Next.js frontend and a FastAPI backend. This separation of concerns allows for independent development, scaling, and maintenance.

### 2.1. Frontend (Next.js)

The frontend is a Progressive Web App (PWA) built with Next.js and React.

*   **Framework**: Next.js 15 with the App Router.
*   **Language**: TypeScript.
*   **UI Components**: Built with ShadCN UI, a collection of accessible and composable components based on Radix UI.
*   **Styling**: Tailwind CSS for utility-first styling.
*   **State Management**: React Context (`AuthContext`) for global state like user authentication. Component-level state is managed with `useState` and `useReducer`.
*   **Data Fetching**: A centralized API service (`src/services/api.ts`) handles all communication with the backend.
*   **Real-Time Communication**: A sophisticated `realtimeService` manages real-time events, starting with a WebSocket connection and gracefully falling back to Server-Sent Events (SSE) if the WebSocket connection fails. It also handles event synchronization to catch up on missed messages after a disconnection.
*   **Mobile/PWA**: `next-pwa` is used for service worker generation, enabling offline caching and push notifications. Capacitor is configured for potential future native builds.

### 2.2. Backend (FastAPI)

The backend is a high-performance API built with FastAPI (Python).

*   **Framework**: FastAPI for building robust, high-performance APIs with automatic OpenAPI documentation.
*   **Database**: Supabase (PostgreSQL) is used for data persistence. It's accessed via the `supabase-py` client library. The backend uses the service role key for admin-level operations.
*   **Real-Time Scaling**: Redis is used as a message broker for the Pub/Sub system. This allows multiple, stateless backend instances to broadcast real-time events to all connected clients, ensuring scalability.
*   **Authentication**: Secure JWT-based authentication with short-lived `access_token`s and long-lived `refresh_token`s for persistent sessions.
*   **File Storage**: Cloudinary is used for storing all user-uploaded media (avatars, images, documents, voice messages).
*   **Asynchronous Operations**: The entire backend is asynchronous (`async`/`await`) to handle high concurrency efficiently.

---

## 3. Core Feature Implementation Details

### 3.1. Authentication Flow

1.  **Registration (`/auth/register`)**: A new user provides a phone number, password, and display name. The password is hashed using `bcrypt` before being stored.
2.  **Login (`/auth/login`)**: The user provides their phone and password. The server verifies credentials.
3.  **Token Issuance**: Upon successful registration or login, the backend generates two JWTs:
    *   **`access_token`**: A short-lived token (e.g., 30 minutes) required to access protected API endpoints.
    *   **`refresh_token`**: A long-lived token (e.g., 7 days) used solely to get a new `access_token`.
4.  **Token Refresh (`/auth/refresh`)**: When the `access_token` expires, the frontend sends the `refresh_token` to this endpoint. If valid, the backend issues a new pair of access and refresh tokens (token rotation).
5.  **Token Storage**: Tokens are stored in the browser's `localStorage` on the frontend. The `access_token` is sent in the `Authorization: Bearer <token>` header for all authenticated API requests.

### 3.2. Real-Time Event System

The real-time system is designed to be robust and resilient.

1.  **Primary Connection (WebSocket)**: The frontend first attempts to establish a WebSocket connection to `/ws/connect`. This provides a low-latency, bidirectional communication channel.
2.  **Fallback (Server-Sent Events)**: If the WebSocket connection fails (e.g., due to network proxies), the frontend automatically falls back to a Server-Sent Events (SSE) connection to `/events/subscribe`. This is a read-only connection where the server pushes events to the client. Actions from the client (like sending a message) are sent over standard HTTP POST requests.
3.  **Event Broadcasting (Redis Pub/Sub)**: When an event occurs (e.g., a user sends a message), the backend instance that receives the request publishes the event to a Redis channel. All other backend instances subscribed to this channel receive the event and forward it to their connected clients.
4.  **Event Sequencing & Sync**: Every event broadcast through Redis is assigned a unique, sequential ID. This sequence number is stored on the frontend. If the client disconnects and reconnects, it sends its last known sequence number to the `/events/sync` endpoint. The backend then returns all events that have occurred since that number, ensuring no messages are missed.

### 3.3. Partner System

*   Users can only have one partner.
*   A user can send a partnership request to any other user who is not already in a partnership.
*   The recipient can view incoming requests and either `accept` or `reject` them.
*   Accepting a request establishes a bidirectional `partner_id` link in the `users` table and deletes all other pending requests for both users.

### 3.4. Database Schema Highlights

*   **`users`**: Stores user profile information, including `id`, `display_name`, `hashed_password`, `mood`, `partner_id`, etc.
*   **`chats`**: Contains a record for each chat conversation.
*   **`chat_participants`**: A linking table between `users` and `chats`.
*   **`messages`**: Stores all persistent messages, including text, media URLs, reactions (as a JSONB field), and message mode.
*   **`partner_requests`**: Tracks pending, accepted, and rejected partnership requests.
*   **`push_subscriptions`**: Stores the push notification subscription objects for each user's devices.
*   **`sticker_packs` & `stickers`**: Manages sticker data.

---

## 4. Developer Setup

### 4.1. Environment Variables

Create a `.env` file in the `chirpchat-backend` directory and populate it with the following keys. These are essential for connecting to Supabase, Redis, and Cloudinary.

```env
# Supabase
SUPABASE_URL=YOUR_SUPABASE_PROJECT_URL
SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_SUPABASE_SERVICE_ROLE_KEY

# JWT
SECRET_KEY=YOUR_VERY_SECRET_KEY_FOR_JWT_SIGNING # Generate a strong random string
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_MINUTES=10080 # 7 days

# Redis (for real-time event broadcasting)
REDIS_URL=redis://localhost:6379/0

# Cloudinary (for file uploads)
CLOUDINARY_CLOUD_NAME=YOUR_CLOUDINARY_CLOUD_NAME
CLOUDINARY_API_KEY=YOUR_CLOUDINARY_API_KEY
CLOUDINARY_API_SECRET=YOUR_CLOUDINARY_API_SECRET

# Push Notifications (VAPID keys)
VAPID_PUBLIC_KEY=YOUR_GENERATED_VAPID_PUBLIC_KEY
VAPID_PRIVATE_KEY=YOUR_GENERATED_VAPID_PRIVATE_KEY
VAPID_ADMIN_EMAIL=mailto:your-admin-email@example.com
```

### 4.2. Running the Application

**Backend (FastAPI)**

1.  Navigate to the `chirpchat-backend` directory.
2.  Install dependencies: `pip install -r requirements.txt`
3.  Run the server: `uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload`

**Frontend (Next.js)**

1.  Navigate to the root project directory.
2.  Install dependencies: `npm install`
3.  Create a `.env.local` file in the root and add `NEXT_PUBLIC_API_BASE_URL=http://localhost:8000`.
4.  Run the development server: `npm run dev`
5.  Access the application at `http://localhost:9002`.
