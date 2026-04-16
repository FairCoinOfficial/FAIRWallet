/**
 * Explorer API client for the FairCoin wallet.
 * Wraps all calls to the Explorer backend REST API.
 */

import { EXPLORER_BASE_URL } from "@fairco.in/core";

const EXPLORER_API = EXPLORER_BASE_URL;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ExplorerUTXO {
  txid: string;
  outputIndex: number;
  satoshis: number;
  script: string;
  height: number;
}

export interface ExplorerTransaction {
  txid: string;
  blockhash: string | null;
  confirmations: number;
  time: number;
  size: number;
  vin: unknown[];
  vout: unknown[];
}

interface AddressInfoResponse {
  addressInfo: {
    balance: number;
    balanceSat: number;
    totalReceived: number;
    totalReceivedSat: number;
    totalSent: number;
    totalSentSat: number;
    txCount: number;
    utxos: ExplorerUTXO[];
    isValid?: boolean;
    note?: string;
  };
  network: string;
}

interface UTXOResponse {
  utxos: ExplorerUTXO[];
  network: string;
}

interface TxHistoryResponse {
  transactions: ExplorerTransaction[];
  page: number;
  limit: number;
  total: number;
  network: string;
}

interface BroadcastResponse {
  txid?: string;
  error?: string;
}

interface FeeEstimateResponse {
  feePerKb: number;
  feePerByte: number;
  blocks: number;
  network: string;
}

interface BlockCountResponse {
  blockcount: number;
  network: string;
}

interface ValidateAddressResponse {
  isvalid: boolean;
  address?: string;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(`${EXPLORER_API}${path}`);
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Explorer API error: ${response.status}`);
  }
  return (await response.json()) as T;
}

async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${EXPLORER_API}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = (await response.json()) as T & { error?: string };

  if (!response.ok) {
    throw new Error(
      (data as { error?: string }).error ?? `Explorer API error: ${response.status}`,
    );
  }

  return data;
}

// ---------------------------------------------------------------------------
// API Functions
// ---------------------------------------------------------------------------

/**
 * Get the balance for an address in satoshis, or null if unavailable.
 */
export async function getAddressBalance(address: string): Promise<bigint | null> {
  try {
    const data = await apiGet<AddressInfoResponse>(`/api/address/${address}`);
    return BigInt(data.addressInfo.balanceSat);
  } catch {
    return null;
  }
}

/**
 * Get UTXOs for an address.
 */
export async function getAddressUTXOs(address: string): Promise<ExplorerUTXO[]> {
  try {
    const data = await apiGet<UTXOResponse>(`/api/address/${address}/utxos`);
    return data.utxos;
  } catch {
    return [];
  }
}

/**
 * Get paginated transaction history for an address.
 */
export async function getAddressTxs(
  address: string,
  page: number = 1,
  limit: number = 20,
): Promise<TxHistoryResponse> {
  return apiGet<TxHistoryResponse>(
    `/api/address/${address}/txs?page=${page}&limit=${limit}`,
  );
}

/**
 * Broadcast a signed raw transaction hex. Returns the txid on success.
 */
export async function broadcastTransaction(hex: string): Promise<string> {
  const data = await apiPost<BroadcastResponse>("/api/tx/broadcast", { hex });
  if (!data.txid) {
    throw new Error(data.error ?? "Broadcast returned no txid");
  }
  return data.txid;
}

/**
 * Get the estimated fee in satoshis per byte.
 */
export async function getFeeEstimate(): Promise<number> {
  try {
    const data = await apiGet<FeeEstimateResponse>("/api/fee-estimate");
    return data.feePerByte;
  } catch {
    // Sensible default: 1 sat/byte
    return 1;
  }
}

/**
 * Get the current block count.
 */
export async function getBlockCount(): Promise<number> {
  const data = await apiGet<BlockCountResponse>("/api/blockcount");
  return data.blockcount;
}

/**
 * Validate whether an address is a valid FairCoin address.
 */
export async function validateAddress(address: string): Promise<boolean> {
  try {
    const data = await apiGet<ValidateAddressResponse>(
      `/api/validate-address?address=${encodeURIComponent(address)}`,
    );
    return data.isvalid === true;
  } catch {
    return false;
  }
}
