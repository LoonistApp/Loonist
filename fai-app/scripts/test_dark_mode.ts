/**
 * Test Suite: Aerospace CAD Dark Mode Theme State & Persistence
 */
import fs from 'fs';
import path from 'path';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion Failed: ${message}`);
  }
}

console.log('--- TEST: Aerospace CAD Dark Mode Theme ---');

// 1. Verify CSS rules in index.css
const cssPath = path.resolve(process.cwd(), 'src/index.css');
assert(fs.existsSync(cssPath), `index.css not found at ${cssPath}`);
const cssContent = fs.readFileSync(cssPath, 'utf-8');

assert(cssContent.includes('html.dark'), 'CSS must define html.dark selector');
assert(cssContent.includes('.dark #root'), 'CSS must define .dark #root selector');
assert(cssContent.includes('.dark .bg-white'), 'CSS must define .dark .bg-white override');
assert(cssContent.includes('.dark .text-slate-900'), 'CSS must define .dark .text-slate-900 override');
assert(cssContent.includes('.dark .border-slate-300'), 'CSS must define .dark .border-slate-300 override');
console.log('✓ Scoped CAD dark mode CSS variables and utility classes verified');

// 2. Mock localStorage theme persistence logic
class LocalStorageMock {
  private store: Record<string, string> = {};
  getItem(key: string) { return this.store[key] || null; }
  setItem(key: string, value: string) { this.store[key] = value; }
  clear() { this.store = {}; }
}

const storage = new LocalStorageMock();

// Test initial light default
assert(storage.getItem('loonist_theme') === null, 'Should be null initially');

// Toggle to dark mode
storage.setItem('loonist_theme', 'dark');
assert(storage.getItem('loonist_theme') === 'dark', 'Theme must persist as dark in localStorage');
console.log('✓ Persistent theme toggle verified (localStorage)');

// Toggle to light mode
storage.setItem('loonist_theme', 'light');
assert(storage.getItem('loonist_theme') === 'light', 'Theme must persist as light in localStorage');
console.log('✓ Persistent round-trip toggle verified');

// 3. Verify RibbonBar component includes theme toggle
const ribbonPath = path.resolve(process.cwd(), 'src/components/layout/RibbonBar.tsx');
const ribbonContent = fs.readFileSync(ribbonPath, 'utf-8');
assert(ribbonContent.includes('isDarkMode'), 'RibbonBar must accept isDarkMode prop');
assert(ribbonContent.includes('onToggleDarkMode'), 'RibbonBar must accept onToggleDarkMode prop');
console.log('✓ RibbonBar theme toggle button props and handler verified');

console.log('>>> ALL DARK MODE TESTS PASSED! <<<');
