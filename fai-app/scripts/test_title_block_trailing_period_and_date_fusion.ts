/**
 * Regression test (2026-10-06): two title-block extraction bugs found independently verifying
 * against a real Pentair/SolidWorks drawing (89108946.pdf) — a real exported FAIR report showed
 * Part Number "." (a single stray period) instead of "89108946", and Part Revision blank instead
 * of "B", despite both being cleanly present as real, unambiguous text on the drawing.
 *
 * 1. "PART NO." as a label-only run (trailing period, no colon) with the value in a separate
 *    adjacent cell: buildTitleBlockFieldPatterns' separator class only recognized ":" and "-",
 *    so the label's own trailing "." was captured as if it were the start of the value.
 * 2. A revision-history date cell fused with the adjacent initials cell into one pdf.js text run
 *    with no space ("18/03/2014HDL"): parseRevisionDate required the whole cell to be nothing
 *    but the date, so the fused cell silently failed to parse and broke the whole lookup.
 *
 * See generate_title_block_pentair_bugs_pdf.mjs for the fixture construction.
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
  console.log('--- TEST: Title-Block Trailing-Period Label & Date/Initials Fusion ---');

  const pdfPath = path.join(__dirname, 'fixtures/title_block_trailing_period_and_date_fusion.pdf');
  const buffer = fs.readFileSync(pdfPath);
  const doc = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;

  const { projectProps, titleBlockWarning } = await DrawingExtractionService.extractCharacteristics(doc);

  assert(!titleBlockWarning, `Expected no title-block warning, got: "${titleBlockWarning}"`);
  console.log('✓ No "could not recognize title block" warning raised');

  console.log('► "PART NO." (trailing period, split value cell)...');
  assert(projectProps.partNumber === '77889', `Expected partNumber "77889", got "${projectProps.partNumber}" (a bare "." means the label's own trailing period was swallowed as the value)`);
  assert(projectProps.drawingNumber === '77889', `Expected drawingNumber "77889" (mirrors partNumber), got "${projectProps.drawingNumber}"`);
  console.log('  PASS: trailing period on the label no longer leaks into the captured value\n');

  console.log('► Revision-history table with a fused date+initials cell...');
  assert(projectProps.partRevision === 'C', `Expected partRevision "C" from the history table, got "${projectProps.partRevision}"`);
  assert(projectProps.drawingRevision === 'C', `Expected drawingRevision "C", got "${projectProps.drawingRevision}"`);
  console.log('  PASS: a date fused with trailing initials ("15/01/2020XYZ") still parses as a valid date, and the revision lookup succeeds\n');

  console.log('>>> TITLE-BLOCK TRAILING-PERIOD & DATE-FUSION TEST PASSED! <<<');
}

run();
