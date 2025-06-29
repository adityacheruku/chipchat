
import { api } from './api';
import type { UploadItem, UploadProgress, UploadError } from '@/types';
import { UploadErrorCode, ERROR_MESSAGES } from '@/types/uploadErrors';
import { validateFile } from '@/utils/fileValidation';
import { imageProcessor } from './imageProcessor';
import { videoCompressor } from './videoCompressor';

// A simple event emitter
type ProgressListener = (progress: UploadProgress) => void;
const progressListeners: Set<ProgressListener> = new Set();

const emitProgress = (progress: UploadProgress) => {
  progressListeners.forEach(listener => listener(progress));
};

class UploadManager {
  private queue: UploadItem[] = [];
  private activeUploads: Map<string, XMLHttpRequest> = new Map();
  private maxConcurrentUploads = 2; // Reduced for potentially heavy compression tasks

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
    if (itemIndex === -1) return;

    this.queue[itemIndex].status = 'processing';
    emitProgress({ messageId: item.messageId, status: 'processing', progress: 0 });

    try {
      const validation = validateFile(item.file);
      if (!validation.isValid) {
        throw new Error(validation.errors.join(', '), { cause: UploadErrorCode.VALIDATION_FAILED });
      }
      
      let fileToUpload: Blob = item.file;
      let mediaType = validation.fileType;
      let thumbnailDataUrl: string | undefined = undefined;
      let eagerTransforms: string[] = [];

      if (mediaType === 'image') {
        const variants = await imageProcessor.processImage(item.file);
        fileToUpload = variants.compressed.blob;
        thumbnailDataUrl = variants.thumbnail.dataUrl;
        emitProgress({ messageId: item.messageId, status: 'processing', progress: 0, thumbnailDataUrl });
        // Define standard transformations for images
        eagerTransforms = [
            "w_800,c_limit,q_auto,f_auto", // Preview version
        ];
      } else if (mediaType === 'video') {
        this.queue[itemIndex].status = 'compressing';
        emitProgress({ messageId: item.messageId, status: 'compressing', progress: 0 });
        fileToUpload = await videoCompressor.compressVideo(item.file, 'medium', (progress) => {
            emitProgress({ messageId: item.messageId, status: 'compressing', progress: progress.progress });
        });
        // Define standard transformations for videos (e.g., a thumbnail)
        eagerTransforms = [
            "w_400,h_400,c_limit,f_jpg,so_1" // Thumbnail from 1st second
        ];
      }

      this.queue[itemIndex].status = 'uploading';
      emitProgress({ messageId: item.messageId, status: 'uploading', progress: 0, thumbnailDataUrl });
      
      const payload = { file_type: mediaType, eager: eagerTransforms };
      const { xhr, promise } = api.uploadFile(fileToUpload, payload, (progress) => {
        const currentItem = this.queue[itemIndex];
        if (currentItem) {
          currentItem.progress = progress;
          emitProgress({ messageId: item.messageId, status: 'uploading', progress, thumbnailDataUrl });
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
        
        const errorCode = (error.cause || UploadErrorCode.SERVER_ERROR) as UploadErrorCode;
        const uploadError: UploadError = {
            code: errorCode,
            message: error.message || ERROR_MESSAGES[errorCode] || 'An unknown error occurred.',
            retryable: [UploadErrorCode.NETWORK_ERROR, UploadErrorCode.SERVER_ERROR, UploadErrorCode.TIMEOUT].includes(errorCode),
        };
        
        currentItem.error = uploadError;
        emitProgress({ messageId: item.messageId, status: 'failed', progress: 0, error: uploadError });
        this.handleRetryLogic(currentItem);
      }
    } finally {
      this.processQueue();
    }
  }

  private handleRetryLogic(item: UploadItem): void {
      if (item.error?.retryable && item.retryCount < 3) {
          item.retryCount++;
          const delay = Math.pow(2, item.retryCount) * 1000;
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
      item.retryCount = 0;
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
}

export const uploadManager = typeof window !== 'undefined' ? new UploadManager() : {} as UploadManager;
