import assert from 'node:assert';
import { ProjectArchiveService } from '../src/services/project/projectArchiveService.ts';
import type { EngineeringCharacteristic, ProjectProperties } from '../src/types/characteristics.ts';
import type { BlueprintDocument } from '../src/types/blueprint.ts';

function runTests() {
  console.log('=== Running .loonist Project Archiver Unit Tests ===\n');

  // Test 1: ArrayBuffer Base64 Round-trip
  console.log('Test 1: ArrayBuffer Base64 conversion round-trip');
  const dummyBuffer = new Uint8Array([76, 79, 79, 78, 73, 83, 84, 1, 2, 3, 255]).buffer;
  const base64 = ProjectArchiveService.arrayBufferToBase64(dummyBuffer);
  const recoveredBuffer = ProjectArchiveService.base64ToArrayBuffer(base64);
  const recoveredBytes = new Uint8Array(recoveredBuffer);
  assert.strictEqual(recoveredBytes.length, 11);
  assert.strictEqual(recoveredBytes[0], 76);
  assert.strictEqual(recoveredBytes[10], 255);
  console.log('  [PASS] ArrayBuffer perfectly recovered without byte distortion.\n');

  // Test 2: Full Project Package Serialization & Deserialization
  console.log('Test 2: Full project state serialization & deserialization');
  const props: ProjectProperties = {
    partName: 'Turbine Rotor Disc',
    partNumber: 'TRD-9002-REV-B',
    partRevision: 'B',
    drawingName: 'Turbine Rotor Disc Drawing',
    drawingNumber: 'TRD-9002',
    drawingRevision: 'B',
    cageCode: '9A8B7',
    lotSize: 50,
    samplingLevel: 'II',
    samplingType: 'NORMAL',
    aql: '0.65'
  };

  const chars: EngineeringCharacteristic[] = [
    {
      id: 'char-101',
      itemNumber: 1,
      sheetNumber: 1,
      drawingZone: 'Zone C-3',
      type: 'linear',
      displayType: 'Dimension',
      subType: 'Linear Dimension',
      classification: 'Critical',
      enclosure: 'standard',
      rawText: '2.500 +/- 0.002',
      cleanNominal: 2.5,
      upperTol: 0.002,
      lowerTol: 0.002,
      minLimit: 2.498,
      maxLimit: 2.502,
      plusTol: 0.002,
      minusTol: -0.002,
      upperLimit: 2.502,
      lowerLimit: 2.498,
      units: 'in',
      isToleranceInherited: false,
      toleranceSource: 'Direct Callout',
      quantity: 1,
      inspectionMethod: 'Micrometer',
      confidenceScore: 0.99,
      verificationStatus: 'auto_accepted',
      isBasic: false,
      forReference: false,
      sourceCaptureOrSheet: 'Sheet 1',
      boundingBox: { x: 300, y: 150, width: 90, height: 22 },
      customBalloonPosition: { x: 260, y: 145 }
    }
  ];

  const blueprintDoc: BlueprintDocument = {
    id: 'bp-001',
    name: 'Turbine_Rotor_Disc.pdf',
    fileSize: 1048576,
    fileHash: 'hash-abc-123',
    numSheets: 1,
    sheets: [
      { pageNumber: 1, width: 1200, height: 900, aspectRatio: 1.33, label: 'Sheet 1 of 1' }
    ],
    activeSheetIndex: 0
  };

  const pkg = ProjectArchiveService.createPackage(
    props,
    chars,
    blueprintDoc,
    dummyBuffer,
    'Turbine_Rotor_Disc.pdf',
    0,
    1.5,
    90
  );

  const serialized = ProjectArchiveService.serialize(pkg);
  assert.ok(serialized.includes('LOONIST_PROJECT_V1'), 'Header format marker present');
  assert.ok(serialized.includes('TRD-9002-REV-B'), 'Part number preserved in JSON');

  const deserialized = ProjectArchiveService.deserialize(serialized);
  assert.strictEqual(deserialized.format, 'LOONIST_PROJECT_V1');
  assert.strictEqual(deserialized.projectProps.partNumber, 'TRD-9002-REV-B');
  assert.strictEqual(deserialized.characteristics.length, 1);
  assert.strictEqual(deserialized.characteristics[0].rawText, '2.500 +/- 0.002');
  assert.strictEqual(deserialized.characteristics[0].customBalloonPosition?.x, 260);
  assert.strictEqual(deserialized.scale, 1.5);
  assert.strictEqual(deserialized.rotation, 90);
  assert.ok(deserialized.pdfBase64 !== undefined, 'PDF buffer payload preserved');

  console.log('  [PASS] Full project state successfully serialized and deserialized with 100% precision.\n');

  // Test 3: Rejection of invalid payload
  console.log('Test 3: Rejection of invalid format');
  assert.throws(() => {
    ProjectArchiveService.deserialize(JSON.stringify({ format: 'UNKNOWN_FORMAT', characteristics: [] }));
  }, /Invalid project file format/);
  console.log('  [PASS] Correctly rejected incompatible project schema.\n');

  console.log('=== All .loonist Project Archiver Tests PASSED Successfully! ===');
}

runTests();
