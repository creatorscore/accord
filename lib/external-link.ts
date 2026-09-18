import { Linking } from 'react-native';
import * as Clipboard from 'expo-clipboard';

/**
 * Open an external URL, with a graceful fallback for devices that have no
 * default browser configured (low-end Android, stripped-down ROMs, etc).
 *
 * The bare Linking.openURL throws "No Activity found to handle Intent" on
 * such devices — previously surfaced as JSApplicationIllegalArgumentException
 * in Sentry (REACT-6J). Falling back to clipboard copy at least gives the
 * user a path: they can paste into any browser/share sheet they DO have.
 *
 * The optional onFallback callback lets the caller surface a toast or
 * inline notice when the clipboard path was used; without it, the copy
 * happens silently (still better than a crash). Errors during the
 * fallback itself are swallowed because there's nothing useful left to do.
 */
export async function openExternalURL(
  url: string,
  onFallback?: (url: string) => void,
): Promise<boolean> {
  try {
    await Linking.openURL(url);
    return true;
  } catch {
    try {
      await Clipboard.setStringAsync(url);
      onFallback?.(url);
    } catch {
      // Clipboard write failed too — nothing more we can do.
    }
    return false;
  }
}
