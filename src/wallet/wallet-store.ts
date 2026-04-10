/**
 * Zustand store for FairCoin wallet state management.
 * Central state container used by UI components.
 * Integrates KeyManager for HD key derivation, UTXOSet for coin tracking,
 * and Database for persistence.
 *
 * Supports multi-wallet: users can create, switch, and manage
 * multiple wallets, each with its own mnemonic and chain data.
 */

import { create } from "zustand";
import { generateMnemonic, validateMnemonic } from "../core/hd-wallet";
import type { NetworkType, NetworkConfig } from "../core/network";
import { getNetwork } from "../core/network";
import { KeyManager } from "./key-manager";
import { UTXOSet } from "./utxo-set";
import type { UTXO } from "./utxo-set";
import {
  saveMnemonic,
  getMnemonic,
  clearAll as clearSecureStore,
  getWalletIndex,
  getActiveWalletId,
  setActiveWalletId,
  addWalletToIndex,
  removeWalletFromIndex,
  renameWallet,
  saveWalletMnemonic,
  getWalletMnemonic,
  deleteWalletMnemonic,
} from "../storage/secure-store";
import type { WalletInfo } from "../storage/secure-store";
import { Database } from "../storage/database";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type FeeLevel = "low" | "medium" | "high";

export interface WalletTransaction {
  txid: string;
  amount: bigint; // positive = received, negative = sent
  address: string;
  timestamp: number;
  confirmations: number;
  type: "send" | "receive" | "stake" | "masternode_reward";
}

export interface MasternodeUTXO {
  txid: string;
  vout: number;
  address: string;
  confirmations: number;
}

export interface WalletState {
  // Initialization
  initialized: boolean;
  loading: boolean;
  error: string | null;
  network: NetworkType;

  // Multi-wallet
  activeWalletId: string | null;
  activeWalletName: string;
  wallets: WalletInfo[];

  // Balance
  balance: bigint;
  confirmedBalance: bigint;
  unconfirmedBalance: bigint;

  // Sync
  syncProgress: number; // 0-100
  chainHeight: number;
  connectedPeers: number;
  isSyncing: boolean;

  // Addresses
  currentReceiveAddress: string;
  addresses: string[];

  // Transactions
  transactions: WalletTransaction[];

  // Masternode
  masternodeUTXOs: MasternodeUTXO[];

  // Actions
  initialize: (mnemonic: string, walletId?: string) => Promise<void>;
  createWallet: () => Promise<string>;
  restoreWallet: (mnemonic: string) => Promise<void>;
  refreshBalance: () => void;
  getNewAddress: () => string;
  sendTransaction: (
    toAddress: string,
    amount: bigint,
    feeRate: number,
  ) => Promise<string>;
  refreshMasternodeUTXOs: () => void;
  estimateFee: (feeLevel: FeeLevel) => bigint;
  hasWallet: () => Promise<boolean>;
  wipeWallet: () => Promise<void>;

  // Multi-wallet actions
  loadWalletList: () => Promise<void>;
  switchWallet: (walletId: string) => Promise<void>;
  createNewWallet: (name: string) => Promise<string>;
  importWallet: (name: string, mnemonic: string) => Promise<void>;
  deleteWallet: (walletId: string) => Promise<void>;
  renameActiveWallet: (name: string) => Promise<void>;
}

// ---------------------------------------------------------------------------
// UUID generator (no external deps)
// ---------------------------------------------------------------------------

function generateWalletId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 1
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

// ---------------------------------------------------------------------------
// Internal state (not exposed to Zustand consumers)
// ---------------------------------------------------------------------------

let keyManager: KeyManager | null = null;
let utxoSet: UTXOSet | null = null;
let database: Database | null = null;
let networkConfig: NetworkConfig | null = null;

// ---------------------------------------------------------------------------
// Fee estimation constants (satoshis per byte)
// ---------------------------------------------------------------------------

const FEE_RATES: Record<FeeLevel, number> = {
  low: 1,
  medium: 5,
  high: 10,
};

// Average P2PKH transaction ~226 bytes
const AVERAGE_TX_SIZE = 226;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Reset all in-memory wallet state to defaults. */
function resetWalletInternals(): void {
  keyManager = null;
  utxoSet = null;
  database = null;
  networkConfig = null;
}

