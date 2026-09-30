/**
 * Golden-File Regression Test: Bundled Sample Blueprint Extraction
 *
 * Unlike the isolated-function tests elsewhere in this suite, this runs the *entire* real
 * extraction pipeline (PDF vector text -> regex/heuristic GD&T parsing -> clustering) end to
 * end against a fixed, known input, and asserts against hand-verified expected output.
 *
 * Why this matters: the extraction engine is deterministic rules/regex, not a model — its real
 * failure mode is a silent regression in a parsing rule (someone tweaks a regex for one drawing
 * style and unknowingly breaks another). Unit tests on isolated functions don't catch that; only
 * running the full pipeline against a fixed fixture and diffing the result does.
 *
 * If a legitimate parsing improvement changes these numbers, update the expectations below
 * deliberately (and note why in the commit) — don't just delete the assertion.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { DrawingExtractionService } from '../src/services/ai/drawingExtractionService.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion Failed: ${message}`);
  }
}

async function run() {
  console.log('--- TEST: Golden-File Sample Blueprint Extraction ---');

  const pdfPath = path.join(__dirname, '../public/sample_blueprint.pdf');
  const buffer = fs.readFileSync(pdfPath);
  const doc = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;

  assert(doc.numPages === 2, `Sample blueprint page count changed: expected 2, got ${doc.numPages}. If the bundled sample PDF was intentionally replaced, update this golden fixture deliberately.`);

  const { characteristics, projectProps } = await DrawingExtractionService.extractCharacteristics(doc);

  assert(characteristics.length === 26, `Expected exactly 26 characteristics from the sample blueprint, got ${characteristics.length}. A regex/clustering rule change silently altered extraction — verify it was intentional before updating this number.`);
  console.log(`✓ Extracted exactly 26 characteristics (unchanged from golden baseline)`);

  assert(projectProps.partName === 'HIGH PRESSURE COMPRESSOR TURBINE MOUNT BRACKET', `Part name extraction changed: got "${projectProps.partName}"`);
  assert(projectProps.partNumber === 'AS9102-TMB-001', `Part number extraction changed: got "${projectProps.partNumber}"`);
  console.log('✓ Project properties (part name, part number) match golden baseline');

  const byItem = new Map(characteristics.map((c) => [c.itemNumber, c]));

  const char1 = byItem.get(1);
  assert(!!char1, 'Item #1 missing from extraction');
  assert(char1!.type === 'diameter', `Item #1 type changed: expected 'diameter', got '${char1!.type}'`);
  assert(char1!.cleanNominal === 2.5, `Item #1 nominal changed: expected 2.5, got ${char1!.cleanNominal}`);
  assert(char1!.lowerLimit === 2.495 && char1!.upperLimit === 2.505, `Item #1 limits changed: expected [2.495, 2.505], got [${char1!.lowerLimit}, ${char1!.upperLimit}]`);

  const char9 = byItem.get(9);
  assert(!!char9, 'Item #9 (thread callout) missing from extraction');
  assert(char9!.type === 'thread', `Item #9 type changed: expected 'thread', got '${char9!.type}'`);
  assert(char9!.cleanNominal === 1.375, `Item #9 fractional-thread nominal changed: expected 1.375 (1 3/8"), got ${char9!.cleanNominal}`);

  const char25 = byItem.get(25);
  assert(!!char25, 'Item #25 missing from extraction');
  assert(char25!.sheetNumber === 2, `Item #25 expected on sheet 2, got sheet ${char25!.sheetNumber}`);
  assert(char25!.cleanNominal === 3, `Item #25 nominal changed: expected 3, got ${char25!.cleanNominal}`);

  console.log('✓ Spot-checked characteristics (diameter, fractional thread, sheet-2 linear) match golden baseline');
  console.log('>>> GOLDEN-FILE EXTRACTION TEST PASSED! <<<');
}

run();
