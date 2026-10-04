/**
 * Regression test: the OCR-only fuzzy label matcher and the title-block value plausibility
 * guard, tested directly.
 *
 * Why direct calls instead of an end-to-end PDF fixture: the OCR fallback path only runs when
 * `typeof document !== 'undefined'` (it renders the page to a canvas and calls Tesseract),
 * which requires a browser DOM this Node-based (tsx) test runner doesn't have — there is no
 * way to reach that code path through the public extractCharacteristics() API in this suite.
 * `fuzzyMatchTitleBlockLabel` and `isPlausibleTitleBlockValue` are `private static`, which
 * TypeScript only enforces at compile time; casting to `any` to call them directly is the
 * practical way to pin this logic without a real OCR engine in the loop. If a future refactor
 * removes or renames these methods, update this test alongside it rather than deleting it.
 */
import { DrawingExtractionService } from '../src/services/ai/drawingExtractionService.ts';

const svc = DrawingExtractionService as unknown as {
  fuzzyMatchTitleBlockLabel: (text: string, field: 'partNumber' | 'partRevision' | 'cageCode' | 'partName') => { value: string } | undefined;
  isPlausibleTitleBlockValue: (value: string) => boolean;
};

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion Failed: ${message}`);
  }
}

function run() {
  console.log('--- TEST: OCR Fuzzy Label Matching & Title-Block Value Plausibility Guard ---');

  // OCR garbling: zero/O confusion and a dropped colon should still resolve to the right field.
  const n0 = svc.fuzzyMatchTitleBlockLabel('PART N0 12345-A', 'partNumber');
  assert(!!n0 && n0.value === '12345-A', `"PART N0 12345-A" should fuzzy-match partNumber, got ${JSON.stringify(n0)}`);
  console.log('✓ "PART N0" (zero for O) fuzzy-matches "PART NO"');

  const cageCode = svc.fuzzyMatchTitleBlockLabel('CAGE COD 1ABC2', 'cageCode');
  assert(!!cageCode && cageCode.value === '1ABC2', `"CAGE COD 1ABC2" should fuzzy-match cageCode, got ${JSON.stringify(cageCode)}`);
  console.log('✓ "CAGE COD" (dropped E) fuzzy-matches "CAGE CODE"');

  // Bare "CAGE"/"CASE" collision: the 4-character form must NOT fuzz (would false-match the
  // ordinary English word "CASE" via a single-character edit distance).
  const caseWord = svc.fuzzyMatchTitleBlockLabel('CASE STUDY', 'cageCode');
  assert(caseWord === undefined, `Bare "CAGE" must not fuzzy-match unrelated word "CASE", got ${JSON.stringify(caseWord)}`);
  console.log('✓ Bare "CAGE" does not fuzzy-match the unrelated word "CASE"');

  // Plausibility guard: short identifiers/names pass, sentence-length and bilingual-caption
  // text (the real failure mode found in CINH91CDB11-B.pdf) are rejected.
  assert(svc.isPlausibleTitleBlockValue('BRACKET ASSY'), 'A short plausible value should pass the guard');
  assert(!svc.isPlausibleTitleBlockValue('Description de la modification / Description of the modification'),
    'A bilingual table-header caption should be rejected by the guard');
  assert(!svc.isPlausibleTitleBlockValue('A'.repeat(90)), 'An implausibly long value (>80 chars) should be rejected by the guard');
  assert(!svc.isPlausibleTitleBlockValue(''), 'An empty value should be rejected by the guard');
  console.log('✓ Plausibility guard accepts short values and rejects bilingual captions / sentence-length text');

  console.log('>>> OCR FUZZY MATCHING & PLAUSIBILITY GUARD TEST PASSED! <<<');
}

run();
