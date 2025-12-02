import { useEffect, useRef } from 'react';
import { CaptureProtection, CaptureEventType } from 'react-native-capture-protection';
import * as ScreenCapture from 'expo-screen-capture';
import { Platform } from 'react-native';

/**
 * Hook to protect against screenshots and provide detection callbacks
 *
 * USES react-native-capture-protection v2.x API:
 *
 * iOS:
 *   - Screenshots appear BLACK
 *   - Screen recording is blocked
 *   - App switcher shows protection screen
 *   - Callback fires when screenshot is attempted
 *
 * Android:
 *   - Screenshots are completely blocked via FLAG_SECURE
 *   - Screen recording is blocked
 *   - Callback fires when screenshot is detected
 *
 * IMPORTANT: This is a life-or-death feature for LGBTQ+ users in dangerous regions.
 *
 * @param enabled - Whether screenshot protection is enabled (default: true)
 * @param onScreenshot - Callback when screenshot is detected/attempted
 */
export function useScreenCaptureProtection(
  enabled: boolean = true,
  onScreenshot?: () => void | Promise<void>
) {
  const protectionEnabledRef = useRef(false);
  const listenerRef = useRef<any>(null);

  useEffect(() => {
    if (!enabled) return;

    // Enable protection asynchronously
    const enableProtection = async () => {
      try {
        // In development mode: disable protection for easier testing
        if (__DEV__) {
          console.log('⚠️ Screenshot protection DISABLED in development mode');

          // Still enable detection listener for testing in dev
          if (onScreenshot) {
            try {
              const subscription = ScreenCapture.addScreenshotListener(async () => {
                console.log('📸 Screenshot detected (dev mode)');
                try {
                  await onScreenshot();
                } catch (error) {
                  console.error('Error in screenshot callback:', error);
                }
              });
              listenerRef.current = subscription;
            } catch (e) {
              console.warn('Could not add screenshot listener:', e);
            }
          }
          return;
        }

        // STEP 1: Enable react-native-capture-protection v2.x
        // This is the PRIMARY protection mechanism
        console.log('🛡️ Enabling screen capture protection...');

        await CaptureProtection.prevent({
          screenshot: true,
          record: true,
          appSwitcher: true,
        });

        protectionEnabledRef.current = true;
        console.log('✅ react-native-capture-protection v2 ENABLED');

        // STEP 2: Enable expo-screen-capture as backup
        try {
          await ScreenCapture.preventScreenCaptureAsync();
          console.log('✅ expo-screen-capture backup enabled');
        } catch (e) {
          console.warn('expo-screen-capture not available:', e);
        }

        // STEP 3: Add capture event listener from react-native-capture-protection
        if (onScreenshot) {
          try {
            // Use the library's built-in listener for capture events
            // CaptureEventType values: NONE=0, RECORDING=1, END_RECORDING=2, CAPTURED=3, APP_SWITCHING=4
            const captureListener = CaptureProtection.addListener((event: CaptureEventType) => {
              console.log('📸 Capture event detected:', event);
              // CAPTURED (3) = screenshot was taken
              if (event === CaptureEventType.CAPTURED) {
                onScreenshot();
              }
            });
            listenerRef.current = captureListener;
            console.log('✅ Capture event listener added');
          } catch (e) {
            console.warn('Could not add capture listener:', e);

            // Fallback to expo-screen-capture listener
            if (Platform.OS === 'ios') {
              const subscription = ScreenCapture.addScreenshotListener(async () => {
                console.log('📸 Screenshot detected via expo-screen-capture');
                try {
                  await onScreenshot();
                } catch (error) {
                  console.error('Error in screenshot callback:', error);
                }
              });
              listenerRef.current = subscription;
            }
          }
        }

        // Verify protection status
        const status = await CaptureProtection.protectionStatus();
        console.log('🛡️ Protection status:', status);

      } catch (error) {
        console.error('❌ CRITICAL: Failed to enable screenshot protection:', error);
      }
    };

    enableProtection();

    // Cleanup
    return () => {
      const disableProtection = async () => {
        try {
          // Remove listener
          if (listenerRef.current) {
            if (typeof listenerRef.current.remove === 'function') {
              listenerRef.current.remove();
            } else {
              CaptureProtection.removeListener(listenerRef.current);
            }
            listenerRef.current = null;
          }

          // Skip disabling in dev mode (nothing was enabled)
          if (__DEV__ || !protectionEnabledRef.current) {
            return;
          }

          // Allow screen capture
          await CaptureProtection.allow({
            screenshot: true,
            record: true,
            appSwitcher: true,
          });

          try {
            await ScreenCapture.allowScreenCaptureAsync();
          } catch (e) {
            // Ignore
          }

          protectionEnabledRef.current = false;
          console.log('✅ Screenshot protection disabled');
        } catch (error) {
          console.error('Error disabling screenshot protection:', error);
        }
      };
      disableProtection();
    };
  }, [enabled, onScreenshot]);

  // Return false for backward compatibility (no overlay needed)
  return false;
}
