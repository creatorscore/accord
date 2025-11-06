import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';

interface ScreenCaptureOverlayProps {
  visible: boolean;
}

/**
 * Security overlay that makes screenshots appear black on iOS
 * Covers the entire screen when app goes inactive (Telegram-style protection)
 */
export function ScreenCaptureOverlay({ visible }: ScreenCaptureOverlayProps) {
  // Only render on iOS when visible
  if (Platform.OS !== 'ios' || !visible) {
    return null;
  }

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      accessible={false}
    >
      <View style={styles.securityOverlay} />
    </View>
  );
}

const styles = StyleSheet.create({
  securityOverlay: {
    flex: 1,
    backgroundColor: '#000000', // Solid black - appears in screenshots
    // Alternative options:
    // backgroundColor: '#9B87CE', // Accord purple
    // Or add logo/branding here
  },
});
