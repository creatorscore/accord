/**
 * Safe Blur Hook
 *
 * Ensures photo blur is always applied when enabled, EXCEPT when images fail to load.
 * This prevents SIGSEGV crashes while maintaining user privacy protection.
 *
 * Critical for user safety in Accord - users rely on photo blur for privacy.
 */

import { useState, useCallback, useRef, useEffect } from 'react';

interface UseSafeBlurOptions {
  shouldBlur: boolean;
  blurIntensity?: number;
}

interface UseSafeBlurReturn {
  blurRadius: number;
  onImageLoad: () => void;
  onImageError: () => void;
  resetBlur: () => void;
}

/**
 * Hook to safely apply blur to images while preventing crashes
 *
 * @param shouldBlur - Whether blur should be applied (e.g., photo_blur_enabled)
 * @param blurIntensity - Blur radius value (default: 30)
 * @returns Object with blurRadius value and event handlers
 *
 * @example
 * ```tsx
 * const { blurRadius, onImageLoad, onImageError } = useSafeBlur({
 *   shouldBlur: profile.photo_blur_enabled && !isAdmin,
 *   blurIntensity: 30
 * });
 *
 * <Image
 *   source={{ uri: photoUrl }}
 *   blurRadius={blurRadius}
 *   onLoad={onImageLoad}
 *   onError={onImageError}
 * />
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

  // Apply blur when:
  // 1. shouldBlur is true (e.g., photo_blur_enabled)
  // 2. Image has NOT failed to load (imageError = false)
  //
  // This ensures:
  // ✅ Blur shows while image is loading
  // ✅ Blur shows after successful load
  // ❌ Blur does NOT show if image failed (prevents SIGSEGV crash)
  // ❌ State updates prevented after unmount (prevents garbage pointer crash)
  const blurRadius = shouldBlur && !imageError ? blurIntensity : 0;

  return {
    blurRadius,
    onImageLoad,
    onImageError,
    resetBlur,
  };
}
