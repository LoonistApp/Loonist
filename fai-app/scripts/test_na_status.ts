/**
 * Regression Suite: N/A Conformance Status & Justification Enforcement (2026-10-06)
 *
 * A real drawing (CINH91CDB11) carries two process-alternative edge-spec callouts (sheared/
 * nibbled edge vs. laser/other-process edge), each independently ballooned per standard AS9102
 * practice — the FAI must transcribe every unique toleranced callout on the design record, and
 * it's the inspector's job (not the extraction engine's) to determine, from the actual
 * manufacturing router, which one applies and mark the other N/A with a stated reason. Before
 * this fix, ConformanceStatus had no N/A value at all: an inspector resolving this had no way to
 * record "doesn't apply to this part" distinct from "still pending measurement" — char was stuck
 * showing UNMEASURED forever, or had to be force-measured against a spec that never applied.
 *
 * Covers: lot-statistics bucketing (N/A excluded from both measured and unmeasured, and from the
 * conformance rate denominator), the export gate (blocks N/A with no justification exactly like
 * an unresolved UNMEASURED item; allows it through once justified), and the Form 3 exporter
 * (Result/Status columns both read "N/A", not a fabricated-looking blank or PENDING).
 */
import { MeasurementEngine } from '../src/services/compliance/measurementEngine';
import { evaluateExportReadiness } from '../src/services/validation/characteristicExportGate';
import { As9102ExcelExporter } from '../src/services/export/as9102ExcelExporter';
import type { EngineeringCharacteristic } from '../src/types/characteristics';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion Failed: ${message}`);
  }
}

console.log('--- TEST: N/A Conformance Status & Justification Enforcement ---');

const baseChar: EngineeringCharacteristic = {
  id: 'char-edge-laser',
  itemNumber: 3,
  subNumber: '3',
  pageNumber: 1,
  sheetNumber: 1,
  drawingZone: 'D-4',
  type: 'gdt',
  enclosure: 'standard',
  rawText: 'Profile 0.4 A B-C B (Laser/other process edge spec)',
  cleanNominal: 0,
  upperTol: 0.4,
  lowerTol: 0,
  minLimit: 0,
  maxLimit: 0.4,
  units: 'mm',
  isToleranceInherited: false,
  toleranceSource: 'ASME Y14.5 GD&T Frame — Profile of a Line (⌓), 0.4',
  displayType: 'GEOMETRIC TOLERANCE',
  subType: 'Profile of a Line',
  classification: 'Critical',
  isBasic: false,
  forReference: false,
  plusTol: null,
  minusTol: null,
  upperLimit: 0.4,
  lowerLimit: 0,
  quantity: 1,
  inspectionMethod: 'CMM',
  confidenceScore: 0.95,
  verificationStatus: 'verified',
  boundingBox: { x: 100, y: 100, width: 40, height: 20 }
} as EngineeringCharacteristic;

// 1. Lot statistics: N/A must be its own bucket, excluded from both measured and unmeasured,
// and from the conformance rate denominator (it was never physically measured, so it shouldn't
// inflate or dilute the pass/fail rate either way).
console.log('► Lot statistics: N/A excluded from measured/unmeasured and conformance rate...');
const lot: EngineeringCharacteristic[] = [
  { ...baseChar, id: 'c1', measuredValue: 1.0, conformanceStatus: 'PASS' },
  { ...baseChar, id: 'c2', measuredValue: null, conformanceStatus: 'UNMEASURED' },
  { ...baseChar, id: 'c3', measuredValue: null, conformanceStatus: 'N/A', comments: 'Part made via nibbling — see char 2 for applicable edge spec' }
];
const stats = MeasurementEngine.calculateLotStatistics(lot);
assert(stats.total === 3, `Expected total 3, got ${stats.total}`);
assert(stats.measuredCount === 1, `N/A must not count as measured, expected 1, got ${stats.measuredCount}`);
assert(stats.unmeasuredCount === 1, `N/A must not count as unmeasured either, expected 1, got ${stats.unmeasuredCount}`);
assert(stats.notApplicableCount === 1, `Expected notApplicableCount 1, got ${stats.notApplicableCount}`);
assert(stats.conformanceRatePercent === 100, `Conformance rate must be based only on the 1 measured (PASS) item, got ${stats.conformanceRatePercent}`);
assert(stats.isLotConforming === true, 'A lot with no FAIL items must still be conforming regardless of N/A entries');
console.log('  PASS: N/A tracked separately — never inflates measured, unmeasured, or conformance rate\n');

// 2. Export gate: an N/A characteristic with no justification is exactly as opaque as an
// unresolved UNMEASURED item, and must block export the same way.
console.log('► Export gate: N/A without a justification comment blocks export...');
const naNoComment: EngineeringCharacteristic = { ...baseChar, measuredValue: null, conformanceStatus: 'N/A', comments: '' };
const { blockers: blockersNoComment } = evaluateExportReadiness([naNoComment]);
assert(blockersNoComment.length === 1, `Expected 1 blocker for N/A with no comment, got ${blockersNoComment.length}`);
console.log('  PASS: N/A with an empty justification is blocked\n');

console.log('► Export gate: N/A without a justification is blocked even if comments is whitespace-only...');
const naWhitespaceComment: EngineeringCharacteristic = { ...baseChar, measuredValue: null, conformanceStatus: 'N/A', comments: '   ' };
const { blockers: blockersWhitespace } = evaluateExportReadiness([naWhitespaceComment]);
assert(blockersWhitespace.length === 1, `Expected 1 blocker for N/A with whitespace-only comment, got ${blockersWhitespace.length}`);
console.log('  PASS: whitespace-only justification does not satisfy the requirement\n');

console.log('► Export gate: N/A WITH a real justification passes through cleanly...');
const naWithComment: EngineeringCharacteristic = {
  ...baseChar, measuredValue: null, conformanceStatus: 'N/A',
  comments: 'Part made via nibbling process — see char 2 for the applicable edge-profile spec'
};
const { blockers: blockersJustified } = evaluateExportReadiness([naWithComment]);
assert(blockersJustified.length === 0, `Expected 0 blockers for a justified N/A, got ${blockersJustified.length}`);
console.log('  PASS: a justified N/A is not treated as a blocker, unlike an unresolved UNMEASURED item\n');

// 3. Form 3 export: both the Result and Status columns must read "N/A", not a fabricated-looking
// blank, not PENDING (which would wrongly suggest it's still awaiting inspection).
console.log('► Form 3 export: N/A renders correctly in Result and Status columns...');
const row = As9102ExcelExporter.buildForm3Row(naWithComment);
assert(row.result === 'N/A', `Expected Result column "N/A", got "${row.result}"`);
assert(row.status === 'N/A', `Expected Status column "N/A", got "${row.status}"`);
assert(row.comments === naWithComment.comments, 'The justification must survive into the exported Comments column');
console.log('  PASS: Form 3 Result and Status columns both correctly show "N/A", carrying the justification in Comments\n');

console.log('>>> N/A CONFORMANCE STATUS TEST PASSED! <<<');
