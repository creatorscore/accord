/**
 * Open App Settings
 * 
 * Opens the device's app settings screen with proper fallback for Android devices
 * that don't support the 'app-settings:' URL scheme.
 */

import { Linking, Platform } from 'react-native';
import * as IntentLauncher from 'expo-intent-launcher';

/**
 * Opens the app's settings page in the device settings
 * 
 * iOS: Uses 'app-settings:' URL scheme
 * Android: Uses Intent to open app info settings with fallback to general settings
 */
export async function openAppSettings(): Promise<void> {
  try {
    if (Platform.OS === 'ios') {
      // iOS supports app-settings: URL scheme universally
      await Linking.openURL('app-settings:');
    } else {
      // Android: Use Intent to open app-specific settings
      try {
        await IntentLauncher.startActivityAsync(
          IntentLauncher.ActivityAction.APPLICATION_DETAILS_SETTINGS,
          {
            data: 'package:com.accord.lavendermarriage',
          }
        );
      } catch (intentError) {
        // Fallback: Try opening general app settings
        console.warn('Failed to open app-specific settings, trying general settings:', intentError);
        await IntentLauncher.startActivityAsync(
          IntentLauncher.ActivityAction.SETTINGS
        );
      }
    }
  } catch (error) {
    console.error('Failed to open app settings:', error);
    // Silent fail - user can manually navigate to settings
  }
}
