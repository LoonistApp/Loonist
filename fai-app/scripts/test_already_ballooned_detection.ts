/**
 * Regression Suite: Already-Ballooned PDF Detection & Rejection (2026-10-05)
 *
 * An independent FAI/AS9102 QA review found that re-extracting from a PDF this engine had
 * already ballooned (e.g. a user re-importing their own exported "..._BALLOONED_MARKED.pdf")
 * corrupted the result: every balloon's own item-number label reads as a plausible bare-integer
 * "dimension" to the text-based extractor, producing one phantom Form 3 characteristic per
 * balloon (confirmed directly against a real marked export: 43 genuine characteristics became
 * 154 once the marked PDF was fed back in).
 *
 * This builds the marked PDF with the REAL exporter (MarkedPdfExporter) from the REAL
 * characteristics extracted off the bundled clean fixture — a genuine round trip through
 * production code, not a hand-built synthetic PDF — so this test tracks the actual balloon
 * drawing implementation rather than a guess at its output shape.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { DrawingExtractionService, AlreadyBalloonedPdfError } from '../src/services/ai/drawingExtractionService.ts';
import { MarkedPdfExporter } from '../src/services/export/markedPdfExporter.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion Failed: ${message}`);
  }
}

async function run() {
  console.log('--- TEST: Already-Ballooned PDF Detection & Rejection ---');

  const pdfPath = path.join(__dirname, 'fixtures/CINH91CDB11-B.pdf');
  const buffer = fs.readFileSync(pdfPath);

  // 1. Clean drawing extracts normally, with no false-positive rejection.
  const cleanDoc = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
  const { characteristics } = await DrawingExtractionService.extractCharacteristics(cleanDoc as any);
  assert(characteristics.length > 20, `Expected a substantial genuine characteristic count from the clean drawing, got ${characteristics.length}`);
  console.log(`✓ Clean drawing extracts normally with no false-positive rejection (${characteristics.length} genuine characteristics)`);

  // 2. Generate a REAL marked/ballooned PDF from those genuine characteristics using the actual
  // production exporter.
  const markedBytes = await MarkedPdfExporter.generateMarkedPdf(
    buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer,
    characteristics,
    undefined,
    { highlightNonConformance: false, showLeaderLines: true },
    cleanDoc as any
  );
  assert(markedBytes.length > 1000, 'Marked PDF generation produced an implausibly small file');
  console.log(`✓ Generated a real marked PDF via MarkedPdfExporter (${markedBytes.length} bytes, ${characteristics.length} balloons)`);

  // 3. Re-extracting from that marked PDF must be REFUSED outright, not silently contaminated —
  // and the detection must come from the PRIMARY structural signal (the actual drawn badge
  // shape), not just the sequence-counting fallback, proving this engine prefers detecting the
  // real structure/signature of its own balloons over simply counting small sequential numbers.
  const markedDoc = await pdfjsLib.getDocument({ data: markedBytes.slice() }).promise;
  let rejected = false;
  let rejectionMessage = '';
  let detectionMethod: string | undefined;
  try {
    await DrawingExtractionService.extractCharacteristics(markedDoc as any);
  } catch (e) {
    if (e instanceof AlreadyBalloonedPdfError) {
      rejected = true;
      rejectionMessage = e.message;
      detectionMethod = e.detectionMethod;
    } else {
      throw e;
    }
  }
  assert(rejected, 'Re-extracting from an already-ballooned PDF must throw AlreadyBalloonedPdfError, not silently produce phantom characteristics');
  assert(/already contain Loonist-generated balloon numbers/i.test(rejectionMessage), `Rejection message should clearly explain the cause, got: "${rejectionMessage}"`);
  assert(/original, unballooned drawing/i.test(rejectionMessage), `Rejection message should tell the user what to do instead, got: "${rejectionMessage}"`);
  assert(detectionMethod === 'badge', `Expected the PRIMARY structural badge detector to fire (not the sequence fallback), got detectionMethod="${detectionMethod}"`);
  console.log('✓ Re-extraction from the marked PDF is refused via the primary structural badge-shape signal (not just number-sequence counting), with a clear, actionable error');

  // 4. A genuinely plausible LEGITIMATE drawing — a dense run of small sequential integer
  // dimensions (e.g. a hole pattern dimensioned 1-20mm from a common datum), drawn as ordinary
  // text with no circular badge shapes at all — must NEVER be rejected. This is the exact false-
  // positive risk a naive "count small sequential numbers" detector would have; verified directly
  // against a hand-built synthetic PDF rather than assumed safe.
  const legitDoc = await PDFDocument.create();
  const legitPage = legitDoc.addPage([600, 400]);
  const legitFont = await legitDoc.embedFont(StandardFonts.Helvetica);
  for (let n = 1; n <= 20; n++) {
    legitPage.drawText(String(n), {
      x: 20 + (n % 10) * 55,
      y: 350 - Math.floor(n / 10) * 150,
      size: 14,
      font: legitFont,
      color: rgb(0, 0, 0)
    });
  }
  const legitBytes = await legitDoc.save();
  const legitPdfJsDoc = await pdfjsLib.getDocument({ data: legitBytes }).promise;
  let legitRejected = false;
  try {
    const result = await DrawingExtractionService.extractCharacteristics(legitPdfJsDoc as any);
    assert(result.characteristics.length > 0, 'Expected the legitimate sequential-dimension drawing to actually extract its characteristics');
  } catch (e) {
    if (e instanceof AlreadyBalloonedPdfError) legitRejected = true;
    else throw e;
  }
  assert(!legitRejected, 'A legitimate drawing with 20 real sequential small-integer dimensions (no balloon badge shapes) must NEVER be rejected as already-ballooned');
  console.log('✓ A legitimate drawing with 20 real sequential small-integer dimensions (no badge shapes) extracts normally — no false-positive rejection');

  console.log('>>> ALREADY-BALLOONED PDF DETECTION TEST PASSED! <<<');
}

run();
