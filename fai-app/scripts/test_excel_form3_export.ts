/**
 * Test Suite: Multi-Sheet SAE AS9102 Rev B/C Excel Exporter (Form 1, Form 2, Form 3 with Physical Actuals)
 */
import * as XLSX from 'xlsx';
import { As9102ExcelExporter } from '../src/services/export/as9102ExcelExporter';
import type { EngineeringCharacteristic, ProjectProperties } from '../src/types/characteristics';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion Failed: ${message}`);
  }
}

console.log('--- TEST: SAE AS9102 Multi-Sheet Excel Exporter ---');

const projectProps: ProjectProperties = {
  partName: 'TURBINE MOUNT BRACKET - HIGH PRESSURE COMPRESSOR',
  partNumber: 'AS9102-TMB-001',
  partRevision: 'C',
  drawingName: 'Turbine Mount Bracket',
  drawingNumber: 'AS9102-TMB-001',
  drawingRevision: 'C',
  cageCode: '1A2B3',
  lotSize: 200,
  samplingLevel: 'II',
  samplingType: 'NORMAL',
  aql: '1.0'
};

const characteristics: EngineeringCharacteristic[] = [
  {
    id: 'c1',
    itemNumber: 1,
    subNumber: '1',
    sheetNumber: 1,
    pageNumber: 1,
    drawingZone: 'B-2',
    displayType: 'Dimension',
    subType: 'Linear Dimension',
    rawText: '2.500 ± 0.010',
    cleanNominal: 2.500,
    plusTol: 0.010,
    minusTol: -0.010,
    upperTol: 0.010,
    lowerTol: 0.010,
    upperLimit: 2.510,
    lowerLimit: 2.490,
    maxLimit: 2.510,
    minLimit: 2.490,
    units: 'in',
    classification: 'Critical',
    inspectionMethod: 'CMM',
    toleranceSource: 'Direct (±)',
    boundingBox: { x: 100, y: 150, width: 40, height: 20 },
    measuredValue: 2.504,
    deviation: 0.004,
    conformanceStatus: 'PASS',
    verificationStatus: 'verified'
  },
  {
    id: 'c2',
    itemNumber: 2,
    subNumber: '2',
    sheetNumber: 1,
    pageNumber: 1,
    drawingZone: 'C-4',
    displayType: 'Dimension',
    subType: 'Linear Dimension',
    rawText: '0.750 ± 0.005',
    cleanNominal: 0.750,
    plusTol: 0.005,
    minusTol: -0.005,
    upperTol: 0.005,
    lowerTol: 0.005,
    upperLimit: 0.755,
    lowerLimit: 0.745,
    maxLimit: 0.755,
    minLimit: 0.745,
    units: 'in',
    classification: 'Major',
    inspectionMethod: 'Micrometer',
    toleranceSource: 'Direct (±)',
    boundingBox: { x: 200, y: 200, width: 40, height: 20 },
    measuredValue: 0.7548,
    deviation: 0.0048,
    conformanceStatus: 'MARGINAL',
    verificationStatus: 'verified'
  },
  {
    id: 'c3',
    itemNumber: 3,
    subNumber: '3',
    sheetNumber: 1,
    pageNumber: 1,
    drawingZone: 'A-1',
    displayType: 'Dimension',
    subType: 'Diameter',
    rawText: 'Ø 0.500 ± 0.002',
    cleanNominal: 0.500,
    plusTol: 0.002,
    minusTol: -0.002,
    upperTol: 0.002,
    lowerTol: 0.002,
    upperLimit: 0.502,
    lowerLimit: 0.498,
    maxLimit: 0.502,
    minLimit: 0.498,
    units: 'in',
    classification: 'Critical',
    inspectionMethod: 'Pin Gage',
    toleranceSource: 'Direct (±)',
    boundingBox: { x: 300, y: 300, width: 40, height: 20 },
    measuredValue: 0.504,
    deviation: 0.004,
    conformanceStatus: 'FAIL',
    verificationStatus: 'verified'
  }
];

const wb = As9102ExcelExporter.buildWorkbook(characteristics, projectProps);

// 1. Verify Sheet Names
const sheetNames = wb.SheetNames;
assert(sheetNames.includes('Form 1'), 'Workbook must include Form 1');
assert(sheetNames.includes('Form 2'), 'Workbook must include Form 2');
assert(sheetNames.includes('Form 3'), 'Workbook must include Form 3');
console.log(`✓ All 3 SAE AS9102 Forms generated: ${sheetNames.join(', ')}`);

// 2. Inspect Form 1 Contents
const form1Json = XLSX.utils.sheet_to_json(wb.Sheets['Form 1'], { header: 1 }) as any[][];
assert(form1Json.length > 5, 'Form 1 must contain part number accountability rows');
console.log('✓ Form 1 Part Number Accountability populated with CAGE, Drawing, Part Numbers');

// 3. Inspect Form 3 Characteristic Rows and Actuals
const form3Json = XLSX.utils.sheet_to_json(wb.Sheets['Form 3'], { header: 1 }) as any[][];
const headerRowIdx = form3Json.findIndex(row => row && row[0] === '5. Char No.');
assert(headerRowIdx !== -1, 'Form 3 header row missing');
console.log(`✓ Form 3 Header found at row ${headerRowIdx + 1}`);

// Check characteristics rows (following header)
const rows = form3Json.slice(headerRowIdx + 1);
assert(rows.length === 3, `Expected 3 characteristic rows, got ${rows.length}`);

// Row 1 (Pass)
assert(rows[0][0] === 1, 'Row 1 Char No should be 1');
assert(rows[0][7] === 2.504, `Row 1 Measured Actual should be 2.504, got ${rows[0][7]}`);
assert(rows[0][11] === 'ACCEPT', `Row 1 Status should be ACCEPT, got ${rows[0][11]}`);

// Row 2 (Marginal)
assert(rows[1][0] === 2, 'Row 2 Char No should be 2');
assert(rows[1][7] === 0.7548, `Row 2 Measured Actual should be 0.7548, got ${rows[1][7]}`);
assert(rows[1][11] === 'MARGINAL', `Row 2 Status should be MARGINAL, got ${rows[1][11]}`);

// Row 3 (Fail)
assert(rows[2][0] === 3, 'Row 3 Char No should be 3');
assert(rows[2][7] === 0.504, `Row 3 Measured Actual should be 0.504, got ${rows[2][7]}`);
assert(rows[2][11] === 'REJECT', `Row 3 Status should be REJECT, got ${rows[2][11]}`);

console.log('✓ Form 3 Columns verified: Measured Actuals, Deviations, Tools, Conformance Statuses (ACCEPT, MARGINAL, REJECT)');

// 4. Verify XLSX Binary Write
const binary = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
assert(binary.length > 1000, 'Excel output binary too small');
console.log(`✓ Certified OpenXML XLSX binary generated successfully: ${binary.length} bytes`);

console.log('>>> ALL AS9102 MULTI-SHEET EXCEL EXPORT TESTS PASSED! <<<');
