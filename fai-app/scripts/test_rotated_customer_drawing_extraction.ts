/**
 * Golden-File Regression Test: Rotated Real Customer Drawing (CINH91CDB11-B)
 *
 * Covers a bug class the synthetic sample_blueprint.pdf fixture cannot exercise: a real,
 * born-digital, 90-degree-ROTATED, FRENCH-labeled title block drawing (ISO 5457 side-strip
 * title block, not the ASME bottom-right corner box the rest of the engine assumes).
 *
 * This fixture was added 2026-10-03 after an audit found that:
 *   1. drawingExtractionService.ts computed text positions with a `viewport.height - y` flip
 *      that only works for an unrotated page — on this page it put text at coordinates outside
 *      the sheet entirely, corrupting every downstream heuristic (sort order, clustering,
 *      title-block zone, border-grid detection). Fixed via pdf.js's own viewport transform.
 *   2. A missing title-block match (English-only field labels) was silently backfilled with the
 *      bundled demo part's fake identity (name/number/CAGE code) instead of surfacing a failure.
 *      Fixed: missing fields are now left blank with an explicit titleBlockWarning.
 *   3. Ø10.5 holes with a real ISO 286 stacked limit/deviation tolerance (nominal "10.5" with
 *      "0" written above and "-0.08" below, on separate lines) were silently discarded in favor
 *      of a generic default tolerance class. Fixed via SpatialClusteringEngine's
 *      reattachDeviationsAboveNominal pass + GdtParser's stacked-limit-deviation rule.
 *
 * Follow-up pass (2026-10-04), found by visually checking a real ballooned render against this
 * same fixture:
 *   4. A GD&T feature-control-frame absorbed an UNRELATED neighboring hole's stray "-0.08"
 *      deviation line merely because the frame sat closer above it than the hole's own nominal
 *      did. Fixed by requiring isCompanionCallout's explicit-tolerance rule to only attach to a
 *      plain numeric nominal, never to a frame/datum-reference string.
 *   5. A "18X" repeated-feature multiplier was orphaned from its own Ø10.5 hole by a sort-order
 *      quirk (same underlying issue as #3, one pipeline stage earlier) and ended up fused onto
 *      an unrelated neighboring GD&T frame instead. Fixed via
 *      DrawingExtractionService.reattachOrphanMultipliers.
 *   6. GD&T frames whose leading symbol glyph isn't one of the known Unicode GD&T characters
 *      (this font substitutes plain Latin letters for them) were falling through to a generic
 *      "linear" dimension parse — silently misrepresenting a GD&T characteristic as a plain
 *      dimension. Fixed by recognizing the frame by STRUCTURE (GdtParser.parseSpaceDelimitedFrame)
 *      and reporting the characteristic as 'unknown' + forcing needs_review rather than guessing
 *      which specific GD&T symbol it is.
 *
 * Follow-up pass (2026-10-04), after the user manually verified this drawing's title block
 * against the real PDF and asked for it to be read structurally rather than left blank:
 *   7. The title block here is a genuine bilingual TABLE — "Référence / Part number" sits in
 *      one row with its value ("CINH91CDB11") in a different, stacked row below it, and the
 *      revision is a multi-row dated history ("A" 14/05/2025, "B" 27/05/2025), not a single
 *      "REV: X" field. Reading it correctly needed real structural support — diacritic-aware
 *      label matching, telling a bilingual label's OTHER half apart from a real value
 *      (isBilingualLabelResidue), and a dedicated date-anchored revision-history-table reader
 *      (findCurrentRevisionFromHistoryTable) that picks the row with the latest date rather
 *      than guessing a position — not AUXEL-specific hardcoding of these 3 values. This test's
 *      assertions below were updated FROM "stays blank, unrecognized" TO these user-verified
 *      correct values once that support existed; see drawingExtractionService.ts's
 *      TITLE_BLOCK_FIELD_SYNONYMS doc comment for what's still deliberately out of scope
 *      (ISO 7200 numbered fields — no verified mapping exists to build against).
 *
 * If a future change legitimately alters these numbers, update the expectations deliberately
 * (and say why in the commit) — don't just delete the assertion.
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
  console.log('--- TEST: Rotated Real Customer Drawing Extraction (CINH91CDB11-B) ---');

  const pdfPath = path.join(__dirname, 'fixtures/CINH91CDB11-B.pdf');
  const buffer = fs.readFileSync(pdfPath);
  const doc = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;

  assert(doc.numPages === 1, `Fixture page count changed: expected 1, got ${doc.numPages}.`);
  const page = await doc.getPage(1);
  assert((page as any).rotate === 90, `Fixture is expected to carry an intrinsic /Rotate 90 — got ${(page as any).rotate}. This fixture exists specifically to cover rotated-page handling.`);

  const { characteristics, projectProps, titleBlockWarning, titleBlockFields } = await DrawingExtractionService.extractCharacteristics(doc as any);

  // 1. Title block identity, manually verified by the user against the real PDF (2026-10-04):
  // part number / part name / revision must be read correctly from this bilingual table-style
  // title block, and no titleBlockWarning should fire now that it's recognized. No CAGE code
  // exists on this drawing (a European ISO title block, not a US/NATO contracting one) — it
  // should stay blank, which is the correct answer here, not a fallback.
  assert(projectProps.partNumber === 'CINH91CDB11', `Part number: expected "CINH91CDB11", got "${projectProps.partNumber}"`);
  assert(projectProps.partName === 'Conductor', `Part name: expected "Conductor", got "${projectProps.partName}"`);
  assert(projectProps.partRevision === 'B', `Revision: expected "B" (the latest-dated history-table entry, 27/05/2025), got "${projectProps.partRevision}"`);
  assert(projectProps.cageCode === '', `CAGE code: this drawing has none — expected blank, got "${projectProps.cageCode}"`);
  assert(!titleBlockWarning, `Expected no titleBlockWarning now that the title block is recognized, got: "${titleBlockWarning}"`);
  console.log('✓ Part number, part name, and current revision (from the dated history table) all match the user-verified ground truth; no CAGE code fabricated');

  // 1b. Supplementary title-block fields (not part of the persisted ProjectProperties model),
  // same user-verified ground truth.
  assert(titleBlockFields?.material === 'Cu-ETP H12', `Material: expected "Cu-ETP H12", got "${titleBlockFields?.material}"`);
  assert(titleBlockFields?.scale === '1:2', `Scale: expected "1:2", got "${titleBlockFields?.scale}"`);
  assert(titleBlockFields?.mass === '881.87 g', `Mass: expected "881.87 g", got "${titleBlockFields?.mass}"`);
  assert(titleBlockFields?.sheet === '1 / 1', `Sheet: expected "1 / 1", got "${titleBlockFields?.sheet}"`);
  assert(titleBlockFields?.format === 'A1', `Format: expected "A1", got "${titleBlockFields?.format}"`);
  console.log('✓ Supplementary fields (material, scale, mass, sheet, format) all match the user-verified ground truth');

  // 2. Real ISO 286 stacked limit/deviation tolerances on the Ø10.5 holes must be recovered,
  // not silently discarded in favor of a generic default tolerance class. All 5 holes recover it
  // once a GD&T frame is no longer able to steal one hole's deviation line out from under it
  // (see #4 above) — previously only 4 of 5 came through correctly.
  const toleredHoles = characteristics.filter(c => c.type === 'diameter' && c.cleanNominal === 10.5 && c.lowerLimit === 10.42);
  assert(toleredHoles.length === 5, `Expected all 5 of the 5 Ø10.5 holes to recover their real +0/-0.08 limit tolerance (upper=10.5, lower=10.42), got ${toleredHoles.length}`);
  console.log(`✓ All 5/5 Ø10.5 holes correctly recovered their real ISO 286 stacked limit tolerance (10.5 +0/-0.08)`);

  // 2b. The "18X" multiplier must land on its own Ø10.5 hole, not get fused onto an unrelated
  // neighboring GD&T frame.
  const multipliedHole = characteristics.find(c => c.type === 'diameter' && /^18x/i.test(c.rawText.trim()));
  assert(!!multipliedHole && multipliedHole.cleanNominal === 10.5, `Expected the "18X" multiplier to be attached to its own Ø10.5 hole, found: ${multipliedHole ? `"${multipliedHole.rawText}"` : 'nothing'}`);
  console.log('✓ "18X" multiplier correctly attached to its own Ø10.5 hole, not a neighboring GD&T frame');

  // 2c. GD&T feature-control-frames must be typed as 'gdt' (not silently misrepresented as a
  // plain 'linear' dimension) even when the leading symbol glyph isn't recognized — and an
  // unrecognized symbol must force needs_review rather than guessing which GD&T characteristic
  // it is.
  const gdtFrames = characteristics.filter(c => c.type === 'gdt');
  assert(gdtFrames.length === 8, `Expected 8 GD&T feature-control-frames on this drawing, got ${gdtFrames.length}`);
  assert(gdtFrames.every(c => c.verificationStatus === 'needs_review'), 'Every GD&T frame with an unrecognized leading symbol must be needs_review, not auto_accepted');
  assert(gdtFrames.every(c => !/-0\.\d+$/.test(c.rawText.trim())), `A GD&T frame absorbed an unrelated neighboring tolerance line: ${gdtFrames.filter(c => /-0\.\d+$/.test(c.rawText.trim())).map(c => `"${c.rawText}"`).join(', ')}`);
  console.log('✓ All 8 GD&T frames correctly typed, flagged needs_review for their unrecognized symbol, and clean of unrelated neighboring tolerance values');

  // 3. Coordinate/rotation handling: no characteristic should have been placed with an
  // out-of-sheet bounding box (the symptom of the original viewport.height-y flip bug).
  const sheetWidth = page.getViewport({ scale: 1.0 }).width;
  const sheetHeight = page.getViewport({ scale: 1.0 }).height;
  const offSheet = characteristics.filter(c => {
    const b = (c as any).boundingBox;
    return b && (b.x < -50 || b.y < -50 || b.x > sheetWidth + 50 || b.y > sheetHeight + 50);
  });
  assert(offSheet.length === 0, `${offSheet.length} characteristic(s) placed outside the sheet bounds — rotation/coordinate handling regressed: ${offSheet.map((c: any) => `#${c.itemNumber} "${c.rawText}"`).join(', ')}`);
  console.log('✓ All characteristics placed within sheet bounds (rotated-page coordinate handling correct)');

  // 4. Title-block revision-table metadata (dates, paper size, sheet count) must not leak
  // through as fake characteristics, regardless of where on the sheet the title block sits.
  const leakedMetadata = characteristics.filter(c => /\d{1,2}\/\d{1,2}\/\d{4}/.test(c.rawText) || /^A[0-4]$/.test(c.rawText.trim()));
  assert(leakedMetadata.length === 0, `Title-block metadata leaked through as characteristics: ${leakedMetadata.map(c => `#${c.itemNumber} "${c.rawText}"`).join(', ')}`);
  console.log('✓ No title-block revision-table metadata (dates, paper size) leaked through as characteristics');

  console.log('>>> ROTATED CUSTOMER DRAWING EXTRACTION TEST PASSED! <<<');
}

run();
