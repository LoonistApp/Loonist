/**
 * UNIFIED MASTER TEST SUITE RUNNER
 * Executes all platform feature test suites across Sprints 1 through 5.
 */
import { execSync } from 'child_process';
import path from 'path';

interface TestSuite {
  name: string;
  sprint: string;
  script: string;
  description: string;
}

const testSuites: TestSuite[] = [
  {
    name: 'AI Extraction Pipeline',
    sprint: 'Sprint 1 & 2',
    script: 'scripts/test_extraction_pipeline.ts',
    description: 'Verifies OCR text extraction, regex tolerance parsing, and characteristic generation'
  },
  {
    name: 'Multi-Document Switching & Cache',
    sprint: 'Sprint 3',
    script: 'scripts/test_multidoc_switching.ts',
    description: 'Verifies seamless tab switching, state preservation, and multi-sheet blueprint isolation'
  },
  {
    name: 'LOONIST Self-Contained Project Archive (*.loonist)',
    sprint: 'Sprint 3 & 4',
    script: 'scripts/test_project_archive.ts',
    description: 'Verifies compression, package serialization, base64 embedded PDF preservation, and round-trip parsing'
  },
  {
    name: 'Spatial Placement Engine (R-Tree AABB)',
    sprint: 'Sprint 4',
    script: 'scripts/test_spatial_placement.ts',
    description: 'Verifies 16-radial ray collision avoidance, drawing boundary clamping, and callout avoidance'
  },
  {
    name: 'Balloon Markup & Collision Detection',
    sprint: 'Sprint 4',
    script: 'scripts/test_sprint4_markup.ts',
    description: 'Verifies multi-sheet balloon spatial distribution and non-overlapping balloon coordinates'
  },
  {
    name: 'Antigravity IDE Resizable Splitter Panels',
    sprint: 'Sprint 4',
    script: 'scripts/test_table_resizer.ts',
    description: 'Verifies horizontal/vertical panel resizing, min/max clamping, and full-drawing maximize toggles'
  },
  {
    name: 'Physical Quality Measurement Engine',
    sprint: 'Sprint 5',
    script: 'scripts/test_measurement_engine.ts',
    description: 'Verifies ASME Y14.5 bilateral/unilateral limits, 10% marginal detection, reference dimensions, and lot conformance'
  },
  {
    name: 'Tamper-Evident SHA-256 Audit Ledger',
    sprint: 'Sprint 5',
    script: 'scripts/test_audit_ledger.ts',
    description: 'Verifies cryptographic hash chaining, genesis root verification, and detection of data tampering'
  },
  {
    name: 'Vector Marked Blueprint PDF Exporter (pdf-lib)',
    sprint: 'Sprint 5',
    script: 'scripts/test_marked_pdf_export.ts',
    description: 'Verifies vector badge overlays, status-coded balloon colors, leader lines, and valid PDF-1.7 output'
  },
  {
    name: 'Certified SAE AS9102 Multi-Sheet Excel Exporter',
    sprint: 'Sprint 5',
    script: 'scripts/test_excel_form3_export.ts',
    description: 'Verifies Form 1, Form 2, and Form 3 with measured actuals, deviations, tooling, and conformance statuses'
  },
  {
    name: 'Aerospace CAD Dark Mode Theme Engine',
    sprint: 'Sprint 5 / UI',
    script: 'scripts/test_dark_mode.ts',
    description: 'Verifies dark slate color system, contrast ratios, RibbonBar theme toggle, and localStorage persistence'
  },
  {
    name: 'Characteristics Table Vertical Scroll & Sticky Header',
    sprint: 'Sprint 5 / UI',
    script: 'scripts/test_table_scroll.ts',
    description: 'Verifies independent table body scrolling within locked resizable panel height and sticky column headers'
  }
];

console.log('================================================================');
console.log('       LOONIST PLATFORM — UNIFIED MASTER TEST SUITE');
console.log('       SAE AS9102 Rev B/C & ASME Y14.5 Quality Platform');
console.log('================================================================\n');

let totalPassed = 0;
let totalFailed = 0;
const results: Array<{ name: string; sprint: string; status: 'PASS' | 'FAIL'; durationMs: number; error?: string }> = [];

const startTime = Date.now();

for (const suite of testSuites) {
  const suiteStart = Date.now();
  process.stdout.write(`► [${suite.sprint}] Running: ${suite.name}... `);

  try {
    const fullPath = path.resolve(process.cwd(), suite.script);
    execSync(`npx tsx "${fullPath}"`, {
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd: process.cwd(),
      encoding: 'utf-8'
    });
    const duration = Date.now() - suiteStart;
    console.log(`\x1b[32mPASS\x1b[0m (${duration}ms)`);
    totalPassed++;
    results.push({ name: suite.name, sprint: suite.sprint, status: 'PASS', durationMs: duration });
  } catch (err: any) {
    const duration = Date.now() - suiteStart;
    console.log(`\x1b[31mFAIL\x1b[0m (${duration}ms)`);
    const stderr = err.stderr ? err.stderr.toString() : err.message;
    console.error(`\x1b[33m${stderr}\x1b[0m`);
    totalFailed++;
    results.push({ name: suite.name, sprint: suite.sprint, status: 'FAIL', durationMs: duration, error: stderr });
  }
}

const totalDuration = ((Date.now() - startTime) / 1000).toFixed(2);

console.log('\n================================================================');
console.log('                     TEST EXECUTION SUMMARY');
console.log('================================================================');
console.log(`Total Suites Executed: ${testSuites.length}`);
console.log(`Passed:                \x1b[32m${totalPassed}\x1b[0m`);
console.log(`Failed:                \x1b[${totalFailed > 0 ? '31' : '32'}m${totalFailed}\x1b[0m`);
console.log(`Execution Time:        ${totalDuration}s`);
console.log('================================================================\n');

if (totalFailed > 0) {
  console.error('❌ Master Test Suite Failed! See above logs for details.');
  process.exit(1);
} else {
  console.log('🎉 ALL FEATURE TESTS PASSED WITH 100% SUCCESS RATE!');
  process.exit(0);
}
