import assert from 'assert';
import { GdtParser } from '../src/services/ai/gdtParser';
import { DEFAULT_AEROSPACE_TOLERANCES } from '../src/types/characteristics';
import { DEFAULT_METRIC_ISO_TOLERANCES } from '../src/services/ai/toleranceEngine';

console.log('================================================================');
console.log('   ASME Y14.5 § 1.8.16 CHAMFER & AS9102 COMPLIANCE VERIFICATION');
console.log('================================================================\n');

// Test 1: User Blueprint Case - "3 X 45° CHAMFER"
console.log('► Test 1: "3 X 45° CHAMFER" linear depth vs angle...');
const res1 = GdtParser.parseCallout('3 X 45° CHAMFER', DEFAULT_AEROSPACE_TOLERANCES);
assert.strictEqual(res1.nominal, 3, 'Nominal must be depth 3 (not angle 45)');
assert.strictEqual(res1.multiplier, 1, 'Multiplier must be 1 (not 3)');
assert.strictEqual(res1.type, 'chamfer', 'Type must be chamfer');
assert.strictEqual(res1.upperTol, 0.03, 'Upper tolerance must inherit title block (.X = 0.03)');
assert.strictEqual(res1.lowerTol, 0.03, 'Lower tolerance must be positive magnitude 0.03');
assert.strictEqual(res1.minLimit, 2.97, 'Min limit must be 2.97');
assert.strictEqual(res1.maxLimit, 3.03, 'Max limit must be 3.03');
console.log('  PASS: Nominal = 3, Mul = 1, Type = chamfer, Limits = [2.97, 3.03]\n');

// Test 2: Angle first - "45° X 3"
console.log('► Test 2: Angle-first chamfer "45° X 3"...');
const res2 = GdtParser.parseCallout('45° X 3', DEFAULT_AEROSPACE_TOLERANCES);
assert.strictEqual(res2.nominal, 3);
assert.strictEqual(res2.multiplier, 1);
assert.strictEqual(res2.type, 'chamfer');
console.log('  PASS: Nominal = 3, Mul = 1, Type = chamfer\n');

// Test 3: Chamfer with quantity multiplier - "4X 3 X 45° CHAMFER"
console.log('► Test 3: Multiplied chamfer "4X 3 X 45° CHAMFER"...');
const res3 = GdtParser.parseCallout('4X 3 X 45° CHAMFER', DEFAULT_AEROSPACE_TOLERANCES);
assert.strictEqual(res3.nominal, 3, 'Nominal must be depth 3');
assert.strictEqual(res3.multiplier, 4, 'Multiplier must be 4');
assert.strictEqual(res3.type, 'chamfer');
console.log('  PASS: Nominal = 3, Mul = 4, Type = chamfer\n');

// Test 4: Decimal inch chamfer - ".060 X 45°"
console.log('► Test 4: Decimal inch chamfer ".060 X 45°"...');
const res4 = GdtParser.parseCallout('.060 X 45°', DEFAULT_AEROSPACE_TOLERANCES);
assert.strictEqual(res4.nominal, 0.06);
assert.strictEqual(res4.multiplier, 1);
assert.strictEqual(res4.type, 'chamfer');
console.log('  PASS: Nominal = 0.06, Mul = 1, Type = chamfer\n');

// Test 5: Metric ISO chamfer - "3 X 45° CHAMFER" in mm
console.log('► Test 5: Metric ISO chamfer with ISO 2768 tolerances...');
const res5 = GdtParser.parseCallout('3 X 45° CHAMFER', DEFAULT_METRIC_ISO_TOLERANCES);
assert.strictEqual(res5.nominal, 3);
assert.strictEqual(res5.units, 'mm');
assert.strictEqual(res5.upperTol, 0.1);
assert.strictEqual(res5.lowerTol, 0.1);
assert.strictEqual(res5.minLimit, 2.9);
assert.strictEqual(res5.maxLimit, 3.1);
console.log('  PASS: Metric nominal = 3 mm, limits = [2.9, 3.1] mm\n');

// Test 6: General drawing note chamfer - "ALL CHAMFERS = 0.5 X 45°"
console.log('► Test 6: Global drawing note chamfer "ALL CHAMFERS = 0.5 X 45°"...');
const res6 = GdtParser.parseCallout('ALL CHAMFERS = 0.5 X 45°', DEFAULT_METRIC_ISO_TOLERANCES);
assert.strictEqual(res6.nominal, 0.5);
assert.strictEqual(res6.type, 'chamfer');
console.log('  PASS: Nominal = 0.5, Type = chamfer\n');

// Test 7: Non-chamfer hole with multiplier - "4X Ø10.5"
console.log('► Test 7: Multiplied diameter "4X Ø10.5" must NOT be treated as chamfer...');
const res7 = GdtParser.parseCallout('4X Ø10.5', DEFAULT_METRIC_ISO_TOLERANCES);
assert.strictEqual(res7.nominal, 10.5);
assert.strictEqual(res7.multiplier, 4);
assert.strictEqual(res7.type, 'diameter');
console.log('  PASS: Nominal = 10.5, Mul = 4, Type = diameter\n');

// Test 8: Non-chamfer linear with multiplier - "4X 1.500"
console.log('► Test 8: Multiplied linear "4X 1.500" must NOT be treated as chamfer...');
const res8 = GdtParser.parseCallout('4X 1.500', DEFAULT_AEROSPACE_TOLERANCES);
assert.strictEqual(res8.nominal, 1.5);
assert.strictEqual(res8.multiplier, 4);
assert.strictEqual(res8.type, 'linear');
console.log('  PASS: Nominal = 1.5, Mul = 4, Type = linear\n');

console.log('================================================================');
console.log('   🎉 ALL ASME Y14.5 & AS9102 TESTS PASSED PERFECTLY!');
console.log('================================================================\n');
