import assert from 'node:assert';
import type { EngineeringCharacteristic, ProjectProperties } from '../src/types/characteristics.ts';
import type { BlueprintDocument } from '../src/types/blueprint.ts';

interface DocumentCacheItem {
  id: string;
  name: string;
  filePath?: string;
  fileSize: number;
  fileHash: string;
  buffer: ArrayBuffer;
  blueprintDoc: BlueprintDocument;
  characteristics: EngineeringCharacteristic[];
  projectProps: ProjectProperties;
  selectedCharId: string | null;
  activeSheetIndex: number;
  scale: number;
  rotation: number;
}

class MultiDocumentSessionManager {
  private cache: Map<string, DocumentCacheItem> = new Map();
  public projectFiles: Array<{ id: string; name: string; type: 'pdf' | 'dwg' | 'catpart' }> = [];
  public activeFileId: string = '';

  // Currently active viewport states
  public activeDoc: DocumentCacheItem | null = null;

  public addDocument(doc: DocumentCacheItem) {
    // If there's an active doc, sync its latest state
    if (this.activeDoc && this.cache.has(this.activeDoc.id)) {
      this.cache.set(this.activeDoc.id, { ...this.activeDoc });
    }

    this.cache.set(doc.id, { ...doc });
    if (!this.projectFiles.some((f) => f.id === doc.id)) {
      this.projectFiles.push({ id: doc.id, name: doc.name, type: 'pdf' });
    }

    // Activate
    this.activeFileId = doc.id;
    this.activeDoc = { ...doc };
  }

  public selectDocument(targetFileId: string) {
    if (targetFileId === this.activeFileId) return;

    // 1. Sync outgoing document
    if (this.activeDoc && this.cache.has(this.activeDoc.id)) {
      this.cache.set(this.activeDoc.id, { ...this.activeDoc });
    }

    // 2. Retrieve incoming
    const target = this.cache.get(targetFileId);
    if (!target) throw new Error(`Document ${targetFileId} not found`);

    // 3. Activate
    this.activeFileId = targetFileId;
    this.activeDoc = { ...target };
  }

  public closeDocument(fileIdToClose: string) {
    this.cache.delete(fileIdToClose);
    this.projectFiles = this.projectFiles.filter((f) => f.id !== fileIdToClose);

    if (this.activeFileId === fileIdToClose) {
      if (this.projectFiles.length > 0) {
        const nextFile = this.projectFiles[this.projectFiles.length - 1];
        const nextDoc = this.cache.get(nextFile.id)!;
        this.activeFileId = nextFile.id;
        this.activeDoc = { ...nextDoc };
      } else {
        this.activeFileId = '';
        this.activeDoc = null;
      }
    }
  }

  public getCached(id: string): DocumentCacheItem | undefined {
    return this.cache.get(id);
  }
}

function createDummyDoc(id: string, name: string, partNumber: string): DocumentCacheItem {
  return {
    id,
    name,
    fileSize: 1024,
    fileHash: `hash-${id}`,
    buffer: new ArrayBuffer(8),
    blueprintDoc: {
      id: `bp-${id}`,
      name,
      fileSize: 1024,
      fileHash: `hash-${id}`,
      numSheets: 2,
      sheets: [
        { pageNumber: 1, width: 1000, height: 800, aspectRatio: 1.25, label: 'Sheet 1 of 2' },
        { pageNumber: 2, width: 1000, height: 800, aspectRatio: 1.25, label: 'Sheet 2 of 2' }
      ],
      activeSheetIndex: 0
    },
    characteristics: [],
    projectProps: {
      partName: name.replace(/\.[^/.]+$/, ''),
      partNumber,
      partRevision: 'A',
      drawingName: name,
      drawingNumber: partNumber,
      drawingRevision: 'A',
      cageCode: '1A2B3',
      lotSize: 100,
      samplingLevel: 'II',
      samplingType: 'NORMAL',
      aql: '1.0'
    },
    selectedCharId: null,
    activeSheetIndex: 0,
    scale: 1.0,
    rotation: 0
  };
}

