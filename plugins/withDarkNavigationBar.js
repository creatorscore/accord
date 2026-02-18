const { withMainActivity } = require('@expo/config-plugins');

/**
 * Config plugin to force the Android navigation bar background to dark (#0A0A0B).
 *
 * react-native-edge-to-edge sets the navigation bar to transparent in onCreate().
 * This plugin injects a line AFTER super.onCreate() to override that back to dark,
 * matching the app's bottom tab bar color.
 *
 * Note: On Android 15+ (API 35), the system enforces a transparent navigation bar
 * regardless of this setting. For those devices, a JS-side overlay is used as fallback.
 */
function withDarkNavigationBar(config) {
  return withMainActivity(config, (config) => {
    let contents = config.modResults.contents;

    // Add import for Color if not present
    if (!contents.includes('import android.graphics.Color')) {
      contents = contents.replace(
        'import android.os.Bundle',
        'import android.os.Bundle\nimport android.graphics.Color'
      );
    }

    // Set navigation bar color to dark AFTER super.onCreate (which enables edge-to-edge)
    if (!contents.includes('navigationBarColor')) {
      contents = contents.replace(
        'super.onCreate(null)',
        'super.onCreate(null)\n    window.navigationBarColor = Color.parseColor("#0A0A0B")'
      );
    }

    config.modResults.contents = contents;
    return config;
  });
}

module.exports = withDarkNavigationBar;
