
# Native Plugin Implementation Guide for ChirpChat

**To the Native Plugin Developer:**

This document provides the complete technical specification for building the native Capacitor plugin required for the ChirpChat application. The web-side of the application is **finished**. Your task is to build the native Android and iOS components that the web app will call.

## 1. High-Level Architecture

The application uses a hybrid model:
- **Web Core**: A Next.js Progressive Web App (PWA) handles the entire user interface and business logic.
- **Native Bridge (Capacitor)**: This allows the web app to communicate with native device features.
- **Native Plugin (Your Task)**: A custom Capacitor plugin named `AssistiveTouch` that you will build. This plugin will expose specific methods to the web app and manage the native UI components and services.

![Architecture Diagram](https://placehold.co/800x300.png?text=WebApp%20%3C-%3E%20Capacitor%20%3C-%3E%20Native%20Plugin)
<br/>
*Data AI Hint: architecture diagram*

## 2. Core Task: Create the `AssistiveTouch` Plugin

Your primary responsibility is to create the Capacitor plugin.

**Command to Generate Plugin:**
```bash
npx @capacitor/cli plugin:generate
```
When prompted, use the name `AssistiveTouch`.

### Required Plugin API

The web app's `capacitorService.ts` will call the following methods. Your plugin must implement them.

**Methods to Expose:**

1.  **`requestOverlayPermission()`: Promise<void>**
    *   **Purpose**: To request the "draw over other apps" permission on Android.
    *   **Web Call**: `Capacitor.Plugins.AssistiveTouch.requestOverlayPermission()`

2.  **`show(options)`: Promise<void>**
    *   **Purpose**: Creates and displays the floating button.
    *   **Web Call**: `Capacitor.Plugins.AssistiveTouch.show({ size: 56, opacity: 0.8 })`

3.  **`hide()`: Promise<void>**
    *   **Purpose**: Removes the floating button from the screen.
    *   **Web Call**: `Capacitor.Plugins.AssistiveTouch.hide()`

**Events to Emit:**

Your native plugin must also emit events back to the web view when the user interacts with the floating button.

1.  **`singleTap`**: Emitted on a single tap.
    *   **Native Code**: `notifyListeners("singleTap", new JSObject());`
2.  **`doubleTap`**: Emitted on a double tap.
    *   **Native Code**: `notifyListeners("doubleTap", new JSObject());`
3.  **`longPress`**: Emitted on a long press.
    *   **Native Code**: `notifyListeners("longPress", new JSObject());`

---

## 3. Step-by-Step Native Implementation Plan

### Phase 1: Android Implementation

The goal on Android is a true floating button that persists via a Foreground Service.

#### **Step 1.1: Configure Permissions**
-   In `android/app/src/main/AndroidManifest.xml`, add the `SYSTEM_ALERT_WINDOW` permission.
    ```xml
    <uses-permission android:name="android.permission.SYSTEM_ALERT_WINDOW" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
    ```

#### **Step 1.2: Implement the `requestOverlayPermission` Method**
-   In your plugin's main Java/Kotlin file, implement the `requestOverlayPermission` method.
-   It should check `Settings.canDrawOverlays(getContext())`.
-   If permission is not granted, create an `Intent` to `Settings.ACTION_MANAGE_OVERLAY_PERMISSION` and start an activity for the result.

#### **Step 1.3: Create the `AssistiveTouchService`**
-   This will be a `ForegroundService` that runs independently of the main app activity.
-   **On `onCreate()`**:
    -   Create a `WindowManager` instance.
    -   Inflate the layout for your floating button.
    -   Set the `WindowManager.LayoutParams`. Use `TYPE_APPLICATION_OVERLAY` for the window type.
    -   Add the button view to the `WindowManager`.
-   **On `onStartCommand()`**:
    -   Create the required persistent notification for the foreground service. The notification text should be subtle (e.g., "ChirpChat is running to stay connected").
    -   Start the service in the foreground using `startForeground()`.
-   **On `onDestroy()`**:
    -   Clean up resources by removing the button view from the `WindowManager`.

#### **Step 1.4: Implement Drag-and-Snap Logic**
-   Attach an `OnTouchListener` to your floating button view.
-   In the listener, handle `ACTION_DOWN`, `ACTION_MOVE`, and `ACTION_UP` to update the view's `WindowManager.LayoutParams`.
-   On `ACTION_UP`, calculate the closest screen edge (left or right) and use a `ValueAnimator` to smoothly animate the button to that edge.
-   Save the button's final Y-position and side to `SharedPreferences` to restore its position later.

#### **Step 1.5: Implement Gesture Detection**
-   Use Android's `GestureDetector` and a `GestureDetector.SimpleOnGestureListener`.
-   **`onSingleTapConfirmed`**: Emit the `singleTap` event to the web view.
-   **`onDoubleTap`**: Emit the `doubleTap` event.
-   **`onLongPress`**: Emit the `longPress` event.
-   Implement haptic feedback (`HapticFeedbackConstants`) for each gesture.

#### **Step 1.6: Connect the Plugin to the Service**
-   In your main plugin class (`AssistiveTouchPlugin.java`):
    -   The `show()` method should start the `AssistiveTouchService` using an `Intent`.
    -   The `hide()` method should stop the service using `stopService()`.

### Phase 2: iOS Implementation (In-App Only)

**Reminder:** iOS does not allow drawing over other apps. This implementation will only work while the app is active.

#### **Step 2.1: Implement the Floating Button View**
-   Create a custom `UIView` for the button.
-   The `show()` plugin method should add this `UIView` as a subview to the main application `UIWindow`. This will ensure it floats above the Capacitor web view.
-   The `hide()` plugin method will remove this view from its superview.

#### **Step 2.2: Implement Drag-and-Snap Logic**
-   Add a `UIPanGestureRecognizer` to the button's `UIView`.
-   In the gesture handler, update the view's `center` property based on the gesture's translation.
-   When the gesture state is `.ended`, calculate the closest edge and use `UIView.animate` to snap it into place.

#### **Step 2.3: Implement Gesture Detection**
-   Add `UITapGestureRecognizer` instances for single and double taps.
-   Add a `UILongPressGestureRecognizer` for the long press.
-   In the handlers for these recognizers, call the `notifyListeners(...)` method to send the `singleTap`, `doubleTap`, and `longPress` events to the web view.

---

This plan provides a complete roadmap. The web infrastructure is ready and waiting for this native plugin to be completed.
