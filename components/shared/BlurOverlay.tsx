/**
 * BlurOverlay Component
 *
 * Provides a privacy blur overlay for photos.
 * iOS: Uses native BlurView for real gaussian blur.
 * Android: Uses a frosted glass effect since RenderScript causes SIGSEGV crashes.
 */

import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { BlurView } from 'expo-blur';

interface BlurOverlayProps {
  intensity?: number;
  tint?: 'light' | 'dark' | 'default';
}

export function BlurOverlay({ intensity = 50, tint = 'dark' }: BlurOverlayProps) {
  // On iOS, use native BlurView (no RenderScript issues)
  if (Platform.OS === 'ios') {
    return (
      <BlurView
        intensity={intensity}
        tint={tint}
        style={StyleSheet.absoluteFill}
      />
    );
  }

  // Android: Layered frosted glass effect without RenderScript
  // Uses dark translucent layers to obscure photo details while
  // looking like a blur rather than a white wash
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Primary frosted layer */}
      <View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: 'rgba(20, 20, 22, 0.75)' },
        ]}
      />
      {/* Secondary diffusion layer */}
      <View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: 'rgba(40, 36, 50, 0.45)' },
        ]}
      />
      {/* Subtle lavender tint for brand consistency */}
      <View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: 'rgba(165, 136, 184, 0.08)' },
        ]}
      />
    </View>
  );
}

export default BlurOverlay;
