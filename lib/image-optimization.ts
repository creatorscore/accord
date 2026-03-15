import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';
import * as Crypto from 'expo-crypto';
import { decode } from 'base64-arraybuffer';

/**
 * Persistent directory for optimized images.
 * Uses documentDirectory (not cacheDirectory) so Android/Samsung
 * aggressive memory management won't clean these up before upload.
 */
const OPTIMIZED_IMAGES_DIR = `${FileSystem.documentDirectory}optimized-photos/`;

async function ensureOptimizedDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(OPTIMIZED_IMAGES_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(OPTIMIZED_IMAGES_DIR, { intermediates: true });
  }
}

/**
 * Copy an image from a temp/cache URI to the persistent optimized-photos directory.
 * Returns the new persistent URI.
 */
async function persistImage(tempUri: string): Promise<string> {
  await ensureOptimizedDir();
  const filename = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.jpg`;
  const persistentUri = `${OPTIMIZED_IMAGES_DIR}${filename}`;
  await FileSystem.copyAsync({ from: tempUri, to: persistentUri });
  return persistentUri;
}

/**
 * Clean up all persisted optimized images (call after successful upload).
 */
export async function cleanupOptimizedImages(): Promise<void> {
  try {
    const info = await FileSystem.getInfoAsync(OPTIMIZED_IMAGES_DIR);
    if (info.exists) {
      await FileSystem.deleteAsync(OPTIMIZED_IMAGES_DIR, { idempotent: true });
    }
  } catch (error) {
    console.warn('Failed to cleanup optimized images dir:', error);
  }
}

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
  // Blur thumbnail for privacy blur (server-side)
  blur: {
    maxWidth: 20,
    quality: 0.5,
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
      }
    }

    // Persist optimized image to document directory so it survives
    // Android memory management (Samsung, Xiaomi, etc. aggressively clean temp files)
    const persistedUri = await persistImage(finalUri);
    const persistedSize = await getFileSize(persistedUri);

    const result: {
      optimized: OptimizedImage;
      thumbnail?: OptimizedImage;
    } = {
      optimized: {
        uri: persistedUri,
        width: manipulated.width,
        height: manipulated.height,
        size: persistedSize || fileSize,
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
 * Convert image URI to ArrayBuffer for Supabase upload.
 * Optionally accepts an originalUri to re-optimize from if the file is missing
 * (handles Android temp file cleanup by Samsung/Xiaomi/etc).
 */
export async function uriToArrayBuffer(
  uri: string,
  originalUri?: string
): Promise<ArrayBuffer> {
  try {
    // Check if file still exists (Android can clean temp/cache files)
    const info = await FileSystem.getInfoAsync(uri);
    const fileSize = info.exists && 'size' in info ? info.size : 0;

    // Treat 0-byte files as missing (Samsung/Xiaomi can write empty files during cleanup)
    if (!info.exists || fileSize === 0) {
      // If we have the original URI, try re-optimizing
      if (originalUri) {
        console.warn('Optimized file missing or empty, re-optimizing from original:', originalUri);
        const originalInfo = await FileSystem.getInfoAsync(originalUri);
        if (originalInfo.exists) {
          const { optimized } = await optimizeImage(originalUri);
          uri = optimized.uri;
        } else {
          throw new Error(
            'Photo file was removed by your device. Please remove this photo and re-add it.'
          );
        }
      } else {
        throw new Error(
          'Photo file was removed by your device. Please remove this photo and re-add it.'
        );
      }
    }

    // Primary path: fetch(uri) → ArrayBuffer (no base64 intermediate, lower memory)
    try {
      const response = await fetch(uri);
      if (!response.ok) {
        throw new Error(`fetch returned ${response.status}`);
      }
      const buffer = await response.arrayBuffer();
      if (buffer.byteLength === 0) {
        throw new Error('fetch returned empty body');
      }
      return buffer;
    } catch (fetchError) {
      console.warn('fetch(uri).arrayBuffer() failed, falling back to base64:', fetchError);
    }

    // Fallback: read as base64 string then decode (works on some file URI schemes where fetch doesn't)
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    if (!base64 || base64.length === 0) {
      throw new Error('Photo file could not be read. Please remove this photo and re-add it.');
    }
    return decode(base64);
  } catch (error: any) {
    console.error('Error converting URI to ArrayBuffer:', error);
    // Re-throw with the original message if it's already user-friendly
    if (error.message?.includes('Please remove') || error.message?.includes('re-add')) {
      throw error;
    }
    throw new Error('Failed to process image for upload. Please try removing and re-adding the photo.');
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
 * Generate a tiny (~20px wide) JPEG thumbnail as a base64 data URI.
 * When displayed in a full-size container, bilinear interpolation creates
 * a natural blur effect — same technique used by Medium and Facebook.
 * Result is ~300-500 bytes, stored directly in the database.
 */
export async function generateBlurDataUri(uri: string): Promise<string> {
  try {
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: IMAGE_CONFIG.blur.maxWidth } }],
      {
        compress: IMAGE_CONFIG.blur.quality,
        format: IMAGE_CONFIG.blur.format,
        base64: true,
      }
    );

    return `data:image/jpeg;base64,${result.base64}`;
  } catch (error) {
    console.error('Error generating blur data URI:', error);
    throw new Error('Failed to generate blur thumbnail');
  }
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
