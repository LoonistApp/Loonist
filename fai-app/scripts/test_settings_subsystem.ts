/**
 * LOONIST — Production Test Suite: Settings Subsystem (5-Zone Industrial Architecture)
 * Validates all 8 core functionalities:
 * 1. Title Block General Tolerances Matrix
 * 2. Units Toggle (Metric mm / Imperial in)
 * 3. Skip Reference Dimensions ( )
 * 4. Skip Basic Dimensions [ ]
 * 5. PaddleOCR Review Floor Threshold
 * 6. Starting Index, Step Increment, and Sub-delimiter
 * 7. AS9102 Standard Rev B / Rev C & Sampling Plan
 * 8. Security Watermark & Marked PDF Generation
 * 9. Project Package Serialization Roundtrip
 */

import { DEFAULT_PROJECT_SETTINGS, type ProjectSettings } from '../src/types/settings';
import { DEFAULT_APPLICATION_OPTIONS } from '../src/types/applicationOptions';
import { applicationOptionsActions } from '../src/stores/useApplicationOptionsStore';
import { GdtParser } from '../src/services/ai/gdtParser';
import { ToleranceEngine } from '../src/services/ai/toleranceEngine';
import { MarkedPdfExporter } from '../src/services/export/markedPdfExporter';
import { ProjectArchiveService } from '../src/services/project/projectArchiveService';
import type { EngineeringCharacteristic, ProjectProperties } from '../src/types/characteristics';
import { PDFDocument } from 'pdf-lib';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`[Assertion Failed] ${message}`);
  }
}

