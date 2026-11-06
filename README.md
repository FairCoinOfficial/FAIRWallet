# FAIRWallet

Lightweight SPV wallet for [FairCoin](https://fairco.in) — cross-platform (Android, iOS, Desktop).

Built with Expo SDK 58, React Native 0.88, and pure TypeScript cryptography.

## Features

- **True SPV wallet** — connects directly to the FairCoin P2P network via DNS seeds, no server dependency
- **HD wallet** — BIP39 (24-word mnemonic) + BIP32 + BIP44 (`m/44'/119'/0'/...`)
- **Multi-wallet** — create, import, switch between, and manage multiple wallets
- **QR code** — camera scanner to send, QR display to receive
- **Deep links** — handles `faircoin:` URIs (BIP21-style), opens Send pre-filled
- **PIN & biometrics** — 6-digit PIN with fingerprint/face unlock on app open
- **Address book** — save and manage contacts
- **Coin control** — select specific UTXOs for transactions
- **Masternode** — detect 5,000 FAIR collateral UTXOs, start masternodes
- **BIP38** — encrypted private key export/import
- **Places map** — native MapLibre map of places that accept FairCoin, with category filters, search, minimum-spend and FairCoin-to-fiat exchange metadata per place (native-only; web shows an empty state)
- **Secure** — keys in OS keychain, per-wallet SQLite databases, edge-to-edge UI

## Platforms

| Platform | Status | Build |
|----------|--------|-------|
| Android | Production | Signed APKs (GitHub release) + AAB (Google Play), via GitHub Actions |
| iOS | Production | Expo prebuild + Xcode |
| Desktop | Production | Electron (Windows, macOS, Linux) |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Expo SDK 58, React Native 0.88 (New Architecture) |
| Navigation | expo-router with native tabs (NativeTabs on Android/iOS, headless on web) |
| Styling | NativeWind 5 (Tailwind CSS 4) |
| State | Zustand 5 |
| Crypto | `@noble/secp256k1` 2.x, `@noble/hashes` 1.8, `@scure/bip32` 1.7, `@scure/bip39` 1.6 |
| Storage | expo-secure-store (native keychain), expo-sqlite (chain data) |
| P2P | Custom SPV client over TCP (react-native-tcp-socket on mobile, Node.js net on Electron) |
| Map | `@maplibre/maplibre-react-native` v11 with Carto vector tiles (no API key) |
| UI kit | `@oxy.so/bloom` 17 (theme, buttons, dialogs, toasts, tab bar and rail) |
| Lists | `@shopify/flash-list` v2 with `@gorhom/bottom-sheet` v5 integration |
| Animation | `react-native-reanimated` 4.x |
| Desktop | Electron with custom `app://` protocol for proper SPA routing |

## FairCoin Protocol

| Parameter | Value |
|-----------|-------|
| Ticker | FAIR |
| Address prefix | `35` (starts with `F`) |
| Script prefix | `16` (starts with `3`) |
| BIP44 coin type | `119` |
| P2P port | `46372` |
| Protocol version | `71000` |
| Block hash | Quark (9-round multi-hash) |
| Tx hash | Double SHA-256 |
| Signing curve | secp256k1 |
| Masternode collateral | 5,000 FAIR |
| DNS seeds | `seed1.fairco.in`, `seed2.fairco.in` |

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 22+
- [Bun](https://bun.sh/) (package manager)
- JDK 17+ (for Android builds)
- Android SDK (for Android builds)

### Install

```bash
git clone https://github.com/FairCoinOfficial/FAIRWallet.git
cd FAIRWallet
bun install
```

### Development

```bash
# Start Expo dev server (requires Expo Go or dev client)
bun start

# Build and run on Android (requires Android SDK + JDK)
bun run android

# Build and run on iOS (requires Xcode)
bun run ios

# Web (for Electron development)
bun run web
```

### Desktop (Electron)

```bash
# Build web export + launch Electron
bun run export:web
bun run electron

# Development mode (connects to Expo dev server)
bun run electron -- --dev
```

### Build Android Locally

A debug build needs no key:

```bash
bunx expo prebuild --platform android --clean
cd android && ./gradlew :app:assembleDebug
```

A release build is always signed with FAIRWallet's release key and fails
without it (see [Android releases](#android-releases)). With the key on your
machine, give Gradle its location in `~/.gradle/gradle.properties` (never in
the repository):

```properties
FAIRWALLET_UPLOAD_STORE_FILE=<path to the keystore>
FAIRWALLET_UPLOAD_STORE_PASSWORD_FILE=<file holding its password>
FAIRWALLET_UPLOAD_KEY_ALIAS=fairwallet
```

then `bun run build:android` builds the AAB and the per-ABI APKs.

### Type Check

```bash
bun run typecheck
```

## CI/CD

GitHub Actions build and attach release artifacts when you publish a GitHub release:

- **Android**: one signed APK per ABI, attached to the release; the AAB for Google Play as a workflow artifact
- **Desktop**: Windows (.exe), macOS (.dmg), Linux (.deb, .AppImage) via electron-builder

Pull requests and pushes to `main` that touch the native project run an Android
build check (a debug build, and a check that a release build without the key is
refused). It needs no secret and publishes nothing.

### Cutting a release

1. Bump `version` (`MAJOR.MINOR.PATCH`) in **both** `app.json` and `package.json`
   on `main`. Never set `android.versionCode` or `ios.buildNumber`: they are
   derived from `version`.
2. Publish the release from `main`, tagged `v<version>`:

   ```bash
   gh release create v1.1.0 --target main --title "v1.1.0" --notes "Release notes..."
   ```

   The Android build refuses a tag that is not `v` + the app's `version`.

### Android releases

- **Signing.** Every release is signed with FAIRWallet's own release key
  (alias `fairwallet`), never with Expo's debug keystore. Its certificate is

  ```
  SHA-256 B4:C8:0F:F0:BE:97:2A:EF:A2:19:F4:E4:35:CE:26:7E:AE:36:50:E1:9F:F5:DF:20:93:74:D3:77:5D:9E:20:7F
  ```

  `plugins/withFairWalletReleaseSigning.js` gives the release build type a
  signing config from the Gradle properties `FAIRWALLET_UPLOAD_STORE_FILE`,
  `FAIRWALLET_UPLOAD_STORE_PASSWORD` (or `FAIRWALLET_UPLOAD_STORE_PASSWORD_FILE`)
  and `FAIRWALLET_UPLOAD_KEY_ALIAS`, and adds `fairwalletVerifyReleaseSigning`,
  which runs before every release variant and fails the build unless the
  effective signing certificate is the one above. There is no fallback: no key,
  no release. Debug builds keep Expo's debug key. In CI the keystore and its
  password are the `FAIRWALLET_UPLOAD_KEYSTORE_B64` and
  `FAIRWALLET_UPLOAD_KEYSTORE_PASSWORD` secrets of the `release` environment,
  which only `main` and `v*` tags can use; the job writes them to the runner's
  temporary directory and passes them as `ORG_GRADLE_PROJECT_*`. Keep an
  offline backup of the keystore: Android installs an update only when it is
  signed by the same certificate as the installed app, so without the key no
  APK can update an existing install. On Google Play the key is the upload
  key; unless Play App Signing is set up with this same key as the app signing
  key, Play's builds carry Google's certificate and a GitHub APK cannot update
  a Play install (or the other way round).
- **versionCode** is `major * 1_000_000 + minor * 1_000 + patch`
  (`1.1.0` → `1001000`, `plugins/withFairWalletReleaseVersion.js`); a
  hand-kept `android.versionCode` that differs fails the build.
- **APKs**: `FAIRWallet-<version>-arm64-v8a.apk` (almost every phone from about
  2017 on: start with this one) and `FAIRWallet-<version>-armeabi-v7a.apk`
  (older phones, Android TVs), each with a `.sha256`. There is no universal APK
  (`plugins/withFairWalletAbiSplits.js`). Check a download with
  `sha256sum -c FAIRWallet-<version>-arm64-v8a.apk.sha256` and, with the
  Android build tools, `apksigner verify --print-certs <apk>`.
- **AAB**: `in.fairco.walletapp-<version>.aab`, the workflow run's artifact,
  is what Google Play gets; it is not a release asset. The AAB and the APKs are
  built by two Gradle invocations (`:app:bundleRelease`, then
  `:app:assembleRelease`): the ABI splits are off in one that builds a bundle
  (AGP issue [402800800](https://issuetracker.google.com/402800800)).
- **Push**: a release needs the `GOOGLE_SERVICES_JSON` secret (the Firebase
  `google-services.json` of `in.fairco.walletapp`) and fails without it
  ([docs/notifications-infra.md](docs/notifications-infra.md)).
- A failed release build can be rerun, or started by hand with
  **Actions → Build Android → Run workflow** and the release tag; it always
  builds the tag's commit.

## Project Structure

```
FAIRWallet/
├── app/                    # Expo Router screens
│   ├── _layout.tsx         # Root layout + deep link handler
│   ├── index.tsx           # Entry (wallet check → lock/onboarding/tabs)
│   ├── lock.tsx            # PIN/biometric lock screen
│   ├── masternode.tsx      # Masternode management
│   ├── wallets.tsx         # Multi-wallet manager
│   ├── contacts.tsx        # Address book
│   ├── coin-control.tsx    # UTXO selection
│   ├── export-key.tsx      # BIP38 key export
│   ├── map.tsx             # Native places map (MapLibre + bottom sheet)
│   ├── map.web.tsx         # Web fallback (map is native-only)
│   ├── transaction/        # Transaction detail
│   ├── onboarding/         # Welcome, create, restore, PIN setup
│   └── (tabs)/             # Main app (wallet, send, receive, settings)
├── src/
│   ├── core/               # FairCoin protocol (pure TypeScript)
│   │   ├── network.ts      # Network constants (mainnet/testnet)
│   │   ├── encoding.ts     # Base58Check, BufferWriter/Reader
│   │   ├── address.ts      # Hash160, address generation
│   │   ├── hd-wallet.ts    # BIP39/BIP32/BIP44
│   │   ├── script.ts       # Bitcoin script opcodes
│   │   ├── transaction.ts  # Tx build/sign/serialize
│   │   ├── quark-hash.ts   # Quark 9-round hash (block headers)
│   │   ├── bip38.ts        # Encrypted key export/import
│   │   ├── checkpoints.ts  # Hardcoded block checkpoints
│   │   └── uri.ts          # faircoin: URI parsing (BIP21)
│   ├── p2p/                # SPV P2P client
│   │   ├── messages.ts     # Wire protocol serialization
│   │   ├── bloom-filter.ts # BIP37 Bloom filter
│   │   ├── peer.ts         # TCP peer connection + handshake
│   │   ├── peer-manager.ts # Multi-peer pool + discovery
│   │   ├── spv-client.ts   # Header sync + Merkle validation
│   │   ├── dns-seeds.ts    # DNS-over-HTTPS seed resolution
│   │   ├── masternode.ts   # Masternode broadcast/ping
│   │   ├── socket-provider.ts # Platform TCP adapter
│   │   └── header-store.ts # SQLite ↔ SPV bridge
│   ├── wallet/             # Wallet state
│   │   ├── key-manager.ts  # HD key derivation + gap limit
│   │   ├── utxo-set.ts     # UTXO tracking + coin selection
│   │   └── wallet-store.ts # Zustand store (multi-wallet, P2P)
│   ├── storage/            # Persistence
│   │   ├── database.ts     # SQLite (per-wallet)
│   │   ├── secure-store.ts # Keychain (mnemonics, PIN, biometrics)
│   │   └── kv-store.ts     # Platform adapter (native keychain / localStorage)
│   └── ui/components/      # Reusable UI
│       ├── Button.tsx
│       ├── TransactionItem.tsx
│       ├── SyncStatus.tsx
│       └── QRScanner.tsx
├── plugins/                # Expo config plugins: Android release signing, versionCode, ABI splits
├── electron/               # Desktop wrapper
│   ├── main.js             # Custom app:// protocol + TCP P2P + safeStorage
│   └── preload.js          # contextBridge API
├── modules/
│   └── fairwallet-widgets/ # Android home-screen widgets (Expo module, Jetpack Glance)
├── .github/workflows/
│   ├── build-android.yml   # Signed APKs + AAB on release; build check on PRs
│   └── build-desktop.yml   # Electron builds on release
└── app.json                # Expo config
```

## Deep Links

FAIRWallet handles `faircoin:` URIs following BIP21 conventions:

```
faircoin:FxxxxAddress
faircoin:FxxxxAddress?amount=10.5
faircoin:FxxxxAddress?amount=10.5&label=Donation&message=Thanks
```

Tapping a `faircoin:` link opens FAIRWallet and navigates to the Send screen with address and amount pre-filled.

## Security

- Private keys and mnemonics stored in OS keychain (iOS Keychain / Android EncryptedSharedPreferences)
- PIN hashed with SHA-256 before storage
- Each wallet has its own isolated SQLite database
- All cryptography uses audited libraries (`@noble/*`, `@scure/*`)
- No external servers — SPV client connects directly to FairCoin nodes
- BIP38 encrypted key export for backups

## License

MIT
