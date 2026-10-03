/**
 * Generates a 2-sheet synthetic PDF combining two untested axes in one fixture:
 *   - Sheet 1: /Rotate 0, English title block ("PART NO: MIX-TEST-001")
 *   - Sheet 2: /Rotate 90, German boilerplate/notes ("Alle Maße in Millimeter",
 *     "Allgemeintoleranz nach ISO 2768") plus a real dimension and a metric thread
 *
 * Covers: (a) per-sheet rotation state never bleeding across pages in the extraction loop,
 * (b) sheet-1 title block identity surviving into sheet 2's extraction without being
 * overwritten or corrupted, (c) German boilerplate not leaking through as a fake
 * characteristic the way the prose/admin filters (built around English phrases) might miss.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function createPDF() {
  const objects = [];
  function addObject(content) {
    const objNum = objects.length + 1;
    objects.push(`${objNum} 0 obj\n${content}\nendobj\n`);
    return objNum;
  }

  const width = 800;
  const height = 600;
  const fontObj = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');

  const sheet1 = [
    'BT /F1 10 Tf 50 50 Td (PART NO: MIX-TEST-001) Tj ET',
    'BT /F1 10 Tf 350 320 Td (O) Tj ET',
    'BT /F1 10 Tf 350 305 Td (20) Tj ET'
  ].join('\n');

  // German title-block-style boilerplate/notes — none of these should ever become a fake
  // characteristic, even though the prose/admin-boilerplate filters are keyed on English words.
  const sheet2 = [
    'BT /F1 9 Tf 50 550 Td (Allgemeintoleranz nach ISO 2768-mK) Tj ET',
    'BT /F1 9 Tf 50 535 Td (Alle Masse in Millimeter, wenn nicht anders angegeben) Tj ET',
    'BT /F1 9 Tf 50 520 Td (Vertraulich - Nachdruck nur mit Genehmigung) Tj ET',
    'BT /F1 10 Tf 400 400 Td (M8x1.25) Tj ET',
    'BT /F1 10 Tf 400 150 Td (35) Tj ET'
  ].join('\n');

  const stream1Obj = addObject(`<< /Length ${Buffer.byteLength(sheet1)} >>\nstream\n${sheet1}\nendstream`);
  const stream2Obj = addObject(`<< /Length ${Buffer.byteLength(sheet2)} >>\nstream\n${sheet2}\nendstream`);

  const pagesObjNum = objects.length + 4;
  const page1Obj = addObject(`<<
  /Type /Page
  /Parent ${pagesObjNum} 0 R
  /MediaBox [0 0 ${width} ${height}]
  /Rotate 0
  /Contents ${stream1Obj} 0 R
  /Resources << /Font << /F1 ${fontObj} 0 R >> >>
>>`);
  const page2Obj = addObject(`<<
  /Type /Page
  /Parent ${pagesObjNum} 0 R
  /MediaBox [0 0 ${width} ${height}]
  /Rotate 90
  /Contents ${stream2Obj} 0 R
  /Resources << /Font << /F1 ${fontObj} 0 R >> >>
>>`);

  const pagesObj = addObject(`<< /Type /Pages /Kids [${page1Obj} 0 R ${page2Obj} 0 R] /Count 2 >>`);
  const catalogObj = addObject(`<< /Type /Catalog /Pages ${pagesObj} 0 R >>`);

  let pdf = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
  const xrefOffsets = [];
  for (const obj of objects) {
    xrefOffsets.push(Buffer.byteLength(pdf));
    pdf += obj;
  }
  const xrefStart = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of xrefOffsets) {
    pdf += String(off).padStart(10, '0') + ' 00000 n \n';
  }
  pdf += `trailer\n<<\n  /Size ${objects.length + 1}\n  /Root ${catalogObj} 0 R\n>>\nstartxref\n${xrefStart}\n%%EOF\n`;

  const outPath = path.join(__dirname, 'fixtures/multipage_mixed_rotation_de.pdf');
  fs.writeFileSync(outPath, Buffer.from(pdf, 'binary'));
  console.log(`Generated ${outPath}`);
}

createPDF();
