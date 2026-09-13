// Script to generate an authentic 2-page AS9102 / ASME Y14.5 vector PDF engineering blueprint for LOONIST
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

  // Page dimensions: ANSI B (11 x 17 inches = 792 x 1224 points)
  const width = 1224;
  const height = 792;

  // Font objects
  const fontObj = addObject(`<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>`);
  const fontRegularObj = addObject(`<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>`);

  // --- SHEET 1 STREAM ---
  // Turbine Mount Bracket - Primary Geometry, Basic Dimensions, Composite GD&T, and General Notes
  const sheet1Commands = [
    // CAD Background Border & Margins
    '0.1 0.15 0.25 rg',
    'q 1 w 0 0 1224 792 re s Q',
    'q 2 w 36 36 1152 720 re s Q',   // Outer border
    'q 0.5 w 42 42 1140 708 re s Q', // Inner margin

    // Drawing Margin Grid Labels (A-D, 1-8)
    'BT /F1 10 Tf 50 735 Td (A) Tj ET',
    'BT /F1 10 Tf 50 550 Td (B) Tj ET',
    'BT /F1 10 Tf 50 370 Td (C) Tj ET',
    'BT /F1 10 Tf 50 190 Td (D) Tj ET',
    'BT /F1 10 Tf 1180 735 Td (A) Tj ET',
    'BT /F1 10 Tf 1180 550 Td (B) Tj ET',
    'BT /F1 10 Tf 1180 370 Td (C) Tj ET',
    'BT /F1 10 Tf 1180 190 Td (D) Tj ET',
    'BT /F1 10 Tf 150 48 Td (1) Tj ET',
    'BT /F1 10 Tf 300 48 Td (2) Tj ET',
    'BT /F1 10 Tf 450 48 Td (3) Tj ET',
    'BT /F1 10 Tf 600 48 Td (4) Tj ET',
    'BT /F1 10 Tf 750 48 Td (5) Tj ET',
    'BT /F1 10 Tf 900 48 Td (6) Tj ET',
    'BT /F1 10 Tf 1050 48 Td (7) Tj ET',

    // Title Block (Bottom Right)
    'q 1.5 w 864 42 318 140 re s Q',
    'q 0.75 w 864 125 m 1182 125 l s Q',
    'q 0.75 w 864 85 m 1182 85 l s Q',
    'q 0.75 w 1020 42 m 1020 125 l s Q',
    
    // Title Block Text & Dynamic Tolerances
    'BT /F1 13 Tf 875 160 Td (LOONIST AEROSPACE DEFENSE CORP) Tj ET',
    'BT /F2 8.5 Tf 875 140 Td (TITLE: HIGH PRESSURE COMPRESSOR TURBINE MOUNT BRACKET) Tj ET',
    'BT /F1 10 Tf 875 105 Td (PART NO: AS9102-TMB-001) Tj ET',
    'BT /F1 10 Tf 1035 105 Td (REV: C) Tj ET',
    'BT /F2 7.5 Tf 875 92 Td (CAGE: 1A2B3  |  DWG NO: AS9102-TMB-001) Tj ET',
    'BT /F2 7.5 Tf 875 68 Td (TOLERANCES UNLESS NOTED: .X +/- .030, .XX +/- .010, .XXX +/- .005) Tj ET',
    'BT /F2 7.5 Tf 875 52 Td (ANGLES +/- 0.5 DEG  |  UNITS: INCHES  |  SHEET 1 OF 2) Tj ET',

    // Drawing Geometry: Main Flange Body (Center)
    'q 2 w',
    '280 290 500 270 re s',              // Main rectangular mounting flange
    '280 425 m 780 425 l [6 4] 0 d s',   // Horizontal center line
    '530 290 m 530 560 l [6 4] 0 d s',   // Vertical center line
    '[] 0 d',

    // Center Bore Circle (radius 60 centered at 530, 425)
    '530 485 m',
    '563.1 485 590 458.1 590 425 c',
    '590 391.9 563.1 365 530 365 c',
    '496.9 365 470 391.9 470 425 c',
    '470 458.1 496.9 485 530 485 c',
    's',

    // 4 Corner Bolt Holes
    '330 340 32 32 re s',
    '700 340 32 32 re s',
    '330 490 32 32 re s',
    '700 490 32 32 re s',
    'Q',

    // ========================================================
    // CHARACTERISTICS & ENGINEERING CALLOUTS (SHEET 1)
    // ========================================================

    // Callout 1: Center Bore with Explicit Bilateral Tolerance
    'BT /F1 11 Tf 460 580 Td (DIA 2.500 +/- 0.005) Tj ET',
    'q 0.75 w 530 565 m 530 595 l s 450 575 m 610 575 l s Q',

    // Callout 2: Boxed Basic Dimension [ 4.500 ] (Per ASME Y14.5)
    'q 1 w 185 412 75 22 re s Q', // Enclosing rectangle
    'BT /F1 11 Tf 195 418 Td ([ 4.500 ]) Tj ET',
    'q 0.75 w 270 290 m 270 560 l s 260 290 m 280 290 l s 260 560 m 280 560 l s Q',

    // Callout 3: Overall Flange Width Reference Dimension ( 12.450 REF )
    'BT /F1 11 Tf 475 250 Td (( 12.450 REF )) Tj ET',
    'q 0.75 w 280 265 m 780 265 l s 280 260 m 280 270 l s 780 260 m 780 270 l s Q',

    // Callout 4: Corner Radius MAX callout
    'BT /F1 11 Tf 710 540 Td (4X R .030 MAX) Tj ET',

    // Callout 5: Outer Flange Chamfer
    'BT /F1 11 Tf 220 540 Td (.060 X 45 DEG) Tj ET',

    // Callout 6: Mixed Fraction Thread Callout
    'BT /F1 11 Tf 280 215 Td (4X 1 3/8-12 UNF-2B) Tj ET',

    // Callout 7: Surface Profile GD&T Frame
    'q 1 w 820 530 180 24 re s Q',
    'q 0.75 w 895 530 m 895 554 l s 955 530 m 955 554 l s 985 530 m 985 554 l s Q',
    'BT /F1 10 Tf 825 537 Td (| PROFILE | 0.008 | A | B |) Tj ET',

    // Callout 8: Composite Dual-Tier True Position Feature Control Frame
    'q 1 w 820 450 250 44 re s Q',
    'q 0.75 w 820 472 m 1070 472 l s Q', // Tier divider
    'BT /F1 10 Tf 825 478 Td (| POS | DIA 0.020 (M) | A | B | C |) Tj ET',
    'BT /F1 10 Tf 825 456 Td (| POS | DIA 0.005 (M) | A |) Tj ET',

    // Callout 9: Datum A Flatness Frame
    'q 1 w 820 390 120 24 re s Q',
    'q 0.75 w 875 390 m 875 414 l s Q',
    'BT /F1 10 Tf 825 397 Td (| FLAT | 0.002 |) Tj ET',

    // General Notes Block (Top Left)
    'BT /F1 10 Tf 60 700 Td (GENERAL ENGINEERING NOTES:) Tj ET',
    'BT /F2 8.5 Tf 60 682 Td (1. INTERPRET DRAWING IN ACCORDANCE WITH ASME Y14.5-2018 STANDARDS.) Tj ET',
    'BT /F2 8.5 Tf 60 667 Td (2. MATERIAL: TI-6AL-4V GRADE 5 TITANIUM PER AMS 4928.) Tj ET',
    'BT /F2 8.5 Tf 60 652 Td (3. REMOVE ALL BURRS AND BREAK SHARP EDGES 0.015 MAX.) Tj ET',
    'BT /F2 8.5 Tf 60 637 Td (4. SURFACE FINISH: 32 Ra MAX ALL MACHINED SURFACES.) Tj ET',
    'BT /F2 8.5 Tf 60 622 Td (5. 100% FIRST ARTICLE INSPECTION PER SAE AS9102 REV C REQUIRED.) Tj ET',
    'BT /F2 8.5 Tf 60 607 Td (6. ITAR CONTROLLED: TECHNICAL DATA SUBJECT TO US EXPORT REGULATIONS.) Tj ET'
  ].join('\n');

  const stream1Length = Buffer.byteLength(sheet1Commands);
  const stream1Obj = addObject(`<< /Length ${stream1Length} >>\nstream\n${sheet1Commands}\nendstream`);

  // --- SHEET 2 STREAM ---
  // Section Detail B-B: Internal Bores, Counterbores, Depth Specs, Total Runout, and Perpendicularity
  const sheet2Commands = [
    // CAD Background Border & Margins
    '0.1 0.15 0.25 rg',
    'q 1 w 0 0 1224 792 re s Q',
    'q 2 w 36 36 1152 720 re s Q',
    'q 0.5 w 42 42 1140 708 re s Q',

    // Grid Labels
    'BT /F1 10 Tf 50 735 Td (A) Tj ET',
    'BT /F1 10 Tf 50 550 Td (B) Tj ET',
    'BT /F1 10 Tf 50 370 Td (C) Tj ET',
    'BT /F1 10 Tf 50 190 Td (D) Tj ET',
    'BT /F1 10 Tf 150 48 Td (1) Tj ET',
    'BT /F1 10 Tf 450 48 Td (2) Tj ET',
    'BT /F1 10 Tf 750 48 Td (3) Tj ET',
    'BT /F1 10 Tf 1050 48 Td (4) Tj ET',

    // Title Block
    'q 1.5 w 864 42 318 140 re s Q',
    'q 0.75 w 864 125 m 1182 125 l s Q',
    'q 0.75 w 864 85 m 1182 85 l s Q',
    'q 0.75 w 1020 42 m 1020 125 l s Q',
    'BT /F1 13 Tf 875 160 Td (LOONIST AEROSPACE DEFENSE CORP) Tj ET',
    'BT /F2 8.5 Tf 875 140 Td (TITLE: TURBINE MOUNT BRACKET - INTERNAL BORES & THREADS) Tj ET',
    'BT /F1 10 Tf 875 105 Td (PART NO: AS9102-TMB-001) Tj ET',
    'BT /F1 10 Tf 1035 105 Td (REV: C) Tj ET',
    'BT /F2 7.5 Tf 875 92 Td (CAGE: 1A2B3  |  DWG NO: AS9102-TMB-001) Tj ET',
    'BT /F2 7.5 Tf 875 68 Td (TOLERANCES UNLESS NOTED: .X +/- .030, .XX +/- .010, .XXX +/- .005) Tj ET',
    'BT /F2 7.5 Tf 875 52 Td (ANGLES +/- 0.5 DEG  |  UNITS: INCHES  |  SHEET 2 OF 2) Tj ET',

    // Section Detail B-B View Outline
    'q 2 w',
    '260 250 480 340 re s',
    '260 420 m 740 420 l [6 4] 0 d s', // Horizontal centerline
    '500 250 m 500 590 l [6 4] 0 d s', // Vertical centerline
    '[] 0 d',
    '360 300 280 240 re s',             // Internal counterbore chamber
    'Q',

    // Cross Hatching
    'q 0.5 w',
    '270 250 m 300 590 l s',
    '300 250 m 330 590 l s',
    '670 250 m 700 590 l s',
    '700 250 m 730 590 l s',
    'Q',

    // Section Header
    'BT /F1 12 Tf 360 615 Td (SECTION B-B: INTERNAL BORE & THREAD DETAILS) Tj ET',

    // ========================================================
    // CHARACTERISTICS & ENGINEERING CALLOUTS (SHEET 2)
    // ========================================================

    // Callout 10: Unilateral Tolerance Internal Bore
    'BT /F1 11 Tf 330 565 Td (BORE DIA 1.1250 +0.0005/-0.0000) Tj ET',

    // Callout 11: Multi-line Compound Hole Callout (Hole Thread + Counterbore + Depth)
    'BT /F1 11 Tf 300 215 Td (4X .375-16 UNC-2B THRU) Tj ET',
    'BT /F1 11 Tf 300 198 Td (CBORE DIA .562 DEPTH .250) Tj ET',

    // Callout 12: Limit Dimension for Counterbore Depth
    'BT /F1 11 Tf 760 435 Td (1.255 / 1.245) Tj ET',

    // Callout 13: Total Runout GD&T Frame
    'q 1 w 760 355 170 24 re s Q',
    'q 0.75 w 835 355 m 835 379 l s 895 355 m 895 379 l s Q',
    'BT /F1 10 Tf 765 362 Td (| RUNOUT | 0.002 | A-B |) Tj ET',

    // Callout 14: Perpendicularity GD&T Frame
    'q 1 w 760 295 150 24 re s Q',
    'q 0.75 w 815 295 m 815 319 l s 875 295 m 875 319 l s Q',
    'BT /F1 10 Tf 765 302 Td (| PERP | 0.001 | A |) Tj ET'
  ].join('\n');

  const stream2Length = Buffer.byteLength(sheet2Commands);
  const stream2Obj = addObject(`<< /Length ${stream2Length} >>\nstream\n${sheet2Commands}\nendstream`);

  // Pages & Catalog Objects
  const pagesObjNum = objects.length + 3;
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

  // Build Binary PDF buffer
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
  console.log(`Successfully generated master sample blueprint at ${outPath} (${Buffer.byteLength(pdf)} bytes)`);
}

createPDF();
