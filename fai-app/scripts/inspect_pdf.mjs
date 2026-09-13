import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function inspectPdf() {
  const pdfPath = path.join(__dirname, '../public/sample_blueprint.pdf');
  const buffer = fs.readFileSync(pdfPath);
  const doc = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;

  console.log(`PDF Pages: ${doc.numPages}`);

  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1.0 });
    const textContent = await page.getTextContent();
    console.log(`\n=== PAGE ${pageNum} (Width: ${viewport.width}, Height: ${viewport.height}) ===`);
    for (const item of textContent.items) {
      if ('str' in item && item.str.trim().length > 0) {
        const tx = Math.round(item.transform[4]);
        const ty = Math.round(viewport.height - item.transform[5]);
        console.log(`  [x=${tx}, y=${ty}, w=${Math.round(item.width || 0)}, h=${Math.round(item.height || 0)}] "${item.str.trim()}"`);
      }
    }
  }
}

inspectPdf();
