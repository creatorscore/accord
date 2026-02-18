/**
 * Photo Blur Hook
 *
 * Two-layer blur strategy for privacy photos:
 * 1. Downsized image via Supabase image transforms (~300px) — removes fine detail
 * 2. Native blurRadius on top (iOS: 15, Android: 8) — smooth gaussian finish
 *
 * The downsized image ensures Android only needs a light blur on a small image,
 * avoiding the heavy RenderScript processing that crashes on full-res photos.
 *
 * Falls back to useSafeBlur (overlay) if the URL can't be transformed.
 */

import { Platform } from 'react-native';
import { useSafeBlur } from './useSafeBlur';

interface UsePhotoBlurOptions {
  shouldBlur: boolean;
  photoUrl: string;
  blurDataUri?: string | null;
  blurIntensity?: number;
  /** Transform width — use ~800 for large/full-screen photos to avoid zoom look */
  transformWidth?: number;
}

interface UsePhotoBlurReturn {
  /** The URI to use for the image — transform URL if blurring, else original */
  imageUri: string;
  /** True when using the server transform blur */
  isServerBlur: boolean;
  /** Blur radius to apply on top of the downsized image */
  blurRadius: number;
  /** Legacy fallback overlay flag (Android only, false if server blur active) */
  showBlurOverlay: boolean;
  onImageLoad: () => void;
  onImageError: () => void;
}

/**
 * Convert a Supabase public storage URL to a downsized transform URL.
 * Returns null if the URL doesn't match the expected pattern.
 *
 * @param width - Target width in px. Smaller = more blur but can look zoomed
 *   when upscaled into large containers. Use ~800 for full-screen photos.
 */
export function getTransformUrl(photoUrl: string, width = 300): string | null {
  // Match: .../storage/v1/object/public/profile-photos/...
  const match = photoUrl.match(
    /^(https:\/\/[^/]+\/storage\/v1\/)object(\/public\/profile-photos\/.+)$/
  );
  if (!match) return null;
  return `${match[1]}render/image${match[2]}?width=${width}&quality=60`;
}

export function usePhotoBlur({
  shouldBlur,
  photoUrl,
  blurDataUri,
  transformWidth,
}: UsePhotoBlurOptions): UsePhotoBlurReturn {
  // Prefer blur_data_uri if available, otherwise construct transform URL
  const transformUrl = shouldBlur ? (blurDataUri || getTransformUrl(photoUrl, transformWidth)) : null;
  const hasServerBlur = !!transformUrl;

  // Legacy fallback — only active when transform URL can't be built
  const { blurRadius, showBlurOverlay, onImageLoad, onImageError } = useSafeBlur({
    shouldBlur: shouldBlur && !hasServerBlur,
    blurIntensity: 30,
  });

  // When using transform URL: apply native blur on top
  // Larger transform widths need more blur to compensate for less downscale
  const nativeBlur = (transformWidth && transformWidth >= 600)
    ? (Platform.OS === 'ios' ? 35 : 18)
    : (Platform.OS === 'ios' ? 20 : 12);
  const transformBlurRadius = shouldBlur && hasServerBlur ? nativeBlur : 0;

  return {
    imageUri: shouldBlur && hasServerBlur ? transformUrl! : photoUrl,
    isServerBlur: hasServerBlur,
    blurRadius: hasServerBlur ? transformBlurRadius : blurRadius,
    showBlurOverlay: hasServerBlur ? false : showBlurOverlay,
    onImageLoad,
    onImageError,
  };
}
