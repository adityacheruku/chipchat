
"use client";

// This service acts as a bridge to native Capacitor plugins.
// In a real native build, the methods would call Capacitor plugins.
// For web (PWA) development, it provides simulated or no-op functionality.

type CapacitorEvent = 'singleTap' | 'doubleTap' | 'longPress';
type CapacitorEventListener = (data?: any) => void;

const isCapacitorAvailable = () => {
    // In a real app, you might check if `Capacitor.isNativePlatform()` is true.
    return typeof window !== 'undefined' && (window as any).Capacitor;
};

class CapacitorService {
    private listeners: Map<CapacitorEvent, Set<CapacitorEventListener>> = new Map();

    constructor() {
        if (isCapacitorAvailable()) {
            this.registerNativeEventListeners();
        }
    }
    
    private registerNativeEventListeners() {
        // In a real native build, this connects to the Capacitor plugin.
        // The native plugin would then call back to the webview.
        const { AssistiveTouch } = (window as any).Capacitor.Plugins;

        if (AssistiveTouch) {
            AssistiveTouch.addListener('singleTap', () => this.emit('singleTap'));
            AssistiveTouch.addListener('doubleTap', () => this.emit('doubleTap'));
            AssistiveTouch.addListener('longPress', () => this.emit('longPress'));
        }
    }

    // Public method for web components to subscribe to native events
    public on(event: CapacitorEvent, callback: CapacitorEventListener): () => void {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event)!.add(callback);
        
        // Return an unsubscribe function
        return () => {
            this.listeners.get(event)?.delete(callback);
        };
    }

    private emit(event: CapacitorEvent, data?: any) {
        this.listeners.get(event)?.forEach(callback => callback(data));
    }


    isAssistiveTouchAvailable = (): boolean => {
        // This would check if the specific native plugin is available.
        return isCapacitorAvailable();
    };

    hasOverlayPermission = async (): Promise<boolean> => {
        if (!isCapacitorAvailable()) return false;
        // const { SystemAlertWindow } = (window as any).Capacitor.Plugins;
        // const result = await SystemAlertWindow.checkStatus();
        // return result.granted;
        console.log("Checking for overlay permission... (simulated true)");
        return true; // Simulate permission already granted for web flow
    };

    requestOverlayPermission = async (
        showDialog: (callbacks: { onConfirm: () => void, onCancel: () => void }) => void
    ): Promise<boolean> => {
        if (!isCapacitorAvailable()) {
            console.warn("Capacitor not available. Cannot request overlay permission.");
            return false;
        }

        return new Promise((resolve) => {
            const handleConfirm = async () => {
                // In a real build, this calls the native permission request.
                // const { SystemAlertWindow } = (window as any).Capacitor.Plugins;
                // const result = await SystemAlertWindow.requestPermission();
                // For web simulation, we'll assume it's granted.
                console.log("Requesting system alert window permission... (simulated success)");
                const result = { granted: true };
                resolve(result.granted);
            };

            const handleCancel = () => {
                console.log("User cancelled permission request.");
                resolve(false);
            };
            
            showDialog({ onConfirm: handleConfirm, onCancel: handleCancel });
        });
    };

    showFloatingButton = async (): Promise<void> => {
        if (!isCapacitorAvailable()) return;
        // const { AssistiveTouch } = (window as any).Capacitor.Plugins;
        // await AssistiveTouch.show({ size: 56, opacity: 0.8 });
        console.log("Showing native floating button... (simulated)");
    };
    
    hideFloatingButton = async (): Promise<void> => {
        if (!isCapacitorAvailable()) return;
        // const { AssistiveTouch } = (window as any).Capacitor.Plugins;
        // await AssistiveTouch.hide();
        console.log("Hiding native floating button... (simulated)");
    };
}

export const capacitorService = new CapacitorService();