const DEFAULT_WALLET_STATE = {
  initialized: false,
  loading: false,
  error: null,
  balance: 0n,
  confirmedBalance: 0n,
  unconfirmedBalance: 0n,
  syncProgress: 0,
  chainHeight: 0,
  connectedPeers: 0,
  isSyncing: false,
  currentReceiveAddress: "",
  addresses: [] as string[],
  transactions: [] as WalletTransaction[],
  masternodeUTXOs: [] as MasternodeUTXO[],
} as const;

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useWalletStore = create<WalletState>((set, get) => ({
  // Initial state
  initialized: false,
  loading: false,
  error: null,
  network: "mainnet",

  // Multi-wallet initial state
  activeWalletId: null,
  activeWalletName: "",
  wallets: [],

  balance: 0n,
  confirmedBalance: 0n,
  unconfirmedBalance: 0n,

  syncProgress: 0,
  chainHeight: 0,
  connectedPeers: 0,
  isSyncing: false,

  currentReceiveAddress: "",
  addresses: [],

  transactions: [],

  masternodeUTXOs: [],

  // -------------------------------------------------------------------
  // Actions
  // -------------------------------------------------------------------

  initialize: async (mnemonic: string, walletId?: string): Promise<void> => {
    const state = get();
    if (state.initialized) {
      return;
    }

    set({ loading: true, error: null });

    try {
      networkConfig = getNetwork(state.network);
      database = await Database.open(walletId);
      keyManager = KeyManager.fromMnemonic(mnemonic, networkConfig);
      utxoSet = new UTXOSet();

      // Load persisted UTXOs from database
      const dbUtxos = await database.getUnspentUTXOs();
      for (const row of dbUtxos) {
        utxoSet.add({
          txid: row.txid,
          vout: row.vout,
          address: row.address,
          value: BigInt(row.value),
          scriptPubKey: hexToUint8Array(row.script_pub_key),
          blockHeight: row.block_height,
          confirmed: true,
        });
      }

      // Load persisted addresses from database
      const dbAddresses = await database.getAddresses();
      const addressList = dbAddresses.map((a) => a.address);

      // Get receive address
      const unused = await database.getUnusedAddress(false);
      let receiveAddress: string;
      if (unused) {
        receiveAddress = unused.address;
      } else {
        const derived = keyManager.getNextAddress();
        await database.insertAddress(
          derived.address,
          derived.path,
          derived.index,
          false,
        );
        receiveAddress = derived.address;
        addressList.push(derived.address);
      }

      // Load wallet info
      const activeId = walletId ?? await getActiveWalletId();
      const wallets = await getWalletIndex();
      const activeWallet = activeId
        ? wallets.find((w) => w.id === activeId)
        : undefined;

      set({
        initialized: true,
        loading: false,
        currentReceiveAddress: receiveAddress,
        addresses: addressList,
        balance: utxoSet.getBalance(),
        confirmedBalance: utxoSet.getConfirmedBalance(),
        unconfirmedBalance: utxoSet.getUnconfirmedBalance(),
        activeWalletId: activeId,
        activeWalletName: activeWallet?.name ?? "",
        wallets,
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Unknown initialization error";
      set({ loading: false, error: message });
    }
  },

  createWallet: async (): Promise<string> => {
    set({ loading: true, error: null });

    try {
      const mnemonic = await get().createNewWallet("Wallet 1");
      return mnemonic;
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to create wallet";
      set({ loading: false, error: message });
      throw new Error(message);
    }
  },

  restoreWallet: async (mnemonic: string): Promise<void> => {
    set({ loading: true, error: null });

    try {
      const trimmed = mnemonic.trim().toLowerCase();
      if (!validateMnemonic(trimmed)) {
        throw new Error("Invalid mnemonic phrase");
      }

      const walletId = generateWalletId();
      const wallets = await getWalletIndex();
      const walletName = `Wallet ${wallets.length + 1}`;

      await saveWalletMnemonic(walletId, trimmed);
      await addWalletToIndex(walletId, walletName);
      await setActiveWalletId(walletId);

      await get().initialize(trimmed, walletId);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to restore wallet";
      set({ loading: false, error: message });
      throw new Error(message);
    }
  },

  refreshBalance: (): void => {
    if (!utxoSet) {
      return;
    }
    set({
      balance: utxoSet.getBalance(),
      confirmedBalance: utxoSet.getConfirmedBalance(),
      unconfirmedBalance: utxoSet.getUnconfirmedBalance(),
    });
  },

  getNewAddress: (): string => {
    if (!keyManager) {
      throw new Error("Wallet not initialized");
    }

    const derived = keyManager.getNextAddress();

    // Persist to database asynchronously
    if (database) {
      database
        .insertAddress(derived.address, derived.path, derived.index, false)
        .catch((err: unknown) => {
          const message =
            err instanceof Error ? err.message : "Unknown database error";
          set({ error: `Failed to persist address: ${message}` });
        });
    }

    const current = get().addresses;
    set({
      currentReceiveAddress: derived.address,
      addresses: [...current, derived.address],
    });

    return derived.address;
  },

  sendTransaction: async (
    toAddress: string,
    amount: bigint,
    feeRate: number,
  ): Promise<string> => {
    if (!keyManager || !utxoSet || !networkConfig) {
      throw new Error("Wallet not initialized");
    }

    set({ loading: true, error: null });

    try {
      // Select coins
      const { selected, fee, change } = utxoSet.selectCoins(
        amount,
        feeRate,
      );

      // Get change address if needed
      if (change > 0n && keyManager) {
        const derived = keyManager.getNextChangeAddress();
        if (database) {
          await database.insertAddress(
            derived.address,
            derived.path,
            derived.index,
            true,
          );
        }
      }

      // Compute a deterministic intent hash as placeholder txid.
      // Real transaction building/signing belongs in a tx-builder module.
      const txid = computeIntentHash(selected, toAddress, amount, fee);

      // Mark selected UTXOs as spent
      for (const utxo of selected) {
        utxoSet.spend(utxo.txid, utxo.vout);
        if (database) {
          await database.markUTXOSpent(utxo.txid, utxo.vout);
        }
      }

      // Record the outgoing transaction
      const now = Math.floor(Date.now() / 1000);
      const newTx: WalletTransaction = {
        txid,
        amount: -amount,
        address: toAddress,
        timestamp: now,
        confirmations: 0,
        type: "send",
      };

      const currentTxs = get().transactions;
      set({
        loading: false,
        transactions: [newTx, ...currentTxs],
      });

      get().refreshBalance();

      return txid;
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Transaction failed";
      set({ loading: false, error: message });
      throw new Error(message);
    }
  },

  refreshMasternodeUTXOs: (): void => {
    if (!utxoSet) {
      return;
    }

    const state = get();
    const mnUtxos = utxoSet.getMasternodeUTXOs();
    const masternodeList: MasternodeUTXO[] = mnUtxos.map((u) => ({
      txid: u.txid,
      vout: u.vout,
      address: u.address,
      confirmations:
        state.chainHeight > 0 && u.blockHeight > 0
          ? state.chainHeight - u.blockHeight + 1
          : 0,
    }));

    set({ masternodeUTXOs: masternodeList });
  },

  estimateFee: (feeLevel: FeeLevel): bigint => {
    const rate = FEE_RATES[feeLevel];
    return BigInt(rate * AVERAGE_TX_SIZE);
  },

  hasWallet: async (): Promise<boolean> => {
    try {
      const stored = await getMnemonic();
      return stored !== null && stored.length > 0;
    } catch {
      return false;
    }
  },

  wipeWallet: async (): Promise<void> => {
    set({ loading: true, error: null });
    try {
      await clearSecureStore();

      if (database) {
        await database.close();
      }

      resetWalletInternals();

      set({
        ...DEFAULT_WALLET_STATE,
        network: "mainnet",
        activeWalletId: null,
        activeWalletName: "",
        wallets: [],
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to wipe wallet";
      set({ loading: false, error: message });
    }
  },

  // -------------------------------------------------------------------
  // Multi-wallet actions
  // -------------------------------------------------------------------

  loadWalletList: async (): Promise<void> => {
    try {
      const wallets = await getWalletIndex();
      const activeId = await getActiveWalletId();
      const activeWallet = activeId
        ? wallets.find((w) => w.id === activeId)
        : undefined;

      set({
        wallets,
        activeWalletId: activeId,
        activeWalletName: activeWallet?.name ?? "",
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to load wallet list";
      set({ error: message });
    }
  },

  switchWallet: async (walletId: string): Promise<void> => {
    const state = get();
    if (state.activeWalletId === walletId) return;

    set({ loading: true, error: null });

    try {
      // Close current database
      if (database) {
        await database.close();
      }

      // Reset in-memory state
      resetWalletInternals();

      set({
        ...DEFAULT_WALLET_STATE,
        network: state.network,
        activeWalletId: walletId,
        wallets: state.wallets,
        loading: true,
      });

      // Set the new active wallet
      await setActiveWalletId(walletId);

      // Load the new wallet's mnemonic
      const mnemonic = await getWalletMnemonic(walletId);
      if (!mnemonic) {
        throw new Error("Wallet mnemonic not found");
      }

      // Re-initialize with the new wallet
      await get().initialize(mnemonic, walletId);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to switch wallet";
      set({ loading: false, error: message });
    }
  },

  createNewWallet: async (name: string): Promise<string> => {
    set({ loading: true, error: null });

    try {
      const walletId = generateWalletId();
      const mnemonic = generateMnemonic();

      // Save wallet mnemonic with wallet-specific key
      await saveWalletMnemonic(walletId, mnemonic);
      await addWalletToIndex(walletId, name);
      await setActiveWalletId(walletId);

      // Close current database if open
      if (database) {
        await database.close();
      }

      // Reset in-memory state
      resetWalletInternals();

      const state = get();
      set({
        ...DEFAULT_WALLET_STATE,
        network: state.network,
        activeWalletId: walletId,
        activeWalletName: name,
        wallets: state.wallets,
        loading: true,
      });

      // Mark wallet as created in secure store
      await saveMnemonic(mnemonic);

      // Initialize with the new wallet
      await get().initialize(mnemonic, walletId);

      // Reload wallet list
      await get().loadWalletList();

      return mnemonic;
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to create new wallet";
      set({ loading: false, error: message });
      throw new Error(message);
    }
  },

  importWallet: async (name: string, mnemonic: string): Promise<void> => {
    set({ loading: true, error: null });

    try {
      const trimmed = mnemonic.trim().toLowerCase();
      if (!validateMnemonic(trimmed)) {
        throw new Error("Invalid mnemonic phrase");
      }

      const walletId = generateWalletId();

      await saveWalletMnemonic(walletId, trimmed);
      await addWalletToIndex(walletId, name);
      await setActiveWalletId(walletId);

      // Close current database if open
      if (database) {
        await database.close();
      }

      resetWalletInternals();

      const state = get();
      set({
        ...DEFAULT_WALLET_STATE,
        network: state.network,
        activeWalletId: walletId,
        activeWalletName: name,
        wallets: state.wallets,
        loading: true,
      });

      await get().initialize(trimmed, walletId);
      await get().loadWalletList();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to import wallet";
      set({ loading: false, error: message });
      throw new Error(message);
    }
  },

  deleteWallet: async (walletId: string): Promise<void> => {
    set({ loading: true, error: null });

    try {
      const state = get();
      const isActive = state.activeWalletId === walletId;

      // Remove from index and delete mnemonic
      await removeWalletFromIndex(walletId);
      await deleteWalletMnemonic(walletId);

      // Reload wallet list
      const remainingWallets = await getWalletIndex();

      if (isActive) {
        // Close current database
        if (database) {
          await database.close();
        }
        resetWalletInternals();

        if (remainingWallets.length > 0) {
          // Switch to the first remaining wallet
          const nextWallet = remainingWallets[0];

          set({
            ...DEFAULT_WALLET_STATE,
            network: state.network,
            activeWalletId: nextWallet.id,
            activeWalletName: nextWallet.name,
            wallets: remainingWallets,
            loading: true,
          });

          await setActiveWalletId(nextWallet.id);
          const mnemonic = await getWalletMnemonic(nextWallet.id);
          if (mnemonic) {
            await get().initialize(mnemonic, nextWallet.id);
          }
        } else {
          // No wallets left - go to onboarding state
          set({
            ...DEFAULT_WALLET_STATE,
            network: state.network,
            activeWalletId: null,
            activeWalletName: "",
            wallets: [],
          });
        }
      } else {
        // Not the active wallet, just update the list
        set({
          wallets: remainingWallets,
          loading: false,
        });
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to delete wallet";
      set({ loading: false, error: message });
    }
  },

  renameActiveWallet: async (name: string): Promise<void> => {
    const state = get();
    if (!state.activeWalletId) return;

    try {
      await renameWallet(state.activeWalletId, name);
      const wallets = await getWalletIndex();
      set({
        activeWalletName: name,
        wallets,
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to rename wallet";
      set({ error: message });
    }
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function hexToUint8Array(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

/**
 * Compute a deterministic hash representing a send intent.
 * This is NOT a real transaction ID - it's a placeholder until
 * the tx-builder module is implemented for actual signing.
 */
function computeIntentHash(
  inputs: UTXO[],
  toAddress: string,
  amount: bigint,
  fee: bigint,
): string {
  const encoder = new TextEncoder();
  const parts: string[] = [];
  for (const input of inputs) {
    parts.push(`${input.txid}:${input.vout}`);
  }
  parts.push(toAddress);
  parts.push(amount.toString());
  parts.push(fee.toString());
  parts.push(Date.now().toString());

  const data = encoder.encode(parts.join("|"));

  // FNV-1a hash as a lightweight placeholder identifier
  let hash = 0x811c9dc5;
  for (let i = 0; i < data.length; i++) {
    hash ^= data[i];
    hash = Math.imul(hash, 0x01000193);
  }

  const hex = (hash >>> 0).toString(16).padStart(8, "0");
  return hex.repeat(8); // 64-char hex string to match txid format
}
