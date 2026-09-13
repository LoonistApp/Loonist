import fs from 'fs';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

async function inspectUserPdf() {
  const pdfPath = 'C:\\Users\\hy376\\Downloads\\nist_ftc_06_asme1_rd.pdf';
  if (!fs.existsSync(pdfPath)) {
    console.error('File does not exist:', pdfPath);
    return;
  }

  const buffer = fs.readFileSync(pdfPath);
  console.log(`File size: ${buffer.byteLength} bytes`);

  const doc = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
  console.log(`PDF Pages: ${doc.numPages}`);

  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1.0 });
    const textContent = await page.getTextContent();
    console.log(`\n=== PAGE ${pageNum} (Width: ${viewport.width}, Height: ${viewport.height}, Total Text Items: ${textContent.items.length}) ===`);
    
    let count = 0;
    for (const item of textContent.items) {
      if ('str' in item && item.str.trim().length > 0) {
        count++;
        const tx = Math.round(item.transform[4]);
        const ty = Math.round(viewport.height - item.transform[5]);
        console.log(`  [x=${tx}, y=${ty}, w=${Math.round(item.width || 0)}, h=${Math.round(item.height || 0)}] "${item.str.trim()}"`);
      }
    }
    console.log(`Total non-empty text strings on Page ${pageNum}: ${count}`);
    
    // Check operators
    const ops = await page.getOperatorList();
    console.log(`Total PDF rendering operators on Page ${pageNum}: ${ops.fnArray.length}`);
    const paintImageOps = ops.fnArray.filter(fn => fn === pdfjsLib.OPS.paintImageXObject || fn === pdfjsLib.OPS.paintInlineImageXObject);
    console.log(`Image paint operators on Page ${pageNum}: ${paintImageOps.length}`);
  }
}

inspectUserPdf().catch(console.error);
