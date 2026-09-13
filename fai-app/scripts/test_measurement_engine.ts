/**
 * Test Suite: Physical Quality Measurement Engine (SAE AS9102 Rev C / ASME Y14.5)
 */
import { MeasurementEngine } from '../src/services/compliance/measurementEngine';
import type { EngineeringCharacteristic } from '../src/types/characteristics';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion Failed: ${message}`);
  }
}

console.log('--- TEST: Physical Quality Measurement Engine ---');

const baseChar: EngineeringCharacteristic = {
  id: 'char-1',
  itemNumber: 1,
  subNumber: '1',
  pageNumber: 1,
  sheetNumber: 1,
  displayType: 'Dimension',
  subType: 'Linear Dimension',
  rawText: '1.250 ± 0.005',
  cleanNominal: 1.250,
  plusTol: 0.005,
  minusTol: -0.005,
  upperTol: 0.005,
  lowerTol: 0.005,
  upperLimit: 1.255,
  lowerLimit: 1.245,
  maxLimit: 1.255,
  minLimit: 1.245,
  units: 'in',
  classification: 'Critical',
  inspectionMethod: 'Caliper',
  toleranceSource: 'Direct (±)',
  balloonCoordinates: { x: 100, y: 100, width: 24, height: 24 },
  calloutBoundingBox: { x: 50, y: 100, width: 40, height: 20 },
  verificationStatus: 'verified'
};

// 1. Unmeasured state
const resUnmeasured = MeasurementEngine.evaluateMeasurement(baseChar, null);
assert(resUnmeasured.status === 'UNMEASURED', 'Null measurement must be UNMEASURED');
assert(resUnmeasured.deviation === null, 'Unmeasured deviation must be null');
console.log('✓ Null measurement evaluated as UNMEASURED');

// 2. Perfect Nominal (PASS)
const resNominal = MeasurementEngine.evaluateMeasurement(baseChar, 1.250);
assert(resNominal.status === 'PASS', 'Nominal value must be PASS');
assert(resNominal.deviation === 0, 'Nominal deviation must be 0');
console.log('✓ Nominal measurement evaluated as PASS (deviation = 0)');

// 3. Marginal Tolerance (Within 10% of Upper Limit)
// Upper limit = 1.255, Lower limit = 1.245, Band = 0.010. 10% threshold = 0.001.
// 1.2545 is within 0.0005 of upper limit (<= 0.001) -> MARGINAL
const resMarginal = MeasurementEngine.evaluateMeasurement(baseChar, 1.2545);
assert(resMarginal.status === 'MARGINAL', `Expected MARGINAL for 1.2545, got ${resMarginal.status}`);
assert(resMarginal.deviation !== null && Math.abs(resMarginal.deviation - 0.0045) < 0.00001, 'Deviation should be +0.0045');
console.log('✓ Near-limit measurement evaluated as MARGINAL (within 10% band)');

// 4. Out of Tolerance (FAIL Upper)
const resFailUpper = MeasurementEngine.evaluateMeasurement(baseChar, 1.256);
assert(resFailUpper.status === 'FAIL', `Expected FAIL for 1.256, got ${resFailUpper.status}`);
assert(resFailUpper.deviation !== null && Math.abs(resFailUpper.deviation - 0.006) < 0.00001, 'Deviation should be +0.006');
console.log('✓ Out-of-tolerance upper measurement evaluated as FAIL');

// 5. Out of Tolerance (FAIL Lower)
const resFailLower = MeasurementEngine.evaluateMeasurement(baseChar, 1.243);
assert(resFailLower.status === 'FAIL', `Expected FAIL for 1.243, got ${resFailLower.status}`);
console.log('✓ Out-of-tolerance lower measurement evaluated as FAIL');

// 6. Reference Dimensions (Never Fail per ASME Y14.5)
const refChar: EngineeringCharacteristic = {
  ...baseChar,
  forReference: true,
  rawText: '(2.500)',
  cleanNominal: 2.500,
  upperLimit: null,
  lowerLimit: null
};
const resRef = MeasurementEngine.evaluateMeasurement(refChar, 2.580);
assert(resRef.status === 'PASS', 'Reference dimensions must always be PASS');
console.log('✓ Reference dimension evaluated as PASS regardless of actual');

// 7. Lot Compliance Statistics
const lot: EngineeringCharacteristic[] = [
  { ...baseChar, id: 'c1', measuredValue: 1.250, conformanceStatus: 'PASS' },
  { ...baseChar, id: 'c2', measuredValue: 1.254, conformanceStatus: 'MARGINAL' },
  { ...baseChar, id: 'c3', measuredValue: 1.260, conformanceStatus: 'FAIL' },
  { ...baseChar, id: 'c4', measuredValue: null, conformanceStatus: 'UNMEASURED' },
  { ...baseChar, id: 'c5', measuredValue: null, conformanceStatus: 'UNMEASURED' },
];

const stats = MeasurementEngine.calculateLotStatistics(lot);
assert(stats.total === 5, 'Total count should be 5');
assert(stats.measuredCount === 3, 'Measured count should be 3');
assert(stats.unmeasuredCount === 2, 'Unmeasured count should be 2');
assert(stats.passCount === 1, 'Pass count should be 1');
assert(stats.marginalCount === 1, 'Marginal count should be 1');
assert(stats.failCount === 1, 'Fail count should be 1');
// Conformance rate: (1 pass + 1 marginal) / 3 measured = 66.7%
assert(stats.conformanceRatePercent === 66.7, `Expected 66.7% conformance, got ${stats.conformanceRatePercent}`);
console.log(`✓ Lot FAI Telemetry calculated successfully: ${stats.conformanceRatePercent}% Pass (${stats.measuredCount}/${stats.total} measured)`);

console.log('>>> ALL MEASUREMENT ENGINE TESTS PASSED! <<<');
