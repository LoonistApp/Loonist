/**
 * Generates two minimal single-page PDFs to regression-test DrawingExtractionService's
 * title-block field matcher against layouts the original hardcoded PART NO:/REV:/CAGE:/TITLE:
 * matcher could not read:
 *
 * - title_block_label_synonyms.pdf: same "LABEL: value" single-text-run shape as the original
 *   bundled sample, but using different (still standard) label wording: P/N, REVISION,
 *   CAGE CODE, DESCRIPTION instead of PART NO, REV, CAGE, TITLE.
 * - title_block_split_label_value_cells.pdf: label and value emitted as two separate text
 *   runs (a common CAD-export table layout), both to the right on the same row (TITLE, PART
 *   NO, REV) and stacked label-above-value (CAGE), none of them ending in a colon.
 *
 * Both title blocks sit inside the same bottom-right corner box the extraction engine scans
 * (x > width-245, y(viewport) > height-135 for an 800x600 sheet, i.e. PDF-space y < 135).
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

// All coordinates below sit inside the bottom-right title-block box (PDF-space x > 555, y < 135
// for this 800x600 sheet) and well clear of a lone actual dimension so they can't be mistaken
// for one.
createPDF('title_block_label_synonyms.pdf', [
  { x: 560, y: 100, text: 'P/N: 7788-XY' },
  { x: 560, y: 85, text: 'REVISION: C' },
  { x: 560, y: 70, text: 'CAGE CODE: 1ABC2' },
  { x: 560, y: 55, text: 'DESCRIPTION: BRACKET ASSY' }
]);

createPDF('title_block_split_label_value_cells.pdf', [
  // Same row, value to the right (label then value as two separate text runs)
  { x: 560, y: 100, text: 'TITLE' },
  { x: 610, y: 100, text: 'CONDUCTOR ASSEMBLY' },
  { x: 560, y: 55, text: 'PART NO' },
  { x: 615, y: 55, text: '55219-7' },
  { x: 560, y: 40, text: 'REV' },
  { x: 600, y: 40, text: 'B' },
  // Stacked: label above, value directly below it in the same column
  { x: 700, y: 85, text: 'CAGE' },
  { x: 700, y: 70, text: '9K2R4' }
]);
