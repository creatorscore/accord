import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';
import * as Crypto from 'expo-crypto';
import { decode } from 'base64-arraybuffer';

/**
 * Image optimization configuration
 */
export const IMAGE_CONFIG = {
  // Profile photos
  profile: {
    maxWidth: 1080,
    maxHeight: 1440,
    quality: 0.8,
    format: ImageManipulator.SaveFormat.JPEG,
  },
  // Thumbnail for fast loading in lists
  thumbnail: {
    maxWidth: 400,
    maxHeight: 533,
    quality: 0.7,
    format: ImageManipulator.SaveFormat.JPEG,
  },
  // Chat images
  chat: {
    maxWidth: 1080,
    maxHeight: 1440,
    quality: 0.75,
    format: ImageManipulator.SaveFormat.JPEG,
  },
  // Max file size in bytes (3MB)
  maxFileSize: 3 * 1024 * 1024,
};

export interface OptimizedImage {
  uri: string;
  width: number;
  height: number;
  size?: number;
}

export interface ImageOptimizationOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  format?: ImageManipulator.SaveFormat;
  generateThumbnail?: boolean;
}

/**
 * Get file size in bytes
 */
async function getFileSize(uri: string): Promise<number> {
  try {
    const info = await FileSystem.getInfoAsync(uri);
    return info.exists && 'size' in info ? info.size : 0;
  } catch (error) {
    console.error('Error getting file size:', error);
    return 0;
  }
}

/**
 * Optimize image for upload
 * - Resizes to appropriate dimensions
 * - Compresses to reduce file size
 * - Maintains aspect ratio
 * - Optionally generates thumbnail
 */
export async function optimizeImage(
  uri: string,
  options: ImageOptimizationOptions = {}
): Promise<{
  optimized: OptimizedImage;
  thumbnail?: OptimizedImage;
}> {
  const {
    maxWidth = IMAGE_CONFIG.profile.maxWidth,
    maxHeight = IMAGE_CONFIG.profile.maxHeight,
    quality = IMAGE_CONFIG.profile.quality,
    format = IMAGE_CONFIG.profile.format,
    generateThumbnail = false,
  } = options;

  try {
    // First pass: resize and compress
    const manipulated = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: maxWidth } }],
      { compress: quality, format, base64: false }
    );

    // Check file size
    let finalUri = manipulated.uri;
    let finalQuality = quality;
    let fileSize = await getFileSize(manipulated.uri);

    // If file is still too large, compress more aggressively
    if (fileSize > IMAGE_CONFIG.maxFileSize) {
      console.log(`Image too large (${(fileSize / 1024 / 1024).toFixed(2)}MB), compressing further...`);

      // Progressive compression
      while (fileSize > IMAGE_CONFIG.maxFileSize && finalQuality > 0.3) {
        finalQuality -= 0.1;
        const recompressed = await ImageManipulator.manipulateAsync(
          uri,
          [{ resize: { width: maxWidth } }],
          { compress: finalQuality, format, base64: false }
        );

        finalUri = recompressed.uri;
        fileSize = await getFileSize(recompressed.uri);

        console.log(`Recompressed to ${(fileSize / 1024 / 1024).toFixed(2)}MB with quality ${finalQuality}`);
      }
    }

    const result: {
      optimized: OptimizedImage;
      thumbnail?: OptimizedImage;
    } = {
      optimized: {
        uri: finalUri,
        width: manipulated.width,
        height: manipulated.height,
        size: fileSize,
      },
    };

    // Generate thumbnail if requested
    if (generateThumbnail) {
      const thumb = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: IMAGE_CONFIG.thumbnail.maxWidth } }],
        {
          compress: IMAGE_CONFIG.thumbnail.quality,
          format: IMAGE_CONFIG.thumbnail.format,
          base64: false,
        }
      );

      const thumbSize = await getFileSize(thumb.uri);

      result.thumbnail = {
        uri: thumb.uri,
        width: thumb.width,
        height: thumb.height,
        size: thumbSize,
      };
    }

    return result;
  } catch (error) {
    console.error('Error optimizing image:', error);
    throw new Error('Failed to optimize image');
  }
}

/**
 * Batch optimize multiple images with progress callback
 */
export async function optimizeImages(
  uris: string[],
  options: ImageOptimizationOptions = {},
  onProgress?: (current: number, total: number) => void
): Promise<OptimizedImage[]> {
  const optimized: OptimizedImage[] = [];

  for (let i = 0; i < uris.length; i++) {
    try {
      const result = await optimizeImage(uris[i], options);
      optimized.push(result.optimized);

      if (onProgress) {
        onProgress(i + 1, uris.length);
      }
    } catch (error) {
      console.error(`Failed to optimize image ${i}:`, error);
      throw error;
    }
  }

  return optimized;
}

