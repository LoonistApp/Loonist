/**
 * Regression test proving the structural table-extraction logic (built for
 * CINH91CDB11-B.pdf's bilingual title block) generalizes rather than being tuned to that one
 * drawing's template. This synthetic fixture deliberately differs from it:
 *
 * - A different language pairing (German/English "Werkstoff / Material") than the real
 *   fixture's French/English.
 * - A different zone (top-right block, not the bottom-right corner / bottom strip).
 * - A 3-row revision history where the latest-dated entry ("C", 01/12/2025) sits physically in
 *   the MIDDLE row, not first or last — this only passes if revision selection is genuinely by
 *   parsed date value, not by row position or table order.
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
  console.log('--- TEST: Title-Block Table Structure Generalization ---');

  const pdfPath = path.join(__dirname, 'fixtures/title_block_table_generalization.pdf');
  const buffer = fs.readFileSync(pdfPath);
  const doc = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;

  const { characteristics, projectProps, titleBlockFields } = await DrawingExtractionService.extractCharacteristics(doc);

  assert(projectProps.partRevision === 'C', `Expected current revision "C" (latest date, middle row), got "${projectProps.partRevision}"`);
  console.log('✓ Current revision correctly read as "C" — the latest-dated row, even though it sits physically in the middle of the table');

  assert(titleBlockFields?.material === 'Aluminum 6061', `Expected material "Aluminum 6061" via the German/English "Werkstoff / Material" pair, got "${titleBlockFields?.material}"`);
  console.log('✓ German/English bilingual label ("Werkstoff / Material") correctly resolved to its stacked value, a different language pairing than the real fixture');

  // None of the revision-table cells (dates, revision letters) or the material value should
  // leak through as fake dimensions/characteristics.
  const leaked = characteristics.filter(c =>
    ['A', 'B', 'C'].includes(c.rawText.trim()) ||
    /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(c.rawText.trim()) ||
    c.rawText.trim() === 'Aluminum 6061'
  );
  assert(leaked.length === 0, `Title-block table cells leaked through as characteristics: ${leaked.map(c => `"${c.rawText}"`).join(', ')}`);
  console.log('✓ No revision-table or material cells leaked through as fake characteristics');

  console.log('>>> TITLE-BLOCK TABLE GENERALIZATION TEST PASSED! <<<');
}

run();
