/**
 * Regression Test: Multi-Page Document with Per-Sheet Rotation + Non-English Boilerplate
 *
 * Every other fixture so far is single-page. Real AS9102 packages are routinely multi-sheet,
 * and nothing guaranteed that per-sheet state (rotation, title-block zone, border-grid
 * detection) stays correctly isolated sheet-to-sheet instead of leaking/bleeding across pages.
 * This fixture (scripts/generate_multipage_mixed_pdf.mjs) has sheet 1 at /Rotate 0 (English)
 * and sheet 2 at /Rotate 90 with German boilerplate — covering 3 things at once:
 *   1. Per-sheet rotation handling in the same document (not just a single rotated page)
 *   2. Sheet-to-sheet isolation (sheet 2's content/rotation must not corrupt sheet 1's results)
 *   3. Non-English (German) boilerplate must not leak through as fake characteristics even
 *      though the prose/admin-boilerplate filters are keyed on English words/phrases
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { DrawingExtractionService } from '../src/services/ai/drawingExtractionService.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion Failed: ${message}`);
  }
}

async function run() {
  console.log('--- TEST: Multi-Page Mixed-Rotation + Non-English Boilerplate ---');

  const buffer = fs.readFileSync(path.join(__dirname, 'fixtures/multipage_mixed_rotation_de.pdf'));
  const doc = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
  assert(doc.numPages === 2, `Expected 2 pages, got ${doc.numPages}`);

  const page1 = await doc.getPage(1);
  const page2 = await doc.getPage(2);
  assert((page1 as any).rotate === 0, `Sheet 1 should be /Rotate 0, got ${(page1 as any).rotate}`);
  assert((page2 as any).rotate === 90, `Sheet 2 should be /Rotate 90, got ${(page2 as any).rotate}`);

  const { characteristics } = await DrawingExtractionService.extractCharacteristics(doc as any);

  // Exactly 3 real dimensions total: sheet 1's "20", sheet 2's "35" and "M8x1.25". Nothing from
  // the German boilerplate (title-block notes, confidentiality notice) should have leaked
  // through as a 4th fake characteristic.
  assert(characteristics.length === 3, `Expected exactly 3 characteristics (German boilerplate must not leak through), got ${characteristics.length}: ${characteristics.map(c => `"${c.rawText}"`).join(', ')}`);
  console.log('✓ No German boilerplate leaked through as a fake characteristic');

  const sheet1Chars = characteristics.filter(c => c.sheetNumber === 1);
  const sheet2Chars = characteristics.filter(c => c.sheetNumber === 2);
  assert(sheet1Chars.length === 1 && sheet1Chars[0].cleanNominal === 20, `Sheet 1 should have exactly one characteristic (nominal 20), got ${JSON.stringify(sheet1Chars.map(c => c.cleanNominal))}`);
  assert(sheet2Chars.length === 2, `Sheet 2 should have exactly 2 characteristics (35 and M8x1.25), got ${sheet2Chars.length}`);
  console.log('✓ Sheet 1 and Sheet 2 characteristics correctly isolated, no cross-sheet contamination');

  const threadChar = sheet2Chars.find(c => c.type === 'thread');
  assert(!!threadChar && threadChar.cleanNominal === 8, `Sheet 2's metric thread (M8x1.25) should parse to nominal 8, got ${threadChar?.cleanNominal}`);
  const linearChar = sheet2Chars.find(c => c.type === 'linear');
  assert(!!linearChar && linearChar.cleanNominal === 35, `Sheet 2's linear dimension should be 35, got ${linearChar?.cleanNominal}`);
  console.log('✓ Sheet 2 dimensions (rotated 90°, alongside German text) correctly extracted and typed');

  console.log('>>> MULTI-PAGE MIXED-ROTATION + LANGUAGE TEST PASSED! <<<');
}

run();
