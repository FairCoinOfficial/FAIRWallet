/**
 * SQLite database layer for FairCoin wallet persistent storage.
 * Uses expo-sqlite for cross-platform database access.
 *
 * Design decisions:
 * - WAL journal mode + NORMAL synchronous for optimal write performance
 * - All schema created in a single execAsync batch (one round-trip)
 * - UTXO values stored as TEXT to preserve bigint precision (avoids JS number overflow)
 * - Batch header insertion wrapped in transactions for SPV sync performance
 * - Compound indexes for common multi-column query patterns
 */

import * as SQLite from "expo-sqlite";

// ---------------------------------------------------------------------------
// Row types
// ---------------------------------------------------------------------------

export interface BlockHeaderRow {
  height: number;
  hash: string;
  prev_hash: string;
  merkle_root: string;
  timestamp: number;
  bits: number;
  nonce: number;
  version: number;
}

export interface TransactionRow {
  txid: string;
  raw_hex: string;
  block_height: number;
  block_hash: string;
  timestamp: number;
  fee: number;
  confirmed: number;
}

/**
 * UTXO row from the database.
 * `value` is stored as TEXT in SQLite and returned as string here
 * to preserve precision for amounts that exceed Number.MAX_SAFE_INTEGER.
 * Callers should convert to bigint: `BigInt(row.value)`.
 */
export interface UTXORow {
  txid: string;
  vout: number;
  address: string;
  value: string;
  script_pub_key: string;
  spent: number;
  block_height: number;
}

export interface AddressRow {
  address: string;
  path: string;
  index_num: number;
  is_change: number;
  used: number;
}

export interface PeerRow {
  host: string;
  port: number;
  last_seen: number;
  last_success: number;
  services: number;
}

export interface ContactRow {
  id: string;
  name: string;
  address: string;
  notes: string;
  emoji: string;
  created_at: number;
  updated_at: number;
}

export interface TxNoteRow {
  txid: string;
  note: string;
  updated_at: number;
}

export interface AddressLabelRow {
  address: string;
  label: string;
  updated_at: number;
}

export interface RecentRecipientRow {
  address: string;
  last_used: number;
  use_count: number;
}

// ---------------------------------------------------------------------------
// Schema (single SQL batch for initialization)
// ---------------------------------------------------------------------------

const SCHEMA_SQL = `
  PRAGMA journal_mode = WAL;
  PRAGMA synchronous = NORMAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS block_headers (
    height INTEGER PRIMARY KEY,
    hash TEXT UNIQUE NOT NULL,
    prev_hash TEXT NOT NULL,
    merkle_root TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    bits INTEGER NOT NULL,
    nonce INTEGER NOT NULL,
    version INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS transactions (
    txid TEXT PRIMARY KEY,
    raw_hex TEXT NOT NULL,
    block_height INTEGER NOT NULL,
    block_hash TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    fee INTEGER NOT NULL,
    confirmed INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS utxos (
    txid TEXT NOT NULL,
    vout INTEGER NOT NULL,
    address TEXT NOT NULL,
    value TEXT NOT NULL,
    script_pub_key TEXT NOT NULL,
    spent INTEGER DEFAULT 0,
    block_height INTEGER NOT NULL,
    PRIMARY KEY (txid, vout)
  );

  CREATE TABLE IF NOT EXISTS addresses (
    address TEXT PRIMARY KEY,
    path TEXT NOT NULL,
    index_num INTEGER NOT NULL,
    is_change INTEGER DEFAULT 0,
    used INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS peers (
    host TEXT PRIMARY KEY,
    port INTEGER NOT NULL,
    last_seen INTEGER NOT NULL,
    last_success INTEGER NOT NULL,
    services INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS contacts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    address TEXT NOT NULL,
    notes TEXT DEFAULT '',
    emoji TEXT DEFAULT '👤',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS tx_notes (
    txid TEXT PRIMARY KEY,
    note TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS address_labels (
    address TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS recent_recipients (
    address TEXT PRIMARY KEY,
    last_used INTEGER NOT NULL,
    use_count INTEGER DEFAULT 1
  );

  CREATE INDEX IF NOT EXISTS idx_block_headers_hash ON block_headers(hash);
  CREATE INDEX IF NOT EXISTS idx_utxos_address ON utxos(address);
  CREATE INDEX IF NOT EXISTS idx_utxos_unspent ON utxos(spent, address);
  CREATE INDEX IF NOT EXISTS idx_transactions_block_height ON transactions(block_height);
  CREATE INDEX IF NOT EXISTS idx_transactions_timestamp ON transactions(timestamp);
  CREATE INDEX IF NOT EXISTS idx_addresses_change_used ON addresses(is_change, used);
  CREATE INDEX IF NOT EXISTS idx_contacts_address ON contacts(address);
  CREATE INDEX IF NOT EXISTS idx_contacts_name ON contacts(name);
`;

