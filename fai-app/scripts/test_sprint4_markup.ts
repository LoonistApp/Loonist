import { RenumberingService } from '../src/services/ballooning/renumberingService.ts';
import type { EngineeringCharacteristic } from '../src/types/characteristics.ts';

function createDummyChar(id: string, itemNumber: number, subNumber?: string, sheetNumber: number = 1): EngineeringCharacteristic {
  return {
    id,
    itemNumber,
    subNumber,
    sheetNumber,
    drawingZone: 'Zone A-1',
    type: 'linear',
    displayType: 'Dimension',
    subType: 'Linear Dimension',
    classification: 'Minor',
    enclosure: 'standard',
    rawText: `1.000 (Char ${id})`,
    cleanNominal: 1.0,
    upperTol: 0.005,
    lowerTol: 0.005,
    minLimit: 0.995,
    maxLimit: 1.005,
    plusTol: 0.005,
    minusTol: -0.005,
    upperLimit: 1.005,
    lowerLimit: 0.995,
    units: 'in',
    isToleranceInherited: false,
    toleranceSource: 'Direct',
    quantity: 1,
    inspectionMethod: 'Caliper',
    confidenceScore: 1.0,
    verificationStatus: 'auto_accepted',
    isBasic: false,
    forReference: false,
    sourceCaptureOrSheet: 'Sheet 1',
    boundingBox: { x: 100, y: 100, width: 50, height: 20 }
  };
}

function runTests() {
  console.log('=== Running Sprint 4 Markup & Renumbering Tests ===\n');

  // Test 1: Simple Sequential Cascade Renumbering
  console.log('Test 1: Simple sequence delete #3 from [1, 2, 3, 4, 5]');
  const chars1 = [
    createDummyChar('c1', 1),
    createDummyChar('c2', 2),
    createDummyChar('c3', 3),
    createDummyChar('c4', 4),
    createDummyChar('c5', 5)
  ];
  const res1 = RenumberingService.deleteAndRenumber(chars1, 'c3');
  const items1 = res1.map(c => c.itemNumber);
  console.log('  Result item numbers:', items1);
  if (JSON.stringify(items1) === JSON.stringify([1, 2, 3, 4])) {
    console.log('  [PASS] Successfully cascaded #4->#3 and #5->#4.\n');
  } else {
    console.error('  [FAIL] Expected [1, 2, 3, 4], got:', items1);
    process.exit(1);
  }

  // Test 2: Multiplier sub-number preservation across renumbering
  console.log('Test 2: Sequence with multipliers [1, 2, 3.1, 3.2, 4], delete #2');
  const chars2 = [
    createDummyChar('c1', 1),
    createDummyChar('c2', 2),
    createDummyChar('c3a', 3, '3.1'),
    createDummyChar('c3b', 3, '3.2'),
    createDummyChar('c4', 4)
  ];
  const res2 = RenumberingService.deleteAndRenumber(chars2, 'c2');
  const display2 = res2.map(c => c.subNumber || String(c.itemNumber));
  console.log('  Result display numbers:', display2);
  if (JSON.stringify(display2) === JSON.stringify(['1', '2.1', '2.2', '3'])) {
    console.log('  [PASS] Preserved and re-indexed sub-multipliers to 2.1, 2.2.\n');
  } else {
    console.error('  [FAIL] Expected [1, 2.1, 2.2, 3], got:', display2);
    process.exit(1);
  }

  // Test 3: Multiplier group collapses to single item when other sub-items removed
  console.log('Test 3: Delete sub-item 3.2 from [1, 2, 3.1, 3.2, 4]');
  const chars3 = [
    createDummyChar('c1', 1),
    createDummyChar('c2', 2),
    createDummyChar('c3a', 3, '3.1'),
    createDummyChar('c3b', 3, '3.2'),
    createDummyChar('c4', 4)
  ];
  const res3 = RenumberingService.deleteAndRenumber(chars3, 'c3b');
  const display3 = res3.map(c => c.subNumber || String(c.itemNumber));
  console.log('  Result display numbers:', display3);
  if (JSON.stringify(display3) === JSON.stringify(['1', '2', '3', '4'])) {
    console.log('  [PASS] Single remaining sub-item cleanly collapsed back to standard integer balloon #3.\n');
  } else {
    console.error('  [FAIL] Expected [1, 2, 3, 4], got:', display3);
    process.exit(1);
  }

  // Test 4: Cross-sheet item-number collision must NOT be merged into one compound group.
  // Regression for a real bug: per-sheet extraction numbered Sheet 3 starting from 1 *after*
  // Sheet 2 (also 1-12) already existed, because the continuation logic only looked at sheets
  // with a LOWER number. cascadeRenumber is the recovery path — it must treat two
  // characteristics that merely share an old itemNumber on DIFFERENT sheets as unrelated, not
  // as one compound sub-item family (which can only ever span a single sheet).
  console.log('Test 4: Cross-sheet item-number collision (Sheet 2 items 1-3, Sheet 3 items 1-2, both colliding on old #1-2)');
  const chars4 = [
    createDummyChar('s2-1', 1, undefined, 2),
    createDummyChar('s2-2', 2, undefined, 2),
    createDummyChar('s2-3', 3, undefined, 2),
    createDummyChar('s3-1', 1, undefined, 3),
    createDummyChar('s3-2', 2, undefined, 3)
  ];
  const res4 = RenumberingService.cascadeRenumber(chars4);
  const items4 = res4.map(c => `S${c.sheetNumber}#${c.itemNumber}`);
  console.log('  Result:', items4);
  const expected4 = ['S2#1', 'S2#2', 'S2#3', 'S3#4', 'S3#5'];
  if (JSON.stringify(items4) === JSON.stringify(expected4)) {
    console.log('  [PASS] Sheet 3 items correctly got fresh numbers 4-5, not merged into Sheet 2\'s 1-2.\n');
  } else {
    console.error('  [FAIL] Expected', expected4, ', got:', items4);
    process.exit(1);
  }

  console.log('=== All Sprint 4 Phase 1 Renumbering Tests PASSED! ===');
}

runTests();
