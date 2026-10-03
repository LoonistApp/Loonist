/**
 * Regression Test: Coordinate Transform Rotation Invariance
 *
 * CINH91CDB11-B.pdf (see test_rotated_customer_drawing_extraction.ts) only covers /Rotate 90.
 * Real drawings can carry /Rotate 0, 90, 180, or 270 — per the PDF spec, /Rotate only changes
 * how a viewer DISPLAYS the page; the content stream's text coordinates stay in the page's
 * natural (unrotated) space. This test generates 4 fixtures with IDENTICAL content differing
 * only in their /Rotate value (scripts/generate_rotation_test_pdfs.mjs) and asserts the same
 * three dimensions are extracted, with the same values, regardless of rotation — proving
 * DrawingExtractionService.textItemToViewportBox's use of pdf.js's own viewport transform
 * (Util.transform) generalizes to every rotation, not just the one real fixture happens to use.
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
  console.log('--- TEST: Coordinate Transform Rotation Invariance (0/90/180/270) ---');

  for (const rotate of [0, 90, 180, 270]) {
    const pdfPath = path.join(__dirname, `fixtures/rotation_test_${rotate}.pdf`);
    const buffer = fs.readFileSync(pdfPath);
    const doc = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
    const page = await doc.getPage(1);
    assert((page as any).rotate === rotate, `Fixture rotation_test_${rotate}.pdf should carry /Rotate ${rotate}, got ${(page as any).rotate}`);

    const { characteristics } = await DrawingExtractionService.extractCharacteristics(doc as any);
    const nominals = characteristics.map(c => c.cleanNominal).sort((a, b) => (a ?? 0) - (b ?? 0));

    assert(
      nominals.length === 3 && nominals[0] === 12.5 && nominals[1] === 28.5 && nominals[2] === 45,
      `/Rotate ${rotate}: expected dimensions [12.5, 28.5, 45], got [${nominals.join(', ')}] — coordinate transform may have regressed for this rotation`
    );

    // No characteristic should land with a nonsensical (far outside the 800x600 fixture)
    // bounding box — the original symptom of the pre-fix naive `height - y` flip.
    const viewport = page.getViewport({ scale: 1.0 });
    const offSheet = characteristics.filter(c => {
      const b = (c as any).boundingBox;
      return b && (b.x < -50 || b.y < -50 || b.x > viewport.width + 50 || b.y > viewport.height + 50);
    });
    assert(offSheet.length === 0, `/Rotate ${rotate}: ${offSheet.length} characteristic(s) placed outside the sheet bounds`);

    console.log(`✓ /Rotate ${rotate}: all 3 dimensions [12.5, 28.5, 45] correctly extracted within sheet bounds`);
  }

  console.log('>>> ROTATION INVARIANCE TEST PASSED! <<<');
}

run();
