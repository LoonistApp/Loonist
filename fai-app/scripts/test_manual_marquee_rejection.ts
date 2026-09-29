/**
 * Test Suite: Manual Marquee Box Capture Validation & Non-Inspectable Area Rejection
 *
 * Verifies that when a user manually marquees an area:
 * 1. Non-dimensional drawing prose, tutorial text, and administrative boilerplate
 *    (e.g. "ALL DIMENSIONS ARE IN MILLIMETERS", "DO NOT SCALE DRAWING", "SECTION A-A")
 *    are REJECTED with an explicit ASME Y14.5 / AS9102 error, preventing useless balloons.
 * 2. Authentic CAD callouts (e.g. "185", "Ø30 THRU", "R12") are ACCEPTED and ballooned.
 * 3. Blank geometry features (no text / 'Manual Capture') remain permissible for manual entry.
 */

import { AiExtractionService } from '../src/services/ai/aiExtractionService';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion Failed: ${message}`);
  }
}

async function runTests() {
  console.log('--- TEST: Manual Marquee Box Capture Validation ---');

  const dummyBox = { x: 100, y: 100, width: 200, height: 50 };

  // 1. Non-inspectable prose and boilerplate that MUST be rejected
  const rejectedTexts = [
    'ALL DIMENSIONS ARE IN MILLIMETERS',
    'DO NOT SCALE DRAWING',
    'THIRD ANGLE PROJECTION',
    'UNLESS OTHERWISE SPECIFIED ALL DIMENSIONS ARE IN INCHES',
    'SECTION A-A',
    'DETAIL B',
    'practice with Autodesk Inventor (or any 3D CAD package you may be using).'
  ];

  for (const text of rejectedTexts) {
    // Mock pdfDoc that returns the text
    const mockPdfDoc: any = {
      numPages: 1,
      getPage: async () => ({
        getViewport: () => ({ width: 800, height: 600 }),
        getTextContent: async () => ({
          items: [
            {
              str: text,
              transform: [1, 0, 0, 1, 110, 500],
              width: 150,
              height: 14
            }
          ]
        })
      })
    };

    let errorThrown = false;
    try {
      await AiExtractionService.captureBox(mockPdfDoc, dummyBox, 1, 1);
    } catch (err: any) {
      errorThrown = true;
      assert(
        err.message.includes('non-dimensional drawing prose or boilerplate'),
        `Expected error message to mention non-dimensional prose, got: "${err.message}"`
      );
    }

    assert(errorThrown, `Expected captureBox to REJECT non-inspectable text: "${text}", but it accepted it!`);
    console.log(`✓ Rejected non-inspectable area: "${text}"`);
  }

  // 2. Legitimate dimensional callouts that MUST be accepted
  const validCallouts = [
    '185',
    'Ø30 THRU',
    'R12',
    '2 X 45° CHAMFER',
    '|⌖|Ø0.05|A|B|C|'
  ];

  for (const text of validCallouts) {
    const mockPdfDoc: any = {
      numPages: 1,
      getPage: async () => ({
        getViewport: () => ({ width: 800, height: 600 }),
        getTextContent: async () => ({
          items: [
            {
              str: text,
              transform: [1, 0, 0, 1, 110, 500],
              width: 50,
              height: 14
            }
          ]
        })
      })
    };

    const char = await AiExtractionService.captureBox(mockPdfDoc, dummyBox, 1, 10);
    assert(char !== null, `Expected characteristic to be created for "${text}"`);
    assert(char.itemNumber === 10, `Expected itemNumber 10, got ${char.itemNumber}`);
    assert(char.rawText === text, `Expected rawText "${text}", got "${char.rawText}"`);
    console.log(`✓ Successfully accepted authentic callout: "${text}" -> Balloon #${char.itemNumber}`);
  }

  // 3. Blank/manual capture (e.g. user marquees unannotated physical geometry)
  const emptyPdfDoc: any = {
    numPages: 1,
    getPage: async () => ({
      getViewport: () => ({ width: 800, height: 600 }),
      getTextContent: async () => ({ items: [] })
    })
  };

  const manualChar = await AiExtractionService.captureBox(emptyPdfDoc, dummyBox, 1, 20);
  assert(manualChar.extractionSource === 'manual', 'Expected extractionSource manual');
  assert(manualChar.rawText === 'Manual Capture', 'Expected rawText Manual Capture');
  console.log('✓ Successfully permitted intentional manual geometry capture');

  console.log('\n🎉 ALL MANUAL MARQUEE REJECTION TESTS PASSED!');
}

runTests().catch((err) => {
  console.error('Test Failed:', err);
  process.exit(1);
});
