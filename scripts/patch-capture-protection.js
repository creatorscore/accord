// Patches react-native-capture-protection to add a base .js fallback for the
// TurboModule spec. The library only ships .android.js and .ios.js variants,
// which causes Metro to fail when bundling for all platforms (e.g. expo export).
const fs = require('fs');
const path = require('path');

const stubPath = path.join(
  __dirname, '..', 'node_modules', 'react-native-capture-protection',
  'lib', 'commonjs', 'spec', 'NativeCaptureProtection.js'
);

if (!fs.existsSync(stubPath)) {
  const dir = path.dirname(stubPath);
  if (fs.existsSync(dir)) {
    fs.writeFileSync(stubPath,
      '"use strict";\nObject.defineProperty(exports, "__esModule", { value: true });\nexports.default = null;\n'
    );
    console.log('Patched react-native-capture-protection: added NativeCaptureProtection.js stub');
  }
}