function runTests() {
  console.log('--- Running Multi-Document Switching & State Isolation Unit Tests ---');
  const session = new MultiDocumentSessionManager();

  // Test 1: Ingest Drawing 1 (Turbine Bracket)
  const doc1 = createDummyDoc('file-sample', 'AS9102_Sample_Turbine_Bracket_RevC.pdf', 'AS9102-TMB-001');
  doc1.characteristics = [
    {
      id: 'char-1',
      itemNumber: 1,
      sheetNumber: 1,
      drawingZone: 'Zone A-1',
      type: 'linear',
      displayType: 'Dimension',
      subType: 'Linear Dimension',
      classification: 'Critical',
      enclosure: 'standard',
      rawText: '1.500 +/- 0.005',
      cleanNominal: 1.5,
      upperTol: 0.005,
      lowerTol: 0.005,
      minLimit: 1.495,
      maxLimit: 1.505,
      plusTol: 0.005,
      minusTol: -0.005,
      upperLimit: 1.505,
      lowerLimit: 1.495,
      units: 'in',
      isToleranceInherited: false,
      toleranceSource: 'Direct',
      quantity: 1,
      inspectionMethod: 'Caliper',
      confidenceScore: 0.99,
      verificationStatus: 'auto_accepted',
      isBasic: false,
      forReference: false,
      sourceCaptureOrSheet: 'Sheet 1',
      boundingBox: { x: 100, y: 150, width: 60, height: 25 }
    }
  ];
  session.addDocument(doc1);

  assert.strictEqual(session.activeFileId, 'file-sample');
  assert.strictEqual(session.projectFiles.length, 1);
  assert.strictEqual(session.activeDoc?.characteristics.length, 1);
  console.log('✓ Test 1 Passed: Drawing 1 ingested with 1 characteristic.');

  // Test 2: Ingest Drawing 2 (Resume or Second Drawing)
  const doc2 = createDummyDoc('file-resume', 'SDE_Resume.pdf', 'RESUME-001');
  session.addDocument(doc2);

  assert.strictEqual(session.activeFileId, 'file-resume');
  assert.strictEqual(session.projectFiles.length, 2);
  assert.strictEqual(session.activeDoc?.characteristics.length, 0);
  assert.strictEqual(session.activeDoc?.projectProps.partNumber, 'RESUME-001');
  console.log('✓ Test 2 Passed: Drawing 2 ingested and activated; Drawing 1 cached.');

  // Modify Drawing 2's viewport state (zoom, sheet index)
  session.activeDoc!.scale = 2.5;
  session.activeDoc!.activeSheetIndex = 1;

  // Test 3: Switch back to Drawing 1
  session.selectDocument('file-sample');
  assert.strictEqual(session.activeFileId, 'file-sample');
  assert.strictEqual(session.activeDoc?.name, 'AS9102_Sample_Turbine_Bracket_RevC.pdf');
  assert.strictEqual(session.activeDoc?.characteristics.length, 1);
  assert.strictEqual(session.activeDoc?.projectProps.partNumber, 'AS9102-TMB-001');
  assert.strictEqual(session.activeDoc?.scale, 1.0);
  console.log('✓ Test 3 Passed: Successfully switched back to Drawing 1 with characteristics preserved.');

  // Test 4: Switch to Drawing 2 and verify preserved zoom and sheet
  session.selectDocument('file-resume');
  assert.strictEqual(session.activeFileId, 'file-resume');
  assert.strictEqual(session.activeDoc?.scale, 2.5);
  assert.strictEqual(session.activeDoc?.activeSheetIndex, 1);
  console.log('✓ Test 4 Passed: Switching to Drawing 2 restored custom zoom scale (2.5x) and Sheet 2.');

  // Test 5: Close Drawing 2 tab
  session.closeDocument('file-resume');
  assert.strictEqual(session.projectFiles.length, 1);
  assert.strictEqual(session.activeFileId, 'file-sample');
  assert.strictEqual(session.activeDoc?.name, 'AS9102_Sample_Turbine_Bracket_RevC.pdf');
  console.log('✓ Test 5 Passed: Closing active tab automatically restored remaining document.');

  // Test 6: Close last remaining tab
  session.closeDocument('file-sample');
  assert.strictEqual(session.projectFiles.length, 0);
  assert.strictEqual(session.activeFileId, '');
  assert.strictEqual(session.activeDoc, null);
  console.log('✓ Test 6 Passed: Closing all tabs safely empties session state.');

  console.log('\nALL 6 MULTI-DOCUMENT TESTS PASSED PERFECTLY!');
}

runTests();
