
"use client";

export type NetworkQuality = 'excellent' | 'good' | 'poor' | 'offline';
type NetworkChangeListener = (quality: NetworkQuality) => void;

class NetworkMonitor {
    private quality: NetworkQuality = 'good';
    private listeners: Set<NetworkChangeListener> = new Set();
    private connection: any | null = null; // Type as any for broader compatibility

    constructor() {
        if (typeof window !== 'undefined' && typeof navigator !== 'undefined') {
            this.connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
            
            this.updateQuality();

            window.addEventListener('online', this.updateQuality);
            window.addEventListener('offline', this.updateQuality);
            if (this.connection) {
                this.connection.addEventListener('change', this.updateQuality);
            }
        }
    }

    private updateQuality = () => {
        let newQuality: NetworkQuality;
        
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
            newQuality = 'offline';
        } else if (this.connection) {
            switch (this.connection.effectiveType) {
                case '4g':
                    newQuality = 'excellent';
                    break;
                case '3g':
                    newQuality = 'good';
                    break;
                case '2g':
                case 'slow-2g':
                    newQuality = 'poor';
                    break;
                default:
                    newQuality = 'good'; // Assume good if unknown
            }
        } else {
            newQuality = 'good'; // Fallback if Network Information API is not supported
        }

        if (newQuality !== this.quality) {
            this.quality = newQuality;
            this.emitChange();
        }
    }

    public getQuality(): NetworkQuality {
        // Ensure quality is updated before returning
        this.updateQuality();
        return this.quality;
    }

    public subscribe(listener: NetworkChangeListener): () => void {
        this.listeners.add(listener);
        // Immediately notify the new listener of the current state
        listener(this.quality);
        return () => this.listeners.delete(listener);
    }

    private emitChange() {
        this.listeners.forEach(listener => listener(this.quality));
    }
}

// Export a singleton instance
export const networkMonitor = typeof window !== 'undefined' ? new NetworkMonitor() : {} as NetworkMonitor;
