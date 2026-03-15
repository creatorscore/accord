/**
 * SafeBlurView
 *
 * Drop-in replacement for expo-blur's BlurView that avoids
 * RenderScript SIGSEGV crashes on Android.
 *
 * iOS: Uses native BlurView (safe).
 * Android: Uses a translucent View with matching tint color.
 */

import React from 'react';
import { View, Platform, type ViewStyle, type StyleProp } from 'react-native';
import { BlurView } from 'expo-blur';

interface SafeBlurViewProps {
  intensity?: number;
  tint?: 'light' | 'dark' | 'default';
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}

export function SafeBlurView({ intensity = 50, tint = 'dark', style, children }: SafeBlurViewProps) {
  if (Platform.OS === 'ios') {
    return (
      <BlurView intensity={intensity} tint={tint} style={style}>
        {children}
      </BlurView>
    );
  }

  // Android: translucent background that approximates blur appearance
  const alpha = Math.min(0.95, (intensity / 100) * 0.85 + 0.15);
  const bg =
    tint === 'light'
      ? `rgba(255, 255, 255, ${alpha})`
      : tint === 'dark'
        ? `rgba(10, 10, 11, ${alpha})`
        : `rgba(30, 30, 35, ${alpha})`;

  return (
    <View style={[style, { backgroundColor: bg }]}>
      {children}
    </View>
  );
}

export default SafeBlurView;
