import Constants from 'expo-constants';
import { supabase } from './supabase';

/**
 * Compare two semantic version strings
 * Returns: -1 if v1 < v2, 0 if v1 === v2, 1 if v1 > v2
 */
export function compareVersions(v1: string, v2: string): number {
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);

  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const p1 = parts1[i] || 0;
    const p2 = parts2[i] || 0;

    if (p1 < p2) return -1;
    if (p1 > p2) return 1;
  }

  return 0;
}

/**
 * Get the current app version
 */
export function getCurrentVersion(): string {
  return Constants.expoConfig?.version || '1.0.0';
}

/**
 * Check if the current app version meets the minimum required version for messaging
 * Returns { allowed: boolean, message?: string }
 */
export async function checkMessagingVersionRequirement(): Promise<{
  allowed: boolean;
  message?: string;
  minimumVersion?: string;
}> {
  try {
    const currentVersion = getCurrentVersion();

    // Fetch minimum messaging version from database
    const { data, error } = await supabase
      .from('app_config')
      .select('value')
      .eq('key', 'minimum_messaging_version')
      .single();

    if (error || !data) {
      // If we can't fetch the config, allow messaging (fail open)
      console.warn('Could not fetch minimum messaging version:', error);
      return { allowed: true };
    }

    const config = data.value as { version: string; message: string };
    const minimumVersion = config.version;
    const updateMessage = config.message;

    // Compare versions
    const comparison = compareVersions(currentVersion, minimumVersion);

    if (comparison < 0) {
      // Current version is older than minimum required
      return {
        allowed: false,
        message: updateMessage,
        minimumVersion,
      };
    }

    return { allowed: true };
  } catch (error) {
    console.error('Error checking messaging version requirement:', error);
    // Fail open - allow messaging if check fails
    return { allowed: true };
  }
}
