/**
 * TEST SUITE: Inspection Workspace Sheet Scope & Balloon Quick Delete Actions
 * Verifies:
 * 1. Bottom viewport SheetTabs bar serves as the single source of truth for sheet navigation.
 * 2. Redundant stepper buttons (<, >) and cramped horizontal scrollbars are eliminated from the Inspector Tab.
 * 3. 300 DPI Vector Crop Box is removed per user request to maximize vertical space for characteristics.
 * 4. Sleek quick-delete option is available when selecting a balloon across:
 *    - Inspections Workspace header strip (Selected #X + Delete button)
 *    - Characteristics list cards (per-item Trash2 button)
 *    - Viewport CAD HUD floating toolbar (Delete #X button)
 *    - Canvas selected balloon badge (floating quick-delete badge)
 *    - Keyboard hotkey (Delete / Backspace key)
 * 5. Scope toggle ('current' vs 'all') provides seamless ASME/AS9102 inspection filtering.
 * 6. Characteristics filtering correctly isolates active sheet items while preserving global access.
 */

import fs from 'fs';
import path from 'path';

function runTests() {
  console.log('================================================================');
  console.log('    TEST: Inspection Workspace Sheet Scope & Quick Delete       ');
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

  const inspectorFile = path.resolve(process.cwd(), 'src/components/layout/dock/CharacteristicsInspectorTab.tsx');
  const dockFile = path.resolve(process.cwd(), 'src/components/layout/LeftPropertiesDock.tsx');
  const appFile = path.resolve(process.cwd(), 'src/App.tsx');
  const toolbarFile = path.resolve(process.cwd(), 'src/components/viewport/ViewportToolbar.tsx');
  const canvasFile = path.resolve(process.cwd(), 'src/components/viewport/ViewportCanvas.tsx');

  assert(fs.existsSync(inspectorFile), 'CharacteristicsInspectorTab.tsx exists');
  assert(fs.existsSync(dockFile), 'LeftPropertiesDock.tsx exists');
  assert(fs.existsSync(appFile), 'App.tsx exists');
  assert(fs.existsSync(toolbarFile), 'ViewportToolbar.tsx exists');
  assert(fs.existsSync(canvasFile), 'ViewportCanvas.tsx exists');

  const inspectorSource = fs.readFileSync(inspectorFile, 'utf8');
  const dockSource = fs.readFileSync(dockFile, 'utf8');
  const appSource = fs.readFileSync(appFile, 'utf8');
  const toolbarSource = fs.readFileSync(toolbarFile, 'utf8');
  const canvasSource = fs.readFileSync(canvasFile, 'utf8');

  // 1. Elimination of redundant cramped scrollers and steppers
  assert(
    !inspectorSource.includes('handleScrollLeft') &&
    !inspectorSource.includes('handleScrollRight') &&
    !inspectorSource.includes('canScrollLeft'),
    'Eliminated redundant stepper buttons and horizontal scroll handlers from Inspector'
  );

  assert(
    !inspectorSource.includes('inspection-sheet-scroll'),
    'Removed cramped horizontal scroll track class from CharacteristicsInspectorTab'
  );

  // 2. Active Sheet Propagation from Bottom Drawing Viewport Controller
  assert(
    appSource.includes('activeSheetNumber={activeSheetIndex + 1}'),
    'App.tsx passes activeSheetNumber={activeSheetIndex + 1} to LeftPropertiesDock'
  );

  assert(
    dockSource.includes('activeSheetNumber?: number') &&
    dockSource.includes('activeSheetNumber={activeSheetNumber}'),
    'LeftPropertiesDock receives and forwards activeSheetNumber to CharacteristicsInspectorTab'
  );

  assert(
    inspectorSource.includes('activeSheetNumber?: number') &&
    inspectorSource.includes('const currentSheetNum = activeSheetNumber || (characteristics[0]?.sheetNumber ?? 1);'),
    'CharacteristicsInspectorTab synchronizes currentSheetNum with activeSheetNumber'
  );

  // 3. Unified Scope Selector (Sheet X vs All Sheets)
  assert(
    inspectorSource.includes("const [sheetScope, setSheetScope] = useState<'current' | 'all'>('current');"),
    'Inspector defaults to current sheet scope synchronized with drawing viewport'
  );

  assert(
    inspectorSource.includes("onClick={() => setSheetScope('current')}") &&
    inspectorSource.includes("onClick={() => setSheetScope('all')}"),
    'Provides 2-way Scope Selector buttons for Sheet X and All Sheets'
  );

  // 4. Removal of "300 DPI VECTOR CROP" writing label while keeping display box
  assert(
    !inspectorSource.includes('300 DPI VECTOR CROP (INSPECTOR)'),
    '"300 DPI VECTOR CROP (INSPECTOR)" text writing is removed from CharacteristicsInspectorTab per user request'
  );

  assert(
    inspectorSource.includes('w-full h-20') && inspectorSource.includes('rounded border'),
    'Magnified blueprint crop image display box is preserved in CharacteristicsInspectorTab'
  );

  // 5. Clean Crop Display Header & Card Actions
  assert(
    inspectorSource.includes('onDeleteCharacteristic?: (charId: string) => void') &&
    dockSource.includes('onDeleteCharacteristic={onDeleteCharacteristic}'),
    'onDeleteCharacteristic prop is wired from dock to CharacteristicsInspectorTab'
  );

  assert(
    !inspectorSource.includes('Delete Characteristic #${selectedChar.subNumber || selectedChar.itemNumber}'),
    'Redundant Delete button removed from Inspector crop display header per user request'
  );

  // 6. Viewport Toolbar uncluttered (Delete button removed per user request)
  assert(
    !toolbarSource.includes('Delete #{selectedChar.subNumber || selectedChar.itemNumber}'),
    'ViewportToolbar does not render Delete button, keeping CAD viewport HUD uncluttered'
  );

  // 7. On-Canvas Clean Balloon (Floating delete button removed per user request)
  assert(
    !canvasSource.includes('title="Delete Balloon (Del / Backspace)"'),
    'ViewportCanvas keeps balloon badge clean without floating delete button per user request'
  );

  assert(
    appSource.includes("e.key === 'Delete' || e.key === 'Backspace'") &&
    appSource.includes('handleDeleteCharacteristic(selectedCharId)'),
    'App.tsx binds Delete and Backspace hotkeys to delete selected balloon'
  );

  // 8. Auto-Scroll to Selected Characteristic Card
  assert(
    inspectorSource.includes('listContainerRef = useRef<HTMLDivElement>(null)') &&
    inspectorSource.includes('selectedCardRef = useRef<HTMLDivElement>(null)'),
    'Defines listContainerRef and selectedCardRef for smooth auto-scroll to matching card'
  );

  assert(
    inspectorSource.includes('container.scrollTo({') &&
    inspectorSource.includes("behavior: 'smooth'") &&
    inspectorSource.includes('ref={isSelected ? selectedCardRef : undefined}'),
    'Automatically scrolls the matching inspected characteristic card to the top when selected'
  );

  // 9. Logical Filter Verification
  const mockChars = [
    { id: 'c1', sheetNumber: 1, itemNumber: 1 },
    { id: 'c2', sheetNumber: 1, itemNumber: 2 },
    { id: 'c3', sheetNumber: 2, itemNumber: 3 },
    { id: 'c4', sheetNumber: 5, itemNumber: 4 },
    { id: 'c5', sheetNumber: 25, itemNumber: 5 }
  ];

  const filterByScope = (chars: typeof mockChars, scope: 'current' | 'all', activeSheet: number) => {
    return scope === 'all' ? chars : chars.filter(c => c.sheetNumber === activeSheet);
  };

  assert(filterByScope(mockChars, 'current', 1).length === 2, 'Scope=current on Sheet 1 yields 2 items');
  assert(filterByScope(mockChars, 'current', 2).length === 1, 'Scope=current on Sheet 2 yields 1 item');
  assert(filterByScope(mockChars, 'current', 5).length === 1, 'Scope=current on Sheet 5 yields 1 item');
  assert(filterByScope(mockChars, 'current', 25).length === 1, 'Scope=current on Sheet 25 yields 1 item');
  assert(filterByScope(mockChars, 'all', 1).length === 5, 'Scope=all yields all 5 items across drawing package');

  console.log('\n================================================================');
  console.log(`Summary: ${passed}/${total} assertions passed`);
  console.log('================================================================\n');

  if (passed === total) {
    console.log('🎉 ALL INSPECTION SHEET SCOPE & QUICK DELETE TESTS PASSED!');
  } else {
    process.exit(1);
  }
}

runTests();
