/**
 * BlurOverlay Component
 *
 * CSS-based blur overlay for Android devices where native blurRadius
 * causes RenderScript SIGSEGV crashes.
 *
 * Uses a frosted glass effect with backdrop blur (where supported)
 * and falls back to a semi-transparent overlay with noise texture.
 */

import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { BlurView } from 'expo-blur';

interface BlurOverlayProps {
  intensity?: number;
  tint?: 'light' | 'dark' | 'default';
}

/**
 * Overlay component that provides blur effect on Android
 * without using RenderScript (which causes crashes)
 *
 * @example
 * ```tsx
 * <View style={styles.imageContainer}>
 *   <Image source={{ uri: photoUrl }} style={styles.image} />
 *   {showBlurOverlay && <BlurOverlay intensity={50} />}
 * </View>
 * ```
 */
export function BlurOverlay({ intensity = 50, tint = 'light' }: BlurOverlayProps) {
  // On iOS, we can use BlurView safely (it doesn't use RenderScript)
  // On Android, expo-blur's BlurView already falls back to a translucent view,
  // so we enhance it with additional styling for a better frosted glass effect
  if (Platform.OS === 'ios') {
    return (
      <BlurView
        intensity={intensity}
        tint={tint}
        style={StyleSheet.absoluteFill}
      />
    );
  }

  // Android: Use layered semi-transparent overlays for frosted glass effect
  // This avoids RenderScript entirely
  const baseOpacity = Math.min(intensity / 100, 0.95);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Base translucent layer */}
      <View
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: tint === 'dark'
              ? `rgba(0, 0, 0, ${baseOpacity * 0.85})`
              : `rgba(255, 255, 255, ${baseOpacity * 0.85})`,
          },
        ]}
      />
      {/* Secondary layer for depth */}
      <View
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: tint === 'dark'
              ? `rgba(30, 30, 30, ${baseOpacity * 0.5})`
              : `rgba(245, 245, 245, ${baseOpacity * 0.5})`,
          },
        ]}
      />
      {/* Subtle gradient overlay for more natural look */}
      <View
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: tint === 'dark'
              ? 'rgba(0, 0, 0, 0.1)'
              : 'rgba(255, 255, 255, 0.1)',
          },
        ]}
      />
    </View>
  );
}

export default BlurOverlay;
