/**
 * Safe Blur Hook
 *
 * Provides blur functionality while preventing RenderScript SIGSEGV crashes on Android.
 *
 * On iOS: Uses native blurRadius (smooth, performant)
 * On Android: Returns blurRadius=0 and showBlurOverlay=true to use CSS-based overlay
 *
 * The proper blur on Android comes from server-side blur_data_uri thumbnails
 * (tiny ~20px JPEGs that bilinear-interpolate into a natural blur).
 * When blur_data_uri is available, neither blurRadius nor overlay is needed.
 *
 * Critical for user safety in Accord - users rely on photo blur for privacy.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { Platform } from 'react-native';

interface UseSafeBlurOptions {
  shouldBlur: boolean;
  blurIntensity?: number;
}

interface UseSafeBlurReturn {
  /** Blur radius for the image - 0 on Android to prevent crashes */
  blurRadius: number;
  /** Whether to show a blur overlay (Android fallback) */
  showBlurOverlay: boolean;
  onImageLoad: () => void;
  onImageError: () => void;
  resetBlur: () => void;
}

/**
 * Hook to safely apply blur to images while preventing crashes
 *
 * @param shouldBlur - Whether blur should be applied (e.g., photo_blur_enabled)
 * @param blurIntensity - Blur radius value (default: 30, iOS only)
 * @returns Object with blurRadius, showBlurOverlay, and event handlers
 *
 * @example
 * ```tsx
 * const { blurRadius, showBlurOverlay, onImageLoad, onImageError } = useSafeBlur({
 *   shouldBlur: profile.photo_blur_enabled && !isAdmin,
 *   blurIntensity: 30
 * });
 *
 * <View>
 *   <Image
 *     source={{ uri: photoUrl }}
 *     blurRadius={blurRadius}
 *     onLoad={onImageLoad}
 *     onError={onImageError}
 *   />
 *   {showBlurOverlay && <BlurOverlay />}
 * </View>
 * ```
 */
export function useSafeBlur({
  shouldBlur,
  blurIntensity = 30,
}: UseSafeBlurOptions): UseSafeBlurReturn {
  const [imageError, setImageError] = useState(false);
  const isMountedRef = useRef(true);

  // Track component mount status to prevent state updates after unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const onImageLoad = useCallback(() => {
    if (isMountedRef.current) {
      setImageError(false);
    }
  }, []);

  const onImageError = useCallback(() => {
    if (isMountedRef.current) {
      setImageError(true);
    }
  }, []);

  const resetBlur = useCallback(() => {
    if (isMountedRef.current) {
      setImageError(false);
    }
  }, []);

  const shouldApplyBlur = shouldBlur && !imageError;

  // On Android: NEVER use blurRadius - it uses RenderScript which crashes
  // Instead, return showBlurOverlay=true so components can render a CSS-based overlay
  // The proper solution is server-side blur_data_uri (handled by usePhotoBlur)
  const isAndroid = Platform.OS === 'android';

  return {
    // iOS: use native blur, Android: always 0 to prevent RenderScript crashes
    blurRadius: shouldApplyBlur && !isAndroid ? blurIntensity : 0,
    // Android fallback: show overlay instead of native blur
    showBlurOverlay: shouldApplyBlur && isAndroid,
    onImageLoad,
    onImageError,
    resetBlur,
  };
}
