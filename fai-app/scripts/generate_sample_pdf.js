// Script to generate a 2-page valid vector PDF engineering blueprint for LOONIST
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function createPDF() {
  const objects = [];

  function addObject(content) {
    const objNum = objects.length + 1;
    const str = `${objNum} 0 obj\n${content}\nendobj\n`;
    objects.push(str);
    return objNum;
  }

  // Page dimensions: ANSI B (11 x 17 inches = 792 x 1224 points) or standard Letter landscape (612 x 792)
  const width = 1224;
  const height = 792;

  // Font object
  const fontObj = addObject(`<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>`);
  const fontRegularObj = addObject(`<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>`);

  // --- SHEET 1 STREAM ---
  const sheet1Commands = [
    // Background border & CAD grid
    '0.1 0.15 0.25 rg',
    'q 1 w 0 0 1224 792 re s Q',
    'q 2 w 36 36 1152 720 re s Q', // Outer margin
    'q 0.5 w 42 42 1140 708 re s Q', // Inner margin

    // Grid Labels (A, B, C, D / 1, 2, 3, 4, 5, 6, 7, 8)
    'BT /F1 10 Tf 50 735 Td (A) Tj 50 550 Td (B) Tj 50 370 Td (C) Tj 50 190 Td (D) Tj ET',
    'BT /F1 10 Tf 1180 735 Td (A) Tj 1180 550 Td (B) Tj 1180 370 Td (C) Tj 1180 190 Td (D) Tj ET',
    'BT /F1 10 Tf 150 48 Td (1) Tj 300 48 Td (2) Tj 450 48 Td (3) Tj 600 48 Td (4) Tj 750 48 Td (5) Tj 900 48 Td (6) Tj 1050 48 Td (7) Tj ET',

    // Title Block (Bottom Right)
    'q 1.5 w 864 42 318 140 re s Q',
    'q 0.75 w 864 120 318 0 m 1182 120 l s Q',
    'q 0.75 w 864 80 318 0 m 1182 80 l s Q',
    'q 0.75 w 1020 42 0 78 m 1020 120 l s Q',
    
    // Title Block Text
    'BT /F1 14 Tf 880 155 Td (LOONIST AEROSPACE DEFENSE CORP) Tj ET',
    'BT /F2 9 Tf 880 135 Td (TITLE: TURBINE MOUNT BRACKET - HIGH PRESSURE COMPRESSOR) Tj ET',
    'BT /F1 10 Tf 880 102 Td (PART NO: AS9102-TMB-001) Tj ET',
    'BT /F1 10 Tf 1040 102 Td (REV: C) Tj ET',
    'BT /F2 8 Tf 880 62 Td (CAGE: 1A2B3  |  SCALE: 1:1) Tj ET',
    'BT /F2 8 Tf 1040 62 Td (SHEET 1 OF 2  |  UNITS: INCHES) Tj ET',

    // Drawing Geometry: Main Flange Outline (Center)
    'q 2 w',
    '300 300 450 250 re s', // Main body
    '300 425 450 0 m 750 425 l [4 4] 0 d s', // Centerline
    '525 300 0 250 m 525 550 l [4 4] 0 d s', // Vertical centerline
    '[] 0 d',

    // Center Bore Circle (simulated with 8 segments)
    '450 425 150 0 m 450 450 600 450 v s',
    '400 425 50 0 m 400 425 50 20 re s',
    'Q',

    // 4 Mounting Holes with Crosshairs
    'q 1.5 w',
    '340 340 30 30 re s',
    '710 340 30 30 re s',
    '340 500 30 30 re s',
    '710 500 30 30 re s',
    'Q',

    // GD&T Dimension Callouts
    'BT /F1 11 Tf 460 565 Td (DIA 2.500 +/- 0.005 [DIM 1]) Tj ET',
    'q 0.75 w 525 555 0 20 m 525 575 l s 450 560 150 0 m 600 560 l s Q',

    'BT /F1 11 Tf 220 425 Td (4.500 +/- 0.010 [DIM 2]) Tj ET',
    'q 0.75 w 290 300 0 250 m 290 550 l s 280 300 20 0 m 300 300 l s 280 550 20 0 m 300 550 l s Q',

    'BT /F1 11 Tf 480 270 Td (12.450 REF [DIM 3]) Tj ET',
    'q 0.75 w 300 280 450 0 m 750 280 l s Q',

    // Feature Control Frame (ASME Y14.5)
    'q 1 w 780 480 210 24 re s Q',
    'q 0.75 w 820 480 0 24 m 820 504 l s 900 480 0 24 m 900 504 l s 930 480 0 24 m 930 504 l s 960 480 0 24 m 960 504 l s Q',
    'BT /F1 10 Tf 790 488 Td (POS) Tj 830 488 Td (DIA 0.010 M) Tj 910 488 Td (A) Tj 940 488 Td (B) Tj 970 488 Td (C) Tj ET',
    'BT /F2 8 Tf 780 512 Td (FEATURE CONTROL FRAME [FCF 1]) Tj ET',

    // General Notes Block (Top Left)
    'BT /F1 10 Tf 60 700 Td (GENERAL ENGINEERING NOTES:) Tj ET',
    'BT /F2 9 Tf',
    '60 680 Td (1. INTERPRET DRAWING PER ASME Y14.5-2018 STANDARDS.) Tj',
    '0 -15 Td (2. MATERIAL: TI-6AL-4V GRADE 5 TITANIUM PER AMS 4928.) Tj',
    '0 -15 Td (3. REMOVE ALL BURRS AND BREAK SHARP EDGES 0.015 MAX.) Tj',
    '0 -15 Td (4. SURFACE FINISH: 32 Ra MAX ALL MACHINED SURFACES.) Tj',
    '0 -15 Td (5. 100% FIRST ARTICLE INSPECTION PER SAE AS9102 REV C REQUIRED.) Tj',
    '0 -15 Td (6. ITAR CONTROLLED: EXPORT CONTROLLED DEFENSE DATA.) Tj',
    'ET'
  ].join('\n');

  const stream1Length = Buffer.byteLength(sheet1Commands);
  const stream1Obj = addObject(`<< /Length ${stream1Length} >>\nstream\n${sheet1Commands}\nendstream`);

  // --- SHEET 2 STREAM ---
  const sheet2Commands = [
    // Background border & CAD grid
    '0.1 0.15 0.25 rg',
    'q 1 w 0 0 1224 792 re s Q',
    'q 2 w 36 36 1152 720 re s Q',
    'q 0.5 w 42 42 1140 708 re s Q',

    // Grid Labels
    'BT /F1 10 Tf 50 735 Td (A) Tj 50 550 Td (B) Tj 50 370 Td (C) Tj 50 190 Td (D) Tj ET',
    'BT /F1 10 Tf 150 48 Td (1) Tj 450 48 Td (2) Tj 750 48 Td (3) Tj 1050 48 Td (4) Tj ET',

    // Title Block
    'q 1.5 w 864 42 318 140 re s Q',
    'q 0.75 w 864 120 318 0 m 1182 120 l s Q',
    'q 0.75 w 864 80 318 0 m 1182 80 l s Q',
    'q 0.75 w 1020 42 0 78 m 1020 120 l s Q',
    'BT /F1 14 Tf 880 155 Td (LOONIST AEROSPACE DEFENSE CORP) Tj ET',
    'BT /F2 9 Tf 880 135 Td (TITLE: TURBINE MOUNT BRACKET - SECTION DETAILS & THREADS) Tj ET',
    'BT /F1 10 Tf 880 102 Td (PART NO: AS9102-TMB-001) Tj ET',
    'BT /F1 10 Tf 1040 102 Td (REV: C) Tj ET',
    'BT /F2 8 Tf 880 62 Td (CAGE: 1A2B3  |  SCALE: 2:1) Tj ET',
    'BT /F2 8 Tf 1040 62 Td (SHEET 2 OF 2  |  UNITS: INCHES) Tj ET',

    // Section Detail B-B View
    'q 2 w',
    '250 250 500 350 re s',
    '250 425 500 0 m 750 425 l [6 6] 0 d s',
    '[] 0 d',
    '350 300 300 250 re s', // Internal counterbore
    'Q',

    // Section Hatching lines
    'q 0.5 w',
    '260 250 30 300 m 290 550 l s',
    '290 250 30 300 m 320 550 l s',
    '680 250 30 300 m 710 550 l s',
    '710 250 30 300 m 740 550 l s',
    'Q',

    // Callouts & Dimensions
    'BT /F1 12 Tf 420 620 Td (DETAIL B-B: INTERNAL BORE & THREADS [SCALE 2:1]) Tj ET',
    'BT /F1 11 Tf 380 570 Td (BORE DIA 1.1250 +0.0005/-0.0000 [DIM 4]) Tj ET',
    'BT /F1 11 Tf 400 220 Td (4X .375-16 UNC-2B THRU [DIM 5]) Tj ET',
    'BT /F1 11 Tf 780 430 Td (DEPTH 1.250 +/- 0.010 [DIM 6]) Tj ET',

    // Runout Feature Control Frame
    'q 1 w 780 340 160 24 re s Q',
    'q 0.75 w 820 340 0 24 m 820 364 l s 890 340 0 24 m 890 364 l s Q',
    'BT /F1 10 Tf 790 348 Td (RUNOUT) Tj 830 348 Td (0.002) Tj 900 348 Td (A-B) Tj ET',
    'BT /F2 8 Tf 780 372 Td (TOTAL RUNOUT SPECIFICATION [FCF 2]) Tj ET'
  ].join('\n');

  const stream2Length = Buffer.byteLength(sheet2Commands);
  const stream2Obj = addObject(`<< /Length ${stream2Length} >>\nstream\n${sheet2Commands}\nendstream`);

  // Pages & Catalog
  const pagesObjNum = objects.length + 3;
  const _catalogObjNum = objects.length + 4;

  const page1Obj = addObject(`<<
  /Type /Page
  /Parent ${pagesObjNum} 0 R
  /MediaBox [0 0 ${width} ${height}]
  /Contents ${stream1Obj} 0 R
  /Resources <<
    /Font <<
      /F1 ${fontObj} 0 R
      /F2 ${fontRegularObj} 0 R
    >>
  >>
>>`);

  const page2Obj = addObject(`<<
  /Type /Page
  /Parent ${pagesObjNum} 0 R
  /MediaBox [0 0 ${width} ${height}]
  /Contents ${stream2Obj} 0 R
  /Resources <<
    /Font <<
      /F1 ${fontObj} 0 R
      /F2 ${fontRegularObj} 0 R
    >>
  >>
>>`);

  const pagesObj = addObject(`<<
  /Type /Pages
  /Kids [${page1Obj} 0 R ${page2Obj} 0 R]
  /Count 2
>>`);

  const catalogObj = addObject(`<<
  /Type /Catalog
  /Pages ${pagesObj} 0 R
>>`);

  // Build PDF buffer
  let pdf = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
  const xrefOffsets = [];

  for (let i = 0; i < objects.length; i++) {
    xrefOffsets.push(Buffer.byteLength(pdf));
    pdf += objects[i];
  }

  const xrefStart = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 0; i < xrefOffsets.length; i++) {
    pdf += String(xrefOffsets[i]).padStart(10, '0') + ' 00000 n \n';
  }

  pdf += `trailer\n<<\n  /Size ${objects.length + 1}\n  /Root ${catalogObj} 0 R\n>>\nstartxref\n${xrefStart}\n%%EOF\n`;

  const outPath = path.join(__dirname, '../public/sample_blueprint.pdf');
  fs.writeFileSync(outPath, pdf);
  console.log(`Successfully generated sample blueprint at ${outPath} (${Buffer.byteLength(pdf)} bytes)`);
}

createPDF();
