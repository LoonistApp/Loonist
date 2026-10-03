/**
 * Copies the Tesseract.js OCR runtime assets (WASM core variants + English trained-data model)
 * into public/tessdata so the scanned-drawing OCR fallback works fully offline.
 *
 * Without this, tesseract.js falls back to its documented default behavior: fetching the worker
 * script, WASM core, and language model from cdn.jsdelivr.net at runtime. On an air-gapped
 * machine — this product's whole positioning — that fallback never resolves, so the entire
 * scanned-drawing ingestion path silently hangs/fails with no local alternative.
 *
 * Runs before `npm run dev` and `npm run build`; the copies are git-ignored (see
 * copy-pdfjs-assets.mjs for the identical pattern already used for pdf.js's own assets).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const target = path.join(root, 'public', 'tessdata');

// WASM core (all lstm/simd variants — tesseract.js auto-selects the right one at runtime based
// on the browser/Electron renderer's WASM feature support).
const coreSource = path.join(root, 'node_modules', 'tesseract.js-core');
if (!fs.existsSync(coreSource)) {
  throw new Error('tesseract.js-core is missing — run npm install');
}
const coreTarget = path.join(target, 'core');
fs.rmSync(coreTarget, { recursive: true, force: true });
fs.mkdirSync(coreTarget, { recursive: true });
for (const file of fs.readdirSync(coreSource)) {
  if (file.endsWith('.js') || file.endsWith('.wasm')) {
    fs.copyFileSync(path.join(coreSource, file), path.join(coreTarget, file));
  }
}

// English trained-data model. Tesseract.js's own CDN fallback uses the "4.0.0_best_int" variant
// whenever lstmOnly is active (the default OEM.LSTM_ONLY we use) — bundle the same variant so
// local behavior matches what the CDN default would have served.
const langSource = path.join(root, 'node_modules', '@tesseract.js-data', 'eng', '4.0.0_best_int', 'eng.traineddata.gz');
if (!fs.existsSync(langSource)) {
  throw new Error('@tesseract.js-data/eng is missing — run npm install');
}
const langTarget = path.join(target, 'lang');
fs.mkdirSync(langTarget, { recursive: true });
fs.copyFileSync(langSource, path.join(langTarget, 'eng.traineddata.gz'));

console.log('Tesseract.js OCR assets copied to public/tessdata');
