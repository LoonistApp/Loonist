/**
 * Test Suite: Vector Marked Blueprint PDF Exporter (pdf-lib)
 */
import fs from 'fs';
import path from 'path';
import { PDFDocument } from 'pdf-lib';
import { MarkedPdfExporter } from '../src/services/export/markedPdfExporter';
import type { EngineeringCharacteristic, BalloonAppearance } from '../src/types/characteristics';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion Failed: ${message}`);
  }
}

console.log('--- TEST: Vector Marked Blueprint PDF Exporter ---');

const samplePdfPath = path.resolve(process.cwd(), 'public/sample_blueprint.pdf');
assert(fs.existsSync(samplePdfPath), `Sample PDF not found at ${samplePdfPath}`);
const originalBuffer = fs.readFileSync(samplePdfPath);
console.log(`✓ Loaded original blueprint: ${originalBuffer.byteLength} bytes`);

const appearance: BalloonAppearance = {
  shape: 'circle',
  fit: 2,
  fontSize: 10,
  color: 'blue',
  showLeaderLine: true
};

const testCharacteristics: EngineeringCharacteristic[] = [
  {
    id: 'char-1',
    itemNumber: 1,
    subNumber: '1',
    sheetNumber: 1,
    pageNumber: 1,
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
    customBalloonPosition: { x: 150, y: 150 },
    measuredValue: 2.502,
    deviation: 0.002,
    conformanceStatus: 'PASS',
    verificationStatus: 'verified'
  },
  {
    id: 'char-2',
    itemNumber: 2,
    subNumber: '2',
    sheetNumber: 1,
    pageNumber: 1,
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
    boundingBox: { x: 230, y: 220, width: 40, height: 20 },
    customBalloonPosition: { x: 280, y: 220 },
    measuredValue: 0.7548,
    deviation: 0.0048,
    conformanceStatus: 'MARGINAL',
    verificationStatus: 'verified'
  },
  {
    id: 'char-3',
    itemNumber: 3,
    subNumber: '3',
    sheetNumber: 1,
    pageNumber: 1,
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
    boundingBox: { x: 380, y: 300, width: 35, height: 20 },
    customBalloonPosition: { x: 420, y: 300 },
    measuredValue: 0.504,
    deviation: 0.004,
    conformanceStatus: 'FAIL',
    verificationStatus: 'verified'
  }
];

async function run() {
  const markedPdfBytes = await MarkedPdfExporter.generateMarkedPdf(
    originalBuffer,
    testCharacteristics,
    appearance
  );

  assert(markedPdfBytes instanceof Uint8Array, 'Marked PDF must return a Uint8Array');
  assert(markedPdfBytes.length > 0, 'Marked PDF bytes cannot be empty');

  // Check PDF magic header '%PDF-'
  const header = String.fromCharCode(...markedPdfBytes.slice(0, 5));
  assert(header === '%PDF-', `Invalid PDF magic header: ${header}`);
  console.log('✓ Valid PDF-1.7 binary header verified');

  // Verify that the PDF can be parsed back and has pages
  const doc = await PDFDocument.load(markedPdfBytes);
  const pageCount = doc.getPageCount();
  assert(pageCount > 0, 'Exported PDF must have at least 1 page');
  console.log(`✓ Vector Marked PDF verified by pdf-lib parser (${pageCount} pages, ${markedPdfBytes.length} bytes)`);

  // Regression (2026-10-06): a real user reported that changing the balloon shape in the app
  // (circle/square/triangle/hexagon/balloon) had no effect on the exported marked PDF — every
  // badge still burned as a plain circle, only the color setting actually reached the export.
  // Root cause: the exporter unconditionally called pdf-lib's drawCircle for every badge,
  // ignoring appearance.shape and char.customBalloonShape entirely. Prove shape now actually
  // changes the drawn output: two characteristics identical in every respect except
  // customBalloonShape must not produce byte-identical PDFs.
  console.log('► Regression: balloon shape must actually affect the exported badge geometry...');
  const baseChar = testCharacteristics[0];
  const asShape = (shape: EngineeringCharacteristic['customBalloonShape']): EngineeringCharacteristic[] => [
    { ...baseChar, customBalloonShape: shape }
  ];
  const circleBytes = await MarkedPdfExporter.generateMarkedPdf(originalBuffer, asShape('circle'), appearance);
  const squareBytes = await MarkedPdfExporter.generateMarkedPdf(originalBuffer, asShape('square'), appearance);
  const triangleBytes = await MarkedPdfExporter.generateMarkedPdf(originalBuffer, asShape('triangle'), appearance);
  const hexagonBytes = await MarkedPdfExporter.generateMarkedPdf(originalBuffer, asShape('hexagon'), appearance);
  const balloonBytes = await MarkedPdfExporter.generateMarkedPdf(originalBuffer, asShape('balloon'), appearance);
  const allBytes = [circleBytes, squareBytes, triangleBytes, hexagonBytes, balloonBytes];
  const shapeNames = ['circle', 'square', 'triangle', 'hexagon', 'balloon'];
  for (let i = 0; i < allBytes.length; i++) {
    for (let j = i + 1; j < allBytes.length; j++) {
      const identical = allBytes[i].length === allBytes[j].length &&
        allBytes[i].every((b, k) => b === allBytes[j][k]);
      assert(!identical, `"${shapeNames[i]}" and "${shapeNames[j]}" must produce different PDF bytes — identical output means the shape setting was ignored`);
    }
  }
  // Every variant must still be a structurally valid, parseable single-page PDF.
  for (let i = 0; i < allBytes.length; i++) {
    const doc = await PDFDocument.load(allBytes[i]);
    assert(doc.getPageCount() > 0, `"${shapeNames[i]}" export must still produce a valid, parseable PDF`);
  }
  console.log('  PASS: all 5 balloon shapes produce distinct, valid PDF output — shape setting reaches the export\n');

  console.log('>>> ALL MARKED PDF EXPORT TESTS PASSED! <<<');
}

run().catch((err) => {
  console.error('Marked PDF Export Test Failed:', err);
  process.exit(1);
});
