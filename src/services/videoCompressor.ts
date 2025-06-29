
"use client";

import type { FFmpeg } from '@ffmpeg/ffmpeg';

export interface CompressionSettings {
  maxWidth: number;
  maxHeight: number;
  videoBitrate: number; // in kbps
  audioBitrate: number; // in kbps
  frameRate: number;
  format: 'mp4' | 'webm';
}

export interface CompressionProgress {
  progress: number; // 0-100
  stage: 'initializing' | 'compressing' | 'done';
  estimatedTimeRemaining?: number;
}

class VideoCompressor {
  private ffmpeg: FFmpeg | null = null;
  private isInitialized = false;
  private createFFmpeg: any = null;
  private fetchFile: any = null;

  async initialize(onProgress: (progress: CompressionProgress) => void): Promise<void> {
    if (this.isInitialized) return;
    onProgress({ progress: 0, stage: 'initializing' });

    try {
      // Dynamically import the ffmpeg module only on the client
      const ffmpegModule = await import('@ffmpeg/ffmpeg');
      this.createFFmpeg = ffmpegModule.createFFmpeg;
      this.fetchFile = ffmpegModule.fetchFile;
      
      this.ffmpeg = this.createFFmpeg({
        log: process.env.NODE_ENV === 'development',
        corePath: '/ffmpeg/ffmpeg-core.js',
        // Note: For cross-origin isolation issues, ensure server headers are set:
        // Cross-Origin-Opener-Policy: same-origin
        // Cross-Origin-Embedder-Policy: require-corp
      });
      await this.ffmpeg.load();
      this.isInitialized = true;
      onProgress({ progress: 100, stage: 'initializing' });
    } catch (error) {
      console.error("FFmpeg initialization failed:", error);
      this.isInitialized = false;
      throw new Error("Could not initialize video compressor.");
    }
  }

  async compressVideo(
    file: File,
    level: 'light' | 'medium' | 'heavy',
    onProgress: (progress: CompressionProgress) => void
  ): Promise<Blob> {
    if (!this.isInitialized) {
      await this.initialize(onProgress);
    }
    if (!this.ffmpeg || !this.fetchFile) throw new Error("FFmpeg not available.");

    const settings = this.getCompressionSettings(level);
    const inputName = 'input.' + (file.name.split('.').pop() || 'mp4');
    const outputName = 'output.mp4';

    try {
      this.ffmpeg.FS('writeFile', inputName, await this.fetchFile(file));

      this.ffmpeg.setProgress(({ ratio }) => {
        onProgress({
          progress: Math.round(ratio * 100),
          stage: 'compressing',
        });
      });

      const command = this.buildCompressionCommand(inputName, outputName, settings);
      await this.ffmpeg.run(...command);

      const data = this.ffmpeg.FS('readFile', outputName);
      
      onProgress({ progress: 100, stage: 'done' });
      return new Blob([data.buffer], { type: 'video/mp4' });

    } catch (error: any) {
      console.error("Video compression failed:", error);
      throw new Error(`Video compression failed: ${error.message}`);
    } finally {
      try {
        this.ffmpeg.FS('unlink', inputName);
        this.ffmpeg.FS('unlink', outputName);
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  }

  async compressAudio(
    file: File,
    onProgress: (progress: CompressionProgress) => void
  ): Promise<Blob> {
    if (!this.isInitialized) {
      await this.initialize(onProgress);
    }
    if (!this.ffmpeg || !this.fetchFile) throw new Error("FFmpeg not available.");

    const inputName = 'input.' + (file.name.split('.').pop() || 'webm');
    const outputName = 'output.mp4'; // Using mp4 container with AAC audio is very compatible

    try {
      this.ffmpeg.FS('writeFile', inputName, await this.fetchFile(file));

      this.ffmpeg.setProgress(({ ratio }) => {
        onProgress({
          progress: Math.round(ratio * 100),
          stage: 'compressing',
        });
      });

      // Command for audio conversion to AAC in an MP4 container
      const command = [
        '-i', inputName,
        '-c:a', 'aac',      // Use the AAC audio codec
        '-b:a', '96k',       // Set audio bitrate to 96kbps, good for voice
        '-vn',               // No video output
        '-movflags', '+faststart',
        outputName
      ];

      await this.ffmpeg.run(...command);

      const data = this.ffmpeg.FS('readFile', outputName);
      
      onProgress({ progress: 100, stage: 'done' });
      return new Blob([data.buffer], { type: 'audio/mp4' });

    } catch (error: any) {
      console.error("Audio compression failed:", error);
      throw new Error(`Audio compression failed: ${error.message}`);
    } finally {
      try {
        this.ffmpeg.FS('unlink', inputName);
        this.ffmpeg.FS('unlink', outputName);
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  }


  private getCompressionSettings(level: 'light' | 'medium' | 'heavy'): CompressionSettings {
    switch (level) {
      case 'light':
        return { maxWidth: 1920, maxHeight: 1080, videoBitrate: 2000, audioBitrate: 128, frameRate: 30, format: 'mp4' };
      case 'medium':
        return { maxWidth: 1280, maxHeight: 720, videoBitrate: 1000, audioBitrate: 96, frameRate: 30, format: 'mp4' };
      case 'heavy':
        return { maxWidth: 854, maxHeight: 480, videoBitrate: 500, audioBitrate: 64, frameRate: 24, format: 'mp4' };
    }
  }

  private buildCompressionCommand(
    input: string,
    output: string,
    settings: CompressionSettings
  ): string[] {
    return [
      '-i', input,
      '-c:v', 'libx264',
      '-preset', 'medium', // A good balance of speed and quality
      '-crf', '23', // Constant Rate Factor (lower is better quality, 18-28 is a sane range)
      '-maxrate', `${settings.videoBitrate}k`,
      '-bufsize', `${settings.videoBitrate * 2}k`,
      // scale filter: resizes video if it's larger than max dimensions, keeping aspect ratio
      '-vf', `scale='min(${settings.maxWidth},iw)':'min(${settings.maxHeight},ih)':force_original_aspect_ratio=decrease`,
      '-r', settings.frameRate.toString(), // set frame rate
      '-c:a', 'aac', // audio codec
      '-b:a', `${settings.audioBitrate}k`, // audio bitrate
      '-movflags', '+faststart', // Optimize for web streaming
      output
    ];
  }
}

// Export a singleton instance
export const videoCompressor = new VideoCompressor();
