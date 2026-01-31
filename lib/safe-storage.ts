import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Sentry from '@sentry/react-native';

/**
 * Safe wrapper around AsyncStorage that gracefully handles storage errors
 * like "device out of space" without crashing the app.
 */

export type StorageError = {
  code: 'OUT_OF_SPACE' | 'UNKNOWN';
  message: string;
};

/**
 * Safely set an item in AsyncStorage
 * Returns true on success, false on failure
 */
export async function safeSetItem(key: string, value: string): Promise<boolean> {
  try {
    await AsyncStorage.setItem(key, value);
    return true;
  } catch (error: any) {
    handleStorageError(error, 'setItem', key);
    return false;
  }
}

/**
 * Safely get an item from AsyncStorage
 * Returns null if not found or on error
 */
export async function safeGetItem(key: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(key);
  } catch (error: any) {
    handleStorageError(error, 'getItem', key);
    return null;
  }
}

/**
 * Safely remove an item from AsyncStorage
 * Returns true on success, false on failure
 */
export async function safeRemoveItem(key: string): Promise<boolean> {
  try {
    await AsyncStorage.removeItem(key);
    return true;
  } catch (error: any) {
    handleStorageError(error, 'removeItem', key);
    return false;
  }
}

/**
 * Safely set multiple items in AsyncStorage
 * Returns true on success, false on failure
 */
export async function safeMultiSet(keyValuePairs: [string, string][]): Promise<boolean> {
  try {
    await AsyncStorage.multiSet(keyValuePairs);
    return true;
  } catch (error: any) {
    handleStorageError(error, 'multiSet', keyValuePairs.map(([k]) => k).join(', '));
    return false;
  }
}

/**
 * Check if the error is a storage space error
 */
export function isOutOfSpaceError(error: any): boolean {
  const errorMessage = error?.message || String(error);
  return (
    errorMessage.includes('out of space') ||
    errorMessage.includes('No space left on device') ||
    errorMessage.includes('Code=640') ||
    errorMessage.includes('Code=28')
  );
}

/**
 * Handle storage errors - log to Sentry but don't crash
 */
function handleStorageError(error: any, operation: string, key: string): void {
  const isSpaceError = isOutOfSpaceError(error);

  // Log to Sentry with context but mark as handled
  Sentry.withScope((scope) => {
    scope.setTag('storage.operation', operation);
    scope.setTag('storage.key', key);
    scope.setTag('storage.error_type', isSpaceError ? 'out_of_space' : 'unknown');
    scope.setLevel(isSpaceError ? 'warning' : 'error');

    // For out-of-space errors, we just log a warning since it's user's device issue
    if (isSpaceError) {
      scope.setFingerprint(['storage-out-of-space']);
      Sentry.captureMessage(`Storage out of space: ${operation} failed for key "${key}"`, 'warning');
    } else {
      Sentry.captureException(error);
    }
  });

  // Log to console for debugging
  console.warn(`[SafeStorage] ${operation} failed for key "${key}":`,
    isSpaceError ? 'Device out of storage space' : error.message
  );
}
