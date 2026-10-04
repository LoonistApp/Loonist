/**
 * Regression test: German (DIN) and French (NF) single-word title-block labels are recognized
 * when they sit in the same simple "LABEL: value" structure the English synonyms already cover.
 *
 * This is deliberately a narrower claim than "the engine understands non-English title
 * blocks" — see test_rotated_customer_drawing_extraction.ts and the doc comment on
 * TITLE_BLOCK_FIELD_SYNONYMS for why a real bilingual table-style French title block
 * (CINH91CDB11-B.pdf) is intentionally left unrecognized rather than guessed at.
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
  console.log('--- TEST: Title-Block German/French Label Synonyms ---');

  const pdfPath = path.join(__dirname, 'fixtures/title_block_german_french_labels.pdf');
  const buffer = fs.readFileSync(pdfPath);
  const doc = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;

  const { projectProps, titleBlockWarning } = await DrawingExtractionService.extractCharacteristics(doc);

  assert(!titleBlockWarning, `Expected no title-block warning, got: "${titleBlockWarning}"`);
  assert(projectProps.partNumber === '4455-DE', `German "TEIL NR:" not matched, got "${projectProps.partNumber}"`);
  assert(projectProps.partRevision === 'D', `French "INDICE:" not matched, got "${projectProps.partRevision}"`);
  assert(projectProps.cageCode === '3XY99', `French "CODE CAGE:" not matched, got "${projectProps.cageCode}"`);
  assert(projectProps.partName === 'SUPPORT BRACKET', `French "DESIGNATION:" not matched, got "${projectProps.partName}"`);
  console.log('✓ German "TEIL NR", French "INDICE", "CODE CAGE", and "DESIGNATION" all correctly matched');

  console.log('>>> TITLE-BLOCK LANGUAGE SYNONYM TEST PASSED! <<<');
}

run();
