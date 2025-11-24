import { useEffect } from 'react';
import { CaptureProtection } from 'react-native-capture-protection';

/**
 * Custom hook to protect screens from screenshots and screen recording
 *
 * On iOS: Screenshots will appear as a black screen
 * On Android: Screenshots are blocked entirely
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

    // Check if native module is available
    if (!CaptureProtection) {
      console.warn('react-native-capture-protection native module not available');
      return;
    }

    // Enable screenshot protection
    const enableProtection = async () => {
      try {
        // Prevent screenshots and screen recording
        // On iOS: screenshots will appear as black images
        // On Android: screenshots are blocked entirely
        await CaptureProtection.prevent({
          screenshot: options?.screenshot !== false,
          record: options?.record !== false,
          appSwitcher: options?.appSwitcher !== false,
        });
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
          await CaptureProtection.allow({
            screenshot: true,
            record: true,
            appSwitcher: true,
          });
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
