import fs from 'fs';
import path from 'path';

function runTests() {
  console.log('=== Running Draggable Resizable Splitter Tests ===\n');

  // Test 1: Splitter.tsx component exists and exports HorizontalSplitter and VerticalSplitter
  console.log('Test 1: Splitter.tsx exports HorizontalSplitter and VerticalSplitter');
  const splitterPath = path.resolve('src/components/layout/Splitter.tsx');
  if (!fs.existsSync(splitterPath)) {
    console.error('FAIL: Splitter.tsx does not exist');
    process.exit(1);
  }
  const splitterContent = fs.readFileSync(splitterPath, 'utf-8');

  if (
    splitterContent.includes('export const HorizontalSplitter') &&
    splitterContent.includes('export const VerticalSplitter')
  ) {
    console.log('  [PASS] Splitter.tsx exports both HorizontalSplitter and VerticalSplitter.\n');
  } else {
    console.error('  [FAIL] Missing splitter exports in Splitter.tsx');
    process.exit(1);
  }

  // Test 2: HorizontalSplitter highlights on hover and shows row-resize cursor
  console.log('Test 2: HorizontalSplitter highlights on hover and shows resize cursor for vertical dragging');
  if (
    splitterContent.includes('cursor-row-resize') &&
    splitterContent.includes('#0078d4') &&
    splitterContent.includes('group-hover:bg-[#0078d4]') &&
    splitterContent.includes('onHeightChange')
  ) {
    console.log('  [PASS] HorizontalSplitter has cursor-row-resize, #0078d4 hover highlight, and vertical drag height handler.\n');
  } else {
    console.error('  [FAIL] HorizontalSplitter missing cursor or hover highlight');
    process.exit(1);
  }

  // Test 3: VerticalSplitter highlights on hover and shows col-resize cursor
  console.log('Test 3: VerticalSplitter highlights on hover and shows col-resize cursor');
  if (
    splitterContent.includes('cursor-col-resize') &&
    splitterContent.includes('group-hover:bg-[#0078d4]') &&
    splitterContent.includes('onWidthChange')
  ) {
    console.log('  [PASS] VerticalSplitter has cursor-col-resize, #0078d4 hover highlight, and width handler.\n');
  } else {
    console.error('  [FAIL] VerticalSplitter missing cursor or hover highlight');
    process.exit(1);
  }

  // Test 4: App.tsx places splitters between panels and drawing viewer
  console.log('Test 4: App.tsx places draggable splitters between panels and drawing viewer');
  const appPath = path.resolve('src/App.tsx');
  const appContent = fs.readFileSync(appPath, 'utf-8');

  if (
    appContent.includes('<VerticalSplitter') &&
    appContent.includes('<HorizontalSplitter') &&
    appContent.includes('bottomPanelHeight') &&
    appContent.includes('leftPanelWidth')
  ) {
    console.log('  [PASS] App.tsx renders VerticalSplitter and HorizontalSplitter between panels and drawing viewer.\n');
  } else {
    console.error('  [FAIL] App.tsx does not place splitters between panels and drawing viewer');
    process.exit(1);
  }

  // Test 5: TableManager accepts dynamic panelHeight and has IDE window controls
  console.log('Test 5: TableManager integrates with dynamic panelHeight and IDE controls');
  const tablePath = path.resolve('src/components/layout/TableManager.tsx');
  const tableContent = fs.readFileSync(tablePath, 'utf-8');

  if (
    tableContent.includes('panelHeight') &&
    tableContent.includes('onHeightChange') &&
    tableContent.includes('Maximize2') &&
    tableContent.includes('<X')
  ) {
    console.log('  [PASS] TableManager accepts panelHeight and includes Maximize/Close controls.\n');
  } else {
    console.error('  [FAIL] TableManager missing panelHeight or IDE controls');
    process.exit(1);
  }

  // Test 6: LeftPropertiesDock integrates with dynamic width and 40px activity rail
  console.log('Test 6: LeftPropertiesDock integrates with dynamic width and collapse rail');
  const leftPath = path.resolve('src/components/layout/LeftPropertiesDock.tsx');
  const leftContent = fs.readFileSync(leftPath, 'utf-8');

  if (
    leftContent.includes('dockWidth') &&
    leftContent.includes('onWidthChange') &&
    leftContent.includes('w-10 h-full bg-slate-100')
  ) {
    console.log('  [PASS] LeftPropertiesDock accepts dynamic width and collapses to 40px rail.\n');
  } else {
    console.error('  [FAIL] LeftPropertiesDock missing width props or activity rail');
    process.exit(1);
  }

  console.log('=== All 6 Draggable Resizable Splitter Tests Passed Successfully! ===\n');
}

runTests();
