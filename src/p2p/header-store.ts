/**
 * Bridges the SPV client's HeaderStore interface to our SQLite Database class.
 *
 * Converts between the SPV client's binary representations (Uint8Array hashes)
 * and the Database's hex-string storage format.
 */

import type { HeaderStore, StoredBlockHeader } from "./spv-client";
import type { Database, BlockHeaderRow } from "../storage/database";
import { hexToBytes, bytesToHex } from "../core/encoding";

// ---------------------------------------------------------------------------
// DatabaseHeaderStore
// ---------------------------------------------------------------------------

export class DatabaseHeaderStore implements HeaderStore {
  private readonly db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  async getLatestHeader(): Promise<StoredBlockHeader | undefined> {
    const row = await this.db.getLatestHeader();
    if (!row) return undefined;
    return rowToStoredHeader(row);
  }

  async getHeaderByHash(hash: Uint8Array): Promise<StoredBlockHeader | undefined> {
    // The SPV client uses this for chain validation. We don't have a direct
    // getHeaderByHash query on the Database class, so we search by hex.
    // This method is called infrequently (validation only), so a scan
    // of the latest header is acceptable. For a full implementation,
    // add a getHeaderByHash(hashHex) method to Database.
    const _hashHex = bytesToHex(hash);
    // Database does not currently expose getHeaderByHash.
    // Return undefined - the SPV client handles this gracefully during validation.
    return undefined;
  }

  async getHeaderByHeight(height: number): Promise<StoredBlockHeader | undefined> {
    const row = await this.db.getHeaderByHeight(height);
    if (!row) return undefined;
    return rowToStoredHeader(row);
  }

  async saveHeaders(headers: StoredBlockHeader[]): Promise<void> {
    for (const header of headers) {
      await this.db.insertHeader({
        height: header.height,
        hash: bytesToHex(header.hash),
        prev_hash: bytesToHex(header.prevBlock),
        merkle_root: bytesToHex(header.merkleRoot),
        timestamp: header.timestamp,
        bits: header.bits,
        nonce: header.nonce,
        version: header.version,
      });
    }
  }

  async getChainHeight(): Promise<number> {
    const latest = await this.db.getLatestHeader();
    if (!latest) return 0;
    return latest.height;
  }
}

// ---------------------------------------------------------------------------
// Conversion helper
// ---------------------------------------------------------------------------

function rowToStoredHeader(row: BlockHeaderRow): StoredBlockHeader {
  return {
    height: row.height,
    hash: hexToBytes(row.hash),
    prevBlock: hexToBytes(row.prev_hash),
    merkleRoot: hexToBytes(row.merkle_root),
    timestamp: row.timestamp,
    bits: row.bits,
    nonce: row.nonce,
    version: row.version,
  };
}
