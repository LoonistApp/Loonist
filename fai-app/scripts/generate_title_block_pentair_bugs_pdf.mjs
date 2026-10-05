/**
 * Generates a minimal single-page PDF reproducing two real-drawing title-block bugs found while
 * independently verifying extraction against a real Pentair/SolidWorks drawing (89108946.pdf,
 * 2026-10-06):
 *
 * 1. "PART NO." as a label-only text run (trailing period, no colon, value in a separate
 *    adjacent cell) — the field regex's separator class only recognized ":" and "-", so the
 *    label's own trailing "." was swallowed into the capture group as if it were the start of
 *    the value, producing a garbage one-character "." part number instead of falling through to
 *    the neighbor-cell search.
 *
 * 2. A revision-history table whose DATE cell is fused with the adjacent "Checked by" initials
 *    into one text run with no space between them ("18/03/2014HDL") — a real pdf.js text-run
 *    segmentation artifact when a PDF places two cells with near-zero horizontal gap. The
 *    revision-date parser required the ENTIRE cell text to be nothing but the date, so this
 *    fused cell failed to parse as a date at all and silently broke the whole revision lookup.
 *
 * Coordinates sit inside the bottom-right title-block zone (PDF-space x > width-245, y < 135 for
 * this 800x600 sheet), matching the convention in generate_title_block_test_pdfs.mjs.
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

createPDF('title_block_trailing_period_and_date_fusion.pdf', [
  // Bug 1: label-only run ending in a bare period, value in a separate adjacent cell.
  { x: 560, y: 125, text: 'PART NO.' },
  { x: 605, y: 125, text: '77889' },

  // Bug 2: revision-history header row, then a data row whose date cell is fused with the
  // adjacent initials cell into one run (no space) — exactly as pdf.js extracted it from the
  // real drawing.
  { x: 560, y: 105, text: 'REV' },
  { x: 650, y: 105, text: 'DATE' },
  { x: 562, y: 85, text: 'C' },
  { x: 645, y: 85, text: '15/01/2020XYZ' }
]);
