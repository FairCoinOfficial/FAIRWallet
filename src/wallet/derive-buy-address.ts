/**
 * Derive a fresh receive address for the Buy-FAIR flow.
 *
 * Buy addresses live on a dedicated BIP44 chain (chain=2) so they don't
 * pollute the user's regular external receive addresses (chain=0) or the
 * change addresses the wallet selects for its own outputs (chain=1).
 *
 * Path: m/44'/{coinType}'/0'/2/{nextBuyIndex}
 *
 * The next index is persisted per active wallet in the platform-agnostic
 * key/value store. Watch-only wallets cannot derive buy addresses (no
 * private material) — callers must check `isWatchOnly` first.
 */

import { HDKey } from "@scure/bip32";
import { mnemonicToSeedSync } from "@scure/bip39";
import {
  getNetwork,
  publicKeyToAddress,
  type NetworkConfig,
  type NetworkType,
} from "@fairco.in/core";
import { getItemAsync, setItemAsync } from "../storage/kv-store";
import { getWalletMnemonic } from "../storage/secure-store";

const BUY_CHAIN = 2;

function buyIndexKey(walletId: string): string {
  return `fairwallet_buy_index_${walletId}`;
}

async function getNextBuyIndex(walletId: string): Promise<number> {
  const raw = await getItemAsync(buyIndexKey(walletId));
  if (raw === null) return 0;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return parsed;
}

async function setNextBuyIndex(walletId: string, index: number): Promise<void> {
  await setItemAsync(buyIndexKey(walletId), String(index));
}

export interface DerivedBuyAddress {
  address: string;
  path: string;
  index: number;
}

interface DeriveOptions {
  walletId: string;
  network: NetworkType;
}

function deriveAddressAtIndex(
  mnemonic: string,
  network: NetworkConfig,
  index: number,
): { address: string; path: string } {
  const seed = mnemonicToSeedSync(mnemonic);
  const root = HDKey.fromMasterSeed(seed, {
    public: network.bip32.public,
    private: network.bip32.private,
  });
  const path = `m/44'/${network.bip44CoinType}'/0'/${BUY_CHAIN}/${index}`;
  const child = root.derive(path);
  if (!child.publicKey) {
    throw new Error(`buy-address derivation failed at ${path}`);
  }
  const address = publicKeyToAddress(child.publicKey, network);
  return { address, path };
}

/**
 * Derive the next buy receive address and bump the persisted index.
 *
 * Throws if the wallet is watch-only (no mnemonic) or its mnemonic cannot
 * be loaded from secure storage.
 */
export async function deriveNextBuyAddress(
  options: DeriveOptions,
): Promise<DerivedBuyAddress> {
  const mnemonic = await getWalletMnemonic(options.walletId);
  if (!mnemonic) {
    throw new Error("Active wallet has no mnemonic; cannot derive buy address");
  }
  if (mnemonic.startsWith("xpub:")) {
    throw new Error("Watch-only wallet cannot derive buy addresses");
  }

  const network = getNetwork(options.network);
  const index = await getNextBuyIndex(options.walletId);
  const { address, path } = deriveAddressAtIndex(mnemonic, network, index);
  // Bump AFTER successful derivation so a transient failure doesn't burn an
  // index on every retry.
  await setNextBuyIndex(options.walletId, index + 1);
  return { address, path, index };
}
