/**
 * Regression test: title-block field matcher recovers a value when the label and value are
 * emitted as two separate adjacent PDF text runs (no colon, no shared text run) — a common CAD
 * export table layout the original matcher (which required "LABEL: value" glued into one run)
 * could never read.
 *
 * Covers both neighbor layouts the matcher falls back to when a label run captures no inline
 * value: same-row-to-the-right (TITLE, PART NO, REV) and stacked label-above-value (CAGE).
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
  console.log('--- TEST: Title-Block Split Label/Value Cell Matching ---');

  const pdfPath = path.join(__dirname, 'fixtures/title_block_split_label_value_cells.pdf');
  const buffer = fs.readFileSync(pdfPath);
  const doc = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;

  const { projectProps, titleBlockWarning } = await DrawingExtractionService.extractCharacteristics(doc);

  assert(!titleBlockWarning, `Expected no title-block warning, got: "${titleBlockWarning}"`);
  console.log('✓ No "could not recognize title block" warning raised');

  assert(projectProps.partName === 'CONDUCTOR ASSEMBLY', `Same-row "TITLE" split cell not matched, got "${projectProps.partName}"`);
  assert(projectProps.partNumber === '55219-7', `Same-row "PART NO" split cell not matched, got "${projectProps.partNumber}"`);
  assert(projectProps.partRevision === 'B', `Same-row "REV" split cell not matched, got "${projectProps.partRevision}"`);
  assert(projectProps.cageCode === '9K2R4', `Stacked "CAGE" split cell not matched, got "${projectProps.cageCode}"`);
  console.log('✓ Same-row (TITLE, PART NO, REV) and stacked (CAGE) split label/value cells all correctly matched');

  console.log('>>> TITLE-BLOCK SPLIT LABEL/VALUE CELL TEST PASSED! <<<');
}

run();
