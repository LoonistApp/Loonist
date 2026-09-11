import Database from 'better-sqlite3';
import path from 'path';

export class DBManager {
  private db: Database.Database;

  constructor(dbPath: string) {
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
        id TEXT PRIMARY KEY,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        action TEXT NOT NULL,
        payload TEXT,
        previous_hash TEXT,
        hash TEXT
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

  public close() {
    this.db.close();
  }
}

