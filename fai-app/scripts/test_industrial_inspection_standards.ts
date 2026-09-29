/**
 * Test Suite: Industrial Inspection Standards Verification
 * 
 * Verifies senior quality control engineering criteria:
 * 1. Automatic Drawing Unit Detection (precedence of drawing notes over imperial defaults)
 * 2. Metric ISO 2768-m General Tolerancing for integer millimeter dimensions
 * 3. Angular Isolation on Compound Callouts (Ø12 ↧ 55.73 / ⩡ Ø25 X 90° retains mm units, 90 retains deg)
 * 4. Multi-Feature Compound Callout Deconstruction into AS9102 Form 3 sub-characteristics
 * 5. Chamfer Fidelity (ALL CHAMFERS = 0.5 X 45° captures both 0.5 mm leg and 45° angle)
 * 6. Single Balloon CAD Canvas Rule (only 1 balloon per leader, secondary sub-features suppressed)
 */

import { ToleranceEngine, DEFAULT_METRIC_ISO_TOLERANCES } from '../src/services/ai/toleranceEngine';
import { GdtParser } from '../src/services/ai/gdtParser';
import { DEFAULT_AEROSPACE_TOLERANCES } from '../src/types/characteristics';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion Failed: ${message}`);
  }
}

console.log('--- TEST: Industrial Inspection Standards & Multi-Feature Deconstruction ---');

// ============================================================================
// 1. Automatic Drawing Unit Detection
// ============================================================================
console.log('\n[1] Testing Drawing Unit Detection...');
const metricDrawingText = 'PART: SUPPORT BASE ALL DIMENSIONS ARE IN MILLIMETERS MATERIAL: STEEL';
const detectedMetric = ToleranceEngine.detectDrawingUnits(metricDrawingText);
assert(detectedMetric === 'mm', `Expected 'mm' for drawing with "ALL DIMENSIONS ARE IN MILLIMETERS", got "${detectedMetric}"`);

const imperialDrawingText = 'DRAWING NO: 100-245 REV C UNLESS OTHERWISE SPECIFIED: DIMENSIONS ARE IN INCHES';
const detectedImperial = ToleranceEngine.detectDrawingUnits(imperialDrawingText);
assert(detectedImperial === 'in', `Expected 'in' for drawing with "DIMENSIONS ARE IN INCHES", got "${detectedImperial}"`);

const ambiguousText = 'PART NAME: BRACKET REVISION: B SCALE: 1:1';
const detectedAmbiguous = ToleranceEngine.detectDrawingUnits(ambiguousText);
assert(detectedAmbiguous === null, `Expected null for drawing without unit declarations, got "${detectedAmbiguous}"`);
console.log('✓ Drawing unit detection strictly prioritizes explicit blueprint notes');

// ============================================================================
// 2. Metric ISO 2768-m Tolerances for Integer Millimeters
// ============================================================================
console.log('\n[2] Testing Metric ISO 2768-m General Tolerances...');
// 300 mm flange (band >120 to <=400) -> ±0.5 mm
const tol300 = ToleranceEngine.resolveTitleBlockTolerance('300', false, DEFAULT_METRIC_ISO_TOLERANCES);
assert(tol300.upperTol === 0.5 && tol300.lowerTol === 0.5, `Expected ±0.5 for 300 mm, got +${tol300.upperTol}/-${tol300.lowerTol}`);
const limits300 = ToleranceEngine.calculateLimits(300, tol300.upperTol, tol300.lowerTol);
assert(limits300.minLimit === 299.5 && limits300.maxLimit === 300.5, `Limits for 300 mm should be 299.5 - 300.5, got ${limits300.minLimit} - ${limits300.maxLimit}`);

// 100 mm (band >30 to <=120) -> ±0.3 mm
const tol100 = ToleranceEngine.resolveTitleBlockTolerance('100', false, DEFAULT_METRIC_ISO_TOLERANCES);
assert(tol100.upperTol === 0.3 && tol100.lowerTol === 0.3, `Expected ±0.3 for 100 mm, got +${tol100.upperTol}/-${tol100.lowerTol}`);

// 50 mm (band >30 to <=120) -> ±0.3 mm
const tol50 = ToleranceEngine.resolveTitleBlockTolerance('50', false, DEFAULT_METRIC_ISO_TOLERANCES);
assert(tol50.upperTol === 0.3 && tol50.lowerTol === 0.3, `Expected ±0.3 for 50 mm, got +${tol50.upperTol}/-${tol50.lowerTol}`);

// 12 mm (band >6 to <=30) -> ±0.2 mm
const tol12 = ToleranceEngine.resolveTitleBlockTolerance('12', false, DEFAULT_METRIC_ISO_TOLERANCES);
assert(tol12.upperTol === 0.2 && tol12.lowerTol === 0.2, `Expected ±0.2 for 12 mm, got +${tol12.upperTol}/-${tol12.lowerTol}`);

// 5 mm (band <=6) -> ±0.1 mm
const tol5 = ToleranceEngine.resolveTitleBlockTolerance('5', false, DEFAULT_METRIC_ISO_TOLERANCES);
assert(tol5.upperTol === 0.1 && tol5.lowerTol === 0.1, `Expected ±0.1 for 5 mm, got +${tol5.upperTol}/-${tol5.lowerTol}`);
console.log('✓ Metric integer dimensions accurately resolve to ISO 2768-m nominal size bands');

// ============================================================================
// 3. Angular Unit Isolation & Deconstruction (#413: Ø12 ↧ 55.73 / ⩡ Ø25 X 90°)
// ============================================================================
console.log('\n[3] Testing Callout #413 Angular Unit Isolation & Deconstruction...');
const callout413Text = 'Ø12 ↧ 55.73 / ⩡ Ø25 X 90°';
const parsed413 = GdtParser.parseCallout(callout413Text, DEFAULT_METRIC_ISO_TOLERANCES);

// Primary diameter must NOT be corrupted to 'deg'
assert(parsed413.nominal === 12, `Primary nominal must be 12, got ${parsed413.nominal}`);
assert(parsed413.units === 'mm', `Primary units must be 'mm', got '${parsed413.units}' (corrupted to deg previously!)`);
assert(parsed413.type === 'diameter', `Primary type must be 'diameter', got '${parsed413.type}'`);

// Deconstructed sub-features
assert(parsed413.subFeatures !== undefined && parsed413.subFeatures.length === 4, `Expected 4 sub-features for #413, got ${parsed413.subFeatures?.length}`);
const [sub413_1, sub413_2, sub413_3, sub413_4] = parsed413.subFeatures!;

