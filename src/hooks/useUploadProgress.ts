
"use client";

import { useState, useEffect, useMemo } from 'react';
import { uploadManager } from '@/services/uploadManager';
import type { UploadProgress } from '@/types';

export interface UseUploadProgressReturn {
  progress: Record<string, UploadProgress>;
  isUploading: boolean;
  hasErrors: boolean;
  retryUpload: (messageId: string) => void;
  cancelUpload: (messageId: string) => void;
}

export function useUploadProgress(): UseUploadProgressReturn {
  const [progress, setProgress] = useState<Record<string, UploadProgress>>({});

  useEffect(() => {
    const handleProgress = (update: UploadProgress) => {
      setProgress(currentProgress => ({
        ...currentProgress,
        [update.messageId]: update,
      }));
    };

    const unsubscribe = uploadManager.subscribe(handleProgress);
    return () => unsubscribe();
  }, []);

  const { isUploading, hasErrors } = useMemo(() => {
    const values = Object.values(progress);
    return {
      isUploading: values.some(p => p.status === 'uploading'),
      hasErrors: values.some(p => p.status === 'failed'),
    };
  }, [progress]);

  const retryUpload = (messageId: string) => {
    uploadManager.retryUpload(messageId);
  };
  
  const cancelUpload = (messageId: string) => {
    uploadManager.cancelUpload(messageId);
  };

  return { progress, isUploading, hasErrors, retryUpload, cancelUpload };
}
