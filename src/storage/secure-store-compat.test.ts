/**
 * Existing wallets must keep opening after an expo-secure-store upgrade.
 *
 * A wallet's mnemonic, cached seed and PIN record live in the OS keychain
 * under names this app chose (the keys below) inside a container
 * expo-secure-store chose (the iOS keychain service, the Android
 * SharedPreferences file, the Android Keystore alias and the cipher). If
 * either side moves, the next launch finds nothing and the user sees
 * onboarding instead of their wallet, with the funds reachable only through a
 * written-down recovery phrase.
 *
 * So this suite pins both sides:
 *
 * 1. The app side: every keychain call goes through `kv-store` with NO options
 *    object, which is what selects expo-secure-store's default container, and
 *    the key names and value formats `secure-store` reads and writes are the
 *    ones earlier releases wrote.
 * 2. The library side: the INSTALLED expo-secure-store's native sources still
 *    name the same default container. Read from `node_modules`, so a dependency
 *    bump that changes one fails here, in CI, before it ships.
 *
 * Reviewed unchanged from expo-secure-store 57.0.1 (Expo SDK 57) to 58.0.2
 * (Expo SDK 58). No value here is a real secret: the "mnemonic" stored is a
 * placeholder string.
 */

import { beforeEach, describe, expect, mock, test } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";

// ---------------------------------------------------------------------------
// A recording, in-memory expo-secure-store, on a native platform.
// ---------------------------------------------------------------------------

interface Call {
  fn: "getItemAsync" | "setItemAsync" | "deleteItemAsync";
  argCount: number;
  key: string;
}

const keychain = new Map<string, string>();
const calls: Call[] = [];

mock.module("react-native", () => ({ Platform: { OS: "ios" } }));
mock.module("expo-secure-store", () => ({
  getItemAsync: async (...args: unknown[]) => {
    calls.push({ fn: "getItemAsync", argCount: args.length, key: String(args[0]) });
    return keychain.get(String(args[0])) ?? null;
  },
  setItemAsync: async (...args: unknown[]) => {
    calls.push({ fn: "setItemAsync", argCount: args.length, key: String(args[0]) });
    keychain.set(String(args[0]), String(args[1]));
  },
  deleteItemAsync: async (...args: unknown[]) => {
    calls.push({ fn: "deleteItemAsync", argCount: args.length, key: String(args[0]) });
    keychain.delete(String(args[0]));
  },
}));

const store = await import("./secure-store");

const WALLET_ID = "0f8fad5b-d9cb-469f-a165-70867728950e";
const PLACEHOLDER_PHRASE = "placeholder-not-a-mnemonic";
const SEED = Uint8Array.from({ length: 64 }, (_, i) => i);

beforeEach(() => {
  keychain.clear();
  calls.length = 0;
});

// ---------------------------------------------------------------------------
// 1. The app side
// ---------------------------------------------------------------------------

describe("secure-store keeps the keychain layout earlier releases wrote", () => {
  test("every keychain call uses expo-secure-store's default container (no options)", async () => {
    await store.addWalletToIndex(WALLET_ID, "Wallet 1", { createdFresh: true });
    await store.setActiveWalletId(WALLET_ID);
    await store.saveWalletMnemonic(WALLET_ID, PLACEHOLDER_PHRASE);
    await store.cacheWalletSeed(WALLET_ID, SEED);
    await store.savePin("123456");
    await store.verifyPin("123456");
    await store.setBiometricsEnabled(true);
    await store.setAutoLockTimeout(10);
    await store.setCurrency("EUR");
    await store.saveWalletXpub(WALLET_ID, "xpub-placeholder");
    await store.markWalletBackedUp(WALLET_ID);
    await store.getMnemonic();
    await store.getCachedWalletSeed(WALLET_ID);
    await store.hasWallet();
    await store.clearAll();

    expect(calls.length).toBeGreaterThan(20);
    for (const call of calls) {
      // get/delete(key) and set(key, value): a third argument would be an
      // options object, which selects a different keychain service / alias.
      expect({ fn: call.fn, argCount: call.argCount }).toEqual({
        fn: call.fn,
        argCount: call.fn === "setItemAsync" ? 2 : 1,
      });
    }
  });

  test("the key names are the ones earlier releases wrote", async () => {
    await store.addWalletToIndex(WALLET_ID, "Wallet 1");
    await store.setActiveWalletId(WALLET_ID);
    await store.saveMnemonic(PLACEHOLDER_PHRASE);
    await store.cacheWalletSeed(WALLET_ID, SEED);
    await store.savePin("123456");
    await store.setBiometricsEnabled(true);
    await store.setAutoLockTimeout(10);
    await store.setCurrency("EUR");
    await store.saveWalletXpub(WALLET_ID, "xpub-placeholder");
    await store.markWalletBackedUp(WALLET_ID);

    expect([...keychain.keys()].sort()).toEqual(
      [
        "fairwallet_active_wallet",
        "fairwallet_auto_lock",
        `fairwallet_backedup_${WALLET_ID}`,
        "fairwallet_biometrics",
        "fairwallet_created",
        "fairwallet_currency",
        `fairwallet_mnemonic_${WALLET_ID}`,
        "fairwallet_pin",
        `fairwallet_seed_${WALLET_ID}`,
        "fairwallet_wallets_index",
        `fairwallet_xpub_${WALLET_ID}`,
      ].sort(),
    );
  });

  test("a keychain written by an earlier release opens", async () => {
    // Exactly what a released build leaves in the keychain (values in their
    // stored formats): the wallet index JSON, the per-wallet entries, the seed
    // as lowercase hex and a legacy (pre-scrypt) PIN record.
    const seedHex = Array.from(SEED, (b) => b.toString(16).padStart(2, "0")).join("");
    keychain.set(
      "fairwallet_wallets_index",
      JSON.stringify([{ id: WALLET_ID, name: "Wallet 1", createdAt: 1_700_000_000_000, birthdayHeight: 1234 }]),
    );
    keychain.set("fairwallet_active_wallet", WALLET_ID);
    keychain.set(`fairwallet_mnemonic_${WALLET_ID}`, PLACEHOLDER_PHRASE);
    keychain.set(`fairwallet_seed_${WALLET_ID}`, seedHex);
    // `legacyHashPin("123456")`: SHA-256 of "fairwallet:pin:123456".
    keychain.set("fairwallet_pin", "295fa35c88554858edbdc3ce444c86b3856282a0c114ab9652cc9ea4c6ab11e8");
    keychain.set("fairwallet_biometrics", "1");
    keychain.set("fairwallet_auto_lock", "10");
    keychain.set("fairwallet_currency", "EUR");

    expect(await store.hasWallet()).toBe(true);
    expect(await store.getActiveWalletId()).toBe(WALLET_ID);
    expect(await store.getMnemonic()).toBe(PLACEHOLDER_PHRASE);
    expect(await store.getCachedWalletSeed(WALLET_ID)).toEqual(SEED);
    expect(await store.getWalletBirthdayHeight(WALLET_ID)).toBe(1234);
    expect(await store.hasPin()).toBe(true);
    expect(await store.verifyPin("000000")).toBe(false);
    expect(await store.verifyPin("123456")).toBe(true);
    // The correct legacy PIN is upgraded in place to the scrypt record.
    expect(keychain.get("fairwallet_pin")?.startsWith("scrypt$")).toBe(true);
    expect(await store.verifyPin("123456")).toBe(true);
    expect(await store.isBiometricsEnabled()).toBe(true);
    expect(await store.getAutoLockTimeout()).toBe(10);
    expect(await store.getCurrency()).toBe("EUR");
  });

  test("a pre-multi-wallet keychain still migrates", async () => {
    keychain.set("fairwallet_mnemonic", PLACEHOLDER_PHRASE);
    keychain.set("fairwallet_created", "1600000000000");

    expect(await store.hasWallet()).toBe(true);
    expect(await store.getMnemonic()).toBe(PLACEHOLDER_PHRASE);
    const [wallet] = await store.getWalletIndex();
    expect(wallet?.createdAt).toBe(1_600_000_000_000);
    expect(keychain.has("fairwallet_mnemonic")).toBe(false);
    expect(keychain.get(`fairwallet_mnemonic_${wallet?.id}`)).toBe(PLACEHOLDER_PHRASE);
  });
});

