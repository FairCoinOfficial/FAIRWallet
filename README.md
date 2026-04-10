# FAIRWallet

Lightweight SPV wallet for [FairCoin](https://fairco.in) — cross-platform (Android, iOS, Desktop).

Built with Expo SDK 55, React Native 0.83, and pure TypeScript cryptography.

## Features

- **True SPV wallet** — connects directly to the FairCoin P2P network, no server dependency
- **HD wallet** — BIP39 (24-word mnemonic) + BIP32 + BIP44 (`m/44'/119'/0'/...`)
- **Multi-wallet** — create, import, switch between, and manage multiple wallets
- **QR code** — scan to send, show to receive
- **Deep links** — handles `faircoin:` URIs (BIP21-style)
- **PIN & biometrics** — 6-digit PIN with fingerprint/face unlock
- **Masternode** — detect 5,000 FAIR collateral UTXOs, start masternodes
- **FastSend** — instant confirmation via masternode quorum (SwiftTX)
- **Secure** — keys stored in OS keychain (Keychain/EncryptedSharedPreferences), per-wallet SQLite databases

## Platforms

| Platform | Status | How |
|----------|--------|-----|
| Android | Ready | Expo Go / APK build |
| iOS | Ready | Expo Go / IPA build |
| Desktop | Ready | Electron wrapping Expo web export |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Expo SDK 55, React Native 0.83 |
| Navigation | expo-router (native tabs on Android/iOS) |
| Styling | NativeWind (Tailwind CSS) |
| State | Zustand |
| Crypto | `@noble/secp256k1`, `@noble/hashes`, `@scure/bip32`, `@scure/bip39` |
| Storage | expo-secure-store (keys), expo-sqlite (chain data) |
| P2P | Custom SPV client (TCP via react-native-tcp-socket / Node.js net) |
| Desktop | Electron (IPC bridge for TCP + secure storage) |

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

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 22+
- [Bun](https://bun.sh/) (package manager)
- [Expo Go](https://expo.dev/go) on your phone/emulator

### Install

```bash
git clone https://github.com/FairCoinOfficial/FAIRWallet.git
cd FAIRWallet
bun install
```

### Development

```bash
# Start Expo dev server
bun start

# Android
bun run android

# iOS
bun run ios

# Web (for Electron)
bun run web
```

### Desktop (Electron)

```bash
# Development
bun run export:web
bun run electron -- --dev

# Production
bun run electron:build
```

### Build APK

```bash
# Local build
npx expo prebuild --platform android
cd android && ./gradlew assembleRelease
```

Or push a release tag — GitHub Actions will automatically build and attach the APK.

### Type Check

```bash
bun run typecheck
```

## Project Structure

```
FAIRWallet/
├── app/                    # Expo Router screens
│   ├── _layout.tsx         # Root layout + deep link handler
│   ├── index.tsx           # Entry (wallet check → lock/onboarding/tabs)
│   ├── lock.tsx            # PIN/biometric lock screen
│   ├── masternode.tsx      # Masternode management
│   ├── wallets.tsx         # Multi-wallet manager
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
│   │   ├── peer.ts         # TCP peer connection
│   │   ├── peer-manager.ts # Multi-peer pool
│   │   ├── spv-client.ts   # Header sync + Merkle validation
│   │   ├── masternode.ts   # Masternode broadcast/ping
│   │   └── fastsend.ts     # SwiftTX instant confirmations
│   ├── wallet/             # Wallet state
│   │   ├── key-manager.ts  # HD key derivation + gap limit
│   │   ├── utxo-set.ts     # UTXO tracking + coin selection
│   │   └── wallet-store.ts # Zustand store (multi-wallet)
│   ├── storage/            # Persistence
│   │   ├── database.ts     # SQLite (per-wallet)
│   │   └── secure-store.ts # Keychain (mnemonics, PIN, biometrics)
│   └── ui/components/      # Reusable UI
│       ├── Button.tsx       # Multi-variant button
│       ├── TransactionItem.tsx
│       ├── SyncStatus.tsx
│       └── QRScanner.tsx    # Camera-based QR scanner
├── electron/               # Desktop wrapper
│   ├── main.js             # TCP P2P + safeStorage via IPC
│   └── preload.js          # contextBridge API
├── .github/workflows/
│   └── build-android.yml   # Auto-build APK on GitHub releases
└── app.json                # Expo config
```

## Deep Links

FAIRWallet handles `faircoin:` URIs:

```
faircoin:FxxxxAddress
faircoin:FxxxxAddress?amount=10.5
faircoin:FxxxxAddress?amount=10.5&label=Donation&message=Thanks
```

Clicking a `faircoin:` link opens FAIRWallet and pre-fills the Send screen.

## Security

- Private keys and mnemonics are stored in the OS keychain (iOS Keychain / Android EncryptedSharedPreferences)
- PIN is hashed with SHA-256 before storage
- Each wallet has its own isolated SQLite database
- All cryptography uses audited libraries (`@noble/*`, `@scure/*`)
- No external servers — SPV client connects directly to FairCoin nodes

## License

MIT
