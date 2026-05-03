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
  blurDataUri: _blurDataUri,
}: UsePhotoBlurOptions): UsePhotoBlurReturn {
  // Always render the full-resolution photoUrl with a strong native
  // blurRadius. The 20px-wide blur_data_uri thumbnail was previously
  // being stretched to card size, which looked like a pixelated
  // colored box rather than a blurred photo. Both expo-image (iOS)
  // and React Native Image (Android via Fresco's IterativeBoxBlur)
  // support native gaussian blur at this radius without crashing.
  const { blurRadius, onImageLoad, onImageError } = useSafeBlur({
    shouldBlur,
    blurIntensity: 60,
  });

  return {
    imageUri: photoUrl,
    isServerBlur: false,
    blurRadius,
    onImageLoad,
    onImageError,
  };
}