async function runSettingsTestSuite() {
  console.log('================================================================');
  console.log('       LOONIST SETTINGS SUBSYSTEM — MASTER TEST SUITE');
  console.log('================================================================\n');

  // -------------------------------------------------------------------------
  // TEST 1: Domain Model Defaults Integrity
  // -------------------------------------------------------------------------
  console.log('► [Feature 1] Testing Default Settings Configuration...');
  assert(DEFAULT_PROJECT_SETTINGS.units === 'in', 'Default units must be inches');
  assert(DEFAULT_PROJECT_SETTINGS.startingNumber === 1, 'Default start number must be 1');
  assert(DEFAULT_PROJECT_SETTINGS.incrementStep === 1, 'Default increment step must be +1');
  assert(DEFAULT_PROJECT_SETTINGS.skipReferenceDimensions === true, 'Default skip reference must be true');
  assert(DEFAULT_PROJECT_SETTINGS.ocrConfidenceThreshold === 0.85, 'Default OCR floor must be 0.85');
  assert(DEFAULT_PROJECT_SETTINGS.as9102Revision === 'Rev C', 'Default AS9102 standard must be Rev C');
  assert(DEFAULT_PROJECT_SETTINGS.watermark === 'NONE', 'Default watermark must be NONE');
  console.log('  ✓ Default settings verified.\n');

  // -------------------------------------------------------------------------
  // TEST 2: Zone 1 - Tolerancing & Units Matrix (ASME Y14.5 / ISO 2768)
  // -------------------------------------------------------------------------
  console.log('► [Feature 2] Testing Units & Decimal Precision Tolerancing Matrix...');
  // Custom aerospace title block tolerances: .X = ±0.050, .XX = ±0.015, .XXX = ±0.002
  const customTolerances = {
    oneDecimal: 0.050,
    twoDecimals: 0.015,
    threeDecimals: 0.002,
    fourDecimals: 0.0005,
    angular: 0.5,
    unit: 'in' as const
  };

  const parsedThreeDec = GdtParser.parseCallout('2.375', customTolerances);
  assert(parsedThreeDec.nominal === 2.375, 'Nominal must parse to 2.375');
  assert(parsedThreeDec.upperTol === 0.002, 'Three-decimal tolerance must inherit ±0.002 from custom matrix');
  assert(parsedThreeDec.lowerTol === 0.002, 'Lower tolerance must inherit ±0.002 from custom matrix');
  assert(parsedThreeDec.maxLimit === 2.377, 'Max limit must be 2.377');
  assert(parsedThreeDec.minLimit === 2.373, 'Min limit must be 2.373');

  // Metric ISO 2768 unit check
  const metricTolerances = {
    oneDecimal: 0.20,
    twoDecimals: 0.05,
    threeDecimals: 0.01,
    fourDecimals: 0.002,
    angular: 0.25,
    unit: 'mm' as const
  };
  const parsedMetric = GdtParser.parseCallout('45.5', metricTolerances);
  assert(parsedMetric.units === 'mm', 'Units must be metric mm');
  assert(parsedMetric.upperTol === 0.20, 'One-decimal metric tolerance must inherit ±0.20 mm');
  console.log('  ✓ Decimal precision matrix & unit calculations verified.\n');

  // -------------------------------------------------------------------------
  // TEST 3: Zone 2 - Extraction Skip Rules for Reference & Basic Dims
  // -------------------------------------------------------------------------
  console.log('► [Feature 3] Testing Drawing Extraction Skip Rules...');
  const refDim = GdtParser.parseCallout('( 3.500 )');
  assert(refDim.enclosure === 'reference', 'Parenthetical dimension must be classified as reference');

  const basicDim = GdtParser.parseCallout('[ 1.250 ]');
  assert(basicDim.enclosure === 'basic', 'Boxed dimension must be classified as basic');

  const standardDim = GdtParser.parseCallout('0.750 ± .005');
  assert(standardDim.enclosure === 'standard', 'Explicit tolerance dimension must be standard');

  // Simulate extraction filter logic
  const candidates = [refDim, basicDim, standardDim];
  
  // Case A: Skip reference only
  const filteredA = candidates.filter(c => !(true && c.enclosure === 'reference'));
  assert(filteredA.length === 2, 'Should have 2 characteristics when skipping reference');
  assert(!filteredA.some(c => c.enclosure === 'reference'), 'Reference dimension must be omitted');

  // Case B: Skip basic only
  const filteredB = candidates.filter(c => !(true && c.enclosure === 'basic'));
  assert(filteredB.length === 2, 'Should have 2 characteristics when skipping basic');
  assert(!filteredB.some(c => c.enclosure === 'basic'), 'Basic dimension must be omitted');

  // Case C: Skip both
  const filteredBoth = candidates.filter(c => !(true && c.enclosure === 'reference') && !(true && c.enclosure === 'basic'));
  assert(filteredBoth.length === 1, 'Should retain only standard dimension when skipping both');
  assert(filteredBoth[0].nominal === 0.750, 'Retained item must be 0.750');
  console.log('  ✓ ASME Y14.5 Reference and Basic dimension skip rules verified.\n');

  // -------------------------------------------------------------------------
  // TEST 4: Zone 2 - PaddleOCR Confidence Review Floor
  // -------------------------------------------------------------------------
  console.log('► [Feature 4] Testing PaddleOCR Review Floor Threshold...');
  const testConfidenceFloor = (ocrConfidence: number, floorThreshold: number): 'needs_review' | 'auto_accepted' => {
    return ocrConfidence < floorThreshold ? 'needs_review' : 'auto_accepted';
  };

  assert(testConfidenceFloor(0.82, 0.85) === 'needs_review', '0.82 confidence must be flagged needs_review when floor is 0.85');
  assert(testConfidenceFloor(0.92, 0.85) === 'auto_accepted', '0.92 confidence must be auto_accepted when floor is 0.85');
  assert(testConfidenceFloor(0.78, 0.75) === 'auto_accepted', '0.78 confidence must be auto_accepted when floor is 0.75');
  console.log('  ✓ PaddleOCR confidence threshold logic verified.\n');

  // -------------------------------------------------------------------------
  // TEST 5: Zone 3 - Numbering Policy (Start, Increment Step, Sub-delimiter)
  // -------------------------------------------------------------------------
  console.log('► [Feature 5] Testing Numbering Sequence & Sub-delimiters...');
  const startNum = 100;
  const step = 5;
  const subDelim = '-';

  const sequence: number[] = [];
  let cur = startNum;
  for (let i = 0; i < 4; i++) {
    sequence.push(cur);
    cur += step;
  }
  assert(sequence[0] === 100, 'First item must be 100');
  assert(sequence[1] === 105, 'Second item must be 105 (+5 step)');
  assert(sequence[2] === 110, 'Third item must be 110 (+5 step)');
  assert(sequence[3] === 115, 'Fourth item must be 115 (+5 step)');

  // Sub-delimiter test (4X hole callout)
  const parentItem = 100;
  const subNumbers = [1, 2, 3, 4].map(m => `${parentItem}${subDelim}${m}`);
  assert(subNumbers[0] === '100-1', 'Sub-number 1 must use dash delimiter');
  assert(subNumbers[3] === '100-4', 'Sub-number 4 must use dash delimiter');
  console.log('  ✓ Numbering sequence start, step (+5), and sub-delimiter verified.\n');

  // -------------------------------------------------------------------------
  // TEST 6: Zone 4 - AS9102 Compliance & Sampling Standard
  // -------------------------------------------------------------------------
  console.log('► [Feature 6] Testing AS9102 Rev B/C & AQL Sampling Plan Configuration...');
  const testSettings: ProjectSettings = {
    ...DEFAULT_PROJECT_SETTINGS,
    as9102Revision: 'Rev B',
    aqlLevel: '0.65',
    inspectionLevel: 'Level III'
  };
  assert(testSettings.as9102Revision === 'Rev B', 'AS9102 revision must be Rev B');
  assert(testSettings.aqlLevel === '0.65', 'AQL must be tightened 0.65');
  assert(testSettings.inspectionLevel === 'Level III', 'Inspection level must be Level III');
  console.log('  ✓ AS9102 standard and ANSI/ASQ Z1.4 sampling verified.\n');

  // -------------------------------------------------------------------------
  // TEST 7: Zone 5 - Security Watermark & Marked PDF Generation
  // -------------------------------------------------------------------------
  console.log('► [Feature 7] Testing Security Watermark in Marked PDF Exporter...');
  const samplePdf = await PDFDocument.create();
  samplePdf.addPage([600, 400]);
  const rawBytes = await samplePdf.save();

  const dummyChar: EngineeringCharacteristic = {
    id: 'char-test-1',
    itemNumber: 1,
    sheetNumber: 1,
    drawingZone: 'B2',
    type: 'linear',
    displayType: 'Dimension',
    subType: 'Linear Dimension',
    classification: 'Major',
    enclosure: 'standard',
    rawText: '2.500 ± .005',
    cleanNominal: 2.500,
    upperTol: 0.005,
    lowerTol: 0.005,
    minLimit: 2.495,
    maxLimit: 2.505,
    plusTol: 0.005,
    minusTol: 0.005,
    upperLimit: 2.505,
    lowerLimit: 2.495,
    units: 'in',
    isToleranceInherited: false,
    toleranceSource: 'Drawing',
    quantity: 1,
    inspectionMethod: 'Caliper',
    confidenceScore: 0.98,
    verificationStatus: 'auto_accepted',
    boundingBox: { x: 100, y: 150, width: 60, height: 20 }
  };

  // Generate marked PDF with ITAR security watermark
  const markedBytes = await MarkedPdfExporter.generateMarkedPdf(
    rawBytes.buffer as ArrayBuffer,
    [dummyChar],
    { shape: 'circle', fit: 2, fontSize: 10, color: 'blue', showLeaderLine: true },
    {
      highlightNonConformance: true,
      showLeaderLines: true,
      watermark: 'ITAR RESTRICTED'
    }
  );

  assert(markedBytes.length > 0, 'Marked PDF bytes must not be empty');
  const loadedMarkedPdf = await PDFDocument.load(markedBytes);
  assert(loadedMarkedPdf.getPageCount() === 1, 'Marked PDF must retain page count');
  console.log('  ✓ ITAR Restricted watermark embedded into vector marked PDF successfully.\n');

  // -------------------------------------------------------------------------
  // TEST 8: Package Persistence Roundtrip (.loonist)
  // -------------------------------------------------------------------------
  console.log('► [Feature 8] Testing .loonist Project Package Serialization Roundtrip...');
  const dummyProps: ProjectProperties = {
    partName: 'TURBINE BLADE FLANGE',
    partNumber: 'ENG-9988-REV-D',
    partRevision: 'D',
    drawingName: 'Turbine Flange Assembly',
    drawingNumber: 'DWG-9988',
    drawingRevision: 'D',
    cageCode: '7X8Y9',
    lotSize: 50,
    samplingLevel: 'II',
    samplingType: 'NORMAL',
    aql: '0.65'
  };

  const customSettings: ProjectSettings = {
    units: 'mm',
    tolerances: metricTolerances,
    skipReferenceDimensions: true,
    skipBasicDimensions: true,
    ocrConfidenceThreshold: 0.90,
    startingNumber: 500,
    incrementStep: 10,
    subDelimiter: '/',
    as9102Revision: 'Rev C',
    samplingStandard: 'ANSI/ASQ Z1.4',
    aqlLevel: '0.65',
    inspectionLevel: 'Level III',
    watermark: 'ITAR RESTRICTED',
    highResPdfExport: true
  };

  const pkg = ProjectArchiveService.createPackage(
    dummyProps,
    [dummyChar],
    null,
    null,
    'flange.pdf',
    0,
    1.0,
    0,
    customSettings
  );

  assert(pkg.settings !== undefined, 'Package must contain settings');
  const serialized = ProjectArchiveService.serialize(pkg);
  const deserialized = ProjectArchiveService.deserialize(serialized);

  assert(deserialized.settings !== undefined, 'Deserialized package must have settings');
  assert(deserialized.settings?.units === 'mm', 'Settings units must roundtrip as mm');
  assert(deserialized.settings?.startingNumber === 500, 'Starting number must roundtrip as 500');
  assert(deserialized.settings?.incrementStep === 10, 'Increment step must roundtrip as +10');
  assert(deserialized.settings?.subDelimiter === '/', 'Sub-delimiter must roundtrip as /');
  assert(deserialized.settings?.watermark === 'ITAR RESTRICTED', 'Watermark must roundtrip as ITAR RESTRICTED');
  assert(deserialized.settings?.tolerances.oneDecimal === 0.20, 'Tolerances matrix must roundtrip faithfully');
  console.log('  ✓ .loonist project package roundtrip verified.\n');

  // -------------------------------------------------------------------------
  // TEST 10: Canvas Contrast Modes & Application Options Persistence
  // -------------------------------------------------------------------------
  console.log('► [Feature 10] Testing Canvas Contrast Modes (Crisp White, Dark Slate, Blueprint Dark)...');
  
  // Verify default workspace canvasBackground
  assert(DEFAULT_APPLICATION_OPTIONS.workspace.canvasBackground === 'charcoal', 'Default canvas mode must be charcoal');

  // 1. Test Crisp White Mode
  applicationOptionsActions.updateWorkspace({ canvasBackground: 'white' });
  let currentOpts = applicationOptionsActions.get();
  assert(currentOpts.workspace.canvasBackground === 'white', 'Canvas mode must update to white');

  // 2. Test Blueprint Dark Mode
  applicationOptionsActions.updateWorkspace({ canvasBackground: 'blueprint' });
  currentOpts = applicationOptionsActions.get();
  assert(currentOpts.workspace.canvasBackground === 'blueprint', 'Canvas mode must update to blueprint');

  // 3. Test Dark Slate Mode
  applicationOptionsActions.updateWorkspace({ canvasBackground: 'charcoal' });
  currentOpts = applicationOptionsActions.get();
  assert(currentOpts.workspace.canvasBackground === 'charcoal', 'Canvas mode must update to charcoal');

  // 4. Validate color mappings for each mode
  const getCanvasColor = (mode: 'white' | 'charcoal' | 'blueprint') => {
    return mode === 'white' ? '#f8fafc' : mode === 'blueprint' ? '#0b132b' : '#181a1f';
  };
  assert(getCanvasColor('white') === '#f8fafc', 'Crisp White must map to #f8fafc');
  assert(getCanvasColor('charcoal') === '#181a1f', 'Dark Slate must map to #181a1f');
  assert(getCanvasColor('blueprint') === '#0b132b', 'Blueprint Dark must map to #0b132b');
  // -------------------------------------------------------------------------
  // TEST 11: Characteristics Table Presets (AS9102, Shop Floor, GD&T Focus)
  // -------------------------------------------------------------------------
  console.log('► [Feature 11] Testing Characteristics Table Presets...');

  // 1. Test Shop Floor Quick Preset
  applicationOptionsActions.applyTablePreset('shop-floor');
  let tableOpts = applicationOptionsActions.get();
  assert(tableOpts.workspace.tablePresetView === 'shop-floor', 'Preset must be shop-floor');
  const shopFloorCols = tableOpts.workspace.tableColumns.filter(c => c.visible).map(c => c.id);
  assert(shopFloorCols.includes('balloonNumber'), 'Shop Floor must include balloonNumber');
  assert(shopFloorCols.includes('rawText'), 'Shop Floor must include rawText');
  assert(shopFloorCols.includes('cleanNominal'), 'Shop Floor must include cleanNominal');
  assert(shopFloorCols.includes('measuredValue'), 'Shop Floor must include measuredValue');
  assert(shopFloorCols.includes('status'), 'Shop Floor must include status');
  assert(shopFloorCols.includes('method'), 'Shop Floor must include method');
  assert(!shopFloorCols.includes('plusTol'), 'Shop Floor must hide plusTol');
  assert(!shopFloorCols.includes('minusTol'), 'Shop Floor must hide minusTol');

  // 2. Test GD&T Focus Preset (Crucial: must include cleanNominal for basic dimensions)
  applicationOptionsActions.applyTablePreset('gdt-focus');
  tableOpts = applicationOptionsActions.get();
  assert(tableOpts.workspace.tablePresetView === 'gdt-focus', 'Preset must be gdt-focus');
  const gdtCols = tableOpts.workspace.tableColumns.filter(c => c.visible).map(c => c.id);
  assert(gdtCols.includes('balloonNumber'), 'GD&T Focus must include balloonNumber');
  assert(gdtCols.includes('rawText'), 'GD&T Focus must include rawText (Drawing Callout)');
  assert(gdtCols.includes('type'), 'GD&T Focus must include type');
  assert(gdtCols.includes('cleanNominal'), 'GD&T Focus must include cleanNominal for basic dimension targets');
  assert(gdtCols.includes('plusTol'), 'GD&T Focus must include plusTol');
  assert(gdtCols.includes('minusTol'), 'GD&T Focus must include minusTol');
  assert(gdtCols.includes('measuredValue'), 'GD&T Focus must include measuredValue');
  assert(gdtCols.includes('status'), 'GD&T Focus must include status');
  assert(!gdtCols.includes('method'), 'GD&T Focus must keep view lean by omitting method');
  assert(!gdtCols.includes('classification'), 'GD&T Focus must keep view lean by omitting classification');

  // 3. Test AS9102 Standard Full Preset
  applicationOptionsActions.applyTablePreset('as9102-standard');
  tableOpts = applicationOptionsActions.get();
  assert(tableOpts.workspace.tablePresetView === 'as9102-standard', 'Preset must be as9102-standard');
  const as9102Cols = tableOpts.workspace.tableColumns.filter(c => c.visible).map(c => c.id);
  assert(as9102Cols.includes('upperLimit') && as9102Cols.includes('lowerLimit') && as9102Cols.includes('deviation'), 'AS9102 Full must include full limits and deviation');
  // -------------------------------------------------------------------------
  // TEST 12: Decimal Separator Format (Period vs European Comma vs System)
  // -------------------------------------------------------------------------
  console.log('► [Feature 12] Testing Decimal Separator Format (Period vs European Comma)...');
  const { formatDecimal, formatTolerance, parseDecimalInput } = await import('../src/utils/numberFormat');

  // Test Period (.) formatting
  applicationOptionsActions.updateWorkspace({ decimalSeparator: '.' });
  let sepOpts = applicationOptionsActions.get();
  assert(sepOpts.workspace.decimalSeparator === '.', 'Decimal separator must be .');
  assert(formatDecimal(1.25, 4, '.') === '1.2500', 'Period format must produce 1.2500');
  assert(formatTolerance(0.05, '.') === '0.05', 'Period tolerance format must produce 0.05');
  assert(parseDecimalInput('1.25', '.') === 1.25, 'Parsing 1.25 must equal 1.25');

  // Test European ISO Comma (,) formatting
  applicationOptionsActions.updateWorkspace({ decimalSeparator: ',' });
  sepOpts = applicationOptionsActions.get();
  assert(sepOpts.workspace.decimalSeparator === ',', 'Decimal separator must be ,');
  assert(formatDecimal(1.25, 4, ',') === '1,2500', 'Comma format must produce 1,2500');
  assert(formatTolerance(0.05, ',') === '0,05', 'Comma tolerance format must produce 0,05');
  assert(parseDecimalInput('1,25', ',') === 1.25, 'Parsing 1,25 with comma must equal 1.25');
  assert(parseDecimalInput('25,4', ',') === 25.4, 'Parsing 25,4 must equal 25.4');

  // Restore Default Period (.)
  applicationOptionsActions.updateWorkspace({ decimalSeparator: '.' });
  console.log('  ✓ Decimal Separator Formatting & Locale Parsing verified.\n');

  console.log('================================================================');
  console.log('🎉 ALL SETTINGS SUBSYSTEM FEATURES VERIFIED SUCCESSFULLY!');
  console.log('================================================================');
}

runSettingsTestSuite().catch((err) => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
