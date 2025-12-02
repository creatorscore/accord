import { useEffect, useRef } from 'react';
import { CaptureProtection } from 'react-native-capture-protection';
import * as ScreenCapture from 'expo-screen-capture';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * Custom hook to protect screens from screenshots and screen recording
 *
 * Uses react-native-capture-protection v2.x API for maximum protection:
 * - iOS: Screenshots appear BLACK, screen recording blocked, app switcher protected
 * - Android: Screenshots and screen recording blocked via FLAG_SECURE
 *
 * IMPORTANT: This is a life-or-death feature for LGBTQ+ users in dangerous regions.
 * Screenshot protection MUST work reliably.
 *
 * Usage:
 * ```tsx
 * function ChatScreen() {
 *   useScreenProtection(); // Enable protection for this screen
 *   return <View>...</View>;
 * }
 * ```
 *
 * @param enabled - Whether to enable screen protection (default: true)
 * @param options - Custom configuration for screen protection
 */
export function useScreenProtection(
  enabled: boolean = true,
  options?: {
    screenshot?: boolean;
    record?: boolean;
    appSwitcher?: boolean;
  }
) {
  const protectionEnabledRef = useRef(false);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    // Enable screenshot protection
    const enableProtection = async () => {
      try {
        // Check if we're in production
        // Use Constants.appOwnership to reliably detect production vs development
        // 'standalone' = App Store/Play Store build, 'expo' = Expo Go, null = dev client
        const appOwnership = Constants.appOwnership as string | null;
        const isStandalone = appOwnership === 'standalone' || appOwnership === null;

        // In __DEV__ mode (Metro bundler), disable protection for easier development
        if (__DEV__) {
          console.log('⚠️ Screenshot protection DISABLED in __DEV__ mode');
          return;
        }

        // STEP 1: Enable react-native-capture-protection (PRIMARY PROTECTION)
        // This is the main protection mechanism - makes screenshots BLACK on iOS
        // and uses FLAG_SECURE on Android
        const protectOptions = {
          screenshot: options?.screenshot !== false,
          record: options?.record !== false,
          appSwitcher: options?.appSwitcher !== false,
        };

        console.log('🛡️ Enabling screen protection with options:', protectOptions);

        await CaptureProtection.prevent(protectOptions);
        protectionEnabledRef.current = true;

        console.log('✅ react-native-capture-protection v2 ENABLED');
        console.log('   - Screenshots: BLOCKED (will appear BLACK on iOS)');
        console.log('   - Screen recording: BLOCKED');
        console.log('   - App switcher: PROTECTED');

        // STEP 2: Also enable expo-screen-capture as backup (OS-level blocking)
        if (options?.screenshot !== false) {
          try {
            await ScreenCapture.preventScreenCaptureAsync();
            console.log('✅ expo-screen-capture backup enabled');
          } catch (e) {
            // This might fail on some devices, but react-native-capture-protection
            // should still work
            console.warn('expo-screen-capture not available:', e);
          }
        }

        // Verify protection status
        const status = await CaptureProtection.protectionStatus();
        console.log('🛡️ Protection status:', status);

      } catch (error) {
        console.error('❌ CRITICAL: Failed to enable screenshot protection:', error);
        // Log to Sentry or error tracking in production
      }
    };

    enableProtection();

    // Cleanup: Allow screenshots when leaving the screen
    return () => {
      const disableProtection = async () => {
        try {
          // Skip if protection was never enabled
          if (!protectionEnabledRef.current) {
            return;
          }

          // Skip in dev mode
          if (__DEV__) {
            return;
          }

          const allowOptions = {
            screenshot: options?.screenshot !== false,
            record: options?.record !== false,
            appSwitcher: options?.appSwitcher !== false,
          };

          // Disable react-native-capture-protection
          await CaptureProtection.allow(allowOptions);

          // Disable expo-screen-capture backup
          if (options?.screenshot !== false) {
            try {
              await ScreenCapture.allowScreenCaptureAsync();
            } catch (e) {
              // Ignore
            }
          }

          protectionEnabledRef.current = false;
          console.log('✅ Screenshot protection disabled');
        } catch (error) {
          console.error('Error disabling screenshot protection:', error);
        }
      };
      disableProtection();
    };
  }, [enabled, options?.screenshot, options?.record, options?.appSwitcher]);
}

/**
 * Check if screen is currently being recorded
 */
export async function isScreenRecording(): Promise<boolean> {
  try {
    const result = await CaptureProtection.isScreenRecording();
    return result ?? false;
  } catch (error) {
    return false;
  }
}

/**
 * Get current protection status
 */
export async function getProtectionStatus() {
  try {
    return await CaptureProtection.protectionStatus();
  } catch (error) {
    return { screenshot: undefined, record: undefined, appSwitcher: undefined };
  }
}

/**
 * Manually enable protection (use this for global app-level protection)
 */
export async function enableGlobalProtection() {
  try {
    await CaptureProtection.prevent({
      screenshot: true,
      record: true,
      appSwitcher: true,
    });
    console.log('✅ Global screen protection enabled');
    return true;
  } catch (error) {
    console.error('Failed to enable global protection:', error);
    return false;
  }
}

/**
 * Manually disable protection
 */
export async function disableGlobalProtection() {
  try {
    await CaptureProtection.allow({
      screenshot: true,
      record: true,
      appSwitcher: true,
    });
    console.log('✅ Global screen protection disabled');
    return true;
  } catch (error) {
    console.error('Failed to disable global protection:', error);
    return false;
  }
}
