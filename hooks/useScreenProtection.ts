import { useEffect } from 'react';
import CaptureProtection from 'react-native-capture-protection';

/**
 * Custom hook to protect screens from screenshots and screen recording
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
    customMessage?: string;
  }
) {
  useEffect(() => {
    if (!enabled) {
      console.log('📸 Screenshot protection disabled (enabled=false)');
      return;
    }

    // Check if native module is available
    if (!CaptureProtection) {
      console.warn('⚠️ react-native-capture-protection native module not available. Screenshot protection disabled.');
      return;
    }

    console.log('📸 Attempting to enable screenshot protection...');
    console.log('📸 CaptureProtection module:', {
      hasPreventScreenshot: typeof CaptureProtection.preventScreenshot === 'function',
      hasPrevent: typeof CaptureProtection.prevent === 'function',
      hasAllow: typeof CaptureProtection.allow === 'function',
      hasAllowScreenshot: typeof CaptureProtection.allowScreenshot === 'function',
    });

    // Enable screenshot protection using the preventScreenshot() API
    const enableProtection = async () => {
      try {
        if (typeof CaptureProtection.preventScreenshot === 'function') {
          console.log('📸 Calling CaptureProtection.preventScreenshot()...');
          await CaptureProtection.preventScreenshot();
          console.log('✅ Screenshot protection enabled successfully (black screen mode)');
        } else if (typeof CaptureProtection.prevent === 'function') {
          console.log('📸 Calling CaptureProtection.prevent() as fallback...');
          CaptureProtection.prevent({
            screenshot: true,
            record: options?.record !== false ? {
              text: options?.customMessage || 'Accord protects your privacy',
              textColor: '#FFFFFF',
              backgroundColor: '#9B87CE'
            } : false,
            appSwitcher: options?.appSwitcher ?? true,
          });
          console.log('✅ Screenshot protection enabled (prevent mode)');
        } else {
          console.warn('⚠️ No screenshot protection methods available');
        }
      } catch (error) {
        console.error('❌ Error enabling screenshot protection:', error);
      }
    };

    enableProtection();

    // Cleanup: Allow screenshots when leaving the screen
    return () => {
      console.log('📸 Disabling screenshot protection (cleanup)...');
      try {
        if (typeof CaptureProtection.allowScreenshot === 'function') {
          CaptureProtection.allowScreenshot();
          console.log('✅ Screenshot protection disabled (allowScreenshot)');
        } else if (typeof CaptureProtection.allow === 'function') {
          CaptureProtection.allow();
          console.log('✅ Screenshot protection disabled (allow)');
        }
      } catch (error) {
        console.error('❌ Error disabling screenshot protection:', error);
      }
    };
  }, [enabled, options?.screenshot, options?.record, options?.appSwitcher, options?.customMessage]);
}

/**
 * Check if screen is currently being recorded
 */
export async function isScreenRecording(): Promise<boolean> {
  try {
    if (!CaptureProtection || typeof CaptureProtection.isScreenRecording !== 'function') {
      console.warn('react-native-capture-protection native module not available');
      return false;
    }
    return await CaptureProtection.isScreenRecording();
  } catch (error) {
    console.warn('Failed to check screen recording status:', error);
    return false;
  }
}
