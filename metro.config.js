const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Fix for Firebase ESM module resolution
config.resolver = {
  ...config.resolver,
  unstable_enablePackageExports: false,
};

module.exports = withNativeWind(config, { input: './global.css' });
