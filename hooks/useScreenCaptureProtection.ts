import { useEffect, useState } from 'react';
import { Platform, Alert, AppState } from 'react-native';

/**
 * Hook to protect against screenshots and screen recording
 *
 * Android: Completely blocks screenshots and screen recording (FLAG_SECURE)
 * iOS:
 *   - Makes screenshots appear black by overlaying content when app is inactive
 *   - Detects screenshots and logs security alert
 *   - Black overlay shown during app switcher/background (Telegram-style)
 *
 * Note: iOS does not provide an API to detect active screen recording or prevent
 * screenshots while the app is in the foreground. This is a platform limitation.
 *
 * @param enabled - Whether screenshot protection is enabled
 * @param onScreenshot - Optional callback when screenshot is detected (receives no params)
 *
 * Returns: showOverlay state for iOS (use with ScreenCaptureOverlay component)
 */
export function useScreenCaptureProtection(
  enabled: boolean = true,
  onScreenshot?: () => void | Promise<void>
) {
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

      // Detect screenshots and warn user
      let screenshotSubscription: any;
      if (ScreenCapture.addScreenshotListener) {
        screenshotSubscription = ScreenCapture.addScreenshotListener(async () => {
          // Screenshot was taken
          console.warn('[SECURITY] Screenshot detected');

          // Call the callback to log the event
          if (onScreenshot) {
            try {
              await onScreenshot();
            } catch (error) {
              console.error('Error logging screenshot event:', error);
            }
          }

          // Optional: Show subtle warning (don't interrupt user flow)
          setTimeout(() => {
            Alert.alert(
              'Privacy Notice',
              'Screenshots are logged for security. Please respect other users\' privacy.',
              [{ text: 'Understood' }]
            );
          }, 500);
        });
      }

      return () => {
        appStateSubscription?.remove();
        screenshotSubscription?.remove();
      };
    }

    // Android: Screenshots are blocked at native level (MainActivity.kt with FLAG_SECURE)
    // No JS code needed - screenshots will fail completely
  }, [enabled, onScreenshot]);

  return showSecurityOverlay;
}
