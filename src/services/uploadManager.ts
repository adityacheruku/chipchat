
import { api } from './api';
import type { UploadItem, UploadProgress } from '@/types';
import { validateFile } from '@/utils/fileValidation';

// A simple event emitter
type ProgressListener = (progress: UploadProgress) => void;
const progressListeners: Set<ProgressListener> = new Set();

const emitProgress = (progress: UploadProgress) => {
  progressListeners.forEach(listener => listener(progress));
};

class UploadManager {
  private queue: UploadItem[] = [];
  private activeUploads: Map<string, XMLHttpRequest> = new Map();
  private maxConcurrentUploads = 3;

  constructor() {
    if (typeof window !== 'undefined') {
        if ((window as any).uploadManagerInstance) {
            return (window as any).uploadManagerInstance;
        }
        (window as any).uploadManagerInstance = this;
    }
  }

  public subscribe(callback: ProgressListener): () => void {
    progressListeners.add(callback);
    return () => progressListeners.delete(callback);
  }

  public addToQueue(item: Omit<UploadItem, 'status' | 'progress' | 'retryCount' | 'createdAt'>): void {
    const fullItem: UploadItem = {
      ...item,
      status: 'pending',
      progress: 0,
      retryCount: 0,
      createdAt: new Date(),
    };
    this.queue.push(fullItem);
    this.queue.sort((a, b) => a.priority - b.priority);
    this.processQueue();
  }

  private processQueue(): void {
    if (this.activeUploads.size >= this.maxConcurrentUploads) {
      return;
    }

    const nextItem = this.queue.find(item => item.status === 'pending');
    if (nextItem) {
      this.uploadFile(nextItem);
    }
  }
  
  private async uploadFile(item: UploadItem): Promise<void> {
    const itemIndex = this.queue.findIndex(q => q.id === item.id);
    if (itemIndex === -1) return; // Item was removed or not found

    this.queue[itemIndex].status = 'uploading';
    emitProgress({ messageId: item.messageId, status: 'uploading', progress: 0 });

    try {
      const validation = validateFile(item.file);
      if (!validation.isValid) {
        throw new Error(validation.errors.join(', '));
      }
      const mediaType = validation.fileType as 'image' | 'video' | 'audio' | 'document';
      
      const { xhr, promise } = api.uploadFile(item.file, mediaType, (progress) => {
        const currentItem = this.queue[itemIndex];
        if (currentItem) {
          currentItem.progress = progress;
          emitProgress({ messageId: item.messageId, status: 'uploading', progress });
        }
      });

      this.activeUploads.set(item.id, xhr);
      const result = await promise;

      this.activeUploads.delete(item.id);
      this.queue[itemIndex].status = 'completed';
      emitProgress({ messageId: item.messageId, status: 'completed', progress: 100, result });
      
    } catch (error: any) {
      this.activeUploads.delete(item.id);
      const currentItem = this.queue[itemIndex];
      if (currentItem) {
        currentItem.status = 'failed';
        currentItem.error = error.message;
        emitProgress({ messageId: item.messageId, status: 'failed', progress: 0, error: error.message });
        this.handleRetryLogic(currentItem);
      }
    } finally {
      this.processQueue();
    }
  }

  private handleRetryLogic(item: UploadItem): void {
      if (item.retryCount < 3) {
          item.retryCount++;
          const delay = Math.pow(2, item.retryCount) * 1000; // Exponential backoff
          setTimeout(() => {
              const itemIndex = this.queue.findIndex(q => q.id === item.id);
              if (itemIndex !== -1 && this.queue[itemIndex].status === 'failed') {
                  this.queue[itemIndex].status = 'pending';
                  this.processQueue();
              }
          }, delay);
      }
  }

  public retryUpload(messageId: string): void {
    const item = this.queue.find(q => q.messageId === messageId);
    if (item && item.status === 'failed') {
      item.status = 'pending';
      item.retryCount = 0; // Reset retry count for manual retry
      this.processQueue();
    }
  }

  public cancelUpload(messageId: string): void {
    const item = this.queue.find(q => q.messageId === messageId);
    if (item) {
        const xhr = this.activeUploads.get(item.id);
        if (xhr) {
          xhr.abort();
          this.activeUploads.delete(item.id);
        }
        const itemIndex = this.queue.findIndex(q => q.id === item.id);
        if(itemIndex > -1) {
            this.queue[itemIndex].status = 'cancelled';
            emitProgress({ messageId: this.queue[itemIndex].messageId, status: 'cancelled', progress: 0 });
            this.queue.splice(itemIndex, 1);
        }
        this.processQueue();
    }
  }

  public pauseQueue(): void { /* Not implemented */ }
  public resumeQueue(): void { /* Not implemented */ }
}

export const uploadManager = new UploadManager();
