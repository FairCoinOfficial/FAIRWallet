/**
 * Secure storage abstraction for sensitive wallet data.
 * Uses expo-secure-store (Keychain on iOS, EncryptedSharedPreferences on Android).
 *
 * Supports multi-wallet storage: each wallet is identified by a UUID.
 * Legacy single-wallet data is migrated on first read.
 */

import * as SecureStore from "expo-secure-store";
import { sha256 } from "@noble/hashes/sha256";
import { bytesToHex } from "../core/encoding";

// ---------------------------------------------------------------------------
// Storage keys
// ---------------------------------------------------------------------------

const MNEMONIC_KEY = "fairwallet_mnemonic";
const WALLET_PIN_KEY = "fairwallet_pin";
const WALLET_CREATED_KEY = "fairwallet_created";

// ---------------------------------------------------------------------------
// Multi-wallet storage keys
// ---------------------------------------------------------------------------

const WALLETS_INDEX_KEY = "fairwallet_wallets_index";
const ACTIVE_WALLET_KEY = "fairwallet_active_wallet";

// ---------------------------------------------------------------------------
// Multi-wallet types
// ---------------------------------------------------------------------------

export interface WalletInfo {
  id: string;
  name: string;
  createdAt: number;
}

// ---------------------------------------------------------------------------
// Multi-wallet index management
// ---------------------------------------------------------------------------

/** Get the list of all wallets */
export async function getWalletIndex(): Promise<WalletInfo[]> {
  const raw = await SecureStore.getItemAsync(WALLETS_INDEX_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as WalletInfo[];
  } catch {
    return [];
  }
}

/** Save the wallet index */
async function saveWalletIndex(wallets: WalletInfo[]): Promise<void> {
  await SecureStore.setItemAsync(WALLETS_INDEX_KEY, JSON.stringify(wallets));
}

/** Add a wallet to the index */
export async function addWalletToIndex(id: string, name: string): Promise<void> {
  const wallets = await getWalletIndex();
  wallets.push({ id, name, createdAt: Date.now() });
  await saveWalletIndex(wallets);
}

/** Remove a wallet from the index */
export async function removeWalletFromIndex(id: string): Promise<void> {
  const wallets = await getWalletIndex();
  const filtered = wallets.filter((w) => w.id !== id);
  await saveWalletIndex(filtered);
}

/** Rename a wallet in the index */
export async function renameWallet(id: string, name: string): Promise<void> {
  const wallets = await getWalletIndex();
  const wallet = wallets.find((w) => w.id === id);
  if (wallet) {
    wallet.name = name;
    await saveWalletIndex(wallets);
  }
}

// ---------------------------------------------------------------------------
// Active wallet management
// ---------------------------------------------------------------------------

/** Get the active wallet ID */
export async function getActiveWalletId(): Promise<string | null> {
  return SecureStore.getItemAsync(ACTIVE_WALLET_KEY);
}

/** Set the active wallet ID */
export async function setActiveWalletId(id: string): Promise<void> {
  await SecureStore.setItemAsync(ACTIVE_WALLET_KEY, id);
}

// ---------------------------------------------------------------------------
// Per-wallet mnemonic storage
// ---------------------------------------------------------------------------

/** Save mnemonic for a specific wallet */
export async function saveWalletMnemonic(walletId: string, mnemonic: string): Promise<void> {
  await SecureStore.setItemAsync(`fairwallet_mnemonic_${walletId}`, mnemonic);
}

/** Get mnemonic for a specific wallet */
export async function getWalletMnemonic(walletId: string): Promise<string | null> {
  return SecureStore.getItemAsync(`fairwallet_mnemonic_${walletId}`);
}

/** Delete mnemonic for a specific wallet */
export async function deleteWalletMnemonic(walletId: string): Promise<void> {
  await SecureStore.deleteItemAsync(`fairwallet_mnemonic_${walletId}`);
}

// ---------------------------------------------------------------------------
// Legacy migration
// ---------------------------------------------------------------------------

/**
 * Check for a legacy mnemonic (pre-multi-wallet) and migrate it to
 * the new per-wallet format. Returns the active wallet ID after migration,
 * or null if no legacy data exists.
 */
async function migrateLegacyMnemonic(): Promise<string | null> {
  const legacyMnemonic = await SecureStore.getItemAsync(MNEMONIC_KEY);
  if (!legacyMnemonic) return null;

  // Check if already migrated (index exists with entries)
  const existingIndex = await getWalletIndex();
  if (existingIndex.length > 0) {
    // Already migrated - clean up legacy key
    await SecureStore.deleteItemAsync(MNEMONIC_KEY);
    return null;
  }

  // Migrate: create a wallet entry for the legacy mnemonic
  const walletId = generateMigrationWalletId();
  const createdTimestamp = await SecureStore.getItemAsync(WALLET_CREATED_KEY);
  const createdAt = createdTimestamp ? Number(createdTimestamp) : Date.now();

  await saveWalletMnemonic(walletId, legacyMnemonic);
  await addWalletToIndex(walletId, "Wallet 1");

  // Update the createdAt to match the original wallet
  const wallets = await getWalletIndex();
  const migrated = wallets.find((w) => w.id === walletId);
  if (migrated) {
    migrated.createdAt = createdAt;
    await saveWalletIndex(wallets);
  }

  await setActiveWalletId(walletId);

  // Remove legacy key
  await SecureStore.deleteItemAsync(MNEMONIC_KEY);

  return walletId;
}

