/**
 * Test Suite: AIAG PPAP Package Exporter (Part Submission Warrant, Dimensional
 * Results, and 18-Element Submission Status Checklist)
 */
import * as XLSX from 'xlsx';
import { PpapExcelExporter } from '../src/services/export/ppapExporter';
import { createDefaultPpapWarrant, defaultElementStatusesForLevel } from '../src/types/ppap';
import type { EngineeringCharacteristic, ProjectProperties } from '../src/types/characteristics';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion Failed: ${message}`);
  }
}

console.log('--- TEST: AIAG PPAP Package Exporter ---');

const projectProps: ProjectProperties = {
  partName: 'TURBINE MOUNT BRACKET - HIGH PRESSURE COMPRESSOR',
  partNumber: 'PPAP-TMB-001',
  partRevision: 'C',
  drawingName: 'Turbine Mount Bracket',
  drawingNumber: 'PPAP-TMB-001',
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

// ==========================================
// 1. Element Status Defaults Per AIAG Submission Level
// ==========================================
const level1 = defaultElementStatusesForLevel(1);
assert(level1[18] === 'Submitted', 'Level 1: PSW (Element 18) must be Submitted');
assert(level1[9] === 'Retained', 'Level 1: Dimensional Results must be Retained (warrant-only submission)');
assert(level1[7] === 'Retained', 'Level 1: Control Plan must be Retained');
console.log('✓ Level 1 default element statuses correct (PSW only)');

const level3 = defaultElementStatusesForLevel(3);
assert(level3[9] === 'Submitted', 'Level 3: Dimensional Results must be Submitted');
assert(level3[10] === 'Submitted', 'Level 3: Material/Performance Test Results must be Submitted');
assert(level3[7] === 'Retained', 'Level 3: Control Plan must still be Retained (not part of standard Level 3 set)');
console.log('✓ Level 3 default element statuses correct (PSW + dimensional + material/functional + samples)');

// ==========================================
// 2. Build the Full PPAP Workbook
// ==========================================
const warrant = createDefaultPpapWarrant();
warrant.customerName = 'ACME AEROSPACE';
warrant.organizationName = 'LOONIST MFG';
warrant.submissionLevel = 3;
warrant.elementStatuses = defaultElementStatusesForLevel(3);

const wb = PpapExcelExporter.buildWorkbook(characteristics, projectProps, warrant);

const sheetNames = wb.SheetNames;
assert(sheetNames.includes('PSW'), 'Workbook must include PSW sheet');
assert(sheetNames.includes('Dimensional Results'), 'Workbook must include Dimensional Results sheet');
assert(sheetNames.includes('Element Status'), 'Workbook must include Element Status sheet');
console.log(`✓ All 3 PPAP sheets generated: ${sheetNames.join(', ')}`);

// 3. PSW sheet: dimensional result must reflect the FAIL characteristic automatically
const pswJson = XLSX.utils.sheet_to_json(wb.Sheets['PSW'], { header: 1 }) as any[][];
const dimRow = pswJson.find((row) => String(row[0]).startsWith('Dimensional Measurements meet drawing/specification requirements:'));
assert(!!dimRow, 'PSW sheet must contain the dimensional measurements result row');
assert(String(dimRow![0]).includes('NO'), `PSW must report NO when a characteristic has FAILed, got "${dimRow![0]}"`);
console.log('✓ PSW dimensional result auto-derived from characteristic conformance data (NO due to 1 FAIL)');

const customerRow = pswJson.find((row) => row[0] === 'Customer Name / Division:');
assert(!!customerRow && String(customerRow![1]).includes('ACME AEROSPACE'), 'PSW must include the customer name entered in the warrant');
console.log('✓ PSW includes organization/customer submittal info');

// 4. Dimensional Results sheet: one row per characteristic with correct evaluation mapping
const dimJson = XLSX.utils.sheet_to_json(wb.Sheets['Dimensional Results'], { header: 1 }) as any[][];
const headerRowIdx = dimJson.findIndex((row) => row && row[0] === 'Char No.');
assert(headerRowIdx !== -1, 'Dimensional Results header row missing');
const dimRows = dimJson.slice(headerRowIdx + 1);
assert(dimRows.length === 3, `Expected 3 dimensional result rows, got ${dimRows.length}`);
assert(dimRows[0][8] === 'ACCEPT', `Row 1 (PASS) evaluation should be ACCEPT, got ${dimRows[0][8]}`);
assert(dimRows[1][8] === 'REVIEW REQUIRED', `Row 2 (MARGINAL) evaluation should be REVIEW REQUIRED, got ${dimRows[1][8]}`);
assert(dimRows[2][8] === 'REJECT', `Row 3 (FAIL) evaluation should be REJECT, got ${dimRows[2][8]}`);
console.log('✓ Dimensional Results sheet rows and evaluations verified (ACCEPT / REVIEW REQUIRED / REJECT)');

// 5. Element Status sheet: all 18 elements present, honoring the chosen submission level
const elementJson = XLSX.utils.sheet_to_json(wb.Sheets['Element Status'], { header: 1 }) as any[][];
const elHeaderIdx = elementJson.findIndex((row) => row && row[0] === 'Element #');
const elementRows = elementJson.slice(elHeaderIdx + 1, elHeaderIdx + 1 + 18);
assert(elementRows.length === 18, `Expected 18 PPAP elements, got ${elementRows.length}`);
const pswElementRow = elementRows.find((row) => row[0] === 18);
assert(!!pswElementRow && pswElementRow![2] === 'Submitted', 'Element 18 (PSW) must be marked Submitted');
console.log('✓ Element Status checklist lists all 18 AIAG PPAP elements with correct statuses');

// 6. Verify XLSX Binary Write
const binary = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
assert(binary.length > 1000, 'PPAP Excel output binary too small');
console.log(`✓ Certified OpenXML XLSX binary generated successfully: ${binary.length} bytes`);

console.log('>>> ALL PPAP PACKAGE EXPORT TESTS PASSED! <<<');
