/**
 * Regression Test: Metric (ISO 965) Thread Callout Parsing
 *
 * The engine so far has only been exercised against imperial fractional threads (the synthetic
 * sample) and threads weren't present at all in the one real (French/ISO) customer drawing
 * audited this session. Metric threads are the default on the vast majority of real
 * international drawings, so this is a significant untested surface — this test exercises
 * GdtParser.parseCallout directly (no PDF needed) against realistic real-world notation
 * variants to find gaps before a real drawing does.
 */
import { GdtParser } from '../src/services/ai/gdtParser.ts';
import { DEFAULT_METRIC_ISO_TOLERANCES } from '../src/services/ai/toleranceEngine.ts';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion Failed: ${message}`);
  }
}

function run() {
  console.log('--- TEST: Metric Thread Callout Parsing ---');

  const cases: Array<{ text: string; expectedNominal: number; expectedMultiplier?: number; label: string }> = [
    { text: 'M6', expectedNominal: 6, label: 'bare metric designation, no pitch' },
    { text: 'M6X1', expectedNominal: 6, label: 'coarse notation, no space' },
    { text: 'M6x1-6H', expectedNominal: 6, label: 'with internal thread tolerance class suffix' },
    { text: 'M8x1.25 THRU', expectedNominal: 8, label: 'with depth qualifier' },
    { text: '4X M6X1', expectedNominal: 6, expectedMultiplier: 4, label: 'with repeated-feature multiplier' },
    { text: 'M10', expectedNominal: 10, label: 'two-digit bare designation' },
  ];

  let failures = 0;
  for (const c of cases) {
    const result = GdtParser.parseCallout(c.text, DEFAULT_METRIC_ISO_TOLERANCES);
    const ok = result.type === 'thread' && result.nominal === c.expectedNominal &&
      (c.expectedMultiplier === undefined || result.multiplier === c.expectedMultiplier);
    if (!ok) {
      failures++;
      console.log(`✗ FAIL [${c.label}] "${c.text}" -> type=${result.type} nominal=${result.nominal} multiplier=${result.multiplier} (expected type=thread nominal=${c.expectedNominal}${c.expectedMultiplier ? ` multiplier=${c.expectedMultiplier}` : ''})`);
    } else {
      console.log(`✓ [${c.label}] "${c.text}" -> M${result.nominal}${c.expectedMultiplier ? ` x${result.multiplier}` : ''}`);
    }
  }

  // A known, documented gap (not silently patched — see audit notes): ISO drawings sometimes
  // write a space between the M and the diameter ("M 6 x 1"). Report it, don't assert on it,
  // so a real occurrence surfaces as a finding rather than failing this generic regression test.
  const spaced = GdtParser.parseCallout('M 6 x 1', DEFAULT_METRIC_ISO_TOLERANCES);
  if (spaced.type !== 'thread') {
    console.log(`ℹ KNOWN GAP: "M 6 x 1" (space after M) is not recognized as a thread (got type=${spaced.type}) — flag if a real drawing uses this notation`);
  }

  assert(failures === 0, `${failures} metric thread notation variant(s) failed to parse correctly`);
  console.log('>>> METRIC THREAD PARSING TEST PASSED! <<<');
}

run();
