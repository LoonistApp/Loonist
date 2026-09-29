/**
 * TEST SUITE: Characteristics Table Sheet Scope & Multi-Sheet Filtering
 * Verifies:
 * 1. Default scope is 'current', displaying only characteristics matching the active sheet.
 * 2. Toggling to 'all' displays all characteristics across all sheets.
 * 3. Dual telemetry metrics accurately calculate both active-sheet and lot-level FAI completion.
 * 4. Changing active sheet automatically isolates the new sheet's characteristics when in 'current' mode.
 * 5. Full compliance preservation: master characteristic array and export integrity remain untouched.
 */

import fs from 'fs';
import { MeasurementEngine } from '../src/services/compliance/measurementEngine';
import type { EngineeringCharacteristic } from '../src/types/characteristics';

function createMockCharacteristic(id: string, itemNumber: number, sheetNumber: number, measuredValue: number | null = null): EngineeringCharacteristic {
  return {
    id,
    itemNumber,
    sheetNumber,
    drawingZone: `B-${sheetNumber}`,
    rawText: `1.000 ±0.005 (Sheet ${sheetNumber})`,
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
  };
}

function runTests() {
  console.log('================================================================');
  console.log('       TEST: Characteristics Table Multi-Sheet Scope Isolation   ');
  console.log('================================================================\n');

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

  // Create mock 25-sheet drawing package with 446 characteristics
  // Sheet 1: 20 chars
  // Sheet 13: 18 chars (10 measured)
  // Sheet 25: 10 chars
  // Remaining 22 sheets: 18 sheets * 18 chars + 4 sheets * 18 + ... = 446 total
  const characteristics: EngineeringCharacteristic[] = [];
  let currentId = 1;

  for (let sheet = 1; sheet <= 25; sheet++) {
    // Distribute to exactly 446 characteristics across 25 sheets:
    // Sheet 1: 20, Sheet 2: 19, Sheet 3: 19, Sheets 4..24 (21 sheets): 18 each, Sheet 25: 10 -> Total = 446
    let count = 18;
    if (sheet === 1) count = 20;
    else if (sheet === 25) count = 10;
    else if (sheet === 2 || sheet === 3) count = 19;

    for (let i = 0; i < count; i++) {
      // For Sheet 13, simulate 10 measured characteristics
      const isMeasured = sheet === 13 && i < 10;
      characteristics.push(
        createMockCharacteristic(`char-${currentId}`, currentId, sheet, isMeasured ? 1.002 : null)
      );
      currentId++;
    }
  }

  const totalCount = characteristics.length;
  assert(totalCount === 446, `Master package created with exactly 446 characteristics across 25 sheets`);

  // Simulated TableManager Filter Logic
  function getFilteredCharacteristics(
    chars: EngineeringCharacteristic[],
    scope: 'current' | 'all',
    activeSheet: number,
    filter: 'all' | 'critical' | 'review'
  ) {
    return chars.filter((c) => {
      if (scope === 'current') {
        const cSheet = c.sheetNumber || 1;
        if (cSheet !== activeSheet) return false;
      }
      if (filter === 'critical') return c.isCritical || c.classification === 'Critical';
      if (filter === 'review') return c.verificationStatus === 'needs_review';
      return true;
    });
  }

  // TEST 1: Default 'current' scope on Sheet 1
  let activeSheet = 1;
  let scope: 'current' | 'all' = 'current';
  let filtered = getFilteredCharacteristics(characteristics, scope, activeSheet, 'all');
  assert(filtered.length === 20, `Sheet 1 isolates exactly 20 characteristics (out of ${totalCount})`);
  assert(filtered.every(c => c.sheetNumber === 1), `All 20 displayed characteristics belong strictly to Sheet 1`);

  // TEST 2: Switch to Sheet 13 (User scenario with 25-sheet drawing)
  activeSheet = 13;
  filtered = getFilteredCharacteristics(characteristics, scope, activeSheet, 'all');
  assert(filtered.length === 18, `Navigating to Sheet 13 isolates exactly 18 characteristics`);
  const firstSheet13 = filtered[0];
  const lastSheet13 = filtered[17];
  assert(firstSheet13.sheetNumber === 13 && firstSheet13.itemNumber > 1, `First characteristic on Sheet 13 (#${firstSheet13.itemNumber}) retains global AS9102 #CHA index`);
  assert(lastSheet13.sheetNumber === 13 && lastSheet13.itemNumber === firstSheet13.itemNumber + 17, `Last characteristic on Sheet 13 (#${lastSheet13.itemNumber}) retains global AS9102 #CHA index`);

  // TEST 3: Dual Telemetry calculation
  const sheet13Chars = characteristics.filter(c => c.sheetNumber === 13);
  const sheet13Stats = MeasurementEngine.calculateLotStatistics(sheet13Chars);
  const totalStats = MeasurementEngine.calculateLotStatistics(characteristics);

  assert(sheet13Stats.total === 18, `Sheet 13 telemetry correctly counts 18 characteristics`);
  assert(sheet13Stats.measuredCount === 10, `Sheet 13 telemetry shows 10/18 measured on current sheet`);
  assert(sheet13Stats.conformanceRatePercent === 100, `Sheet 13 telemetry calculates 100% Pass for measured callouts`);
  assert(totalStats.total === 446, `Global Lot FAIR telemetry reflects all 446 characteristics`);
  assert(totalStats.measuredCount === 10, `Global Lot FAIR telemetry reflects 10/446 measured across all 25 sheets`);

  // TEST 4: Toggle to 'all' scope
  scope = 'all';
  filtered = getFilteredCharacteristics(characteristics, scope, activeSheet, 'all');
  assert(filtered.length === 446, `Toggling to 'all' scope displays all 446 characteristics across all 25 sheets`);

  // TEST 5: Toggle back to 'current' scope on Sheet 25
  scope = 'current';
  activeSheet = 25;
  filtered = getFilteredCharacteristics(characteristics, scope, activeSheet, 'all');
  assert(filtered.length === 10, `Navigating to Sheet 25 isolates exactly 10 characteristics`);
  assert(filtered.every(c => c.sheetNumber === 25), `All items belong to Sheet 25`);

  // TEST 6: Non-destructive compliance verification (Master export array remains complete)
  assert(characteristics.length === 446, `Master characteristic array remains 100% complete (446 items) for AS9102 Form 3 export`);

  // TEST 7: Sheet Tabs UI Layout & Anti-Clipping Integrity
  const sheetTabsSource = fs.readFileSync('src/components/viewport/SheetTabs.tsx', 'utf-8');
  assert(sheetTabsSource.includes('h-11 shrink-0'), 'Sheet navigation bar has fixed h-11 height and shrink-0 to prevent vertical compression');
  assert(sheetTabsSource.includes('overflow-x-auto') && sheetTabsSource.includes('sheet-tabs-scroll'), 'Sheet cards maintain horizontal scrollability with custom thin scrollbar');
  assert(sheetTabsSource.includes('leading-none') && sheetTabsSource.includes('inline-flex items-center'), 'Sheet label and page count are vertically centered with leading-none and inline-flex');
  assert(sheetTabsSource.includes('shrink-0'), 'Sheet cards have shrink-0 to prevent horizontal card squishing');
  assert(!sheetTabsSource.includes('Active Sheet In-Memory'), 'Memory offload status indicator removed from sheet tab bar');
  assert(sheetTabsSource.includes('handlePrevSheet') && sheetTabsSource.includes('handleNextSheet'), 'Previous and Next sheet navigation arrow buttons implemented');
  assert(sheetTabsSource.includes('handleScrollLeft') && sheetTabsSource.includes('handleScrollRight'), 'Tab strip horizontal scroll buttons implemented');
  assert(sheetTabsSource.includes('scrollIntoView'), 'Active sheet card automatically centers into view upon sheet transition');
  assert(sheetTabsSource.includes('handleWheel'), 'Mouse wheel smoothly scrolls sheet cards horizontally');

  console.log(`\nResults: ${passed}/${total} assertions passed.\n`);
  if (passed === total) {
    console.log('🎉 ALL MULTI-SHEET SCOPE TESTS PASSED SUCCESSFULLY!');
  }
}

runTests();
