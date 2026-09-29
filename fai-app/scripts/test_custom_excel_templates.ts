/**
 * Test Suite: Custom Excel Export Templates
 * Verifies:
 * 1. The starter template is valid and exposes a Form 3 repeat row.
 * 2. Project placeholders are filled on every sheet; single-placeholder numeric cells stay numeric.
 * 3. The {{char.*}} row repeats once per characteristic and rows below it shift down.
 * 4. Cell styles and merged cells survive filling (row-local merges are copied per row).
 * 5. Zero characteristics removes the repeat row cleanly.
 * 6. XML special characters in drawing text are escaped.
 * 7. Invalid files and files without placeholders are rejected with a message.
 * 8. .xltx templates are saved as normal .xlsx workbooks.
 */

import * as XLSX from 'xlsx';
import { unzipSync, zipSync, strFromU8, strToU8 } from 'fflate';
import {
  buildStarterTemplate,
  inspectTemplate,
  fillExcelTemplate,
  buildProjectValues,
  buildCharacteristicValues
} from '../src/services/export/excelTemplateFiller';
import type { EngineeringCharacteristic, ProjectProperties } from '../src/types/characteristics';

let passed = 0;
let total = 0;
function assert(condition: boolean, message: string) {
  total++;
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    process.exitCode = 1;
  }
}

function mockChar(itemNumber: number, rawText: string, measuredValue: number | null): EngineeringCharacteristic {
  return {
    id: `c${itemNumber}`,
    itemNumber,
    sheetNumber: 1,
    drawingZone: 'B-4',
    rawText,
    cleanNominal: 1.0,
    plusTol: 0.005,
    minusTol: -0.005,
    upperLimit: 1.005,
    lowerLimit: 0.995,
    measuredValue,
    conformanceStatus: measuredValue !== null ? 'PASS' : 'UNMEASURED',
    deviation: measuredValue !== null ? 0 : null,
    displayType: 'Linear Dimension',
    subType: 'Dimension',
    classification: 'Major',
    isCritical: false,
    verificationStatus: 'verified',
    inspectionMethod: 'Caliper',
    boundingBox: { x: 100, y: 100, width: 60, height: 20 },
    balloonPosition: { x: 50, y: 100 }
  } as EngineeringCharacteristic;
}

const project: ProjectProperties = {
  partName: 'TURBINE MOUNT BRACKET',
  partNumber: 'TMB-001',
  partRevision: 'C',
  drawingName: 'Bracket',
  drawingNumber: 'DWG-001',
  drawingRevision: 'C',
  cageCode: '1A2B3',
  lotSize: 200,
  samplingLevel: 'II',
  samplingType: 'NORMAL',
  aql: '1.0',
  units: 'in'
};

const chars = [
  mockChar(1, '1.000 ±.005', 1.001),
  mockChar(2, 'Ø.500 <MMC> & DATUM A', null),
  mockChar(3, '2X R.125', 0.999)
];

function fill(template: Uint8Array, list: EngineeringCharacteristic[]) {
  return fillExcelTemplate(template, buildProjectValues(project, list.length), list.map(buildCharacteristicValues));
}

function cell(ws: XLSX.WorkSheet, ref: string) {
  return ws[ref]?.v;
}

console.log('================================================================');
console.log('          TEST: Custom Excel Export Templates                   ');
console.log('================================================================\n');

// 1. Starter template
console.log('► [1] Starter template');
const starter = buildStarterTemplate();
const report = inspectTemplate(starter);
assert(report.isValid, 'Starter template is valid');
assert(report.repeatRowSheets.includes('Form 3'), 'Form 3 sheet has a characteristic repeat row');
assert(report.unknownTokens.length === 0, 'Starter template uses only known placeholders');

// 2 + 3. Fill and read back
console.log('\n► [2] Project fields & [3] repeated characteristic rows');
const wb = XLSX.read(fill(starter, chars), { type: 'array' });
const f1 = wb.Sheets['Form 1'];
const f3 = wb.Sheets['Form 3'];
assert(cell(f1, 'B3') === 'TMB-001', 'Form 1 part number filled');
assert(cell(f1, 'D5') === '1A2B3', 'Form 1 CAGE code filled');
assert(cell(f1, 'B7') === 200, 'Lot size stays numeric');
assert(cell(f1, 'D7') === 'II NORMAL AQL 1.0', 'Several placeholders in one cell are combined');
assert(cell(f3, 'B2') === 'TMB-001', 'Project field filled on Form 3 sheet');
assert(cell(f3, 'A5') === 1 && cell(f3, 'A6') === 2 && cell(f3, 'A7') === 3, 'Characteristic numbers 1–3 on rows 5–7');
assert(typeof cell(f3, 'A5') === 'number', 'Characteristic number is numeric');
assert(cell(f3, 'E5') === '1.000 ±.005', 'Requirement text filled');
assert(cell(f3, 'H5') === 1.001 && cell(f3, 'H6') === 'UNMEASURED', 'Measured result filled');
assert(cell(f3, 'K5') === 'ACCEPT' && cell(f3, 'K6') === 'PENDING', 'Status filled');
assert(cell(f3, 'A9') === 'Total characteristics' && cell(f3, 'B9') === 3, 'Rows below the repeat row moved down by 2');
assert(cell(f3, 'A10') === 'Inspected by', 'Signature row moved down');

