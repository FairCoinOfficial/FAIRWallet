import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';
import withFairWalletAbiSplits from './withFairWalletAbiSplits';
import withFairWalletReleaseSigning from './withFairWalletReleaseSigning';
import withFairWalletReleaseVersion from './withFairWalletReleaseVersion';

const { applyReleaseSigning, RELEASE_CERT_SHA256, PROPERTIES } = withFairWalletReleaseSigning;
const { applyAbiSplits, RELEASE_ABIS } = withFairWalletAbiSplits;
const { releaseBuildNumber } = withFairWalletReleaseVersion;

/**
 * The `android/app/build.gradle` of the Expo template this checkout's `expo`
 * prebuilds from, so a template change that breaks a plugin fails here, not in
 * a release.
 */
function templateBuildGradle(): string {
  const tarball = join(import.meta.dir, '..', 'node_modules', 'expo', 'template.tgz');
  const result = Bun.spawnSync(['tar', '-xzOf', tarball, 'package/android/app/build.gradle']);
  if (result.exitCode !== 0) {
    throw new Error(`Could not read the Expo template build.gradle: ${result.stderr.toString()}`);
  }
  return result.stdout.toString();
}

/** The body of the first `name {` block at `indent` spaces, up to its closing brace. */
function block(contents: string, header: string, from = 0): string {
  const start = contents.indexOf(header, from);
  expect(start).toBeGreaterThan(-1);
  const indent = contents.slice(contents.lastIndexOf('\n', start) + 1, start);
  const end = contents.indexOf(`\n${indent}}`, start);
  return contents.slice(start, end);
}

