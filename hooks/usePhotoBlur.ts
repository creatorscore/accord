/**
 * Photo Blur Hook
 *
 * Returns blur parameters for SafeBlurImage.
 * SafeBlurImage handles platform differences internally:
 * - iOS: expo-image blurRadius (native gaussian)
 * - Android: RN Image blurRadius (Fresco's IterativeBoxBlur, not RenderScript)
 */

import { Platform } from 'react-native';
import { useSafeBlur } from './useSafeBlur';

interface UsePhotoBlurOptions {
  shouldBlur: boolean;
  photoUrl: string;
  blurDataUri?: string | null;
  blurIntensity?: number;
  /** @deprecated No longer used — kept for call-site compatibility */
  transformWidth?: number;
}

interface UsePhotoBlurReturn {
  imageUri: string;
  isServerBlur: boolean;
  blurRadius: number;
  onImageLoad: () => void;
  onImageError: () => void;
}

/**
 * @deprecated Transform URLs do not work with private storage buckets.
 * Always returns null.
 */
export function getTransformUrl(_photoUrl: string, _width = 300): string | null {
  return null;
}

export function usePhotoBlur({
  shouldBlur,
  photoUrl,
  blurDataUri,
}: UsePhotoBlurOptions): UsePhotoBlurReturn {
  const hasBlurData = shouldBlur && !!blurDataUri;

  const { blurRadius, onImageLoad, onImageError } = useSafeBlur({
    shouldBlur: shouldBlur && !hasBlurData,
    blurIntensity: 30,
  });

  // When using blurDataUri, apply native blur on top for extra privacy
  const dataUriBlurRadius = shouldBlur && hasBlurData ? 35 : 0;

  return {
    imageUri: hasBlurData ? blurDataUri! : photoUrl,
    isServerBlur: hasBlurData,
    blurRadius: hasBlurData ? dataUriBlurRadius : blurRadius,
    onImageLoad,
    onImageError,
  };
}
