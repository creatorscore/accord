const { withAndroidManifest } = require('@expo/config-plugins');

/**
 * Config plugin to fix Android manifest issues:
 * 1. Permission merger conflict between react-native-capture-protection and expo-screen-capture
 * 2. Remove orientation restrictions for Android 16+ large screen compatibility
 *
 * Google Play recommendation: Remove resizability and orientation restrictions
 * for large screen devices (foldables and tablets).
 */
function withAndroidManifestFix(config) {
  return withAndroidManifest(config, async (config) => {
    const androidManifest = config.modResults;

    // Get the manifest element
    const manifest = androidManifest.manifest;

    // Ensure tools namespace is declared
    if (!manifest.$['xmlns:tools']) {
      manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';
    }

    // ============================================
    // FIX 1: Permission merger conflict
    // ============================================
    const permissions = manifest['uses-permission'] || [];

    // Look for existing READ_MEDIA_IMAGES permission
    let foundPermission = false;
    for (const permission of permissions) {
      if (permission.$['android:name'] === 'android.permission.READ_MEDIA_IMAGES') {
        // Add tools:replace to override the conflicting maxSdkVersion
        permission.$['tools:replace'] = 'android:maxSdkVersion';
        // Use the higher value (34) from react-native-capture-protection
        permission.$['android:maxSdkVersion'] = '34';
        foundPermission = true;
        break;
      }
    }

    // If not found, add it with the fix
    if (!foundPermission) {
      permissions.push({
        $: {
          'android:name': 'android.permission.READ_MEDIA_IMAGES',
          'android:maxSdkVersion': '34',
          'tools:replace': 'android:maxSdkVersion',
        },
      });
      manifest['uses-permission'] = permissions;
    }

    // ============================================
    // FIX 2: Remove orientation restrictions for large screens
    // Android 16+ will ignore these restrictions anyway, but removing
    // them prevents Google Play warnings and ensures proper behavior.
    // ============================================
    const application = manifest.application?.[0];
    if (application && application.activity) {
      for (const activity of application.activity) {
        const activityName = activity.$['android:name'];

        // Remove screenOrientation="portrait" from activities
        // This affects: MainActivity and GmsBarcodeScanningDelegateActivity
        if (activity.$['android:screenOrientation']) {
          console.log(`[withAndroidManifestFix] Removing screenOrientation from ${activityName}`);
          delete activity.$['android:screenOrientation'];

          // Add resizeableActivity="true" for large screen support
          activity.$['android:resizeableActivity'] = 'true';
        }

        // Specific fix for ML Kit barcode scanner
        if (activityName?.includes('GmsBarcodeScanningDelegateActivity')) {
          // Ensure it's resizeable and not locked to portrait
          activity.$['android:resizeableActivity'] = 'true';
          delete activity.$['android:screenOrientation'];
        }
      }
    }

    return config;
  });
}

module.exports = withAndroidManifestFix;
