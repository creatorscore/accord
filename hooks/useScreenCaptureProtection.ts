import { useEffect, useRef } from 'react';
import { CaptureProtection, CaptureEventType } from 'react-native-capture-protection';
import * as ScreenCapture from 'expo-screen-capture';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

// Use explicit environment check instead of __DEV__ which may be true in dev-client/TestFlight builds.
// Screenshot protection must ALWAYS be active in production — this is life-or-death for users in hostile regions.
const IS_PRODUCTION = Constants.expoConfig?.extra?.environment === 'production' ||
  process.env.EXPO_PUBLIC_ENVIRONMENT === 'production' ||
  (!__DEV__ && !Constants.expoConfig?.extra?.environment);

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
        // Only skip protection in non-production builds (explicit check, not __DEV__)
        if (!IS_PRODUCTION) {
          // Still enable detection listener for testing
          if (onScreenshot) {
            try {
              const subscription = ScreenCapture.addScreenshotListener(async () => {
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
        await CaptureProtection.prevent({
          screenshot: true,
          record: true,
          appSwitcher: true,
        });

        protectionEnabledRef.current = true;

        // STEP 2: Enable expo-screen-capture as backup
        try {
          await ScreenCapture.preventScreenCaptureAsync();
        } catch (e) {
          console.warn('expo-screen-capture not available:', e);
        }

        // STEP 3: Add capture event listener from react-native-capture-protection
        if (onScreenshot) {
          try {
            // Use the library's built-in listener for capture events
            // CaptureEventType values: NONE=0, RECORDING=1, END_RECORDING=2, CAPTURED=3, APP_SWITCHING=4
            const captureListener = CaptureProtection.addListener((event: CaptureEventType) => {
              // CAPTURED (3) = screenshot was taken
              if (event === CaptureEventType.CAPTURED) {
                onScreenshot();
              }
            });
            listenerRef.current = captureListener;
          } catch (e) {
            console.warn('Could not add capture listener:', e);

            // Fallback to expo-screen-capture listener (iOS + Android)
            try {
              const subscription = ScreenCapture.addScreenshotListener(async () => {
                try {
                  await onScreenshot();
                } catch (error) {
                  console.error('Error in screenshot callback:', error);
                }
              });
              listenerRef.current = subscription;
            } catch (fallbackError) {
              console.warn('Fallback screenshot listener not available:', fallbackError);
            }
          }
        }

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

          // Skip disabling in non-production mode (nothing was enabled)
          if (!IS_PRODUCTION || !protectionEnabledRef.current) {
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
        } catch (_) {
          // Expected on low-RAM devices where OS destroys Activity before cleanup runs
          // Silenced to avoid polluting Sentry breadcrumbs
        }
      };
      disableProtection();
    };
  }, [enabled, onScreenshot]);

  // Return false for backward compatibility (no overlay needed)
  return false;
}
