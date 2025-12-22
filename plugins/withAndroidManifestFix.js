const { withAndroidManifest } = require('@expo/config-plugins');

/**
 * Config plugin to fix Android manifest merger conflict between
 * react-native-capture-protection and expo-screen-capture.
 * Both declare READ_MEDIA_IMAGES with different maxSdkVersion values.
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

    // Find or create uses-permission for READ_MEDIA_IMAGES
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

    return config;
  });
}

module.exports = withAndroidManifestFix;