/**
 * Generate a wallet ID for migration. Uses a deterministic approach
 * based on timestamp to avoid external dependencies.
 */
function generateMigrationWalletId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 1
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

// ---------------------------------------------------------------------------
// Mnemonic storage (backward-compatible wrappers)
// ---------------------------------------------------------------------------

/**
 * Save mnemonic for the active wallet. If no active wallet exists,
 * this is a legacy call that should not happen in multi-wallet mode.
 */
export async function saveMnemonic(mnemonic: string): Promise<void> {
  const activeId = await getActiveWalletId();
  if (activeId) {
    await saveWalletMnemonic(activeId, mnemonic);
  } else {
    // Fallback for legacy callers (should not happen in multi-wallet mode)
    await SecureStore.setItemAsync(MNEMONIC_KEY, mnemonic);
  }
  await SecureStore.setItemAsync(WALLET_CREATED_KEY, String(Date.now()));
}

/**
 * Get mnemonic for the active wallet. Handles legacy migration.
 */
export async function getMnemonic(): Promise<string | null> {
  // Try migration first
  const migratedId = await migrateLegacyMnemonic();
  if (migratedId) {
    return getWalletMnemonic(migratedId);
  }

  const activeId = await getActiveWalletId();
  if (activeId) {
    return getWalletMnemonic(activeId);
  }

  // No active wallet and no legacy data
  return null;
}

export async function deleteMnemonic(): Promise<void> {
  const activeId = await getActiveWalletId();
  if (activeId) {
    await deleteWalletMnemonic(activeId);
  }
  await SecureStore.deleteItemAsync(MNEMONIC_KEY);
}

// ---------------------------------------------------------------------------
// PIN management
// ---------------------------------------------------------------------------

/**
 * Hash the PIN before storing to avoid keeping plaintext.
 * Uses SHA-256 with a domain separator to prevent trivial rainbow tables.
 */
function hashPin(pin: string): string {
  const encoder = new TextEncoder();
  const data = encoder.encode(`fairwallet:pin:${pin}`);
  return bytesToHex(sha256(data));
}

export async function savePin(pin: string): Promise<void> {
  const hashed = hashPin(pin);
  await SecureStore.setItemAsync(WALLET_PIN_KEY, hashed);
}

export async function verifyPin(pin: string): Promise<boolean> {
  const stored = await SecureStore.getItemAsync(WALLET_PIN_KEY);
  if (stored === null) {
    return false;
  }
  const hashed = hashPin(pin);
  return constantTimeEqual(stored, hashed);
}

/**
 * Constant-time string comparison to prevent timing attacks on PIN verification.
 */
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

// ---------------------------------------------------------------------------
// PIN existence check
// ---------------------------------------------------------------------------

export async function hasPin(): Promise<boolean> {
  const stored = await SecureStore.getItemAsync(WALLET_PIN_KEY);
  return stored !== null;
}

// ---------------------------------------------------------------------------
// Biometrics preference
// ---------------------------------------------------------------------------

const BIOMETRICS_ENABLED_KEY = "fairwallet_biometrics";

export async function setBiometricsEnabled(enabled: boolean): Promise<void> {
  await SecureStore.setItemAsync(BIOMETRICS_ENABLED_KEY, enabled ? "1" : "0");
}

export async function isBiometricsEnabled(): Promise<boolean> {
  const value = await SecureStore.getItemAsync(BIOMETRICS_ENABLED_KEY);
  return value === "1";
}

// ---------------------------------------------------------------------------
// Wallet existence check
// ---------------------------------------------------------------------------

/**
 * Check if any wallet exists. Handles both multi-wallet index
 * and legacy single-wallet data.
 */
export async function hasWallet(): Promise<boolean> {
  // Check multi-wallet index
  const wallets = await getWalletIndex();
  if (wallets.length > 0) return true;

  // Check legacy mnemonic
  const legacyMnemonic = await SecureStore.getItemAsync(MNEMONIC_KEY);
  if (legacyMnemonic !== null && legacyMnemonic.length > 0) return true;

  // Check legacy created flag
  const created = await SecureStore.getItemAsync(WALLET_CREATED_KEY);
  return created !== null;
}

// ---------------------------------------------------------------------------
// Clear all secure data
// ---------------------------------------------------------------------------

export async function clearAll(): Promise<void> {
  // Clear legacy keys
  await SecureStore.deleteItemAsync(MNEMONIC_KEY);
  await SecureStore.deleteItemAsync(WALLET_PIN_KEY);
  await SecureStore.deleteItemAsync(WALLET_CREATED_KEY);
  await SecureStore.deleteItemAsync(BIOMETRICS_ENABLED_KEY);

  // Clear multi-wallet keys
  const wallets = await getWalletIndex();
  for (const wallet of wallets) {
    await deleteWalletMnemonic(wallet.id);
  }
  await SecureStore.deleteItemAsync(WALLETS_INDEX_KEY);
  await SecureStore.deleteItemAsync(ACTIVE_WALLET_KEY);
}
