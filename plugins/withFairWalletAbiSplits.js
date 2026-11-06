/**
 * Config plugin: withFairWalletAbiSplits
 *
 * Builds one APK per ABI instead of one universal APK. A universal APK carries
 * the native libraries of every ABI, of which a phone loads one, so a release
 * ships
 *
 *   app-arm64-v8a-release.apk     every phone from about 2017 on
 *   app-armeabi-v7a-release.apk   older phones and many Android TVs
 *
 * and no universal APK. Gradle's ABI splits only affect APKs: `bundleRelease`
 * still builds one AAB with every ABI, and Google Play serves each device its
 * own slice of it.
 *
 * The splits are OFF in a Gradle invocation that builds a bundle. When resources
 * are shrunk, AGP fails `buildReleasePreBundle` with "Multiple shrunk-resources
 * files found … Please disable building multiple APKs when building an Android
 * app bundle" (https://issuetracker.google.com/402800800). FAIRWallet does not
 * shrink resources today, but the AAB never uses the splits, so they are off
 * whenever a bundle is built and the release does not break the day it does.
 * The AAB and the APKs are therefore two invocations, `./gradlew :app:bundleRelease`
 * then `./gradlew :app:assembleRelease`; one invocation asking for both would
 * build a universal APK.
 *
 * A build for ONE device keeps working: `expo run:android` passes
 * `-PreactNativeArchitectures=<the device's ABI>`, so the split follows the ABIs
 * Gradle compiles whenever none of the release ABIs is among them (an x86_64
 * emulator gets `app-x86_64-debug.apk`, which the Expo CLI finds by the device's
 * ABI). A release ABI that is not compiled is never split out, because its APK
 * would carry no native libraries.
 *
 * Every split APK has the app's one `versionCode` (withFairWalletReleaseVersion):
 * they are the same version of the same app, and Android installs either over
 * the other. Google Play gets the AAB.
 */
const { withAppBuildGradle } = require('expo/config-plugins');

const PLUGIN = '[withFairWalletAbiSplits]';
const MARKER = '@generated fairwallet-abi-splits';

/** The ABIs every release ships an APK for, in the order people should pick them. */
const RELEASE_ABIS = ['arm64-v8a', 'armeabi-v7a'];

/** Inserted before `android {`: which APKs this build splits out. */
const RESOLVE_ABIS = `// ${MARKER}: one APK per ABI, no universal APK
// (plugins/withFairWalletAbiSplits.js). Edit the plugin, never this file. A release ships
// ${RELEASE_ABIS.join(' and ')}; a build that compiles none of them (-PreactNativeArchitectures=x86_64,
// as \`expo run:android\` passes for an emulator) splits to the ABIs it compiles.
def fairwalletBuiltAbis = (findProperty('reactNativeArchitectures') ?: 'armeabi-v7a,arm64-v8a,x86,x86_64').toString().split(',').collect { it.trim() }.findAll { it }
def fairwalletReleaseAbis = [${RELEASE_ABIS.map((abi) => `'${abi}'`).join(', ')}].findAll { fairwalletBuiltAbis.contains(it) }
def fairwalletApkAbis = fairwalletReleaseAbis ?: fairwalletBuiltAbis
// AGP refuses ABI splits in an invocation that also builds an app bundle while resources are
// shrunk (https://issuetracker.google.com/402800800), and a bundle never uses them: build the
// AAB and the APKs in two invocations.
def fairwalletBuildsBundle = gradle.startParameter.taskNames.any { it.tokenize(':').last().toLowerCase().startsWith('bundle') }

`;

/** Inserted as the first entry of `android {`. */
const SPLITS = `
    // ${MARKER}: the APKs are fairwalletApkAbis, one each; off while building a bundle.
    splits {
        abi {
            reset()
            enable !fairwalletBuildsBundle
            universalApk false
            include(*fairwalletApkAbis)
        }
    }
`;

function fail(message) {
  throw new Error(`${PLUGIN} ${message}`);
}

/**
 * Apply the split to the text of a Groovy `android/app/build.gradle`. Idempotent.
 *
 * @param {string} contents
 * @returns {string}
 */
function applyAbiSplits(contents) {
  if (contents.includes(MARKER)) return contents;

  if (/^\s*splits\s*\{/m.test(contents)) {
    fail(
      'app/build.gradle already has a `splits {}` block written by another plugin or by hand. ' +
        'Remove it: this plugin is the one source of the APK layout.',
    );
  }

  const androidBlock = /^android \{$/m;
  if (!androidBlock.test(contents)) {
    fail(
      'Could not find the top-level `android {` block in app/build.gradle. The Expo template changed: update this plugin.',
    );
  }
  return contents.replace(androidBlock, `${RESOLVE_ABIS}android {${SPLITS}`);
}

/** @param {import('expo/config').ExpoConfig} config */
function withFairWalletAbiSplits(config) {
  return withAppBuildGradle(config, (modConfig) => {
    if (modConfig.modResults.language !== 'groovy') {
      fail(`Expected a Groovy app/build.gradle, got ${modConfig.modResults.language}.`);
    }
    modConfig.modResults.contents = applyAbiSplits(modConfig.modResults.contents);
    return modConfig;
  });
}

module.exports = withFairWalletAbiSplits;
module.exports.applyAbiSplits = applyAbiSplits;
module.exports.RELEASE_ABIS = RELEASE_ABIS;
