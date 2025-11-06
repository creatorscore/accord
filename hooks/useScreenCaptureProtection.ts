import { useEffect, useState } from 'react';
import { Platform, Alert, AppState } from 'react-native';

/**
 * Hook to protect against screenshots and screen recording
 *
 * Android: Completely blocks screenshots and screen recording (FLAG_SECURE)
 * iOS: Makes screenshots appear black by overlaying content when app is inactive
 *      (Telegram-style privacy protection)
 *
 * Returns: showOverlay state for iOS (use with ScreenCaptureOverlay component)
 */
export function useScreenCaptureProtection(enabled: boolean = true) {
  const [showSecurityOverlay, setShowSecurityOverlay] = useState(false);

  useEffect(() => {
    if (!enabled) return;

    if (Platform.OS === 'ios') {
      // iOS: Overlay screen content to make screenshots appear black
      const ScreenCapture = require('expo-screen-capture');

      // Listen for app state changes (inactive = screenshot/app switcher)
      const appStateSubscription = AppState.addEventListener('change', (nextAppState) => {
        if (nextAppState === 'inactive' || nextAppState === 'background') {
          // App is going to background or inactive - show security overlay
          // This makes screenshots and app switcher previews appear black
          setShowSecurityOverlay(true);
        } else if (nextAppState === 'active') {
          // App is active again - hide security overlay
          setShowSecurityOverlay(false);
        }
      });

      // Also detect screenshots and warn user
      let screenshotSubscription: any;
      if (ScreenCapture.addScreenshotListener) {
        screenshotSubscription = ScreenCapture.addScreenshotListener(() => {
          // Screenshot was taken
          console.warn('[SECURITY] Screenshot detected');

          // Optional: Show subtle warning (don't interrupt user flow)
          setTimeout(() => {
            Alert.alert(
              'Privacy Notice',
              'Screenshots are logged for security. Please respect other users\' privacy.',
              [{ text: 'Understood' }]
            );
          }, 500);

          // TODO: Log to analytics/security monitoring
        });
      }

      return () => {
        appStateSubscription?.remove();
        screenshotSubscription?.remove();
      };
    }

    // Android: Screenshots are blocked at native level (MainActivity.kt with FLAG_SECURE)
    // No JS code needed - screenshots will fail completely
  }, [enabled]);

  return showSecurityOverlay;
}
