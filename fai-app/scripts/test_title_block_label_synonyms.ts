/**
 * Regression test: title-block field matcher recognizes standard label synonyms, not just the
 * exact literal strings "PART NO:", "REV:", "CAGE:", "TITLE:" from the original bundled sample.
 *
 * The original matcher was a single hardcoded rule tuned to one CAD export's wording. A real
 * customer drawing using equally standard but differently worded labels (P/N, REVISION, CAGE
 * CODE, DESCRIPTION) silently extracted nothing and surfaced the "could not recognize the title
 * block layout" warning even though the title block was perfectly readable. This fixture uses
 * that alternate (still single-text-run "LABEL: value") wording to close that gap.
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
  console.log('--- TEST: Title-Block Label Synonym Matching ---');

  const pdfPath = path.join(__dirname, 'fixtures/title_block_label_synonyms.pdf');
  const buffer = fs.readFileSync(pdfPath);
  const doc = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;

  const { projectProps, titleBlockWarning } = await DrawingExtractionService.extractCharacteristics(doc);

  assert(!titleBlockWarning, `Expected no title-block warning, got: "${titleBlockWarning}"`);
  console.log('✓ No "could not recognize title block" warning raised');

  assert(projectProps.partNumber === '7788-XY', `"P/N:" synonym not matched for part number, got "${projectProps.partNumber}"`);
  assert(projectProps.partRevision === 'C', `"REVISION:" synonym not matched for revision, got "${projectProps.partRevision}"`);
  assert(projectProps.cageCode === '1ABC2', `"CAGE CODE:" synonym not matched for CAGE code, got "${projectProps.cageCode}"`);
  assert(projectProps.partName === 'BRACKET ASSY', `"DESCRIPTION:" synonym not matched for part name, got "${projectProps.partName}"`);
  console.log('✓ P/N, REVISION, CAGE CODE, and DESCRIPTION labels all correctly matched');

  console.log('>>> TITLE-BLOCK LABEL SYNONYM TEST PASSED! <<<');
}

run();
