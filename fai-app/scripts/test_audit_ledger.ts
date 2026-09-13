/**
 * Test Suite: Tamper-Evident Cryptographic SHA-256 Audit Ledger (SAE AS9102 Rev C Traceability)
 */
import { AuditLedgerService } from '../src/services/compliance/auditLedgerService';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion Failed: ${message}`);
  }
}

console.log('--- TEST: Tamper-Evident SHA-256 Audit Ledger ---');

// 1. Record series of inspection audit events
const e1 = AuditLedgerService.recordEntry({
  characteristicId: 'char-1',
  itemNumber: 1,
  action: 'MEASUREMENT_RECORDED',
  inspectorInitials: 'QC-1',
  previousValue: null,
  newValue: 1.2504,
  conformanceStatus: 'PASS',
  details: 'Initial physical measurement recorded'
});

assert(e1.sequence === 1, 'First block sequence must be 1');
assert(e1.previousHash === '0000000000000000000000000000000000000000000000000000000000000000', 'Genesis previousHash must be 64 zeroes');
assert(e1.hash.length === 64, 'Hash must be 64-character hex string');
console.log('✓ Genesis block created with zero-padded root hash');

const e2 = AuditLedgerService.recordEntry({
  characteristicId: 'char-2',
  itemNumber: 2,
  action: 'MEASUREMENT_RECORDED',
  inspectorInitials: 'QC-1',
  previousValue: null,
  newValue: 0.508,
  conformanceStatus: 'MARGINAL',
  details: 'Measurement recorded within 10% tolerance boundary'
});

assert(e2.sequence === 2, 'Second block sequence must be 2');
assert(e2.previousHash === e1.hash, 'Block 2 previousHash must link to Block 1 hash');
console.log('✓ Hash chaining verified: Block 2 correctly seals Block 1');

const e3 = AuditLedgerService.recordEntry({
  characteristicId: 'char-3',
  itemNumber: 3,
  action: 'LIMITS_MODIFIED',
  inspectorInitials: 'QE-LEAD',
  previousValue: '±0.005',
  newValue: '±0.010',
  details: 'Drawing engineering revision delta applied'
});

assert(e3.sequence === 3, 'Third block sequence must be 3');
assert(e3.previousHash === e2.hash, 'Block 3 previousHash must link to Block 2 hash');
console.log('✓ Block 3 hash chaining verified');

// 2. Verify complete chain integrity
const integrityCheck = AuditLedgerService.verifyIntegrity();
assert(integrityCheck.isValid === true, `Expected ledger to be valid, got broken at ${integrityCheck.brokenSequence}`);
console.log(`✓ Ledger cryptographic integrity verified across ${AuditLedgerService.getEntries().length} chained entries`);

// 3. Test Tamper Detection
const entries = AuditLedgerService.getEntries();
// Maliciously modify recorded measurement in entry #2
entries[1].details.newValue = 1.9999;
const tamperCheck = AuditLedgerService.verifyIntegrity();
assert(tamperCheck.isValid === false, 'Ledger MUST detect data tampering');
assert(tamperCheck.brokenSequence === 2, `Tamper should be detected at sequence 2, got ${tamperCheck.brokenSequence}`);
console.log(`✓ Tamper detection verified! Corrupted entry sequence #${tamperCheck.brokenSequence} flagged immediately`);

console.log('>>> ALL AUDIT LEDGER TESTS PASSED! <<<');
