/**
 * Regression Suite: Independent FAI/AS9102 QA Review Fixes (2026-10-05)
 *
 * Unit-level coverage for the confirmed defects found when an independent QA review compared
 * CINH91CDB11's Loonist-generated FAIR against its real ballooned PDF. The full end-to-end
 * verification against the actual drawing lives in
 * test_rotated_customer_drawing_extraction.ts (assertions 2d-2j); this file isolates each root
 * cause at the unit it was actually fixed in, independent of PDF text extraction, so a future
 * regression here fails fast with a precise cause rather than only showing up as a drift in the
 * full-drawing character count.
 */
import { GdtParser } from '../src/services/ai/gdtParser';
import { GridZoneCalculator } from '../src/services/ai/gridZoneCalculator';
import { ToleranceEngine, DEFAULT_METRIC_ISO_TOLERANCES } from '../src/services/ai/toleranceEngine';
import { validateForm1Record } from '../src/services/validation/form1ValidationService';
import type { ProjectProperties } from '../src/types/characteristics';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion Failed: ${message}`);
  }
}

console.log('--- TEST: Independent FAI/AS9102 QA Review Fixes ---');

// 1. Bare ISO 13715 chamfer-leg symbol ("2c") must parse as a chamfer, not an angle.
console.log('► Bare chamfer-leg symbol ("2c")...');
const chamfer = GdtParser.parseCallout('2c', DEFAULT_METRIC_ISO_TOLERANCES);
assert(chamfer.type === 'chamfer', `Expected type 'chamfer' for bare "2c", got '${chamfer.type}'`);
assert(chamfer.nominal === 2, `Expected nominal 2, got ${chamfer.nominal}`);
assert(chamfer.units === 'mm', `Expected units 'mm' (not 'deg'), got '${chamfer.units}'`);
console.log('  PASS: "2c" -> type=chamfer, nominal=2mm\n');

// 1b. A genuine angle-paired chamfer callout ("x"-paired, or with a CHAMFER/CSINK keyword) must
// still convert "c" to "°" exactly as before — this is the behavior the normalization gating
// must NOT regress.
console.log('► Angle-paired chamfer callout still converts "c" -> "°"...');
const pairedChamfer = GdtParser.parseCallout('3 X 45c CHAMFER', DEFAULT_METRIC_ISO_TOLERANCES);
assert(pairedChamfer.type === 'chamfer', `Expected type 'chamfer', got '${pairedChamfer.type}'`);
assert(pairedChamfer.nominal === 3, `Expected depth nominal 3, got ${pairedChamfer.nominal}`);
console.log('  PASS: "3 X 45c CHAMFER" still parses correctly\n');

// 2. A bare negative nominal must keep its sign through tolerance-limit calculation.
console.log('► Negative nominal sign through tolerancing ("-0.1")...');
const negative = GdtParser.parseCallout('-0.1', DEFAULT_METRIC_ISO_TOLERANCES);
assert(negative.nominal === -0.1, `Expected nominal -0.1, got ${negative.nominal}`);
assert(negative.minLimit === -0.2, `Expected minLimit -0.2 (sign preserved), got ${negative.minLimit}`);
assert(negative.maxLimit === 0, `Expected maxLimit 0, got ${negative.maxLimit}`);
console.log('  PASS: "-0.1" ±0.1 (Title Block .X) -> limits [-0.2, 0], not the sign-flipped [0, 0.2]\n');

const negative2 = GdtParser.parseCallout('-0.3', DEFAULT_METRIC_ISO_TOLERANCES);
assert(negative2.minLimit === -0.4 && negative2.maxLimit === -0.2, `Expected "-0.3" -> limits [-0.4, -0.2], got [${negative2.minLimit}, ${negative2.maxLimit}]`);
console.log('  PASS: "-0.3" ±0.1 -> limits [-0.4, -0.2]\n');

// 3. ToleranceEngine.calculateLimits itself was always sign-correct — confirms the bug was
// strictly in nominal extraction, not here, and guards against a future regression in either.
console.log('► ToleranceEngine.calculateLimits sign correctness (direct)...');
const limits = ToleranceEngine.calculateLimits(-0.1, 0.1, 0.1);
assert(limits.minLimit === -0.2 && limits.maxLimit === 0, `Expected [-0.2, 0], got [${limits.minLimit}, ${limits.maxLimit}]`);
console.log('  PASS\n');

// 4. ISO 2768 class declared on the drawing ("ISO 2768-mK") is detected and used for the
// bare-integer tolerance fallback, instead of a silently hardcoded 'm' default every time.
console.log('► ISO 2768 class detection from drawing text...');
assert(ToleranceEngine.detectIso2768Class('Tolerances generales: ISO 2768-mK / ISO 8015') === 'm', 'Expected "ISO 2768-mK" to detect class "m"');
assert(ToleranceEngine.detectIso2768Class('General tolerance per ISO 2768-fH') === 'f', 'Expected "ISO 2768-fH" to detect class "f"');
assert(ToleranceEngine.detectIso2768Class('No ISO standard mentioned here') === null, 'Expected no match when the drawing has no ISO 2768 note');
console.log('  PASS: declared class correctly extracted, geometric-class suffix (K/L/H) correctly ignored\n');

// 5. GridZoneCalculator must interpolate against a drawing's own detected zone ruler, not guess
// a fixed-bucket grid size from pixel dimensions.
console.log('► GridZoneCalculator: real-ruler interpolation vs. pixel-bucket fallback...');
const ruler = {
  columns: [
    { label: '1', position: 500 }, { label: '2', position: 1065 }, { label: '3', position: 1631 },
    { label: '4', position: 2198 }, { label: '5', position: 2764 }, { label: '6', position: 3331 },
    { label: '7', position: 3898 }, { label: '8', position: 4464 }, { label: '9', position: 5031 },
    { label: '10', position: 5597 }, { label: '11', position: 6164 }, { label: '12', position: 6731 },
    { label: '13', position: 7297 }, { label: '14', position: 7864 }, { label: '15', position: 8430 },
    { label: '16', position: 8997 }
  ],
  rows: [
    { label: 'A', position: 267 }, { label: 'B', position: 817 }, { label: 'C', position: 1383 },
    { label: 'D', position: 1950 }, { label: 'E', position: 2517 }, { label: 'F', position: 3084 },
    { label: 'G', position: 3651 }, { label: 'H', position: 4218 }, { label: 'I', position: 4785 },
    { label: 'J', position: 5352 }, { label: 'K', position: 5919 }, { label: 'L', position: 6468 }
  ]
};
// A feature at the real pixel position of balloon #1 on CINH91CDB11-B.pdf (independently
// pixel-measured: physically at column 16, row B).
const zoneWithRuler = GridZoneCalculator.calculateZone(8997, 817, 9536, 6736, ruler);
assert(zoneWithRuler === 'Zone B-16', `Expected "Zone B-16" from real ruler interpolation, got "${zoneWithRuler}"`);
console.log('  PASS: real-ruler lookup for a 16-column/12-row drawing correctly returns column 16, not a guessed max of 8\n');

// 5b. Without a usable ruler (e.g. a scanned sheet with no extractable zone-ruler text), the
// coarse pixel-bucket fallback must still run exactly as before — this is a deliberate,
// clearly-labeled approximation when no ruler is detected, not a regression to fix here.
console.log('► GridZoneCalculator: fallback with no ruler detected...');
const zoneNoRuler = GridZoneCalculator.calculateZone(8997, 817, 9536, 6736, null);
assert(/^Zone [A-H]-[1-8]$/.test(zoneNoRuler), `Expected the pixel-bucket fallback (A-H, 1-8) when no ruler is available, got "${zoneNoRuler}"`);
console.log(`  PASS: falls back to the coarse pixel-bucket estimate ("${zoneNoRuler}") when no ruler was detected\n`);

// 6. Production hardening (2026-10-06): a re-exported real FAIR report showed "Lot Size: 200" /
// "Sampling Plan: II NORMAL AQL 1.0" on Form 1 for a drawing whose text contains neither value
// anywhere — these were plausible-looking hardcoded defaults (drawingExtractionService's
// extraction result, and App.tsx's new-file seed), not extracted or user-entered data, so a
// report could silently ship invented lot/sampling-plan data indistinguishable from the real
// thing. Lot size and sampling plan are inherently NOT drawing content (they're inspector-
// supplied, per-FAI planning data), so the fix is the same pattern already used for cageCode:
// leave unset (lotSize 0, sampling fields '') rather than guess, and let validateForm1Record —
// the same validator the Backstage "Properties" screen already enforces — flag it as missing.
console.log('► Lot size / sampling plan: unset must be rejected, not silently plausible...');
const unsetLotSampling: ProjectProperties = {
  partName: 'Conductor', partNumber: 'CINH91CDB11', partRevision: 'B',
  drawingName: 'CINH91CDB11', drawingNumber: 'CINH91CDB11', drawingRevision: 'B',
  cageCode: '1A2B3',
  lotSize: 0, samplingLevel: '', samplingType: '', aql: ''
};
const unsetResult = validateForm1Record(unsetLotSampling);
assert(unsetResult.isValid === false, 'A record with unset lot size/sampling must not validate as complete');
assert(unsetResult.invalidFields.lotSize === true, 'lotSize=0 (unset sentinel) must be flagged invalid, not accepted as a real quantity');
assert(unsetResult.invalidFields.samplingLevel === true, 'Blank samplingLevel must be flagged invalid');
assert(unsetResult.invalidFields.samplingType === true, 'Blank samplingType must be flagged invalid');
assert(unsetResult.invalidFields.aql === true, 'Blank aql must be flagged invalid');
console.log('  PASS: unset lot size (0) and blank sampling fields are correctly rejected, never silently exported as if real\n');

// 6b. Once genuinely filled in (by the inspector, not guessed), the same record must validate
// cleanly — confirms the fix only closes the fabrication gap, without making legitimate
// user-entered data unexportable.
console.log('► Lot size / sampling plan: genuinely filled-in values still validate...');
const filledResult = validateForm1Record({ ...unsetLotSampling, lotSize: 200, samplingLevel: 'II', samplingType: 'NORMAL', aql: '1.0' });
assert(filledResult.isValid === true, 'A fully filled-in record must validate as complete');
assert(filledResult.validatedRecord?.lotSize === 200, 'Filled-in lotSize must pass through unchanged');
console.log('  PASS: a record with real, user-entered lot size/sampling data validates normally\n');

console.log('>>> QA REVIEW REGRESSION FIXES TEST PASSED! <<<');
