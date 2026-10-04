/**
 * A synthetic title block deliberately UNLIKE the real CINH91CDB11-B.pdf fixture, to prove the
 * structural table-extraction logic (row/column grouping, bilingual-label-residue detection,
 * date-anchored revision-history reading) generalizes rather than being tuned to that one
 * drawing:
 *
 * - Different language pairing (German/English "Werkstoff / Material" vs. the real fixture's
 *   French/English).
 * - Different zone (top-right block instead of the bottom-right corner / full bottom strip).
 * - A 3-row revision history (not 2) where the LATEST-dated row is physically in the MIDDLE,
 *   not first or last — proves selection is by parsed date value, not row position.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function createPDF(fileName, textCommands) {
  const objects = [];
  function addObject(content) {
    const objNum = objects.length + 1;
    objects.push(`${objNum} 0 obj\n${content}\nendobj\n`);
    return objNum;
  }

  const width = 800;
  const height = 600;

  const fontObj = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');

  const commands = textCommands
    .map(({ x, y, text }) => `BT /F1 8 Tf ${x} ${y} Td (${text}) Tj ET`)
    .join('\n');

  const streamLength = Buffer.byteLength(commands);
  const streamObj = addObject(`<< /Length ${streamLength} >>\nstream\n${commands}\nendstream`);

  const pagesObjNum = objects.length + 3;
  const pageObj = addObject(`<<
  /Type /Page
  /Parent ${pagesObjNum} 0 R
  /MediaBox [0 0 ${width} ${height}]
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

  const outPath = path.join(__dirname, `fixtures/${fileName}`);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, Buffer.from(pdf, 'binary'));
  console.log(`Generated ${outPath}`);
}

createPDF('title_block_table_generalization.pdf', [
  // German/English bilingual material label, value stacked below (top-right zone: x>555, PDF y high)
  { x: 600, y: 580, text: 'Werkstoff / Material' },
  { x: 600, y: 568, text: 'Aluminum 6061' },

  // Revision-history table, header row + 3 entries NOT in date order (latest, "C", is in the middle)
  { x: 720, y: 500, text: 'Revision' },
  { x: 770, y: 500, text: 'Datum' },
  { x: 720, y: 488, text: 'A' },
  { x: 750, y: 488, text: '01/01/2025' },
  { x: 720, y: 476, text: 'C' },
  { x: 750, y: 476, text: '01/12/2025' },
  { x: 720, y: 464, text: 'B' },
  { x: 750, y: 464, text: '15/06/2025' }
]);
