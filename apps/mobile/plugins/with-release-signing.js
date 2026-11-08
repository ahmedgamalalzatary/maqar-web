// Signs Android release builds with the upload key when CI provides one.
//
// Expo's template signs release builds with the debug key, which Google Play refuses.
// When these Gradle properties are set (the store workflow passes them with -P), the
// release build uses the upload key instead:
//   MAQAR_UPLOAD_STORE_FILE, MAQAR_UPLOAD_STORE_PASSWORD, MAQAR_UPLOAD_KEY_ALIAS, MAQAR_UPLOAD_KEY_PASSWORD
const { withAppBuildGradle } = require('expo/config-plugins');

const SIGNING = `
        release {
            if (project.hasProperty('MAQAR_UPLOAD_STORE_FILE')) {
                storeFile file(MAQAR_UPLOAD_STORE_FILE)
                storePassword MAQAR_UPLOAD_STORE_PASSWORD
                keyAlias MAQAR_UPLOAD_KEY_ALIAS
                keyPassword MAQAR_UPLOAD_KEY_PASSWORD
            }
        }`;

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    let gradle = cfg.modResults.contents;
    if (gradle.includes('MAQAR_UPLOAD_STORE_FILE')) return cfg;

    // Add a release signing config next to the template's debug one.
    gradle = gradle.replace(/signingConfigs\s*\{/, (m) => `${m}${SIGNING}`);

    // In the release build type, use it when the upload key is present.
    gradle = gradle.replace(
      /(release\s*\{[^{}]*?)signingConfig\s+signingConfigs\.debug/,
      "$1signingConfig project.hasProperty('MAQAR_UPLOAD_STORE_FILE') ? signingConfigs.release : signingConfigs.debug",
    );
    cfg.modResults.contents = gradle;
    return cfg;
  });
};
