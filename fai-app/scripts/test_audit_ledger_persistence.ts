/**
 * Test Suite: Audit Ledger SQLite Persistence (Restart Survival)
 *
 * Before this hardening pass, the audit ledger was an in-memory array only — it vanished on
 * app restart or crash, which defeats the point of a "tamper-evident compliance record." This
 * test simulates a restart by closing the DB connection and opening a fresh one against the
 * same file, the same way the app would on the next launch, and confirms the chain survives.
 */
import fs from 'fs';
import path from 'path';
import os from 'os';
import { DBManager } from '../electron/database.ts';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion Failed: ${message}`);
  }
}

console.log('--- TEST: Audit Ledger SQLite Persistence (Restart Survival) ---');

const tmpDbPath = path.join(os.tmpdir(), `loonist_audit_persistence_test_${Date.now()}.db`);

try {
  // 1. Simulate a work session: open the DB, append entries, close it (app exit / crash).
  const session1 = new DBManager(tmpDbPath);
  const e1 = session1.appendAuditEvent('MEASUREMENT_LOGGED', { newValue: 1.2504 }, 'char-1', 1, 'QC-7');
  const e2 = session1.appendAuditEvent('MEASUREMENT_LOGGED', { newValue: 0.508 }, 'char-2', 2, 'QC-7');
  assert(e1.seq === 1, 'First persisted entry must have seq 1');
  assert(e2.previousHash === e1.hash, 'Second entry must chain to the first entry\'s hash');
  session1.close();
  console.log('✓ Session 1: 2 audit entries written and connection closed (simulates app exit)');

  // 2. Simulate the next app launch: a brand new DBManager instance against the same file path.
  const session2 = new DBManager(tmpDbPath);
  const persisted = session2.getAuditEvents();
  assert(persisted.length === 2, `Expected 2 entries to survive restart, found ${persisted.length}`);
  assert(persisted[0].id === e1.id && persisted[1].id === e2.id, 'Persisted entries must match what was written in the prior session, in order');
  console.log('✓ Session 2 (simulated restart): both entries are still present on disk, in order');

  // 3. The chain must still verify as intact after the "restart".
  const chainCheck = session2.verifyAuditChain();
  assert(chainCheck.isValid === true, `Expected chain to remain valid after restart, got broken at seq ${chainCheck.brokenSequence}`);
  console.log('✓ Hash chain verifies intact after restart');

  // 4. A third session appends more entries — chain must continue from where it left off, not reset.
  const e3 = session2.appendAuditEvent('CHARACTERISTIC_DELETED', { details: 'removed duplicate row' }, 'char-3', 3, 'QC-7');
  assert(e3.seq === 3, `Third entry across two sessions must have seq 3, got ${e3.seq}`);
  assert(e3.previousHash === e2.hash, 'Chain must continue from the last persisted entry across the simulated restart, not reset to genesis');
  console.log('✓ Chain continues correctly across the simulated restart (no reset to genesis)');

  session2.close();
  console.log('>>> AUDIT LEDGER PERSISTENCE TEST PASSED! <<<');
} finally {
  if (fs.existsSync(tmpDbPath)) fs.unlinkSync(tmpDbPath);
  for (const suffix of ['-wal', '-shm']) {
    if (fs.existsSync(tmpDbPath + suffix)) fs.unlinkSync(tmpDbPath + suffix);
  }
}
