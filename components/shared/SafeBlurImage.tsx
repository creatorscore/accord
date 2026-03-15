/**
 * SafeBlurImage
 *
 * Drop-in image component that applies blur safely on all platforms.
 *
 * iOS: Uses expo-image with native blurRadius (safe, smooth gaussian).
 * Android: When blurRadius > 0, uses React Native's built-in Image (Fresco)
 * which applies blur via IterativeBoxBlurPostProcessor — NOT RenderScript.
 * This avoids the SIGSEGV crashes caused by Glide's RenderScript blur path
 * in expo-image on Android 8–16 (Samsung, Realme, TECNO, etc.).
 *
 * When no blur is needed, always uses expo-image for superior caching.
 *
 * On error: shows a gray placeholder instead of empty space. Resets on source change.
 */

import React, { useState, useCallback, useEffect } from 'react';
import { Image as RNImage, View, Platform, type ImageStyle, type StyleProp } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface SafeBlurImageProps {
  source: { uri: string };
  style?: StyleProp<ImageStyle>;
  contentFit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down';
  blurRadius?: number;
  cachePolicy?: string;
  transition?: number;
  onLoad?: () => void;
  onError?: () => void;
  className?: string;
  resizeMode?: 'cover' | 'contain' | 'stretch' | 'center';
}

export function SafeBlurImage({
  source,
  style,
  contentFit = 'cover',
  blurRadius = 0,
  cachePolicy,
  transition,
  onLoad,
  onError,
  className,
  resizeMode,
}: SafeBlurImageProps) {
  const [hasError, setHasError] = useState(false);
  const needsBlur = blurRadius > 0;
  const isAndroid = Platform.OS === 'android';

  // Reset error state when source URI changes (new photo loaded)
  useEffect(() => {
    setHasError(false);
  }, [source.uri]);

  const handleError = useCallback(() => {
    setHasError(true);
    onError?.();
  }, [onError]);

  // Show placeholder on error instead of empty space
  if (hasError) {
    return (
      <View style={[style as any, { backgroundColor: '#E5E7EB', justifyContent: 'center', alignItems: 'center' }]}>
        <MaterialCommunityIcons name="image-off-outline" size={40} color="#9CA3AF" />
      </View>
    );
  }

  // Android: Always use RN Image (Fresco) — expo-image (Glide) has known rendering
  // failures on many Android devices where images load but render as blank/invisible.
  // Fresco is more reliable for image display across Android OEMs.
  if (isAndroid) {
    return (
      <RNImage
        source={source}
        style={style}
        resizeMode={resizeMode || contentFit as any || 'cover'}
        blurRadius={blurRadius}
        onLoad={onLoad}
        onError={handleError}
      />
    );
  }

  // iOS: use expo-image (better caching, performance, native blur)
  return (
    <ExpoImage
      source={source}
      style={style}
      contentFit={contentFit}
      blurRadius={blurRadius}
      cachePolicy={cachePolicy as any}
      transition={transition}
      onLoad={onLoad}
      onError={handleError}
      className={className}
    />
  );
}