// ---------------------------------------------------------------------------
// Database class
// ---------------------------------------------------------------------------

const DEFAULT_DATABASE_NAME = "fairwallet.db";

export class Database {
  private readonly db: SQLite.SQLiteDatabase;

  private constructor(db: SQLite.SQLiteDatabase) {
    this.db = db;
  }

  /**
   * Open a database. If a walletId is provided, the database file
   * is scoped to that wallet (fairwallet_{walletId}.db).
   */
  static async open(walletId?: string): Promise<Database> {
    const dbName = walletId
      ? `fairwallet_${walletId}.db`
      : DEFAULT_DATABASE_NAME;
    const db = await SQLite.openDatabaseAsync(dbName);
    const instance = new Database(db);
    await instance.initialize();
    return instance;
  }

  /**
   * Create all tables and indexes in a single batch.
   * Using execAsync with the full schema string is a single native call,
   * much faster than 16+ individual calls.
   */
  private async initialize(): Promise<void> {
    await this.db.execAsync(SCHEMA_SQL);
  }

  async close(): Promise<void> {
    await this.db.closeAsync();
  }

  /**
   * Run multiple writes atomically. If any statement fails,
   * all changes are rolled back.
   */
  async withTransaction(fn: () => Promise<void>): Promise<void> {
    await this.db.withTransactionAsync(fn);
  }

  // -----------------------------------------------------------------------
  // Block headers
  // -----------------------------------------------------------------------

