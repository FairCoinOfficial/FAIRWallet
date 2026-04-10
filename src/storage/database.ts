/**
 * SQLite database layer for FairCoin wallet persistent storage.
 * Uses expo-sqlite for cross-platform database access.
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

export interface UTXORow {
  txid: string;
  vout: number;
  address: string;
  value: number;
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

// ---------------------------------------------------------------------------
// SQL statements
// ---------------------------------------------------------------------------

const CREATE_BLOCK_HEADERS = `
  CREATE TABLE IF NOT EXISTS block_headers (
    height INTEGER PRIMARY KEY,
    hash TEXT UNIQUE NOT NULL,
    prev_hash TEXT NOT NULL,
    merkle_root TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    bits INTEGER NOT NULL,
    nonce INTEGER NOT NULL,
    version INTEGER NOT NULL
  )
`;

const CREATE_TRANSACTIONS = `
  CREATE TABLE IF NOT EXISTS transactions (
    txid TEXT PRIMARY KEY,
    raw_hex TEXT NOT NULL,
    block_height INTEGER NOT NULL,
    block_hash TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    fee INTEGER NOT NULL,
    confirmed INTEGER DEFAULT 0
  )
`;

const CREATE_UTXOS = `
  CREATE TABLE IF NOT EXISTS utxos (
    txid TEXT NOT NULL,
    vout INTEGER NOT NULL,
    address TEXT NOT NULL,
    value INTEGER NOT NULL,
    script_pub_key TEXT NOT NULL,
    spent INTEGER DEFAULT 0,
    block_height INTEGER NOT NULL,
    PRIMARY KEY (txid, vout)
  )
`;

const CREATE_ADDRESSES = `
  CREATE TABLE IF NOT EXISTS addresses (
    address TEXT PRIMARY KEY,
    path TEXT NOT NULL,
    index_num INTEGER NOT NULL,
    is_change INTEGER DEFAULT 0,
    used INTEGER DEFAULT 0
  )
`;

const CREATE_PEERS = `
  CREATE TABLE IF NOT EXISTS peers (
    host TEXT PRIMARY KEY,
    port INTEGER NOT NULL,
    last_seen INTEGER NOT NULL,
    last_success INTEGER NOT NULL,
    services INTEGER NOT NULL
  )
`;

// Index for common queries
const CREATE_UTXO_ADDRESS_INDEX = `
  CREATE INDEX IF NOT EXISTS idx_utxos_address ON utxos (address)
`;

const CREATE_UTXO_SPENT_INDEX = `
  CREATE INDEX IF NOT EXISTS idx_utxos_spent ON utxos (spent)
`;

const CREATE_TX_BLOCK_HEIGHT_INDEX = `
  CREATE INDEX IF NOT EXISTS idx_transactions_block_height ON transactions (block_height)
`;

const CREATE_ADDRESSES_CHANGE_INDEX = `
  CREATE INDEX IF NOT EXISTS idx_addresses_is_change ON addresses (is_change, used)
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
   * Otherwise uses the default name (fairwallet.db).
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

  async initialize(): Promise<void> {
    await this.db.execAsync("PRAGMA journal_mode = WAL");
    await this.db.execAsync("PRAGMA foreign_keys = ON");
    await this.db.execAsync(CREATE_BLOCK_HEADERS);
    await this.db.execAsync(CREATE_TRANSACTIONS);
    await this.db.execAsync(CREATE_UTXOS);
    await this.db.execAsync(CREATE_ADDRESSES);
    await this.db.execAsync(CREATE_PEERS);
    await this.db.execAsync(CREATE_UTXO_ADDRESS_INDEX);
    await this.db.execAsync(CREATE_UTXO_SPENT_INDEX);
    await this.db.execAsync(CREATE_TX_BLOCK_HEIGHT_INDEX);
    await this.db.execAsync(CREATE_ADDRESSES_CHANGE_INDEX);
  }

  async close(): Promise<void> {
    await this.db.closeAsync();
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

  async getTransactionsForAddress(address: string): Promise<TransactionRow[]> {
    // Find transactions that reference UTXOs belonging to this address
    return this.db.getAllAsync<TransactionRow>(
      `SELECT DISTINCT t.* FROM transactions t
       INNER JOIN utxos u ON u.txid = t.txid
       WHERE u.address = ?
       ORDER BY t.timestamp DESC`,
      address,
    );
  }

  // -----------------------------------------------------------------------
  // UTXOs
  // -----------------------------------------------------------------------

  async insertUTXO(utxo: UTXORow): Promise<void> {
    await this.db.runAsync(
      `INSERT OR REPLACE INTO utxos
        (txid, vout, address, value, script_pub_key, spent, block_height)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      utxo.txid,
      utxo.vout,
      utxo.address,
      utxo.value,
      utxo.script_pub_key,
      utxo.spent,
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
}
