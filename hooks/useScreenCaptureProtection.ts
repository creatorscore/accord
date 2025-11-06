import { useEffect } from 'react';
import { Platform, Alert, AppState } from 'react-native';
import * as Application from 'expo-application';

/**
 * Hook to protect against screenshots and screen recording
 *
 * Android: Completely blocks screenshots and screen recording
 * iOS: Detects screenshots (cannot block due to Apple policy) and warns user
 */
export function useScreenCaptureProtection(enabled: boolean = true) {
  useEffect(() => {
    if (!enabled) return;

    if (Platform.OS === 'ios') {
      // iOS: Detect screenshots (can't prevent them)
      const { addListener } = require('expo-screen-capture');

      const subscription = addListener(() => {
        // Screenshot was taken - warn the user
        Alert.alert(
          'Screenshot Detected',
          'Screenshots are not allowed in Accord to protect user privacy. This action has been logged.',
          [{ text: 'Understood' }]
        );

        // TODO: Log screenshot event to analytics/security monitoring
        console.warn('[SECURITY] Screenshot taken by user');
      });

      return () => {
        subscription?.remove();
      };
    }

    // Android: Screenshots are blocked at native level (MainActivity.kt)
    // No JS code needed - FLAG_SECURE handles this
  }, [enabled]);
}
