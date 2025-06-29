
export interface FileValidationResult {
  isValid: boolean;
  fileType: 'image' | 'video' | 'audio' | 'document' | 'unknown';
  errors: string[];
  metadata: {
    size: number;
    type: string;
    name: string;
    lastModified: number;
  };
}

export interface FileTypeConfig {
  maxSize: number; // in bytes
  allowedTypes: string[];
  allowedExtensions: string[];
}

export const FILE_TYPE_CONFIGS: Record<string, FileTypeConfig> = {
  image: {
    maxSize: 10 * 1024 * 1024, // 10MB
    allowedTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic'],
    allowedExtensions: ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.heic']
  },
  video: {
    maxSize: 100 * 1024 * 1024, // 100MB
    allowedTypes: ['video/mp4', 'video/quicktime', 'video/webm'],
    allowedExtensions: ['.mp4', '.mov', '.webm']
  },
  audio: {
    maxSize: 25 * 1024 * 1024, // 25MB
    allowedTypes: ['audio/mpeg', 'audio/wav', 'audio/webm', 'audio/mp4', 'audio/x-m4a'],
    allowedExtensions: ['.mp3', '.wav', '.webm', '.m4a']
  },
  document: {
    maxSize: 50 * 1024 * 1024, // 50MB
    allowedTypes: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'],
    allowedExtensions: ['.pdf', '.doc', '.docx', '.txt']
  }
};

export function getFileExtension(filename: string): string {
  return `.${filename.split('.').pop()?.toLowerCase() || ''}`;
}

export function detectFileType(file: File): 'image' | 'video' | 'audio' | 'document' | 'unknown' {
  const extension = getFileExtension(file.name);
  for (const type in FILE_TYPE_CONFIGS) {
    const config = FILE_TYPE_CONFIGS[type];
    if (config.allowedTypes.includes(file.type) || config.allowedExtensions.includes(extension)) {
      return type as 'image' | 'video' | 'audio' | 'document';
    }
  }
  return 'unknown';
}

export function checkFileSize(file: File, maxSize: number): boolean {
    return file.size <= maxSize;
}

export function validateFile(file: File): FileValidationResult {
  const fileType = detectFileType(file);
  const errors: string[] = [];

  const metadata = {
    size: file.size,
    type: file.type,
    name: file.name,
    lastModified: file.lastModified,
  };

  if (fileType === 'unknown') {
    errors.push('Unsupported file type.');
    return { isValid: false, fileType, errors, metadata };
  }

  const config = FILE_TYPE_CONFIGS[fileType];
  if (!checkFileSize(file, config.maxSize)) {
    errors.push(`File size exceeds the limit of ${config.maxSize / 1024 / 1024}MB.`);
  }

  return {
    isValid: errors.length === 0,
    fileType,
    errors,
    metadata,
  };
}
