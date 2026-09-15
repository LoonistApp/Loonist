/**
 * Test Suite: Prose & Tutorial Sentence Exclusion Engine
 * 
 * Verifies that conversational English sentences, tutorial instructions, and book disclaimers
 * containing digits are strictly excluded from characteristic extraction and balloon generation,
 * while genuine ASME Y14.5 CAD callouts and engineering notes remain 100% intact.
 */
import { GdtParser } from '../src/services/ai/gdtParser';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion Failed: ${message}`);
  }
}

console.log('--- TEST: Prose Sentence & Tutorial Text Exclusion ---');

// 1. Exact tutorial cover sheet sentences that previously caused ballooning
const proseSentences = [
  'This PDF contains 24 detailed drawings of miscellaneous parts, to be used for practice with Autodesk Inventor (or any 3D CAD package you may be using).',
  'practice with Autodesk Inventor (or any 3D CAD package you may be using).',
  'Some of the parts are a bit more challenging than others, but none of them are meant to be difficult.',
  'However, they are intended to be suitable for learning so some specific modeling tools and hints are provided in some cases.',
  "In the event that you find a missing dimension please accept my apologies in advance, and don't stop the practice!",
  "Instead, consider it an opportunity to exercise the designer's choice and provide a dimension to your liking – there are no right or wrong answers here!",
  'As you work through the drawings, keep in mind that the best way of creating most of these parts is to start with a simple sketch and build on it.',
  'Many of the parts can be constructed using only a few sketches and features, which can then be used to create more complex features.',
  'Good luck in your modeling pursuits!',
  'Copyright 2024 Autodesk Inc. All rights reserved.',
  'Section created on page 14 with 2 revisions',
  'Refer to chapter 3 for detailed instructions on page 42'
];

for (const sentence of proseSentences) {
  // Test 1: isProseOrInstructionalText must return true
  const isProse = GdtParser.isProseOrInstructionalText(sentence);
  assert(isProse, `Failed isProseOrInstructionalText for: "${sentence}"`);

  // Test 2: GdtParser.parseCallout must reject and return nominal === null
  const parsed = GdtParser.parseCallout(sentence);
  assert(
    parsed.nominal === null,
    `GdtParser.parseCallout must NOT extract nominal from prose sentence. Got nominal=${parsed.nominal} for: "${sentence}"`
  );
}
console.log(`✓ Verified all ${proseSentences.length} tutorial/disclaimer sentences are strictly excluded from ballooning`);

// 2. Authentic CAD Callouts & GD&T features that MUST be preserved
const validCallouts = [
  { text: '1.250', expectedNominal: 1.250, type: 'linear' },
  { text: 'Ø.500 ± .005', expectedNominal: 0.500, type: 'diameter' },
  { text: '2X 45° CHAMFER', expectedNominal: 45, type: 'chamfer' },
  { text: '4X Ø.375 THRU', expectedNominal: 0.375, type: 'diameter' },
  { text: '[2.000]', expectedNominal: 2.000, enclosure: 'basic' },
  { text: '(1.500)', expectedNominal: 1.500, enclosure: 'reference' },
  { text: '3.00 BORE', expectedNominal: 3.00, type: 'linear' },
  { text: '0.050 WALL', expectedNominal: 0.050, type: 'linear' },
  { text: '12.00 STOCK', expectedNominal: 12.00, type: 'linear' },
  { text: '.750 TYP', expectedNominal: 0.750, type: 'linear' },
  { text: '2.50 MAX', expectedNominal: 2.50, type: 'linear' },
  { text: '1.00 MIN', expectedNominal: 1.00, type: 'linear' }
];

for (const vc of validCallouts) {
  // Test 3: Must NOT be detected as prose
  const isProse = GdtParser.isProseOrInstructionalText(vc.text);
  assert(!isProse, `Valid CAD callout falsely flagged as prose: "${vc.text}"`);

  // Test 4: GdtParser.parseCallout must parse genuine nominal
  const parsed = GdtParser.parseCallout(vc.text);
  assert(
    parsed.nominal === vc.expectedNominal,
    `Valid callout nominal mismatch for "${vc.text}". Expected ${vc.expectedNominal}, got ${parsed.nominal}`
  );
  if (vc.type) {
    assert(parsed.type === vc.type, `Expected type ${vc.type}, got ${parsed.type} for "${vc.text}"`);
  }
  if (vc.enclosure) {
    assert(parsed.enclosure === vc.enclosure, `Expected enclosure ${vc.enclosure}, got ${parsed.enclosure} for "${vc.text}"`);
  }
}
console.log(`✓ Verified all ${validCallouts.length} authentic CAD callouts parse with exact nominals and enclosures`);

// 3. Genuine Engineering Drawing Notes must NOT be flagged as prose
const validNotes = [
  '1. MATERIAL: 6061-T6 ALUMINUM',
  '2. FINISH: ANODIZE PER MIL-A-8625 TYPE II CLASS 1',
  '3. BREAK ALL SHARP EDGES 0.005-0.015 MAX',
  '4. HEAT TREAT TO RC 58-62',
  '5. ALL DIMENSIONS APPLY AFTER PLATING'
];

for (const note of validNotes) {
  const isProse = GdtParser.isProseOrInstructionalText(note);
  assert(!isProse, `Legitimate drawing note was falsely flagged as prose: "${note}"`);
}
console.log(`✓ Verified all ${validNotes.length} authentic drawing notes are preserved for characteristic generation`);

console.log('\n✅ ALL PROSE EXCLUSION & CAD INTEGRITY TESTS PASSED!');
