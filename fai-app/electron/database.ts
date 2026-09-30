import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export interface AuditLedgerEntry {
  id: string;
  seq: number;
  timestamp: string;
  action: string;
  charId?: string;
  itemNumber?: string | number;
  details: Record<string, any>;
  inspector: string;
  previousHash: string;
  hash: string;
}

export class DBManager {
  private db: Database.Database;

  constructor(dbPath: string) {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    this.db = new Database(dbPath);
    this.initialize();
  }

  private initialize() {
    // PRAGMAs for performance, reliability, and concurrency
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.db.pragma('busy_timeout = 5000');

    // Create Schema
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS Project (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS Drawing (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        file_hash TEXT NOT NULL,
        FOREIGN KEY (project_id) REFERENCES Project(id)
      );

      CREATE TABLE IF NOT EXISTS Feature (
        id TEXT PRIMARY KEY,
        drawing_id TEXT NOT NULL,
        nominal_value TEXT,
        tolerance TEXT,
        FOREIGN KEY (drawing_id) REFERENCES Drawing(id)
      );

      CREATE TABLE IF NOT EXISTS Balloon (
        id TEXT PRIMARY KEY,
        feature_id TEXT NOT NULL,
        number INTEGER NOT NULL,
        x REAL NOT NULL,
        y REAL NOT NULL,
        FOREIGN KEY (feature_id) REFERENCES Feature(id)
      );

      CREATE TABLE IF NOT EXISTS AuditEvent (
        seq INTEGER PRIMARY KEY AUTOINCREMENT,
        id TEXT NOT NULL UNIQUE,
        timestamp TEXT NOT NULL,
        action TEXT NOT NULL,
        char_id TEXT,
        item_number TEXT,
        details TEXT,
        inspector TEXT NOT NULL,
        previous_hash TEXT NOT NULL,
        hash TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS TransactionHistory (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        action_group_id TEXT NOT NULL,
        forward_query TEXT NOT NULL,
        forward_params TEXT NOT NULL,
        reverse_query TEXT NOT NULL,
        reverse_params TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        is_undone INTEGER DEFAULT 0
      );
    `);
  }

  /**
   * Robust transaction wrapper utilizing BEGIN...COMMIT
   * Reverts on error, preserving database integrity.
   */
  public executeTransaction<T>(callback: () => T): T {
    const transaction = this.db.transaction(callback);
    return transaction();
  }

  /**
   * Executes a set of actions with history tracking for Undo/Redo.
   * Wraps everything in a secure BEGIN/COMMIT block.
   */
  public executeWithHistory(
    actionGroupId: string,
    actions: { forwardQuery: string; forwardParams: any[]; reverseQuery: string; reverseParams: any[] }[]
  ): void {
    this.executeTransaction(() => {
      for (const action of actions) {
        // Execute the forward query
        this.db.prepare(action.forwardQuery).run(...action.forwardParams);
        
        // Log the history for undo/redo
        this.db.prepare(`
          INSERT INTO TransactionHistory (action_group_id, forward_query, forward_params, reverse_query, reverse_params)
          VALUES (?, ?, ?, ?, ?)
        `).run(
          actionGroupId,
          action.forwardQuery,
          JSON.stringify(action.forwardParams),
          action.reverseQuery,
          JSON.stringify(action.reverseParams)
        );
      }
      // Any new action clears the redo history (is_undone = 1) for this project/session
      this.db.prepare('DELETE FROM TransactionHistory WHERE is_undone = 1').run();
    });
  }

  /**
   * Undoes the last action group.
   */
  public undo(): boolean {
    return this.executeTransaction(() => {
      // Find the most recent action group that hasn't been undone
      const lastAction = this.db.prepare(`
        SELECT action_group_id FROM TransactionHistory WHERE is_undone = 0 ORDER BY id DESC LIMIT 1
      `).get() as { action_group_id: string } | undefined;

      if (!lastAction) return false; // Nothing to undo

      // Get all operations in this action group, in reverse order
      const operations = this.db.prepare(`
        SELECT * FROM TransactionHistory WHERE action_group_id = ? AND is_undone = 0 ORDER BY id DESC
      `).all(lastAction.action_group_id) as any[];

      for (const op of operations) {
        // Execute the reverse query
        this.db.prepare(op.reverse_query).run(...JSON.parse(op.reverse_params));
      }

      // Mark the group as undone
      this.db.prepare(`
        UPDATE TransactionHistory SET is_undone = 1 WHERE action_group_id = ?
      `).run(lastAction.action_group_id);

      return true;
    });
  }

  /**
   * Redoes the last undone action group.
   */
  public redo(): boolean {
    return this.executeTransaction(() => {
      // Find the oldest action group that has been undone
      const lastUndone = this.db.prepare(`
        SELECT action_group_id FROM TransactionHistory WHERE is_undone = 1 ORDER BY id ASC LIMIT 1
      `).get() as { action_group_id: string } | undefined;

      if (!lastUndone) return false; // Nothing to redo

      // Get all operations in this action group, in forward order
      const operations = this.db.prepare(`
        SELECT * FROM TransactionHistory WHERE action_group_id = ? AND is_undone = 1 ORDER BY id ASC
      `).all(lastUndone.action_group_id) as any[];

      for (const op of operations) {
        // Execute the forward query
        this.db.prepare(op.forward_query).run(...JSON.parse(op.forward_params));
      }

      // Mark the group as done
      this.db.prepare(`
        UPDATE TransactionHistory SET is_undone = 0 WHERE action_group_id = ?
      `).run(lastUndone.action_group_id);

      return true;
    });
  }

  private static readonly AUDIT_GENESIS_HASH = '0000000000000000000000000000000000000000000000000000000000000000';

  /**
   * Appends a tamper-evident audit entry, chained to the previous entry's hash.
   * The main process is the sole authority for this chain: hashes are computed
   * here (trusted, using Node's real crypto module) and persisted immediately,
   * never trusted from the renderer.
   */
  public appendAuditEvent(
    action: string,
    details: Record<string, any>,
    charId: string | undefined,
    itemNumber: string | number | undefined,
    inspector: string
  ): AuditLedgerEntry {
    return this.executeTransaction(() => {
      const last = this.db.prepare(
        `SELECT hash FROM AuditEvent ORDER BY seq DESC LIMIT 1`
      ).get() as { hash: string } | undefined;
      const previousHash = last?.hash || DBManager.AUDIT_GENESIS_HASH;

      const id = `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const timestamp = new Date().toISOString();
      const detailsJson = JSON.stringify(details ?? {});

      // Payload/hash format intentionally mirrors the prior renderer-side implementation
      // so historical verification logic and tests stay meaningful.
      const payload = `${id}|${timestamp}|${action}|${charId || ''}|${detailsJson}|${inspector}|${previousHash}`;
      const hash = crypto.createHash('sha256').update(payload, 'utf-8').digest('hex');

      this.db.prepare(`
        INSERT INTO AuditEvent (id, timestamp, action, char_id, item_number, details, inspector, previous_hash, hash)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, timestamp, action, charId ?? null, itemNumber !== undefined ? String(itemNumber) : null, detailsJson, inspector, previousHash, hash);

      const row = this.db.prepare(`SELECT seq FROM AuditEvent WHERE id = ?`).get(id) as { seq: number };

      return {
        id,
        seq: row.seq,
        timestamp,
        action,
        charId,
        itemNumber,
        details,
        inspector,
        previousHash,
        hash
      };
    });
  }

  public getAuditEvents(): AuditLedgerEntry[] {
    const rows = this.db.prepare(`SELECT * FROM AuditEvent ORDER BY seq ASC`).all() as any[];
    return rows.map((r) => ({
      id: r.id,
      seq: r.seq,
      timestamp: r.timestamp,
      action: r.action,
      charId: r.char_id ?? undefined,
      itemNumber: r.item_number ?? undefined,
      details: r.details ? JSON.parse(r.details) : {},
      inspector: r.inspector,
      previousHash: r.previous_hash,
      hash: r.hash
    }));
  }

  /**
   * Re-walks the persisted chain and recomputes every hash to detect tampering
   * (e.g. a row edited directly in the SQLite file, bypassing appendAuditEvent).
   */
  public verifyAuditChain(): { isValid: boolean; brokenSequence?: number } {
    const entries = this.getAuditEvents();
    let prev = DBManager.AUDIT_GENESIS_HASH;

    for (const entry of entries) {
      if (entry.previousHash !== prev) {
        return { isValid: false, brokenSequence: entry.seq };
      }
      const payload = `${entry.id}|${entry.timestamp}|${entry.action}|${entry.charId || ''}|${JSON.stringify(entry.details)}|${entry.inspector}|${entry.previousHash}`;
      const recomputed = crypto.createHash('sha256').update(payload, 'utf-8').digest('hex');
      if (recomputed !== entry.hash) {
        return { isValid: false, brokenSequence: entry.seq };
      }
      prev = entry.hash;
    }

    return { isValid: true };
  }

  public close() {
    this.db.close();
  }
}

