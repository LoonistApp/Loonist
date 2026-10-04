/**
 * PRODUCTION-PATH VALIDATION — not a test file, no assert() helpers, no test-only shortcuts.
 *
 * This calls the exact same production modules and argument shapes the real app uses:
 *
 *   - PDF loading options mirror PDFRenderService.loadDocument() exactly (same bundled
 *     cmaps/standard_fonts/wasm/iccs asset directories under public/pdfjs, copied there by
 *     the same scripts/copy-pdfjs-assets.mjs the app's own build runs) instead of the bare
 *     `pdfjsLib.getDocument({data})` the test suite uses (which is why those tests print
 *     "standardFontDataUrl not provided" warnings — this script shouldn't).
 *   - DrawingExtractionService.extractCharacteristics() is called with the exact argument
 *     shape App.tsx's handleSmartExtract() uses: undefined onProgress, the real
 *     DEFAULT_PROJECT_SETTINGS, undefined targetSheet (the "extract all sheets" scope —
 *     equivalent to "active sheet" for these single-page fixtures), an empty existing-
 *     characteristics array, and allowDemoFallback omitted (defaults to false, same as the
 *     real app's call).
 *
 * Caveat, stated plainly rather than glossed over: this runs under Node (tsx), not literally
 * inside Chrome. The one behavior gated on `typeof document !== 'undefined'` is the
 * scanned-sheet OCR fallback — irrelevant here since both fixtures below are vector-text
 * PDFs with plenty of text content, so that branch is never reached by either the Node run or
 * a real browser run. Every other line of the production code path — title-block field
 * matching, the revision-history-table reader, dimension extraction, PDF asset loading — is
 * identical to what the Electron app executes.
 *
 * This just prints the raw result the app's handleSmartExtract() would receive — no
 * pass/fail assertions here, that's for a human (or a separate test) to judge.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { DrawingExtractionService } from '../src/services/ai/drawingExtractionService.ts';
import { DEFAULT_PROJECT_SETTINGS } from '../src/types/settings.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function loadDocumentLikeProduction(filePath: string) {
  const data = fs.readFileSync(filePath);
  const assetDir = (dir: string) => `${path.join(__dirname, '../public/pdfjs', dir).replace(/\\/g, '/')}/`;
  // Same options PDFRenderService.loadDocument() passes, minus useSystemFonts (a browser-only
  // Canvas/font-matching knob with no Node equivalent — doesn't affect getTextContent()).
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(data),
    cMapUrl: assetDir('cmaps'),
    cMapPacked: true,
    standardFontDataUrl: assetDir('standard_fonts'),
    wasmUrl: assetDir('wasm'),
    iccUrl: assetDir('iccs'),
  });
  return await loadingTask.promise;
}

async function validate(label: string, fileName: string) {
  console.log(`\n=== ${label} (${fileName}) ===`);
  const pdfDoc = await loadDocumentLikeProduction(path.join(__dirname, 'fixtures', fileName));

  // Exact argument shape App.tsx's handleSmartExtract() passes to extractCharacteristics:
  // (pdfDoc, onProgress, settings, targetSheet, existingCharacteristics[, allowDemoFallback]).
  const result = await DrawingExtractionService.extractCharacteristics(
    pdfDoc,
    undefined,
    DEFAULT_PROJECT_SETTINGS,
    undefined,
    []
  );

  console.log('titleBlockWarning:', result.titleBlockWarning ?? '(none)');
  console.log('projectProps:', JSON.stringify({
    partNumber: result.projectProps.partNumber,
    partName: result.projectProps.partName,
    partRevision: result.projectProps.partRevision,
    cageCode: result.projectProps.cageCode,
    drawingNumber: result.projectProps.drawingNumber,
    drawingName: result.projectProps.drawingName,
    drawingRevision: result.projectProps.drawingRevision,
  }, null, 2));
  console.log('titleBlockFields:', JSON.stringify(result.titleBlockFields ?? {}, null, 2));
  console.log('characteristics count:', result.characteristics.length);
}

async function run() {
  await validate('Real customer drawing', 'CINH91CDB11-B.pdf');
  await validate('Synthetic German/English generalization fixture', 'title_block_table_generalization.pdf');
}

run();
