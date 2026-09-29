/**
 * Copies the pdf.js runtime assets (character maps, standard fonts, image decoders and
 * colour profiles) into public/pdfjs so drawings render fully offline. Runs before
 * `npm run dev` and `npm run build`; the copies are git-ignored.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(root, 'node_modules', 'pdfjs-dist');
const target = path.join(root, 'public', 'pdfjs');

for (const dir of ['cmaps', 'standard_fonts', 'wasm', 'iccs']) {
  const from = path.join(source, dir);
  if (!fs.existsSync(from)) {
    throw new Error(`pdfjs-dist is missing ${dir}/ — run npm install`);
  }
  fs.rmSync(path.join(target, dir), { recursive: true, force: true });
  fs.cpSync(from, path.join(target, dir), { recursive: true });
}

console.log('pdf.js assets copied to public/pdfjs');
