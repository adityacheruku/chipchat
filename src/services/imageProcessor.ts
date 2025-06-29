
"use client";

// A service to process images on the client-side before uploading.
// It can resize, compress, and create different variants of an image.

export interface ImageProcessingOptions {
  maxWidth: number;
  maxHeight: number;
  quality: number;
  format: 'jpeg' | 'webp' | 'png';
  maintainAspectRatio: boolean;
}

export interface ProcessedImage {
  blob: Blob;
  dataUrl: string;
  width: number;
  height: number;
  size: number;
  format: string;
}

export interface ImageVariants {
  thumbnail: ProcessedImage;    // 150x150
  preview: ProcessedImage;      // 800x600 max
  compressed: ProcessedImage;   // Original with compression
  original: File;
}

class ImageProcessor {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  constructor() {
    // This code only runs on the client, so document is available.
    if (typeof document !== 'undefined') {
      this.canvas = document.createElement('canvas');
      const context = this.canvas.getContext('2d');
      if (!context) {
        throw new Error('Failed to get 2D context from canvas');
      }
      this.ctx = context;
    } else {
      // Provide dummy properties for SSR
      this.canvas = {} as HTMLCanvasElement;
      this.ctx = {} as CanvasRenderingContext2D;
    }
  }

  public async processImage(file: File): Promise<ImageVariants> {
    const originalImage = await this.loadImage(file);

    const thumbnail = await this.createThumbnail(originalImage);
    const preview = await this.createPreview(originalImage);
    const compressed = await this.createCompressed(originalImage, file.type);
    
    return { thumbnail, preview, compressed, original: file };
  }
  
  private loadImage(file: File): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(img.src); // Clean up the object URL
        resolve(img);
      };
      img.onerror = (err) => {
        URL.revokeObjectURL(img.src);
        reject(err);
      };
      img.src = URL.createObjectURL(file);
    });
  }

  private createThumbnail(img: HTMLImageElement): Promise<ProcessedImage> {
    return this.resizeImage(img, {
      maxWidth: 150,
      maxHeight: 150,
      quality: 0.8,
      format: 'jpeg',
      maintainAspectRatio: true,
    });
  }

  private createPreview(img: HTMLImageElement): Promise<ProcessedImage> {
    return this.resizeImage(img, {
      maxWidth: 800,
      maxHeight: 600,
      quality: 0.85,
      format: 'jpeg',
      maintainAspectRatio: true,
    });
  }

  private createCompressed(img: HTMLImageElement, originalType: string): Promise<ProcessedImage> {
    const quality = this.calculateCompressionRatio(img);
    const format = originalType.includes('png') ? 'png' : 'jpeg';
    
    return this.resizeImage(img, {
      maxWidth: img.naturalWidth,
      maxHeight: img.naturalHeight,
      quality,
      format,
      maintainAspectRatio: true,
    });
  }

  private async resizeImage(img: HTMLImageElement, options: ImageProcessingOptions): Promise<ProcessedImage> {
    const { width, height } = this.calculateDimensions(
      img.naturalWidth,
      img.naturalHeight,
      options.maxWidth,
      options.maxHeight,
      options.maintainAspectRatio
    );

    this.canvas.width = width;
    this.canvas.height = height;

    this.ctx.imageSmoothingEnabled = true;
    this.ctx.imageSmoothingQuality = 'high';
    this.ctx.drawImage(img, 0, 0, width, height);
    
    const blob = await this.canvasToBlob(`image/${options.format}`, options.quality);
    const dataUrl = this.canvas.toDataURL(`image/${options.format}`, options.quality);

    return { blob, dataUrl, width, height, size: blob.size, format: options.format };
  }

  private calculateDimensions(
    originalWidth: number, originalHeight: number,
    maxWidth: number, maxHeight: number,
    maintainAspectRatio: boolean
  ): { width: number; height: number } {
    if (!maintainAspectRatio) {
      return { width: maxWidth, height: maxHeight };
    }
    
    const ratio = Math.min(maxWidth / originalWidth, maxHeight / originalHeight, 1);
    return { width: Math.round(originalWidth * ratio), height: Math.round(originalHeight * ratio) };
  }

  private calculateCompressionRatio(img: HTMLImageElement): number {
    const pixels = img.naturalWidth * img.naturalHeight;
    if (pixels > 8_000_000) return 0.7;  // 8MP+
    if (pixels > 4_000_000) return 0.75; // 4-8MP
    if (pixels > 2_000_000) return 0.8;  // 2-4MP
    return 0.85; // <2MP
  }

  private canvasToBlob(format: string, quality: number): Promise<Blob> {
    return new Promise((resolve, reject) => {
      this.canvas.toBlob(blob => {
        if (blob) resolve(blob);
        else reject(new Error('Canvas to Blob conversion failed'));
      }, format, quality);
    });
  }
}

// Export a singleton instance
export const imageProcessor = new ImageProcessor();
