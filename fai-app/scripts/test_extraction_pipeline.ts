import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { DrawingExtractionService } from '../src/services/ai/drawingExtractionService.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runExtractionTest() {
  const pdfPath = path.join(__dirname, '../public/sample_blueprint.pdf');
  const buffer = fs.readFileSync(pdfPath);
  const doc = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;

  console.log(`Document loaded with ${doc.numPages} pages.`);
  const { characteristics, projectProps } = await DrawingExtractionService.extractCharacteristics(doc);

  console.log(`Extracted ${characteristics.length} characteristics:`);
  for (const c of characteristics) {
    console.log(`\nID: ${c.id}`);
    console.log(`  Item: #${c.itemNumber} (Sub: ${c.subNumber || c.itemNumber})`);
    console.log(`  Sheet: ${c.sheetNumber}, Zone: ${c.drawingZone}`);
    console.log(`  Type: ${c.type} / ${c.displayType} / ${c.subType}`);
    console.log(`  Raw Text: "${c.rawText}"`);
    console.log(`  Clean Nominal: ${c.cleanNominal}`);
    console.log(`  Limits: [${c.lowerLimit}, ${c.upperLimit}]`);
    console.log(`  Tols: [+${c.plusTol}, ${c.minusTol}]`);
    console.log(`  BoundingBox:`, c.boundingBox);
  }

  console.log('\nProject Properties:');
  console.log('  Part Name:', projectProps.partName);
  console.log('  Part Number:', projectProps.partNumber);
}

runExtractionTest();