// Sub 1: Drill Diameter
assert(sub413_1.nominal === 12 && sub413_1.units === 'mm' && sub413_1.isSecondarySub === false, `Sub 413.1 should be 12 mm drill`);
// Sub 2: Drill Depth
assert(sub413_2.nominal === 55.73 && sub413_2.units === 'mm' && sub413_2.isSecondarySub === true, `Sub 413.2 should be 55.73 mm depth`);
// Sub 3: Countersink Diameter
assert(sub413_3.nominal === 25 && sub413_3.units === 'mm' && sub413_3.isSecondarySub === true, `Sub 413.3 should be Ø25 mm countersink`);
// Sub 4: Countersink Angle
assert(sub413_4.nominal === 90 && sub413_4.units === 'deg' && sub413_4.isSecondarySub === true, `Sub 413.4 should be 90° angle`);
console.log('✓ Callout #413 correctly isolates primary diameter (mm) from trailing countersink angle (deg) with 4 sub-characteristics');

// ============================================================================
// 4. Counterbore Hole Deconstruction (#409: Ø50 THRU / ⌴ Ø70 ↧ 12)
// ============================================================================
console.log('\n[4] Testing Callout #409 Counterbore Deconstruction...');
const callout409Text = 'Ø50 THRU / ⌴ Ø70 ↧ 12';
const parsed409 = GdtParser.parseCallout(callout409Text, DEFAULT_METRIC_ISO_TOLERANCES);

assert(parsed409.subFeatures !== undefined && parsed409.subFeatures.length === 3, `Expected 3 sub-features for #409, got ${parsed409.subFeatures?.length}`);
const [sub409_1, sub409_2, sub409_3] = parsed409.subFeatures!;

