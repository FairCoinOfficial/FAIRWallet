/**
 * FastSend (SwiftTX) - instant transaction confirmation via masternode quorum.
 *
 * When enabled, transactions are broadcast with the `ix` message type instead
 * of the standard `tx` type. Masternodes will then vote to lock the inputs,
 * providing instant confirmation.
 *
 * Message types:
 * - `ix` (MSG_TXLOCK_REQUEST = 4): Transaction lock request
 * - `txlvote` (MSG_TXLOCK_VOTE = 5): Masternode vote to lock inputs
 *
 * A transaction is considered instantly confirmed when it receives at least
 * SWIFTTX_SIGNATURES_REQUIRED (6) votes from unique masternodes.
 */

import { BufferReader, bytesToHex, UNITS_PER_COIN } from "@fairco.in/core";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Inventory type for a transaction lock request. */
export const MSG_TXLOCK_REQUEST = 4;

/** Inventory type for a transaction lock vote. */
export const MSG_TXLOCK_VOTE = 5;

/** Maximum value for a FastSend transaction (1000 FAIR in base units). */
export const FASTSEND_MAX_VALUE = 1000n * UNITS_PER_COIN;

/** Number of masternode signatures required for instant confirmation. */
export const SWIFTTX_SIGNATURES_REQUIRED = 6;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A transaction lock request - same as a regular transaction but broadcast as `ix`. */
export interface TxLockRequest {
  /** Raw serialized transaction bytes. */
  rawTx: Uint8Array;
}

/** Outpoint reference (txid + output index). */
export interface Outpoint {
  /** 32-byte transaction hash. */
  txid: Uint8Array;
  /** Output index (uint32). */
  vout: number;
}

/** A masternode vote to lock a specific transaction input. */
export interface TxLockVote {
  /** 32-byte hash of the locked transaction. */
  txHash: Uint8Array;
  /** The UTXO being voted on. */
  outpoint: Outpoint;
  /** The masternode's collateral outpoint (identifies the voter). */
  masternodeOutpoint: Outpoint;
  /** ECDSA signature from the masternode. */
  sig: Uint8Array;
}

/** Tracking status for a pending FastSend transaction. */
export interface FastSendStatus {
  /** Transaction ID (hex). */
  txid: string;
  /** Whether the transaction has reached the vote threshold. */
  locked: boolean;
  /** Number of unique masternode votes received. */
  votes: number;
  /** Number of votes required for instant confirmation. */
  requiredVotes: number;
}

// ---------------------------------------------------------------------------
// Serialization
// ---------------------------------------------------------------------------

/**
 * Serialize a TxLockRequest for broadcasting.
 * The lock request payload is identical to the raw transaction;
 * only the P2P command differs (`ix` instead of `tx`).
 */
export function serializeTxLockRequest(req: TxLockRequest): Uint8Array {
  // Return a copy to prevent external mutation
  const result = new Uint8Array(req.rawTx.length);
  result.set(req.rawTx);
  return result;
}

/**
 * Parse a TxLockVote from wire data.
 *
 * Wire format:
 *   txHash (32 bytes)
 *   outpoint.txid (32 bytes) + outpoint.vout (uint32)
 *   masternodeOutpoint.txid (32 bytes) + masternodeOutpoint.vout (uint32)
 *   sigLen (varint) + sig (sigLen bytes)
 */
export function parseTxLockVote(data: Uint8Array): TxLockVote {
  const reader = new BufferReader(data);

  const txHash = reader.readBytes(32);

  const outpointTxid = reader.readBytes(32);
  const outpointVout = reader.readUInt32LE();

  const mnOutpointTxid = reader.readBytes(32);
  const mnOutpointVout = reader.readUInt32LE();

  const sigLen = reader.readVarInt();
  const sig = reader.readBytes(sigLen);

  return {
    txHash,
    outpoint: {
      txid: outpointTxid,
      vout: outpointVout,
    },
    masternodeOutpoint: {
      txid: mnOutpointTxid,
      vout: mnOutpointVout,
    },
    sig,
  };
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Check if a given amount is eligible for FastSend.
 * FastSend is only available for transactions up to FASTSEND_MAX_VALUE.
 */
export function canUseFastSend(amount: bigint): boolean {
  return amount > 0n && amount <= FASTSEND_MAX_VALUE;
}

// ---------------------------------------------------------------------------
// Vote tracker
// ---------------------------------------------------------------------------

/**
 * Unique key for a masternode outpoint (used to deduplicate votes).
 */
function outpointKey(outpoint: Outpoint): string {
  return `${bytesToHex(outpoint.txid)}:${outpoint.vout}`;
}

/** Internal state for a single tracked transaction. */
interface TrackedTransaction {
  /** Set of masternode outpoint keys that have voted. */
  voterKeys: Set<string>;
  /** Whether the lock threshold has been met. */
  locked: boolean;
}

/**
 * Tracks FastSend votes for pending lock requests and determines
 * when a transaction is considered instantly confirmed.
 *
 * A transaction is locked when it accumulates SWIFTTX_SIGNATURES_REQUIRED
 * votes from unique masternodes (deduplicated by masternode collateral outpoint).
 */
export class FastSendTracker {
  private readonly tracked: Map<string, TrackedTransaction> = new Map();

  /**
   * Start tracking a transaction for FastSend votes.
   *
   * @param txid - Hex transaction ID to track
   */
  track(txid: string): void {
    if (this.tracked.has(txid)) {
      return;
    }
    this.tracked.set(txid, {
      voterKeys: new Set(),
      locked: false,
    });
  }

  /**
   * Record a vote for a tracked transaction.
   * Duplicate votes from the same masternode are ignored.
   *
   * @param vote - The TxLockVote received from the network
   * @returns true if the vote was new and accepted, false if duplicate or untracked
   */
  addVote(vote: TxLockVote): boolean {
    const txid = bytesToHex(vote.txHash);
    const entry = this.tracked.get(txid);
    if (!entry) {
      return false;
    }

    // Already locked - no need to process more votes
    if (entry.locked) {
      return false;
    }

    const voterKey = outpointKey(vote.masternodeOutpoint);
    if (entry.voterKeys.has(voterKey)) {
      return false;
    }

    entry.voterKeys.add(voterKey);

    if (entry.voterKeys.size >= SWIFTTX_SIGNATURES_REQUIRED) {
      entry.locked = true;
    }

    return true;
  }

  /**
   * Get the current status of a tracked transaction.
   *
   * @param txid - Hex transaction ID
   * @returns Status object or null if not tracked
   */
  getStatus(txid: string): FastSendStatus | null {
    const entry = this.tracked.get(txid);
    if (!entry) {
      return null;
    }

    return {
      txid,
      locked: entry.locked,
      votes: entry.voterKeys.size,
      requiredVotes: SWIFTTX_SIGNATURES_REQUIRED,
    };
  }

  /**
   * Check if a transaction is instantly confirmed (locked).
   *
   * @param txid - Hex transaction ID
   * @returns true if locked, false otherwise
   */
  isLocked(txid: string): boolean {
    const entry = this.tracked.get(txid);
    if (!entry) {
      return false;
    }
    return entry.locked;
  }

  /**
   * Stop tracking a transaction (e.g., after it receives a regular confirmation).
   *
   * @param txid - Hex transaction ID
   */
  untrack(txid: string): void {
    this.tracked.delete(txid);
  }

  /**
   * Get the number of currently tracked transactions.
   */
  get size(): number {
    return this.tracked.size;
  }

  /**
   * Remove all tracked transactions.
   */
  clear(): void {
    this.tracked.clear();
  }
}