/**
 * Convert image URI to ArrayBuffer for Supabase upload
 */
export async function uriToArrayBuffer(uri: string): Promise<ArrayBuffer> {
  try {
    // Read file as base64
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    // Convert base64 to ArrayBuffer
    return decode(base64);
  } catch (error) {
    console.error('Error converting URI to ArrayBuffer:', error);
    throw new Error('Failed to process image for upload');
  }
}

/**
 * Calculate image dimensions to fit within bounds while maintaining aspect ratio
 */
export function calculateDimensions(
  originalWidth: number,
  originalHeight: number,
  maxWidth: number,
  maxHeight: number
): { width: number; height: number } {
  const aspectRatio = originalWidth / originalHeight;

  let width = originalWidth;
  let height = originalHeight;

  // Scale down if too wide
  if (width > maxWidth) {
    width = maxWidth;
    height = width / aspectRatio;
  }

  // Scale down if too tall
  if (height > maxHeight) {
    height = maxHeight;
    width = height * aspectRatio;
  }

  return {
    width: Math.round(width),
    height: Math.round(height),
  };
}

/**
 * Validate image before processing
 */
export async function validateImage(uri: string): Promise<{
  isValid: boolean;
  error?: string;
}> {
  try {
    // Check if file exists
    const info = await FileSystem.getInfoAsync(uri);
    if (!info.exists) {
      return { isValid: false, error: 'Image file not found' };
    }

    // Check file size (before optimization)
    const size = 'size' in info ? info.size : 0;
    const maxSize = 20 * 1024 * 1024; // 20MB before optimization
    if (size > maxSize) {
      return {
        isValid: false,
        error: `Image is too large (${(size / 1024 / 1024).toFixed(1)}MB). Please select an image under 20MB.`,
      };
    }

    return { isValid: true };
  } catch (error) {
    console.error('Error validating image:', error);
    return { isValid: false, error: 'Failed to validate image' };
  }
}

/**
 * Generate progressive quality versions of an image
 * Useful for responsive loading
 */
export async function generateProgressiveImages(
  uri: string
): Promise<{
  small: OptimizedImage;
  medium: OptimizedImage;
  large: OptimizedImage;
}> {
  const [small, medium, large] = await Promise.all([
    optimizeImage(uri, {
      maxWidth: 400,
      quality: 0.6,
    }),
    optimizeImage(uri, {
      maxWidth: 800,
      quality: 0.75,
    }),
    optimizeImage(uri, {
      maxWidth: 1080,
      quality: 0.85,
    }),
  ]);

  return {
    small: small.optimized,
    medium: medium.optimized,
    large: large.optimized,
  };
}

/**
 * Estimate upload time based on file size and network speed
 */
export function estimateUploadTime(
  fileSizeBytes: number,
  speedMbps: number = 5 // Default to 5 Mbps (typical mobile)
): number {
  const fileSizeMb = fileSizeBytes / (1024 * 1024);
  const timeSeconds = (fileSizeMb * 8) / speedMbps;
  return Math.ceil(timeSeconds);
}

/**
 * Get recommended image quality based on file size
 */
export function getRecommendedQuality(fileSizeBytes: number): number {
  const sizeMb = fileSizeBytes / (1024 * 1024);

  if (sizeMb < 1) return 0.9;
  if (sizeMb < 2) return 0.85;
  if (sizeMb < 4) return 0.8;
  if (sizeMb < 6) return 0.75;
  if (sizeMb < 10) return 0.7;
  return 0.6;
}

/**
 * Generate SHA-256 hash of image content for duplicate detection
 * Used to prevent users from uploading the same image twice
 */
export async function generateImageHash(uri: string): Promise<string> {
  try {
    // Get file info for size-based hashing to avoid loading entire file into RAM
    const info = await FileSystem.getInfoAsync(uri);
    const fileSize = (info as any).size || 0;

    // For files under 2MB, hash normally. For larger files, use size+partial content
    // to avoid spiking memory with massive base64 strings
    if (fileSize > 2 * 1024 * 1024) {
      // Hash file size + first 64KB as a fingerprint (avoids full base64 in RAM)
      const partial = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
        length: 65536,
        position: 0,
      });
      const hash = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        `${fileSize}:${partial}`
      );
      return hash;
    }

    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    const hash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      base64
    );

    return hash;
  } catch (error) {
    console.error('Error generating image hash:', error);
    throw new Error('Failed to generate image hash');
  }
}