describe('withFairWalletReleaseSigning', () => {
  const template = templateBuildGradle();
  const signed = applyReleaseSigning(template);

  test('the template signs release with the debug key, which is what this replaces', () => {
    const releaseBuildType = block(template, 'release {', template.indexOf('buildTypes {'));
    expect(releaseBuildType).toContain('signingConfig signingConfigs.debug');
  });

  test('release is signed by signingConfigs.release, debug keeps the debug key', () => {
    const buildTypes = signed.indexOf('buildTypes {');
    expect(block(signed, 'release {', buildTypes)).toContain(
      'signingConfig signingConfigs.release',
    );
    expect(block(signed, 'release {', buildTypes)).not.toContain('signingConfigs.debug');
    expect(block(signed, 'debug {', buildTypes)).toContain('signingConfig signingConfigs.debug');
  });

  test('signingConfigs.release reads only the FAIRWALLET_UPLOAD_* properties', () => {
    const signingConfigs = signed.indexOf('signingConfigs {');
    const release = block(signed, 'release {', signingConfigs);
    expect(release).toContain('storeFile fairwalletStoreFile');
    expect(release).toContain('keyAlias fairwalletKeyAlias');
    for (const name of Object.values(PROPERTIES)) {
      expect(signed).toContain(`'${name}'`);
    }
    expect(PROPERTIES.storeFile).toBe('FAIRWALLET_UPLOAD_STORE_FILE');
    expect(PROPERTIES.storePassword).toBe('FAIRWALLET_UPLOAD_STORE_PASSWORD');
    expect(PROPERTIES.keyAlias).toBe('FAIRWALLET_UPLOAD_KEY_ALIAS');
    // The debug keystore's password appears only in the template's debug entry.
    expect(release).not.toContain("'android'");
  });

  test('the guard checks FAIRWallet’s certificate before every release variant, never debug', () => {
    expect(RELEASE_CERT_SHA256).toBe(
      'B4:C8:0F:F0:BE:97:2A:EF:A2:19:F4:E4:35:CE:26:7E:AE:36:50:E1:9F:F5:DF:20:93:74:D3:77:5D:9E:20:7F'
        .replaceAll(':', '')
        .toLowerCase(),
    );
    expect(signed).toContain(`def expected = '${RELEASE_CERT_SHA256}'`);
    expect(signed).toContain("tasks.register('fairwalletVerifyReleaseSigning')");
    expect(signed).toContain("android.buildTypes.getByName('release').signingConfig");
    const wiring = /task\.name ==~ \/([^/]+)\//.exec(signed);
    expect(wiring?.[1]).toBe('pre\\w*ReleaseBuild|validateSigning\\w*Release');
    const pattern = new RegExp(`^(?:${wiring?.[1]})$`);
    for (const task of ['preReleaseBuild', 'validateSigningRelease']) {
      expect(pattern.test(task)).toBe(true);
    }
    for (const task of ['preDebugBuild', 'validateSigningDebug']) {
      expect(pattern.test(task)).toBe(false);
    }
  });

  test('is idempotent', () => {
    expect(applyReleaseSigning(signed)).toBe(signed);
  });

  test('refuses a build.gradle that already declares signingConfigs.release', () => {
    const other = template.replace(
      /(signingConfigs \{\n\s*debug \{[\s\S]*?\n {8}\}\n)/,
      "$1        release {\n            storeFile file('other.keystore')\n        }\n",
    );
    expect(other).not.toBe(template);
    expect(() => applyReleaseSigning(other)).toThrow('already declares signingConfigs.release');
  });

  test('refuses a template it does not recognise instead of skipping the signing', () => {
    expect(() => applyReleaseSigning(template.replace('android {', 'android{'))).toThrow(
      '`android {`',
    );
    expect(() => applyReleaseSigning(template.replace(/signingConfigs \{/, 'signing {'))).toThrow(
      'signingConfigs.debug',
    );
  });
});

describe('withFairWalletAbiSplits', () => {
  const template = templateBuildGradle();
  const split = applyAbiSplits(template);

  test('splits arm64-v8a and armeabi-v7a, no universal APK, off while building a bundle', () => {
    expect(RELEASE_ABIS).toEqual(['arm64-v8a', 'armeabi-v7a']);
    expect(split).toContain("def fairwalletReleaseAbis = ['arm64-v8a', 'armeabi-v7a']");
    const splits = block(split, 'splits {');
    expect(splits).toContain('universalApk false');
    expect(splits).toContain('enable !fairwalletBuildsBundle');
    expect(splits).toContain('include(*fairwalletApkAbis)');
    expect(split).toContain(
      "def fairwalletBuildsBundle = gradle.startParameter.taskNames.any { it.tokenize(':').last().toLowerCase().startsWith('bundle') }",
    );
  });

  test('is idempotent and composes with the release signing', () => {
    expect(applyAbiSplits(split)).toBe(split);
    const both = applyReleaseSigning(split);
    expect(applyAbiSplits(both)).toBe(both);
    expect(applyReleaseSigning(applyAbiSplits(applyReleaseSigning(template)))).toContain(
      'enable !fairwalletBuildsBundle',
    );
  });

  test('refuses a second source of splits', () => {
    const other = template.replace('android {', 'android {\n    splits {\n    }');
    expect(() => applyAbiSplits(other)).toThrow('already has a `splits {}` block');
  });
});

describe('withFairWalletReleaseVersion', () => {
  test('derives the build number from the version', () => {
    expect(releaseBuildNumber('1.0.0')).toBe(1_000_000);
    expect(releaseBuildNumber('1.2.3')).toBe(1_002_003);
    expect(releaseBuildNumber('2099.999.999')).toBe(2_099_999_999);
  });

  test('refuses a version it cannot number', () => {
    expect(() => releaseBuildNumber('1.0')).toThrow('MAJOR.MINOR.PATCH');
    expect(() => releaseBuildNumber('1.0.0-alpha.1')).toThrow('MAJOR.MINOR.PATCH');
    expect(() => releaseBuildNumber('1.1000.0')).toThrow('out of range');
    expect(() => releaseBuildNumber('2100.0.0')).toThrow('out of range');
  });

  test('sets android.versionCode and ios.buildNumber', () => {
    const config = withFairWalletReleaseVersion({
      name: 'FAIRWallet',
      slug: 'fairwallet',
      version: '1.1.0',
      android: { package: 'in.fairco.walletapp' },
      ios: { bundleIdentifier: 'in.fairco.wallet' },
    });
    expect(config.android?.versionCode).toBe(1_001_000);
    expect(config.android?.package).toBe('in.fairco.walletapp');
    expect(config.ios?.buildNumber).toBe('1001000');
  });

  test('refuses a hand-kept versionCode or buildNumber that differs, accepts an equal one', () => {
    const base = { name: 'FAIRWallet', slug: 'fairwallet', version: '1.1.0' };
    expect(() => withFairWalletReleaseVersion({ ...base, android: { versionCode: 7 } })).toThrow(
      'Remove `android.versionCode` (7)',
    );
    expect(() => withFairWalletReleaseVersion({ ...base, ios: { buildNumber: '7' } })).toThrow(
      'Remove `ios.buildNumber` (7)',
    );
    expect(
      withFairWalletReleaseVersion({ ...base, android: { versionCode: 1_001_000 } }).android
        ?.versionCode,
    ).toBe(1_001_000);
    expect(() => withFairWalletReleaseVersion({ name: 'x', slug: 'x' })).toThrow(
      'needs a `version`',
    );
  });
});

describe('app.json', () => {
  test('lists the three release plugins and keeps no hand-kept build number', async () => {
    const appJson = await Bun.file(join(import.meta.dir, '..', 'app.json')).json();
    const plugins: unknown[] = appJson.expo.plugins;
    for (const plugin of [
      './plugins/withFairWalletReleaseVersion',
      './plugins/withFairWalletAbiSplits',
      './plugins/withFairWalletReleaseSigning',
    ]) {
      expect(plugins).toContain(plugin);
    }
    expect(appJson.expo.android.versionCode).toBeUndefined();
    expect(appJson.expo.ios.buildNumber).toBeUndefined();
    expect(appJson.expo.android.package).toBe('in.fairco.walletapp');
    expect(appJson.expo.ios.bundleIdentifier).toBe('in.fairco.wallet');
  });

  test('the app and the desktop build release the same version', async () => {
    const appJson = await Bun.file(join(import.meta.dir, '..', 'app.json')).json();
    const packageJson = await Bun.file(join(import.meta.dir, '..', 'package.json')).json();
    expect(packageJson.version).toBe(appJson.expo.version);
    releaseBuildNumber(appJson.expo.version);
  });
});
