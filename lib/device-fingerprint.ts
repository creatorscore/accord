import * as Device from 'expo-device';
import * as Application from 'expo-application';
import * as Crypto from 'expo-crypto';

/**
 * Generate a unique device fingerprint based on device characteristics
 * This creates a semi-persistent identifier that survives app reinstalls
 */
export async function getDeviceFingerprint(): Promise<string> {
  try {
    // Collect device characteristics
    const characteristics = [
      Device.modelName || 'unknown',
      Device.brand || 'unknown',
      Device.osName || 'unknown',
      Device.osVersion || 'unknown',
      Device.deviceType?.toString() || 'unknown',
      Application.nativeApplicationVersion || 'unknown',
      Application.nativeBuildVersion || 'unknown',
    ];

    // Create a stable string from characteristics
    const fingerprintString = characteristics.join('|');

    // Hash it for privacy and consistency
    const fingerprint = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      fingerprintString
    );

    return fingerprint;
  } catch (error) {
    console.error('Error generating device fingerprint:', error);
    // Return a fallback that indicates we couldn't fingerprint
    return 'unknown-device';
  }
}

/**
 * Get device info for display/logging purposes
 */
export function getDeviceInfo() {
  return {
    modelName: Device.modelName,
    brand: Device.brand,
    osName: Device.osName,
    osVersion: Device.osVersion,
    deviceType: Device.deviceType,
    isDevice: Device.isDevice,
  };
}

/**
 * Check if this is a physical device (not simulator/emulator)
 */
export function isPhysicalDevice(): boolean {
  return Device.isDevice === true;
}
