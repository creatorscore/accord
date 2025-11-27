import { useEffect } from 'react';
import { CaptureProtection } from 'react-native-capture-protection';
import * as ScreenCapture from 'expo-screen-capture';
import { Platform } from 'react-native';

/**
 * Hook to protect against screenshots and provide detection callbacks
 *
 * USES TWO PACKAGES:
 * 1. react-native-capture-protection: Makes screenshots BLACK on iOS (prevention)
 * 2. expo-screen-capture: Detects screenshot events for logging (detection)
 *
 * iOS:
 *   - Screenshots appear BLACK (react-native-capture-protection)
 *   - Callback fires when screenshot is detected (expo-screen-capture)
 *   - Screen recording is prevented
 *
 * Android:
 *   - Screenshots are blocked via FLAG_SECURE in MainActivity.kt
 *   - Callback won't fire (screenshots are completely blocked)
 *
 * @param enabled - Whether screenshot protection is enabled (default: true)
 * @param onScreenshot - Callback when screenshot is detected (iOS only)
 * @param customMessage - Custom message to show during screen recording
 *
 * @deprecated Use useScreenProtection hook instead for new code
 */
export function useScreenCaptureProtection(
  enabled: boolean = true,
  onScreenshot?: () => void | Promise<void>,
  customMessage?: string
) {
  useEffect(() => {
    if (!enabled) return;

    let screenshotSubscription: { remove: () => void } | null = null;

    // Enable protection asynchronously
    const enableProtection = async () => {
      try {
        // In development mode: explicitly ALLOW screenshots (in case it was blocked before)
        if (__DEV__) {
          console.log('⚠️ Screenshot protection DISABLED in development mode');

          // Explicitly allow screen capture in dev mode
          try {
            await ScreenCapture.allowScreenCaptureAsync();
            console.log('✅ Explicitly allowed screen capture in dev mode');
          } catch (e) {
            console.log('Could not enable screen capture:', e);
          }

          // Still enable detection listener for testing
          if (Platform.OS === 'ios' && onScreenshot) {
            screenshotSubscription = ScreenCapture.addScreenshotListener(async () => {
              console.log('📸 Screenshot detected on iOS (dev mode) - firing callback');
              try {
                await onScreenshot();
              } catch (error) {
                console.error('Error in screenshot callback:', error);
              }
            });
          }
          return;
        }

        // STEP 1: Enable expo-screen-capture PREVENTION (OS-level blocking)
        await ScreenCapture.preventScreenCaptureAsync();
        console.log('✅ expo-screen-capture prevention enabled');

        // STEP 2: Enable react-native-capture-protection (makes screenshots BLACK on iOS)
        if (CaptureProtection && typeof CaptureProtection.preventScreenshot === 'function') {
          await CaptureProtection.preventScreenshot();
          console.log('✅ react-native-capture-protection enabled (screenshots will be BLACK)');

          // Enable screen recording protection
          await CaptureProtection.preventScreenRecord();
          console.log('✅ Screen recording protection enabled');
        } else {
          console.warn('⚠️ react-native-capture-protection not available');
        }

        // STEP 3: Enable screenshot DETECTION (for logging on iOS)
        if (Platform.OS === 'ios' && onScreenshot) {
          screenshotSubscription = ScreenCapture.addScreenshotListener(async () => {
            console.log('📸 Screenshot detected on iOS - firing callback');
            try {
              await onScreenshot();
            } catch (error) {
              console.error('Error in screenshot callback:', error);
            }
          });
          console.log('✅ Screenshot detection listener enabled');
        }

      } catch (error) {
        console.error('Error enabling screenshot protection:', error);
      }
    };

    enableProtection();

    // Cleanup
    return () => {
      const disableProtection = async () => {
        try {
          // Remove screenshot listener
          if (screenshotSubscription) {
            screenshotSubscription.remove();
            console.log('✅ Screenshot detection listener removed');
          }

          // Skip disabling in dev mode (nothing was enabled)
          if (__DEV__) {
            return;
          }

          // Allow expo-screen-capture
          await ScreenCapture.allowScreenCaptureAsync();
          console.log('✅ expo-screen-capture disabled');

          // Allow react-native-capture-protection screenshots
          if (CaptureProtection && typeof CaptureProtection.allowScreenshot === 'function') {
            await CaptureProtection.allowScreenshot();
            console.log('✅ react-native-capture-protection disabled');
          }
        } catch (error) {
          console.error('Error disabling screenshot protection:', error);
        }
      };
      disableProtection();
    };
  }, [enabled, onScreenshot, customMessage]);

  // Return false for backward compatibility (no overlay needed)
  return false;
}
