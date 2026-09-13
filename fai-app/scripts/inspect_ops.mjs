import fs from 'fs';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

async function inspectOperators() {
  const pdfPath = 'C:\\Users\\hy376\\Downloads\\nist_ftc_06_asme1_rd.pdf';
  const buffer = fs.readFileSync(pdfPath);
  const doc = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
  const page = await doc.getPage(1);
  const ops = await page.getOperatorList();
  
  // Count frequency of operators
  const opCounts = {};
  for (const fn of ops.fnArray) {
    const name = Object.keys(pdfjsLib.OPS).find(k => pdfjsLib.OPS[k] === fn) || fn;
    opCounts[name] = (opCounts[name] || 0) + 1;
  }
  console.log('Operator distribution on Page 1:', opCounts);
}

inspectOperators().catch(console.error);
