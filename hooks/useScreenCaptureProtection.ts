import { useEffect } from 'react';
import CaptureProtection from 'react-native-capture-protection';

/**
 * Hook to protect against screenshots and screen recording using react-native-capture-protection
 *
 * iOS & Android:
 *   - Screenshots appear BLACK (not just overlayed)
 *   - Screen recording shows custom message or blank screen
 *   - App switcher preview is protected
 *
 * This is a more powerful solution than expo-screen-capture as it uses native
 * APIs to actually make screenshots appear black, rather than just overlaying content.
 *
 * @param enabled - Whether screenshot protection is enabled (default: true)
 * @param onScreenshot - Optional callback when screenshot is detected (legacy compatibility)
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

    // Check if native module is available
    if (!CaptureProtection || typeof CaptureProtection.prevent !== 'function') {
      console.warn('⚠️ react-native-capture-protection native module not available. Screenshot protection disabled.');
      return;
    }

    try {
      // Enable screen protection with react-native-capture-protection
      CaptureProtection.prevent({
        screenshot: true,      // Screenshots appear black
        record: {
          text: customMessage || 'Content is protected',
          textColor: '#FFFFFF',
          backgroundColor: '#9B87CE'
        },
        appSwitcher: true,     // App switcher preview protected
      });

      // Note: onScreenshot callback is deprecated as react-native-capture-protection
      // doesn't provide screenshot detection on iOS (Apple limitation)
      if (onScreenshot) {
        console.warn('onScreenshot callback is deprecated and will not be called');
      }

      // Cleanup: Allow screenshots when leaving the screen
      return () => {
        try {
          if (CaptureProtection && typeof CaptureProtection.allow === 'function') {
            CaptureProtection.allow();
          }
        } catch (error) {
          console.error('Error disabling screenshot protection:', error);
        }
      };
    } catch (error) {
      console.error('Error enabling screenshot protection:', error);
    }
  }, [enabled, customMessage]);

  // Return false for backward compatibility (no overlay needed anymore)
  return false;
}
