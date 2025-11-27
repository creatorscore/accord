import { useEffect } from 'react';
import { CaptureProtection } from 'react-native-capture-protection';
import * as ScreenCapture from 'expo-screen-capture';
import Constants from 'expo-constants';

/**
 * Custom hook to protect screens from screenshots and screen recording
 *
 * Uses BOTH packages for maximum protection:
 * 1. expo-screen-capture: OS-level screenshot blocking
 * 2. react-native-capture-protection: Makes screenshots BLACK on iOS
 *
 * On iOS: Screenshots will appear as BLACK screens
 * On Android: Screenshots are blocked entirely via FLAG_SECURE in MainActivity.kt
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
  useEffect(() => {
    if (!enabled) {
      return;
    }

    // Enable screenshot protection
    const enableProtection = async () => {
      try {
        // In development mode: explicitly ALLOW screenshots (in case it was blocked before)
        // Use Constants.appOwnership to reliably detect production vs development
        // 'standalone' = App Store/Play Store build, 'expo' = Expo Go
        const isProduction = Constants.appOwnership === 'standalone';

        if (!isProduction || __DEV__) {
          console.log('⚠️ Screenshot protection DISABLED in development mode');

          // Explicitly allow screen capture in dev mode
          try {
            await ScreenCapture.allowScreenCaptureAsync();
            console.log('✅ Explicitly allowed screen capture in dev mode');
          } catch (e) {
            console.log('Could not enable screen capture:', e);
          }
          return;
        }

        // STEP 1: Enable expo-screen-capture (OS-level blocking)
        if (options?.screenshot !== false) {
          await ScreenCapture.preventScreenCaptureAsync();
          console.log('✅ expo-screen-capture enabled');
        }

        // STEP 2: Enable react-native-capture-protection (makes screenshots BLACK on iOS)
        if (CaptureProtection) {
          if (options?.screenshot !== false) {
            await CaptureProtection.preventScreenshot();
            console.log('✅ react-native-capture-protection enabled (iOS screenshots will be BLACK)');
          }

          // Prevent screen recording
          if (options?.record !== false) {
            await CaptureProtection.preventScreenRecord();
            console.log('✅ Screen recording protection enabled');
          }
        } else {
          console.warn('react-native-capture-protection native module not available');
        }
      } catch (error) {
        // Silently fail in development/Expo Go
        console.warn('Screenshot protection not available:', error);
      }
    };

    enableProtection();

    // Cleanup: Allow screenshots when leaving the screen
    return () => {
      const disableProtection = async () => {
        try {
          // Skip disabling in dev mode (nothing was enabled)
          const isProduction = Constants.appOwnership === 'standalone';
          if (!isProduction || __DEV__) {
            return;
          }

          // Disable expo-screen-capture
          if (options?.screenshot !== false) {
            await ScreenCapture.allowScreenCaptureAsync();
          }

          // Disable react-native-capture-protection
          if (CaptureProtection && options?.screenshot !== false) {
            await CaptureProtection.allowScreenshot();
          }
          console.log('✅ Screenshot protection disabled');
        } catch (error) {
          // Silently fail
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
    if (!CaptureProtection) {
      return false;
    }
    const result = await CaptureProtection.isScreenRecording();
    return result ?? false;
  } catch (error) {
    return false;
  }
}