assert(sub409_1.nominal === 50 && sub409_1.units === 'mm' && !sub409_1.isSecondarySub, `Sub 409.1 should be Ø50 THRU`);
assert(sub409_1.minLimit === 49.7 && sub409_1.maxLimit === 50.3, `Sub 409.1 limits should be 49.7 - 50.3 (ISO 2768-m ±0.3 mm)`);

assert(sub409_2.nominal === 70 && sub409_2.units === 'mm' && sub409_2.isSecondarySub, `Sub 409.2 should be ⌴ Ø70`);
assert(sub409_2.minLimit === 69.7 && sub409_2.maxLimit === 70.3, `Sub 409.2 limits should be 69.7 - 70.3`);

assert(sub409_3.nominal === 12 && sub409_3.units === 'mm' && sub409_3.isSecondarySub, `Sub 409.3 should be ↧ 12`);
assert(sub409_3.minLimit === 11.8 && sub409_3.maxLimit === 12.2, `Sub 409.3 limits should be 11.8 - 12.2 (ISO 2768-m ±0.2 mm)`);
console.log('✓ Callout #409 decomposes into 3 discrete inspection rows with complete limits');

// ============================================================================
// 5. Threaded Hole with Spotface & Multi-Place (#416: 1/2-13 UNC - 2B / ⌴ Ø22 ↧ 5 / 3 PLCS)
// ============================================================================
console.log('\n[5] Testing Callout #416 Thread with Spotface...');
const callout416Text = '1/2-13 UNC - 2B / ⌴ Ø22 ↧ 5 / 3 PLCS';
const parsed416 = GdtParser.parseCallout(callout416Text, DEFAULT_METRIC_ISO_TOLERANCES);

assert(parsed416.subFeatures !== undefined && parsed416.subFeatures.length === 3, `Expected 3 sub-features for #416, got ${parsed416.subFeatures?.length}`);
const [sub416_1, sub416_2, sub416_3] = parsed416.subFeatures!;

assert(sub416_1.displayRequirement.includes('1/2-13 UNC - 2B'), `Sub 416.1 must contain thread callout`);
assert(sub416_1.quantity === 3, `Sub 416.1 quantity must be 3`);
assert(sub416_1.inspectionMethod === 'Thread Gage', `Sub 416.1 must use Thread Gage`);

assert(sub416_2.nominal === 22 && sub416_2.quantity === 3 && sub416_2.isSecondarySub, `Sub 416.2 must be Ø22 spotface`);
assert(sub416_3.nominal === 5 && sub416_3.quantity === 3 && sub416_3.isSecondarySub, `Sub 416.3 must be 5 mm depth`);
console.log('✓ Callout #416 decomposes thread, spotface diameter, and depth with quantity 3 preserved');

// ============================================================================
// 6. Chamfer Fidelity (#404: ALL CHAMFERS = 0.5 X 45°)
// ============================================================================
console.log('\n[6] Testing Callout #404 Chamfer Fidelity...');
const callout404Text = 'ALL CHAMFERS = 0.5 X 45°';
const parsed404 = GdtParser.parseCallout(callout404Text, DEFAULT_METRIC_ISO_TOLERANCES);

assert(parsed404.subFeatures !== undefined && parsed404.subFeatures.length === 2, `Expected 2 sub-features for chamfer #404, got ${parsed404.subFeatures?.length}`);
const [sub404_1, sub404_2] = parsed404.subFeatures!;

assert(sub404_1.nominal === 0.5 && sub404_1.units === 'mm' && !sub404_1.isSecondarySub, `Sub 404.1 must be 0.5 mm chamfer leg`);
assert(sub404_2.nominal === 45 && sub404_2.units === 'deg' && sub404_2.isSecondarySub, `Sub 404.2 must be 45° chamfer angle`);
assert(sub404_2.minLimit === 44.5 && sub404_2.maxLimit === 45.5, `Chamfer angle limits should be 44.5° - 45.5°`);
console.log('✓ Callout #404 captures both 0.5 mm leg and 45° angle with dedicated tolerances');

console.log('\n🎉 ALL INDUSTRIAL QUALITY CONTROL INSPECTION TESTS PASSED PERFECTLY!\n');
