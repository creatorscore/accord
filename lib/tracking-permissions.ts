import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as TrackingTransparency from 'expo-tracking-transparency';

const TRACKING_PERMISSION_KEY = '@accord_tracking_permission';

export type TrackingStatus = 'granted' | 'denied' | 'restricted' | 'undetermined';

/**
 * Request iOS App Tracking Transparency (ATT) permission
 * This shows the system popup asking for tracking permission
 * Only shows on iOS 14.5+ and only once per user
 */
export async function requestTrackingPermission(): Promise<TrackingStatus> {
  // Only applicable to iOS (not web or Android)
  if (Platform.OS !== 'ios') {
    return 'granted'; // Web/Android doesn't require ATT
  }

  try {
    // Check current status first
    const currentStatus = await TrackingTransparency.getTrackingPermissionsAsync();

    // If already determined, don't ask again
    if (currentStatus.status !== 'undetermined') {
      await AsyncStorage.setItem(TRACKING_PERMISSION_KEY, currentStatus.status);
      return currentStatus.status;
    }

    // Request permission (shows system popup)
    const { status } = await TrackingTransparency.requestTrackingPermissionsAsync();

    // Store the result
    await AsyncStorage.setItem(TRACKING_PERMISSION_KEY, status);

    console.log(`📊 Tracking permission: ${status}`);

    return status;
  } catch (error) {
    console.error('Error requesting tracking permission:', error);
    return 'denied';
  }
}

/**
 * Get current tracking permission status without showing popup
 */
export async function getTrackingStatus(): Promise<TrackingStatus> {
  if (Platform.OS !== 'ios') {
    return 'granted';
  }

  try {
    const { status } = await TrackingTransparency.getTrackingPermissionsAsync();
    return status;
  } catch (error) {
    console.error('Error getting tracking status:', error);
    return 'denied';
  }
}

/**
 * Check if tracking is enabled (user granted permission)
 */
export async function isTrackingEnabled(): Promise<boolean> {
  const status = await getTrackingStatus();
  return status === 'granted';
}

/**
 * Check if we should request tracking permission
 * (only on iOS and only if not determined yet)
 */
export async function shouldRequestTracking(): Promise<boolean> {
  if (Platform.OS !== 'ios') {
    return false;
  }

  const status = await getTrackingStatus();
  return status === 'undetermined';
}

/**
 * Initialize tracking permission on app launch
 * This should be called early in the app lifecycle
 * Best practice: Call after user completes onboarding
 */
export async function initializeTracking(): Promise<void> {
  try {
    // Check if we should request permission
    const shouldRequest = await shouldRequestTracking();

    if (shouldRequest) {
      console.log('📊 Requesting tracking permission...');
      await requestTrackingPermission();
    } else {
      const status = await getTrackingStatus();
      console.log(`📊 Tracking status: ${status}`);
    }
  } catch (error) {
    console.error('Error initializing tracking:', error);
  }
}