// ---------------------------------------------------------------------------
// 2. The library side
// ---------------------------------------------------------------------------

const secureStoreRoot = dirname(require.resolve("expo-secure-store/package.json"));
const source = (relative: string) => readFileSync(join(secureStoreRoot, relative), "utf8");

describe("the installed expo-secure-store keeps the default container", () => {
  test("iOS: keychain service `app`, with the :auth / :no-auth suffix, default accessibility whenUnlocked", () => {
    const module = source("ios/SecureStoreModule.swift");
    expect(module).toContain('var service = options.keychainService ?? "app"');
    expect(module).toContain('service.append(":\\(requireAuthentication ? "auth" : "no-auth")")');
    expect(module).toContain("kSecClass as String: kSecClassGenericPassword");
    expect(module).toContain("kSecAttrAccount as String: encodedKey");
    expect(module).toMatch(/options\.keychainAccessible \?\? \.whenUnlocked|keychainAccessible: SecureStoreAccessible = \.whenUnlocked/);
  });

  test("Android: SharedPreferences `SecureStore`, alias `key_v1`, AES/GCM, the same item keys", () => {
    const module = source("android/src/main/java/expo/modules/securestore/SecureStoreModule.kt");
    expect(module).toContain('private const val SHARED_PREFERENCES_NAME = "SecureStore"');
    expect(module).toContain('const val DEFAULT_KEYSTORE_ALIAS = "key_v1"');
    expect(module).toContain('return "$keychainService-$key"');
    expect(module).toContain('private const val KEYSTORE_PROVIDER = "AndroidKeyStore"');
    expect(module).toContain('private const val SCHEME_PROPERTY = "scheme"');
    expect(module).toContain('private const val KEYSTORE_ALIAS_PROPERTY = "keystoreAlias"');
    expect(module).toContain('const val AUTHENTICATED_KEYSTORE_SUFFIX = "keystoreAuthenticated"');
    expect(module).toContain('const val UNAUTHENTICATED_KEYSTORE_SUFFIX = "keystoreUnauthenticated"');

    const options = source("android/src/main/java/expo/modules/securestore/SecureStoreOptions.kt");
    expect(options).toContain("var keychainService: String = SecureStoreModule.DEFAULT_KEYSTORE_ALIAS");

    const aes = source("android/src/main/java/expo/modules/securestore/encryptors/AESEncryptor.kt");
    expect(aes).toContain('const val NAME = "aes"');
    expect(aes).toContain('const val AES_CIPHER = "AES/GCM/NoPadding"');
    expect(aes).toContain('return "$AES_CIPHER:$baseAlias"');
    expect(aes).toContain('return "${getKeyStoreAlias(options)}:$suffix"');

    const hybrid = source("android/src/main/java/expo/modules/securestore/encryptors/HybridAESEncryptor.kt");
    expect(hybrid).toContain('const val NAME = "hybrid"');
  });
});
