/**
 * Config plugin: withFairWalletReleaseVersion
 *
 * Derives the store build number from the app's `version`, so it is never kept
 * by hand and never drifts: Android `versionCode` and iOS `buildNumber` are
 *
 *   major * 1_000_000 + minor * 1_000 + patch      (1.2.3 → 1002003)
 *
 * Every new version gets a strictly higher build number, which is what Google
 * Play and the App Store require, and a release is a new version. A config that
 * keeps any OTHER `android.versionCode` or `ios.buildNumber` fails: two sources
 * for one number is how a release ends up rejected for reusing one. A number
 * equal to the derived one passes.
 */
const VERSION_PATTERN = /^(\d+)\.(\d+)\.(\d+)$/;
const MAX_MAJOR = 2099; // Play's versionCode ceiling is 2_100_000_000.
const PLUGIN = '[withFairWalletReleaseVersion]';

/**
 * @param {string} version
 * @returns {number}
 */
function releaseBuildNumber(version) {
  const match = VERSION_PATTERN.exec(String(version));
  if (!match) {
    throw new Error(
      `${PLUGIN} The app \`version\` must be MAJOR.MINOR.PATCH (got ${JSON.stringify(version)}): ` +
        'the store build number is derived from it.',
    );
  }
  const [major, minor, patch] = match.slice(1).map(Number);
  if (major > MAX_MAJOR || minor > 999 || patch > 999) {
    throw new Error(
      `${PLUGIN} The app \`version\` ${version} is out of range: major ≤ ${MAX_MAJOR}, minor and patch ≤ 999.`,
    );
  }
  return major * 1_000_000 + minor * 1_000 + patch;
}

/** @param {import('expo/config').ExpoConfig} config */
function withFairWalletReleaseVersion(config) {
  if (config.version === undefined) {
    throw new Error(`${PLUGIN} The app config needs a \`version\` (MAJOR.MINOR.PATCH).`);
  }
  const buildNumber = releaseBuildNumber(config.version);
  const versionCode = config.android?.versionCode;
  if (versionCode !== undefined && versionCode !== buildNumber) {
    throw new Error(
      `${PLUGIN} Remove \`android.versionCode\` (${versionCode}): it is derived from \`version\` (${buildNumber}).`,
    );
  }
  const iosBuildNumber = config.ios?.buildNumber;
  if (iosBuildNumber !== undefined && iosBuildNumber !== String(buildNumber)) {
    throw new Error(
      `${PLUGIN} Remove \`ios.buildNumber\` (${iosBuildNumber}): it is derived from \`version\` (${buildNumber}).`,
    );
  }
  return {
    ...config,
    android: { ...config.android, versionCode: buildNumber },
    ios: { ...config.ios, buildNumber: String(buildNumber) },
  };
}

module.exports = withFairWalletReleaseVersion;
module.exports.releaseBuildNumber = releaseBuildNumber;
