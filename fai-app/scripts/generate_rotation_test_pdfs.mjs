/**
 * Generates 4 minimal single-page PDFs — identical content, differing only in their /Rotate
 * page entry (0, 90, 180, 270) — to regression-test DrawingExtractionService's rotation-aware
 * coordinate transform (textItemToViewportBox) across every rotation a real drawing can carry.
 *
 * Per the PDF spec, /Rotate only changes how a VIEWER displays the page; the content stream's
 * own text coordinates stay in the page's natural (unrotated) space. This is exactly how real
 * CAD exporters produce a rotated landscape drawing (e.g. CINH91CDB11-B.pdf, which has /Rotate
 * 90) — so varying only this flag while keeping content fixed isolates the transform logic.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function createPDF(rotate) {
  const objects = [];
  function addObject(content) {
    const objNum = objects.length + 1;
    objects.push(`${objNum} 0 obj\n${content}\nendobj\n`);
    return objNum;
  }

  const width = 800;
  const height = 600;

  const fontObj = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');

  // Content kept well clear of every corner (the title-block corner-box heuristic clips a
  // bottom-right-of-viewport region, which corner that ends up being in PDF space depends on
  // rotation) so this fixture isolates the coordinate TRANSFORM, not that separate, already
  // tracked heuristic limitation.
  const commands = [
    'BT /F1 10 Tf 350 320 Td (O) Tj ET',
    'BT /F1 10 Tf 350 305 Td (12.5) Tj ET',
    'BT /F1 10 Tf 450 320 Td (45) Tj ET',
    'BT /F1 10 Tf 550 320 Td (28.5) Tj ET'
  ].join('\n');

  const streamLength = Buffer.byteLength(commands);
  const streamObj = addObject(`<< /Length ${streamLength} >>\nstream\n${commands}\nendstream`);

  const pagesObjNum = objects.length + 3;
  const pageObj = addObject(`<<
  /Type /Page
  /Parent ${pagesObjNum} 0 R
  /MediaBox [0 0 ${width} ${height}]
  /Rotate ${rotate}
  /Contents ${streamObj} 0 R
  /Resources << /Font << /F1 ${fontObj} 0 R >> >>
>>`);

  const pagesObj = addObject(`<< /Type /Pages /Kids [${pageObj} 0 R] /Count 1 >>`);
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

  const outPath = path.join(__dirname, `fixtures/rotation_test_${rotate}.pdf`);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, Buffer.from(pdf, 'binary'));
  console.log(`Generated ${outPath}`);
}

for (const rotate of [0, 90, 180, 270]) {
  createPDF(rotate);
}
