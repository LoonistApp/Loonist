/**
 * Regression Suite: Organization/Company Name Detection Across Title-Block Layouts (2026-10-05)
 *
 * Production-hardening follow-up: the original detector only worked when a PHONE/FAX-labeled
 * address block sat near the company name. This verifies the generalized two-signal detector
 * (DrawingExtractionService.detectOrganizationName) across layouts that do and don't have one,
 * and confirms it stays blank (never guesses) when the title block is genuinely ambiguous.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { DrawingExtractionService } from '../src/services/ai/drawingExtractionService.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion Failed: ${message}`);
  }
}

/** Builds a synthetic page with a bottom-right title block populated from `fields`. */
async function buildTitleBlockPdf(fields: Array<{ text: string; x: number; y: number; size: number }>): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  // Large page (width >= 1000pt) so getTitleBlockBoxSize uses the 380x180 bottom-right box.
  const page = doc.addPage([1200, 800]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (const f of fields) {
    page.drawText(f.text, { x: f.x, y: f.y, size: f.size, font, color: rgb(0, 0, 0) });
  }
  return doc.save();
}

async function run() {
  console.log('--- TEST: Organization Name Detection Across Title-Block Layouts ---');

  // 1. Real drawing WITH a PHONE/FAX-labeled address block (signal 1) — regression guard, same
  // fixture the golden extraction test already covers in full; re-asserted here in isolation.
  const realBuffer = fs.readFileSync(path.join(__dirname, 'fixtures/CINH91CDB11-B.pdf'));
  const realDoc = await pdfjsLib.getDocument({ data: new Uint8Array(realBuffer) }).promise;
  const { projectProps: realProps } = await DrawingExtractionService.extractCharacteristics(realDoc as any);
  assert(realProps.organizationName === 'Amphenol', `Expected "Amphenol" via the address-block signal, got "${realProps.organizationName}"`);
  console.log('✓ Signal 1 (PHONE/FAX-anchored address block): "Amphenol" correctly found');

  // 2. Synthetic title block with NO phone/fax at all — the company name is simply the one
  // clear font-size outlier among several small, equal-sized "data" fields (signal 2). This is
  // the exact layout the original PHONE/FAX-only detector could never handle.
  // Title block zone for a 1200-wide page is x:[820,1200] y:[620,800] in viewport space, which
  // for an unrotated page is the same as low pdf-lib y / high pdf-lib x.
  // Includes realistic UNLABELED filler (finish note, tolerance note, approval initials) in
  // addition to the labeled fields — a real title block always has more plain "data" text than
  // just its few recognized label:value pairs, which is what signal 2's median comparison needs
  // enough of to be meaningful (the recognized fields themselves get excluded as "already
  // identified as something else").
  const noPhoneBytes = await buildTitleBlockPdf([
    { text: 'PART-4471-B', x: 850, y: 90, size: 7 },
    { text: 'REV C', x: 850, y: 75, size: 7 },
    { text: 'SCALE 1:2', x: 850, y: 60, size: 7 },
    { text: 'SHEET 1 OF 1', x: 850, y: 45, size: 7 },
    { text: 'Bracket Assembly', x: 850, y: 30, size: 7 },
    { text: 'FINISH: ANODIZE', x: 1000, y: 90, size: 7 },
    { text: 'TOL: ±0.005 UNLESS NOTED', x: 1000, y: 75, size: 7 },
    { text: 'APPROVED JD', x: 1000, y: 60, size: 7 },
    { text: 'Meridian Aerostructures', x: 850, y: 120, size: 16 } // the clear outlier
  ]);
  const noPhoneDoc = await pdfjsLib.getDocument({ data: noPhoneBytes }).promise;
  const { projectProps: noPhoneProps } = await DrawingExtractionService.extractCharacteristics(noPhoneDoc as any);
  assert(noPhoneProps.organizationName === 'Meridian Aerostructures', `Expected "Meridian Aerostructures" via the font-outlier signal (no PHONE/FAX present), got "${noPhoneProps.organizationName}"`);
  console.log('✓ Signal 2 (font-size outlier, no PHONE/FAX present): "Meridian Aerostructures" correctly found');

  // 3. Genuinely ambiguous title block: TWO equally large text runs (e.g. a part designation
  // styled just as large as the company name) — must stay blank rather than guess which one is
  // the organization.
  const ambiguousBytes = await buildTitleBlockPdf([
    { text: 'PART-9981', x: 850, y: 90, size: 7 },
    { text: 'REV A', x: 850, y: 75, size: 7 },
    { text: 'SCALE 1:1', x: 850, y: 60, size: 7 },
    { text: 'SHEET 1 OF 1', x: 850, y: 45, size: 7 },
    { text: 'FINISH: PASSIVATE', x: 1000, y: 90, size: 7 },
    { text: 'TOL: ±0.005 UNLESS NOTED', x: 1000, y: 75, size: 7 },
    { text: 'APPROVED JD', x: 1000, y: 60, size: 7 },
    { text: 'Landing Gear Strut', x: 850, y: 120, size: 16 }, // large designation
    { text: 'Vantage Precision Works', x: 850, y: 150, size: 16 } // equally large company name
  ]);
  const ambiguousDoc = await pdfjsLib.getDocument({ data: ambiguousBytes }).promise;
  const { projectProps: ambiguousProps } = await DrawingExtractionService.extractCharacteristics(ambiguousDoc as any);
  assert(!ambiguousProps.organizationName, `Expected organization name to stay blank when two equally-large candidates exist (genuinely ambiguous), got "${ambiguousProps.organizationName}"`);
  console.log('✓ Ambiguous title block (two equally-large candidates): correctly stays blank rather than guessing');

  // 4. Sparse/non-title-block page: a handful of large, isolated text runs with no populated
  // title-block cluster at all must not be mistaken for a company name either (the >=5
  // unconsumed-items density gate).
  const sparseBytes = await buildTitleBlockPdf([
    { text: 'SOME LARGE NOTE', x: 850, y: 90, size: 16 }
  ]);
  const sparseDoc = await pdfjsLib.getDocument({ data: sparseBytes }).promise;
  const { projectProps: sparseProps } = await DrawingExtractionService.extractCharacteristics(sparseDoc as any);
  assert(!sparseProps.organizationName, `Expected organization name to stay blank on a sparse page with no real title-block cluster, got "${sparseProps.organizationName}"`);
  console.log('✓ Sparse page (no real title-block cluster): correctly stays blank rather than guessing from an isolated large text run');

  console.log('>>> ORGANIZATION NAME DETECTION TEST PASSED! <<<');
}

run();
