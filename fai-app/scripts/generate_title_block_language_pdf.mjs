/**
 * A title block using standard German (DIN) and French (NF) single-word labels instead of
 * English, in the same simple "LABEL: value" single-run shape as the English fixtures —
 * deliberately NOT the bilingual table-caption style of the real CINH91CDB11-B.pdf fixture,
 * which this engine intentionally leaves unrecognized (see drawingExtractionService.ts's
 * TITLE_BLOCK_FIELD_SYNONYMS doc comment for why).
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

createPDF('title_block_german_french_labels.pdf', [
  { x: 560, y: 100, text: 'TEIL NR: 4455-DE' },     // German part number
  { x: 560, y: 85, text: 'INDICE: D' },             // French revision index
  { x: 560, y: 70, text: 'CODE CAGE: 3XY99' },      // French CAGE code
  { x: 560, y: 55, text: 'DESIGNATION: SUPPORT BRACKET' } // French part name
]);
