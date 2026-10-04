/**
 * Regression test: title-block matching reaches beyond the original bottom-right-corner-only
 * box, and rejoins a value split across more than two text runs.
 *
 * - title_block_left_strip.pdf: the title block sits in the left margin (ISO 5457 side-strip
 *   style). The original engine only ever scanned the bottom-right corner, so this would have
 *   silently produced nothing.
 * - title_block_fragmented_value.pdf: a part number broken into three separate adjacent runs
 *   ("PART NO" | "AB12" | "-34" | "-CD") at tight gaps. The original split-cell fix only ever
 *   took the single nearest neighbor, so this would have read just "AB12" and silently dropped
 *   the rest of the number.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { DrawingExtractionService } from '../src/services/ai/drawingExtractionService.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion Failed: ${message}`);
  }
}

async function run() {
  console.log('--- TEST: Title-Block Search Zones & Multi-Fragment Values ---');

  {
    const pdfPath = path.join(__dirname, 'fixtures/title_block_left_strip.pdf');
    const buffer = fs.readFileSync(pdfPath);
    const doc = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
    const { projectProps, titleBlockWarning } = await DrawingExtractionService.extractCharacteristics(doc);

    assert(!titleBlockWarning, `Left-strip title block: expected no warning, got: "${titleBlockWarning}"`);
    assert(projectProps.partNumber === 'LFT-100', `Left-strip title block not reached by the broadened search zones, got "${projectProps.partNumber}"`);
    console.log('✓ Title block in the left-margin strip (outside the bottom-right corner box) correctly recognized');
  }

  {
    const pdfPath = path.join(__dirname, 'fixtures/title_block_fragmented_value.pdf');
    const buffer = fs.readFileSync(pdfPath);
    const doc = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
    const { characteristics, projectProps, titleBlockWarning } = await DrawingExtractionService.extractCharacteristics(doc);

    assert(!titleBlockWarning, `Fragmented value: expected no warning, got: "${titleBlockWarning}"`);
    assert(projectProps.partNumber === 'AB12 -34 -CD', `Three-fragment part number not fully rejoined, got "${projectProps.partNumber}"`);

    // None of the three value fragments ("AB12", "-34", "-CD", all containing digits) should
    // leak through as fake dimensions now that they're consumed as title-block metadata.
    const leaked = characteristics.filter(c => ['AB12', '-34', '-CD'].includes(c.rawText.trim()));
    assert(leaked.length === 0, `Consumed title-block value fragments leaked through as characteristics: ${leaked.map(c => `"${c.rawText}"`).join(', ')}`);
    console.log('✓ Three-fragment part number ("AB12" + "-34" + "-CD") rejoined into one value, and none of the fragments leaked through as fake dimensions');
  }

  console.log('>>> TITLE-BLOCK ZONES & FRAGMENTS TEST PASSED! <<<');
}

run();
