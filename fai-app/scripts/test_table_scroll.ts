/**
 * TABLE SCROLL & STICKY COLUMN HEADER VERIFICATION
 * Validates that:
 * 1. Bottom panel remains locked to its resizable panelHeight
 * 2. Table container is independently vertically scrollable (flex-1 min-h-0 overflow-auto)
 * 3. Table element uses border-separate and border-spacing-0 for bulletproof sticky rendering
 * 4. Column headers are sticky at top: 0 with opaque background and bottom borders
 * 5. index.css contains all required CSS utility definitions and dark mode overrides
 */
import fs from 'fs';
import path from 'path';

console.log('--- TEST SUITE: Table Scroll & Sticky Column Header ---');

// 1. Check TableManager.tsx layout and sticky configuration
console.log('Test 1: TableManager container and sticky column headers');
const tablePath = path.resolve('src/components/layout/TableManager.tsx');
const tableCode = fs.readFileSync(tablePath, 'utf-8');

if (!tableCode.includes("style={{ height: isCollapsed ? '28px' : `${panelHeight}px` }}")) {
  console.error('  [FAIL] TableManager footer does not lock height to panelHeight');
  process.exit(1);
}
console.log('  [PASS] Footer height is constrained to panelHeight / 28px when collapsed.');

if (!tableCode.includes('flex-1 min-h-0 w-full overflow-auto')) {
  console.error('  [FAIL] Table container does not have flex-1 min-h-0 overflow-auto');
  process.exit(1);
}
console.log('  [PASS] Table container has flex-1 min-h-0 w-full overflow-auto.');

if (!tableCode.includes('border-separate border-spacing-0')) {
  console.error('  [FAIL] Table does not use border-separate border-spacing-0');
  process.exit(1);
}
console.log('  [PASS] Table uses border-separate border-spacing-0 for sticky support.');

if (!tableCode.includes('<thead className="sticky top-0 z-20 bg-slate-100 shadow-2xs">')) {
  console.error('  [FAIL] thead does not have sticky top-0 z-20');
  process.exit(1);
}
console.log('  [PASS] thead has sticky top-0 z-20 bg-slate-100.');

if (!tableCode.includes('th className="sticky top-0 z-20 bg-slate-100')) {
  console.error('  [FAIL] th elements do not have sticky top-0 z-20 bg-slate-100');
  process.exit(1);
}
console.log('  [PASS] Column header <th> cells are explicitly pinned sticky at top: 0.');

// 2. Check index.css utility classes
console.log('\nTest 2: index.css positioning, overflow, and table border utilities');
const cssPath = path.resolve('src/index.css');
const cssCode = fs.readFileSync(cssPath, 'utf-8');

const requiredRules = [
  { selector: '.sticky', rule: 'position: sticky;' },
  { selector: '.overflow-auto', rule: 'overflow: auto;' },
  { selector: '.min-h-0', rule: 'min-height: 0;' },
  { selector: '.border-separate', rule: 'border-collapse: separate;' },
  { selector: '.border-spacing-0', rule: 'border-spacing: 0;' },
  { selector: 'thead.sticky th', rule: 'position: sticky;' },
  { selector: '.dark thead.sticky th', rule: 'background-color: #131b2e' }
];

for (const req of requiredRules) {
  if (!cssCode.includes(req.selector) || !cssCode.includes(req.rule)) {
    console.error(`  [FAIL] index.css missing ${req.selector} with ${req.rule}`);
    process.exit(1);
  }
}
console.log('  [PASS] index.css includes all required sticky, overflow, and border-separate utilities.');

console.log('\n🎉 ALL TABLE SCROLL & STICKY HEADER TESTS PASSED SUCCESSFULLY!');