  async insertHeader(header: BlockHeaderRow): Promise<void> {
    await this.db.runAsync(
      `INSERT OR REPLACE INTO block_headers
        (height, hash, prev_hash, merkle_root, timestamp, bits, nonce, version)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      header.height,
      header.hash,
      header.prev_hash,
      header.merkle_root,
      header.timestamp,
      header.bits,
      header.nonce,
      header.version,
    );
  }

  /**
   * Insert multiple headers in a single transaction.
   * Critical for SPV sync performance where thousands of headers
   * arrive in rapid succession.
   */
  async insertHeadersBatch(headers: BlockHeaderRow[]): Promise<void> {
    if (headers.length === 0) return;
    await this.db.withTransactionAsync(async () => {
      const stmt = await this.db.prepareAsync(
        `INSERT OR REPLACE INTO block_headers
          (height, hash, prev_hash, merkle_root, timestamp, bits, nonce, version)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      );
      try {
        for (const h of headers) {
          await stmt.executeAsync(
            h.height,
            h.hash,
            h.prev_hash,
            h.merkle_root,
            h.timestamp,
            h.bits,
            h.nonce,
            h.version,
          );
        }
      } finally {
        await stmt.finalizeAsync();
      }
    });
  }

  async getLatestHeader(): Promise<BlockHeaderRow | null> {
    const row = await this.db.getFirstAsync<BlockHeaderRow>(
      "SELECT * FROM block_headers ORDER BY height DESC LIMIT 1",
    );
    return row ?? null;
  }

  async getHeaderByHeight(height: number): Promise<BlockHeaderRow | null> {
    const row = await this.db.getFirstAsync<BlockHeaderRow>(
      "SELECT * FROM block_headers WHERE height = ?",
      height,
    );
    return row ?? null;
  }

  async getHeaderByHash(hash: string): Promise<BlockHeaderRow | null> {
    const row = await this.db.getFirstAsync<BlockHeaderRow>(
      "SELECT * FROM block_headers WHERE hash = ?",
      hash,
    );
    return row ?? null;
  }

  async getHeaderCount(): Promise<number> {
    const row = await this.db.getFirstAsync<{ count: number }>(
      "SELECT COUNT(*) as count FROM block_headers",
    );
    return row?.count ?? 0;
  }

  // -----------------------------------------------------------------------
  // Transactions
  // -----------------------------------------------------------------------

  async insertTransaction(tx: TransactionRow): Promise<void> {
    await this.db.runAsync(
      `INSERT OR REPLACE INTO transactions
        (txid, raw_hex, block_height, block_hash, timestamp, fee, confirmed)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      tx.txid,
      tx.raw_hex,
      tx.block_height,
      tx.block_hash,
      tx.timestamp,
      tx.fee,
      tx.confirmed,
    );
  }

  async getTransaction(txid: string): Promise<TransactionRow | null> {
    const row = await this.db.getFirstAsync<TransactionRow>(
      "SELECT * FROM transactions WHERE txid = ?",
      txid,
    );
    return row ?? null;
  }

  async getTransactions(
    limit: number,
    offset: number,
  ): Promise<TransactionRow[]> {
    return this.db.getAllAsync<TransactionRow>(
      "SELECT * FROM transactions ORDER BY timestamp DESC LIMIT ? OFFSET ?",
      limit,
      offset,
    );
  }

  /**
   * Find transactions related to an address (both sends and receives).
   * Checks both UTXO outputs (received) and inputs (spent from this address).
   */
  async getTransactionsForAddress(address: string): Promise<TransactionRow[]> {
    return this.db.getAllAsync<TransactionRow>(
      `SELECT DISTINCT t.* FROM transactions t
       WHERE t.txid IN (
         SELECT txid FROM utxos WHERE address = ?
       )
       ORDER BY t.timestamp DESC`,
      address,
    );
  }

  async updateTransactionConfirmation(
    txid: string,
    blockHeight: number,
    blockHash: string,
    confirmed: number,
  ): Promise<void> {
    await this.db.runAsync(
      `UPDATE transactions SET block_height = ?, block_hash = ?, confirmed = ?
       WHERE txid = ?`,
      blockHeight,
      blockHash,
      confirmed,
      txid,
    );
  }

  // -----------------------------------------------------------------------
  // UTXOs
  // -----------------------------------------------------------------------

  async insertUTXO(utxo: {
    txid: string;
    vout: number;
    address: string;
    value: bigint | string;
    script_pub_key: string;
    spent?: number;
    block_height: number;
  }): Promise<void> {
    await this.db.runAsync(
      `INSERT OR REPLACE INTO utxos
        (txid, vout, address, value, script_pub_key, spent, block_height)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      utxo.txid,
      utxo.vout,
      utxo.address,
      String(utxo.value),
      utxo.script_pub_key,
      utxo.spent ?? 0,
      utxo.block_height,
    );
  }

  async markUTXOSpent(txid: string, vout: number): Promise<void> {
    await this.db.runAsync(
      "UPDATE utxos SET spent = 1 WHERE txid = ? AND vout = ?",
      txid,
      vout,
    );
  }

  async getUnspentUTXOs(): Promise<UTXORow[]> {
    return this.db.getAllAsync<UTXORow>(
      "SELECT * FROM utxos WHERE spent = 0",
    );
  }

  async getUnspentUTXOsForAddress(address: string): Promise<UTXORow[]> {
    return this.db.getAllAsync<UTXORow>(
      "SELECT * FROM utxos WHERE spent = 0 AND address = ?",
      address,
    );
  }

  async getUTXOCount(): Promise<{ total: number; unspent: number }> {
    const total = await this.db.getFirstAsync<{ count: number }>(
      "SELECT COUNT(*) as count FROM utxos",
    );
    const unspent = await this.db.getFirstAsync<{ count: number }>(
      "SELECT COUNT(*) as count FROM utxos WHERE spent = 0",
    );
    return {
      total: total?.count ?? 0,
      unspent: unspent?.count ?? 0,
    };
  }

  // -----------------------------------------------------------------------
  // Addresses
  // -----------------------------------------------------------------------

  async insertAddress(
    address: string,
    path: string,
    index: number,
    isChange: boolean,
  ): Promise<void> {
    await this.db.runAsync(
      `INSERT OR IGNORE INTO addresses
        (address, path, index_num, is_change, used)
       VALUES (?, ?, ?, ?, 0)`,
      address,
      path,
      index,
      isChange ? 1 : 0,
    );
  }

  async getAddresses(): Promise<AddressRow[]> {
    return this.db.getAllAsync<AddressRow>(
      "SELECT * FROM addresses ORDER BY is_change, index_num",
    );
  }

  async getUnusedAddress(isChange: boolean): Promise<AddressRow | null> {
    const row = await this.db.getFirstAsync<AddressRow>(
      "SELECT * FROM addresses WHERE is_change = ? AND used = 0 ORDER BY index_num ASC LIMIT 1",
      isChange ? 1 : 0,
    );
    return row ?? null;
  }

  async markAddressUsed(address: string): Promise<void> {
    await this.db.runAsync(
      "UPDATE addresses SET used = 1 WHERE address = ?",
      address,
    );
  }

  // -----------------------------------------------------------------------
  // Peers
  // -----------------------------------------------------------------------

  async insertPeer(
    host: string,
    port: number,
    services: number,
  ): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    await this.db.runAsync(
      `INSERT OR REPLACE INTO peers
        (host, port, last_seen, last_success, services)
       VALUES (?, ?, ?, ?, ?)`,
      host,
      port,
      now,
      now,
      services,
    );
  }

  async getKnownPeers(limit: number): Promise<PeerRow[]> {
    return this.db.getAllAsync<PeerRow>(
      "SELECT * FROM peers ORDER BY last_success DESC LIMIT ?",
      limit,
    );
  }

  // -----------------------------------------------------------------------
  // Contacts
  // -----------------------------------------------------------------------

  async insertContact(
    id: string,
    name: string,
    address: string,
    notes: string,
    emoji: string,
  ): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    await this.db.runAsync(
      `INSERT INTO contacts (id, name, address, notes, emoji, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      id,
      name,
      address,
      notes,
      emoji,
      now,
      now,
    );
  }

  async updateContact(
    id: string,
    name: string,
    address: string,
    notes: string,
    emoji: string,
  ): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    await this.db.runAsync(
      `UPDATE contacts SET name = ?, address = ?, notes = ?, emoji = ?, updated_at = ?
       WHERE id = ?`,
      name,
      address,
      notes,
      emoji,
      now,
      id,
    );
  }

  async deleteContact(id: string): Promise<void> {
    await this.db.runAsync("DELETE FROM contacts WHERE id = ?", id);
  }

  async getContacts(): Promise<ContactRow[]> {
    return this.db.getAllAsync<ContactRow>(
      "SELECT * FROM contacts ORDER BY name ASC",
    );
  }

  async getContactByAddress(address: string): Promise<ContactRow | null> {
    const row = await this.db.getFirstAsync<ContactRow>(
      "SELECT * FROM contacts WHERE address = ? LIMIT 1",
      address,
    );
    return row ?? null;
  }

  /**
   * Search contacts by name or address.
   * Escapes LIKE wildcards in user input to prevent unintended matches.
   */
  async searchContacts(query: string): Promise<ContactRow[]> {
    const escaped = query.replace(/[%_]/g, "\\$&");
    const pattern = `%${escaped}%`;
    return this.db.getAllAsync<ContactRow>(
      "SELECT * FROM contacts WHERE name LIKE ? ESCAPE '\\' OR address LIKE ? ESCAPE '\\' ORDER BY name ASC",
      pattern,
      pattern,
    );
  }

  // -----------------------------------------------------------------------
  // Transaction notes
  // -----------------------------------------------------------------------

  async setTxNote(txid: string, note: string): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    await this.db.runAsync(
      `INSERT OR REPLACE INTO tx_notes (txid, note, updated_at)
       VALUES (?, ?, ?)`,
      txid,
      note,
      now,
    );
  }

  async getTxNote(txid: string): Promise<string | null> {
    const row = await this.db.getFirstAsync<TxNoteRow>(
      "SELECT * FROM tx_notes WHERE txid = ?",
      txid,
    );
    return row?.note ?? null;
  }

  // -----------------------------------------------------------------------
  // Address labels
  // -----------------------------------------------------------------------

  async setAddressLabel(address: string, label: string): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    await this.db.runAsync(
      `INSERT OR REPLACE INTO address_labels (address, label, updated_at)
       VALUES (?, ?, ?)`,
      address,
      label,
      now,
    );
  }

  async getAddressLabel(address: string): Promise<string | null> {
    const row = await this.db.getFirstAsync<AddressLabelRow>(
      "SELECT * FROM address_labels WHERE address = ?",
      address,
    );
    return row?.label ?? null;
  }

  // -----------------------------------------------------------------------
  // Recent recipients
  // -----------------------------------------------------------------------

  async addRecentRecipient(address: string): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    await this.db.runAsync(
      `INSERT INTO recent_recipients (address, last_used, use_count)
       VALUES (?, ?, 1)
       ON CONFLICT(address) DO UPDATE SET
         last_used = ?,
         use_count = use_count + 1`,
      address,
      now,
      now,
    );
  }

  async getRecentRecipients(limit: number): Promise<RecentRecipientRow[]> {
    return this.db.getAllAsync<RecentRecipientRow>(
      "SELECT * FROM recent_recipients ORDER BY last_used DESC LIMIT ?",
      limit,
    );
  }
}
