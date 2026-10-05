/**
 * Golden-File Regression Test: Real Pentair/SolidWorks Drawing (89108946.pdf)
 *
 * A second real-world ground truth alongside test_rotated_customer_drawing_extraction.ts
 * (CINH91CDB11-B.pdf, a French/Amphenol/SolidEdge drawing). Where that fixture exercises
 * European title-block conventions and SolidEdge's CAD symbol-font substitutions, this one
 * exercises US MIL-STD/ASME Y14.5 conventions and a SolidWorks export — a genuinely different
 * spectrum of inputs, per the project's stated regression policy: every new parser/engine change
 * must be a generalized improvement, verified against the full growing set of previously
 * validated real drawings, never a fix that helps one drawing at the expense of another.
 *
 * Independently verifying against this drawing (2026-10-06) found three real, previously-latent
 * bugs, all fixed and locked in here:
 *
 * 1. Part Number/Drawing Number extracted as "." instead of "89108946" — a label ending in a
 *    bare period ("PART NO.", no colon) had its own trailing period swallowed as the value.
 * 2. Part Revision/Drawing Revision blank instead of "B" — pdf.js fused the revision-history
 *    table's date cell with the adjacent initials cell into one run ("18/03/2014HDL"), and the
 *    date parser required the whole cell to be nothing but the date.
 * 3. Six fabricated "characteristics" with no corresponding feature on the part: the title
 *    block's general-tolerance legend table ("ZERO PLACE X ±2.5", "ONE PLACE .X ±0.8", etc.)
 *    and the NOTES list's own index markers ("1.", "2.") were syntactically indistinguishable
 *    from real toleranced dimensions and leaked straight through.
 *
 * One known, NOT-yet-fixed limitation is deliberately asserted here too (not silently ignored):
 * this drawing's GD&T symbols (parallelism/flatness) are drawn as pure vector line art with no
 * extractable text character at all — a fundamentally different, harder problem than a wrong
 * glyph substitution (see GdtParser's SYMBOL_FONT_GLYPH_REGISTRY), requiring shape/image
 * recognition rather than a text-parsing fix. Those 6 callouts are still extracted as plain
 * dimensions today; asserting that here means a future fix for it will be a deliberate,
 * visible change to this test, not an unnoticed drift.
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
  console.log('--- TEST: Golden-File Real Pentair/SolidWorks Drawing Extraction (89108946) ---');

  const pdfPath = path.join(__dirname, 'fixtures/89108946.pdf');
  const buffer = fs.readFileSync(pdfPath);
  const doc = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;

  const { characteristics, projectProps, titleBlockFields, titleBlockWarning } = await DrawingExtractionService.extractCharacteristics(doc);

  assert(!titleBlockWarning, `Expected no title-block warning, got: "${titleBlockWarning}"`);

  console.log('► Title block (US MIL-STD/ASME convention, label ending in a bare period)...');
  assert(projectProps.partNumber === '89108946', `Part number: expected "89108946", got "${projectProps.partNumber}"`);
  assert(projectProps.drawingNumber === '89108946', `Drawing number: expected "89108946", got "${projectProps.drawingNumber}"`);
  assert(projectProps.partRevision === 'B', `Part revision: expected "B" (from the revision-history table), got "${projectProps.partRevision}"`);
  assert(projectProps.drawingRevision === 'B', `Drawing revision: expected "B", got "${projectProps.drawingRevision}"`);
  assert(projectProps.partName === 'FLANGE, C-POST; 316', `Part name: expected "FLANGE, C-POST; 316", got "${projectProps.partName}"`);
  assert(projectProps.cageCode === '', 'No CAGE code exists on this drawing — must stay blank, never fabricated');
  console.log('  PASS: Part/Drawing Number "89108946", Revision "B", Part Name all correct\n');

  console.log('► Form 2 supplementary fields (material/finish, no CAGE)...');
  assert(titleBlockFields.treatment === 'NA', `Finish: expected "NA" (literal drawing value), got "${titleBlockFields.treatment}"`);
  assert(titleBlockFields.format === 'B', `Size/format: expected "B", got "${titleBlockFields.format}"`);
  console.log('  PASS\n');

  console.log('► General-tolerance legend table and NOTES list index markers excluded...');
  const legendLeakage = characteristics.filter(c =>
    /^(?:[.\dX]\s*±\s*[\d.]+|±\s*[\d.]+)$/.test(c.rawText.trim()) || /^\d{1,2}\.$/.test(c.rawText.trim())
  );
  assert(legendLeakage.length === 0, `Expected 0 phantom legend/notes-index characteristics, found ${legendLeakage.length}: ${JSON.stringify(legendLeakage.map(c => c.rawText))}`);
  assert(characteristics.length === 46, `Expected exactly 46 characteristic rows (45 real callouts, one split into 32.1/32.2), got ${characteristics.length}`);
  console.log('  PASS: no fabricated dimensions from "ZERO PLACE X ±2.5" / "ONE PLACE .X ±0.8" / NOTES "1."/"2." — 46 rows exactly\n');

  console.log('► Known limitation (not yet fixed): vector-drawn GD&T symbols have no extractable text...');
  // These callouts show a parallelism/flatness symbol drawn as pure vector line art in the PDF —
  // no character for GdtParser to ever see — so they still come through as plain dimensions with
  // a title-block-derived tolerance band, not a recognized GD&T frame. This assertion documents
  // the current (wrong) behavior deliberately, so a future fix changes this file, not silently.
  const vectorSymbolGdt = characteristics.filter(c => /^0\.4(?:\s+A)?$/.test(c.rawText.trim()));
  assert(vectorSymbolGdt.length === 6, `Expected exactly 6 still-unresolved vector-symbol GD&T callouts, got ${vectorSymbolGdt.length}`);
  assert(vectorSymbolGdt.every(c => c.type === 'linear' && c.classification === 'Major'), 'Each must still be misclassified as a plain Major linear dimension (documents the gap, not a regression)');
  console.log('  CONFIRMED (documented gap, not asserted as correct): 6 vector-only GD&T symbols still read as plain dimensions\n');

  console.log('>>> GOLDEN PENTAIR FLANGE EXTRACTION TEST PASSED! <<<');
}

run().catch((err) => {
  console.error('Golden Pentair Flange Extraction Test Failed:', err);
  process.exit(1);
});
