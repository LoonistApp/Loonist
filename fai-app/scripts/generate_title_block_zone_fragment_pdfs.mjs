/**
 * Two more synthetic title-block fixtures, same hand-rolled PDF approach as
 * generate_title_block_test_pdfs.mjs:
 *
 * - title_block_left_strip.pdf: the title block sits in the LEFT margin (ISO 5457 side-strip
 *   style), nowhere near the bottom-right corner box the engine used to search exclusively.
 *   Proves the broadened multi-zone search actually reaches it.
 * - title_block_fragmented_value.pdf: a part number split into THREE separate text runs at
 *   tight gaps ("AB12" "-34" "-CD"), not just a two-cell label/value split. Proves the
 *   same-row neighbor search rejoins multiple fragments, not only the first one.
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

// Mid-height, left margin (x=20) — nowhere near the bottom-right corner box (x>555, y<135)
// or the full-width bottom strip (y<135) the engine already covered.
createPDF('title_block_left_strip.pdf', [
  { x: 20, y: 300, text: 'PART NO: LFT-100' }
]);

// Bottom-right corner box, label then three value fragments at tight (<24pt) gaps.
createPDF('title_block_fragmented_value.pdf', [
  { x: 560, y: 90, text: 'PART NO' },
  { x: 610, y: 90, text: 'AB12' },
  { x: 650, y: 90, text: '-34' },
  { x: 680, y: 90, text: '-CD' }
]);