// 6. Escaping
console.log('\n► [6] XML escaping');
assert(cell(f3, 'E6') === 'Ø.500 <MMC> & DATUM A', 'Special characters round-trip');

// 4. Styles and merges
console.log('\n► [4] Styles & merged cells preserved');
const files = unzipSync(starter);
const form3Path = 'xl/worksheets/sheet2.xml';
let sheetXml = strFromU8(files[form3Path]);
// Give every cell on the repeat row (row 5) a style and add merges on and below it
sheetXml = sheetXml.replace(/(<row\b[^>]*\br="5"[^>]*>)([\s\S]*?)(<\/row>)/, (_m, open, inner, close) =>
  open + inner.replace(/<c\b/g, '<c s="7"') + close
);
sheetXml = sheetXml.replace('</sheetData>', '</sheetData><mergeCells count="2"><mergeCell ref="K5:L5"/><mergeCell ref="B8:C8"/></mergeCells>');
files[form3Path] = strToU8(sheetXml);
const styled = zipSync(files);
const styledOut = strFromU8(unzipSync(fill(styled, chars))[form3Path]);
const row7 = styledOut.match(/<row\b[^>]*\br="7"[^>]*>[\s\S]*?<\/row>/)?.[0] ?? '';
assert(/<c(?=[^>]*\br="A7")(?=[^>]*\bs="7")/.test(row7), 'Generated row keeps the template cell style');
assert(styledOut.includes('<mergeCell ref="K5:L5"/>') && styledOut.includes('<mergeCell ref="K7:L7"/>'), 'Row merge copied to every generated row');
assert(styledOut.includes('<mergeCell ref="B10:C10"/>') && !styledOut.includes('B8:C8'), 'Merge below the repeat row shifted down');
assert(/<mergeCells count="4">/.test(styledOut), 'mergeCells count updated');

// 5. Zero characteristics
console.log('\n► [5] Zero characteristics');
const empty = XLSX.read(fill(starter, []), { type: 'array' }).Sheets['Form 3'];
assert(cell(empty, 'A4') === 'Char No.', 'Header row untouched');
assert(cell(empty, 'A6') === 'Total characteristics' && cell(empty, 'B6') === 0, 'Rows below moved up when the repeat row is removed');

// 7. Rejections
console.log('\n► [7] Invalid templates rejected');
const garbage = inspectTemplate(new Uint8Array([1, 2, 3, 4]));
assert(!garbage.isValid && !!garbage.error, 'Non-zip file rejected with a message');
const plainWb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(plainWb, XLSX.utils.aoa_to_sheet([['No placeholders here']]), 'Sheet1');
const plain = inspectTemplate(new Uint8Array(XLSX.write(plainWb, { bookType: 'xlsx', type: 'array' })));
assert(!plain.isValid && /placeholders/.test(plain.error ?? ''), 'Workbook without placeholders rejected');

// 8. .xltx
console.log('\n► [8] .xltx templates');
const xltxFiles = unzipSync(starter);
xltxFiles['[Content_Types].xml'] = strToU8(
  strFromU8(xltxFiles['[Content_Types].xml']).replace(
    'spreadsheetml.sheet.main+xml',
    'spreadsheetml.template.main+xml'
  )
);
const xltxOut = unzipSync(fill(zipSync(xltxFiles), chars));
const ct = strFromU8(xltxOut['[Content_Types].xml']);
assert(ct.includes('spreadsheetml.sheet.main+xml') && !ct.includes('template.main+xml'), 'Output content type is a normal workbook');

// 9. Shared strings (how Excel itself stores text)
console.log('\n► [9] Shared-string templates (Excel-authored)');
const sstTemplate = new Uint8Array(
  XLSX.write(XLSX.read(starter, { type: 'array' }), { bookType: 'xlsx', type: 'array', bookSST: true })
);
assert(!!unzipSync(sstTemplate)['xl/sharedStrings.xml'], 'Template uses a shared-strings table');
assert(inspectTemplate(sstTemplate).repeatRowSheets.includes('Form 3'), 'Placeholders found through shared strings');
const sstSheet = XLSX.read(fill(sstTemplate, chars), { type: 'array' }).Sheets['Form 3'];
assert(cell(sstSheet, 'A7') === 3 && cell(sstSheet, 'E7') === '2X R.125', 'Shared-string template filled');
assert(cell(sstSheet, 'A4') === 'Char No.', 'Plain shared-string text untouched');

console.log(`\n${passed}/${total} checks passed`);
if (passed !== total) {
  process.exitCode = 1;
}
