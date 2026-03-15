/**
 * Safe Blur Hook
 *
 * Returns blur parameters for SafeBlurImage.
 * SafeBlurImage handles platform differences internally:
 * - iOS: expo-image blurRadius (native gaussian)
 * - Android: RN Image blurRadius (Fresco's IterativeBoxBlur, not RenderScript)
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

export function useSafeBlur({
  shouldBlur,
  blurIntensity = 30,
}: UseSafeBlurOptions): UseSafeBlurReturn {
  const [imageError, setImageError] = useState(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const onImageLoad = useCallback(() => {
    if (isMountedRef.current) setImageError(false);
  }, []);

  const onImageError = useCallback(() => {
    if (isMountedRef.current) setImageError(true);
  }, []);

  const resetBlur = useCallback(() => {
    if (isMountedRef.current) setImageError(false);
  }, []);

  return {
    // Keep blur active even on error — removing blur on a failed image
    // exposes an empty unblurred space which is worse than a blurred placeholder
    blurRadius: shouldBlur ? blurIntensity : 0,
    onImageLoad,
    onImageError,
    resetBlur,
  };
}
