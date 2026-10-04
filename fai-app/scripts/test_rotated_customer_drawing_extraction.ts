/**
 * Golden-File Regression Test: Rotated Real Customer Drawing (CINH91CDB11-B)
 *
 * Covers a bug class the synthetic sample_blueprint.pdf fixture cannot exercise: a real,
 * born-digital, 90-degree-ROTATED, FRENCH-labeled title block drawing (ISO 5457 side-strip
 * title block, not the ASME bottom-right corner box the rest of the engine assumes).
 *
 * This fixture was added 2026-10-03 after an audit found that:
 *   1. drawingExtractionService.ts computed text positions with a `viewport.height - y` flip
 *      that only works for an unrotated page — on this page it put text at coordinates outside
 *      the sheet entirely, corrupting every downstream heuristic (sort order, clustering,
 *      title-block zone, border-grid detection). Fixed via pdf.js's own viewport transform.
 *   2. A missing title-block match (English-only field labels) was silently backfilled with the
 *      bundled demo part's fake identity (name/number/CAGE code) instead of surfacing a failure.
 *      Fixed: missing fields are now left blank with an explicit titleBlockWarning.
 *   3. Ø10.5 holes with a real ISO 286 stacked limit/deviation tolerance (nominal "10.5" with
 *      "0" written above and "-0.08" below, on separate lines) were silently discarded in favor
 *      of a generic default tolerance class. Fixed via SpatialClusteringEngine's
 *      reattachDeviationsAboveNominal pass + GdtParser's stacked-limit-deviation rule.
 *
 * Follow-up pass (2026-10-04), found by visually checking a real ballooned render against this
 * same fixture:
 *   4. A GD&T feature-control-frame absorbed an UNRELATED neighboring hole's stray "-0.08"
 *      deviation line merely because the frame sat closer above it than the hole's own nominal
 *      did. Fixed by requiring isCompanionCallout's explicit-tolerance rule to only attach to a
 *      plain numeric nominal, never to a frame/datum-reference string.
 *   5. A "18X" repeated-feature multiplier was orphaned from its own Ø10.5 hole by a sort-order
 *      quirk (same underlying issue as #3, one pipeline stage earlier) and ended up fused onto
 *      an unrelated neighboring GD&T frame instead. Fixed via
 *      DrawingExtractionService.reattachOrphanMultipliers.
 *   6. GD&T frames whose leading symbol glyph isn't one of the known Unicode GD&T characters
 *      (this font substitutes plain Latin letters for them) were falling through to a generic
 *      "linear" dimension parse — silently misrepresenting a GD&T characteristic as a plain
 *      dimension. Fixed by recognizing the frame by STRUCTURE (GdtParser.parseSpaceDelimitedFrame)
 *      and reporting the characteristic as 'unknown' + forcing needs_review rather than guessing
 *      which specific GD&T symbol it is.
 *
 * Follow-up pass (2026-10-04), after the user manually verified this drawing's title block
 * against the real PDF and asked for it to be read structurally rather than left blank:
 *   7. The title block here is a genuine bilingual TABLE — "Référence / Part number" sits in
 *      one row with its value ("CINH91CDB11") in a different, stacked row below it, and the
 *      revision is a multi-row dated history ("A" 14/05/2025, "B" 27/05/2025), not a single
 *      "REV: X" field. Reading it correctly needed real structural support — diacritic-aware
 *      label matching, telling a bilingual label's OTHER half apart from a real value
 *      (isBilingualLabelResidue), and a dedicated date-anchored revision-history-table reader
 *      (findCurrentRevisionFromHistoryTable) that picks the row with the latest date rather
 *      than guessing a position — not AUXEL-specific hardcoding of these 3 values. This test's
 *      assertions below were updated FROM "stays blank, unrecognized" TO these user-verified
 *      correct values once that support existed; see drawingExtractionService.ts's
 *      TITLE_BLOCK_FIELD_SYNONYMS doc comment for what's still deliberately out of scope
 *      (ISO 7200 numbered fields — no verified mapping exists to build against).
 *
 * Follow-up pass (2026-10-05), from an independent FAI/AS9102 QA review that compared this
 * drawing's Loonist-generated FAIR against the actual ballooned PDF and found six confirmed
 * defects (verified against the drawing's own PDF text layer, including the exact font —
 * "SolidEdgeANSI1Symbols" — the GD&T frame glyphs come from):
 *   8.  Form 3 "Reference Location" zone was wrong for essentially every characteristic: the
 *       zone grid's column/row count was guessed from rendered pixel dimensions (capped at 8x8)
 *       instead of reading the drawing's own printed 16-column/12-row ruler, which this engine
 *       already detects elsewhere (findBorderGridLabels, previously used only to exclude grid
 *       labels from being misread as dimensions, never reused for zone lookup itself). Fixed by
 *       having GridZoneCalculator.calculateZone interpolate against that real detected ruler.
 *   9.  A bare ISO 13715 chamfer-leg symbol ("2c", meaning a 2mm chamfer with an unstated angle)
 *       was converted to "2°" and misreported as an angular dimension with the wrong tolerance
 *       class. Two separate causes, both fixed: DrawingExtractionService.normalizeCadSymbols
 *       (and OcrEngineService.normalizeCadOcr) unconditionally treated any trailing "c" as a
 *       degree-sign substitute even with no angle/chamfer context, and GdtParser's chamfer
 *       detection separately required an "x" pairing that a bare "Nc" never has.
 *   10. A bare negative dimension (e.g. "-0.1") lost its sign before tolerances were applied —
 *       "-0.1" ±0.1 produced limits [0, 0.2] instead of [-0.2, 0] — because GdtParser's generic
 *       nominal-extraction regex had no optional leading "-". calculateLimits itself was already
 *       sign-correct.
 *   11. The "18X" multiplied Ø10.5 hole's upper-deviation line ("0", stacked above the nominal
 *       per ISO 286) failed to reattach specifically because that nominal carries a leading
 *       multiplier ("18x Ø10.5") and SpatialClusteringEngine's reattachment-target regex didn't
 *       tolerate one (unlike the main clustering pass's own stacked-limit rule, which already
 *       did) — so the orphaned "0" surfaced as its own fabricated 44th characteristic instead of
 *       completing the hole's real tolerance.
 *   12. Both GD&T frame types on this drawing (Position, Profile-of-a-Line) were always
 *       needs_review because their SolidEdgeANSI1Symbols-font leading glyph ("l", "h") wasn't
 *       recognized — confirmed by cross-referencing the PDF's own text-layer font tags against
 *       the rendered frame symbols. Fixed by mapping these two specific, verified glyphs in
 *       GdtParser.normalizeGdtSymbol; any OTHER unrecognized glyph still correctly falls through
 *       to 'unknown' + needs_review rather than guessing.
 *   13. Form 2 (materials & special processes) was always empty: "material" was already
 *       extracted into titleBlockFields but never reached the Excel exporter, and "treatment"
 *       (Traitement/Treatment — this drawing's tin-plating special process) had no synonym
 *       entry at all. Fixed by threading titleBlockFields through to As9102ExcelExporter and
 *       adding the treatment synonym.
 * Items #9-13 are exercised directly below. Item #8 (zone) is exercised against this drawing's
 * real, independently pixel-measured ruler positions — see the inline comments at each
 * assertion for how those expected zones were verified.
 *
 * If a future change legitimately alters these numbers, update the expectations deliberately
 * (and say why in the commit) — don't just delete the assertion.
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
  console.log('--- TEST: Rotated Real Customer Drawing Extraction (CINH91CDB11-B) ---');

  const pdfPath = path.join(__dirname, 'fixtures/CINH91CDB11-B.pdf');
  const buffer = fs.readFileSync(pdfPath);
  const doc = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;

  assert(doc.numPages === 1, `Fixture page count changed: expected 1, got ${doc.numPages}.`);
  const page = await doc.getPage(1);
  assert((page as any).rotate === 90, `Fixture is expected to carry an intrinsic /Rotate 90 — got ${(page as any).rotate}. This fixture exists specifically to cover rotated-page handling.`);

  const { characteristics, projectProps, titleBlockWarning, titleBlockFields } = await DrawingExtractionService.extractCharacteristics(doc as any);

  // 1. Title block identity, manually verified by the user against the real PDF (2026-10-04):
  // part number / part name / revision must be read correctly from this bilingual table-style
  // title block, and no titleBlockWarning should fire now that it's recognized. No CAGE code
  // exists on this drawing (a European ISO title block, not a US/NATO contracting one) — it
  // should stay blank, which is the correct answer here, not a fallback.
  assert(projectProps.partNumber === 'CINH91CDB11', `Part number: expected "CINH91CDB11", got "${projectProps.partNumber}"`);
  assert(projectProps.partName === 'Conductor', `Part name: expected "Conductor", got "${projectProps.partName}"`);
  assert(projectProps.partRevision === 'B', `Revision: expected "B" (the latest-dated history-table entry, 27/05/2025), got "${projectProps.partRevision}"`);
  assert(projectProps.cageCode === '', `CAGE code: this drawing has none — expected blank, got "${projectProps.cageCode}"`);
  assert(!titleBlockWarning, `Expected no titleBlockWarning now that the title block is recognized, got: "${titleBlockWarning}"`);
  console.log('✓ Part number, part name, and current revision (from the dated history table) all match the user-verified ground truth; no CAGE code fabricated');

  // 1b. Supplementary title-block fields (not part of the persisted ProjectProperties model),
  // same user-verified ground truth.
  assert(titleBlockFields?.material === 'Cu-ETP H12', `Material: expected "Cu-ETP H12", got "${titleBlockFields?.material}"`);
  assert(titleBlockFields?.scale === '1:2', `Scale: expected "1:2", got "${titleBlockFields?.scale}"`);
  assert(titleBlockFields?.mass === '881.87 g', `Mass: expected "881.87 g", got "${titleBlockFields?.mass}"`);
  assert(titleBlockFields?.sheet === '1 / 1', `Sheet: expected "1 / 1", got "${titleBlockFields?.sheet}"`);
  assert(titleBlockFields?.format === 'A1', `Format: expected "A1", got "${titleBlockFields?.format}"`);
  console.log('✓ Supplementary fields (material, scale, mass, sheet, format) all match the user-verified ground truth');

  // 2. Real ISO 286 stacked limit/deviation tolerances on the Ø10.5 holes must be recovered,
  // not silently discarded in favor of a generic default tolerance class. All 5 holes recover it
  // once a GD&T frame is no longer able to steal one hole's deviation line out from under it
  // (see #4 above) — previously only 4 of 5 came through correctly.
  const toleredHoles = characteristics.filter(c => c.type === 'diameter' && c.cleanNominal === 10.5 && c.lowerLimit === 10.42);
  assert(toleredHoles.length === 5, `Expected all 5 of the 5 Ø10.5 holes to recover their real +0/-0.08 limit tolerance (upper=10.5, lower=10.42), got ${toleredHoles.length}`);
  console.log(`✓ All 5/5 Ø10.5 holes correctly recovered their real ISO 286 stacked limit tolerance (10.5 +0/-0.08)`);

  // 2b. The "18X" multiplier must land on its own Ø10.5 hole, not get fused onto an unrelated
  // neighboring GD&T frame.
  const multipliedHole = characteristics.find(c => c.type === 'diameter' && /^18x/i.test(c.rawText.trim()));
  assert(!!multipliedHole && multipliedHole.cleanNominal === 10.5, `Expected the "18X" multiplier to be attached to its own Ø10.5 hole, found: ${multipliedHole ? `"${multipliedHole.rawText}"` : 'nothing'}`);
  console.log('✓ "18X" multiplier correctly attached to its own Ø10.5 hole, not a neighboring GD&T frame');

  // 2c. GD&T feature-control-frames must be typed as 'gdt' (not silently misrepresented as a
  // plain 'linear' dimension), and must never absorb an unrelated neighboring tolerance line.
  const gdtFrames = characteristics.filter(c => c.type === 'gdt');
  assert(gdtFrames.length === 8, `Expected 8 GD&T feature-control-frames on this drawing, got ${gdtFrames.length}`);
  assert(gdtFrames.every(c => !/-0\.\d+$/.test(c.rawText.trim())), `A GD&T frame absorbed an unrelated neighboring tolerance line: ${gdtFrames.filter(c => /-0\.\d+$/.test(c.rawText.trim())).map(c => `"${c.rawText}"`).join(', ')}`);
  console.log('✓ All 8 GD&T frames correctly typed and clean of unrelated neighboring tolerance values');

  // 2d. (QA fix #12, 2026-10-05) This drawing's GD&T frames use Siemens Solid Edge's
  // "SolidEdgeANSI1Symbols" font, which draws Position and Profile-of-a-Line using plain
  // lowercase-letter character codes ("l", "h") instead of real GD&T Unicode glyphs — confirmed
  // by reading the PDF's own text-layer font tags. Both are now recognized (6 Position frames,
  // "Ø10.5 position-to-datum" + "chamfer-edge position" callouts; 2 Profile-of-a-Line frames,
  // the two "sheared/laser edge" callouts), so none of the 8 should still need manual
  // GD&T-type review. Any symbol this engine genuinely doesn't recognize must still fall
  // through to 'unknown' + needs_review rather than guess — this only asserts that these two
  // SPECIFIC, drawing-verified glyphs are no longer in that bucket.
  const positionFrames = gdtFrames.filter(c => c.subType === 'Position');
  const profileLineFrames = gdtFrames.filter(c => c.subType === 'Profile of a Line');
  assert(positionFrames.length === 6, `Expected 6 Position frames (SolidEdgeANSI1Symbols "l"), got ${positionFrames.length}`);
  assert(profileLineFrames.length === 2, `Expected 2 Profile-of-a-Line frames (SolidEdgeANSI1Symbols "h"), got ${profileLineFrames.length}`);
  assert(gdtFrames.every(c => c.verificationStatus === 'auto_accepted'), `All 8 GD&T frames should now auto_accept with their symbol correctly identified, found needs_review on: ${gdtFrames.filter(c => c.verificationStatus !== 'auto_accepted').map(c => `#${c.itemNumber} "${c.rawText}"`).join(', ')}`);
  console.log('✓ Both GD&T frame types (Position, Profile-of-a-Line) correctly decoded from the SolidEdgeANSI1Symbols font glyphs and auto-accepted');

  // 2e. (QA fix #9, 2026-10-05) The two bare ISO 13715 chamfer-leg symbols ("2c", one each at
  // Detail A and the 5x Detail C views) must parse as a 2mm chamfer, not get their trailing "c"
  // read as a degree sign and misreported as a 2° angle.
  const chamfers = characteristics.filter(c => c.type === 'chamfer');
  assert(chamfers.length === 2, `Expected 2 bare "2c" chamfer-leg callouts, got ${chamfers.length}`);
  assert(chamfers.every(c => c.cleanNominal === 2 && c.units === 'mm' && c.rawText.trim() === '2c'), `Expected both chamfers to read nominal=2mm with raw text "2c" preserved, got: ${chamfers.map(c => `nominal=${c.cleanNominal} units=${c.units} raw="${c.rawText}"`).join('; ')}`);
  assert(characteristics.filter(c => c.type === 'angle').every(c => c.rawText.trim() !== '2c'), 'A "2c" chamfer symbol was still misread as an angle');
  console.log('✓ Both "2c" ISO 13715 chamfer-leg symbols correctly read as 2mm chamfers, not misread as 2° angles');

  // 2f. (QA fix #10, 2026-10-05) The two bare negative dimensions near the "Outside edge
  // according to ISO13715" note ("-0.1", "-0.3") must keep their sign through tolerancing: with
  // this drawing's Title Block ±0.1mm one-decimal class, "-0.1" must resolve to [-0.2, 0.0] and
  // "-0.3" to [-0.4, -0.2] — not the positive-mirrored [0, 0.2] / [0.2, 0.4] a sign-stripping
  // bug previously produced.
  const negPoint1 = characteristics.find(c => c.cleanNominal === -0.1);
  const negPoint3 = characteristics.find(c => c.cleanNominal === -0.3);
  assert(!!negPoint1 && negPoint1.lowerLimit === -0.2 && negPoint1.upperLimit === 0, `Expected "-0.1" to resolve to limits [-0.2, 0], got: ${negPoint1 ? `[${negPoint1.lowerLimit}, ${negPoint1.upperLimit}]` : 'not found'}`);
  assert(!!negPoint3 && negPoint3.lowerLimit === -0.4 && negPoint3.upperLimit === -0.2, `Expected "-0.3" to resolve to limits [-0.4, -0.2], got: ${negPoint3 ? `[${negPoint3.lowerLimit}, ${negPoint3.upperLimit}]` : 'not found'}`);
  console.log('✓ Both negative-nominal dimensions ("-0.1", "-0.3") kept their sign through tolerance limit calculation');

  // 2g. (QA fix #11, 2026-10-05) The "18X" multiplied Ø10.5 hole's upper-deviation line ("0",
  // stacked above the nominal per ISO 286) must now reattach to its own multiplier-prefixed
  // nominal instead of surfacing as its own fabricated characteristic — so there must be exactly
  // one "18x..." characteristic (not two), and it must carry the complete, correctly-signed
  // ISO 286 tolerance (not a generic Title Block default on a bare "0").
  const eighteenXChars = characteristics.filter(c => /^18x/i.test(c.rawText.trim()));
  assert(eighteenXChars.length === 1, `Expected exactly 1 characteristic for the "18X" hole (the stray "0" must be reattached, not a separate characteristic), got ${eighteenXChars.length}: ${eighteenXChars.map(c => `"${c.rawText}"`).join(', ')}`);
  assert(eighteenXChars[0].lowerLimit === 10.42 && eighteenXChars[0].upperLimit === 10.5, `Expected the merged "18X" hole to carry limits [10.42, 10.5], got [${eighteenXChars[0].lowerLimit}, ${eighteenXChars[0].upperLimit}]`);
  // 43 genuine toleranced/GD&T characteristics + 2 drawing-note characteristics (2m below) = 45.
  // The ORIGINAL human-ballooned PDF had numbered this drawing 1-44, but balloon #17 of that
  // scheme was itself the bug this fix removes (a stray split of balloon #16's own deviation
  // value, not a genuine 44th characteristic) — 43 is the drawing's real toleranced-feature
  // count, independently verified against the drawing.
  assert(characteristics.filter(c => c.type !== 'note').length === 43, `Expected 43 genuine toleranced/GD&T characteristics now that the stray "0" no longer surfaces as its own characteristic, got ${characteristics.filter(c => c.type !== 'note').length}`);
  console.log('✓ "18X" hole\'s stacked upper-deviation line correctly reattached — no stray duplicate characteristic, correct ISO 286 limits, 43 genuine characteristics');

  // 2h. (QA fix #8, 2026-10-05) Form 3 "Reference Location" zone must come from this drawing's
  // own printed 16-column/12-row zone ruler, not a guessed 8x8 grid. Ground truth below was
  // independently verified by rendering this exact fixture to a 288 DPI-equivalent image and
  // pixel-measuring the printed column-tick/row-tick positions directly against each balloon —
  // not re-derived from this engine's own output. Balloon #1 ("1 ±0.1", the overall edge
  // thickness) sits physically at column 16 (the sheet's rightmost column) — under the previous
  // 8-column guess this reported "Zone B-8", silently halving every column reference on the
  // drawing.
  const edgeThickness = characteristics.find(c => c.rawText.trim() === '1 ±0.1');
  assert(edgeThickness?.drawingZone === 'Zone B-16', `Expected balloon #1 ("1 ±0.1") at pixel-verified column 16 to report "Zone B-16", got "${edgeThickness?.drawingZone}"`);
  console.log('✓ Zone calculation now reads this drawing\'s real 16-column printed ruler (balloon #1 correctly reports Zone B-16, not the old guessed Zone B-8)');

  // 2i. (QA fix #13, 2026-10-05) Form 2 (materials & special processes): the title block's
  // "Traitement / Treatment: Sn 5 (I) / Cu" (tin-plating special process) must now be captured
  // alongside the already-working "Matière / Raw material: Cu-ETP H12", so Form 2 is no longer
  // silently empty.
  assert(titleBlockFields?.treatment === 'Sn 5 (I) / Cu', `Expected Form 2 treatment "Sn 5 (I) / Cu", got "${titleBlockFields?.treatment}"`);
  console.log('✓ Special-process treatment ("Sn 5 (I) / Cu") now captured for AS9102 Form 2, alongside the material');

  // 2j. (Follow-up, 2026-10-05) Organization Name: this drawing's company name ("Amphenol")
  // has no explicit "Company:"/"Manufacturer:" field label anywhere on the sheet — it is bare
  // text sitting directly above its own address/phone/fax block, in a visibly larger font.
  // detectOrganizationNameFromAddressBlock recognizes that structural convention (language-
  // agnostic PHONE/FAX labels + a nearby, much-larger-font text run that isn't itself another
  // address line or an already-identified title-block field) instead of requiring an explicit
  // label, since the field is just as "clearly present" to a human reader either way.
  assert(projectProps.organizationName === 'Amphenol', `Expected Organization Name "Amphenol" (found structurally via its address block, no explicit label exists), got "${projectProps.organizationName}"`);
  console.log('✓ Organization Name "Amphenol" correctly found via its address-block structure, with no explicit title-block label');

  // 2k. (Follow-up, 2026-10-05) Form 2 must also capture the drawing's general tolerance
  // standard ("ISO 2768-mK / ISO 8015") verbatim as a traceable note, not just silently consume
  // the "m" class internally for tolerance math.
  const iso2768Note = characteristics.find(c => c.type === 'note' && c.rawText.includes('ISO 2768'));
  assert(!!iso2768Note && iso2768Note.rawText === 'ISO 2768-mK / ISO 8015', `Expected a note capturing the full "ISO 2768-mK / ISO 8015" standard text, got: ${iso2768Note?.rawText}`);
  console.log('✓ General tolerance standard "ISO 2768-mK / ISO 8015" captured verbatim as a traceable note');

  // 2l. (Follow-up, 2026-10-05) The "Outside edge according to ISO13715 :" edge-treatment
  // requirement must be captured even though it is an un-numbered standalone caption sitting
  // near the title block (not a numbered "N. ..." general note, and not swallowed by the
  // title-block exclusion zone that correctly keeps real identity fields out of Form 3).
  const iso13715Note = characteristics.find(c => c.type === 'note' && c.rawText.includes('13715'));
  assert(!!iso13715Note && iso13715Note.rawText === 'Outside edge according to ISO13715 :', `Expected the ISO13715 edge-treatment note to be captured verbatim, got: ${iso13715Note?.rawText}`);
  console.log('✓ "Outside edge according to ISO13715" edge-treatment requirement captured as a traceable note');

  // 3. Coordinate/rotation handling: no characteristic should have been placed with an
  // out-of-sheet bounding box (the symptom of the original viewport.height-y flip bug).
  const sheetWidth = page.getViewport({ scale: 1.0 }).width;
  const sheetHeight = page.getViewport({ scale: 1.0 }).height;
  const offSheet = characteristics.filter(c => {
    const b = (c as any).boundingBox;
    return b && (b.x < -50 || b.y < -50 || b.x > sheetWidth + 50 || b.y > sheetHeight + 50);
  });
  assert(offSheet.length === 0, `${offSheet.length} characteristic(s) placed outside the sheet bounds — rotation/coordinate handling regressed: ${offSheet.map((c: any) => `#${c.itemNumber} "${c.rawText}"`).join(', ')}`);
  console.log('✓ All characteristics placed within sheet bounds (rotated-page coordinate handling correct)');

  // 4. Title-block revision-table metadata (dates, paper size, sheet count) must not leak
  // through as fake characteristics, regardless of where on the sheet the title block sits.
  const leakedMetadata = characteristics.filter(c => /\d{1,2}\/\d{1,2}\/\d{4}/.test(c.rawText) || /^A[0-4]$/.test(c.rawText.trim()));
  assert(leakedMetadata.length === 0, `Title-block metadata leaked through as characteristics: ${leakedMetadata.map(c => `#${c.itemNumber} "${c.rawText}"`).join(', ')}`);
  console.log('✓ No title-block revision-table metadata (dates, paper size) leaked through as characteristics');

  // 5. (Production hardening, 2026-10-05) Zone/detail-view robustness: this drawing has a MAIN
  // view (rows roughly B-H on the real printed ruler) and two embedded DETAIL views, "DETAIL A"
  // and "5x DETAIL C" (rows roughly I-K, independently pixel-verified against the rendered
  // sheet) — zone calculation must use each characteristic's own actual page position, never a
  // single "main view" assumption applied uniformly. The two "2c" chamfers live one in each
  // detail view; their zones must differ from each other AND from the main-view dimensions, and
  // must land in the detail-view row band, not be dragged into the main view's.
  const mainViewDim = characteristics.find(c => c.rawText.trim() === '169.75'); // main view only
  const detailAChamfer = characteristics.find(c => c.type === 'chamfer' && c.drawingZone?.startsWith('Zone I-'));
  const detailCChamfer = characteristics.find(c => c.type === 'chamfer' && c.drawingZone?.startsWith('Zone K-'));
  assert(!!mainViewDim && /^Zone [B-H]-/.test(mainViewDim.drawingZone), `Expected the main-view "169.75" dimension's zone to be in row B-H, got "${mainViewDim?.drawingZone}"`);
  assert(!!detailAChamfer, `Expected to find a chamfer characteristic zoned in Detail A's actual row band (I), got none (chamfer zones: ${characteristics.filter(c => c.type === 'chamfer').map(c => c.drawingZone).join(', ')})`);
  assert(!!detailCChamfer, `Expected to find a chamfer characteristic zoned in Detail C's actual row band (K), got none (chamfer zones: ${characteristics.filter(c => c.type === 'chamfer').map(c => c.drawingZone).join(', ')})`);
  assert(detailAChamfer!.drawingZone !== detailCChamfer!.drawingZone, 'Detail A and Detail C chamfers must NOT share a zone — each uses its own actual sheet position, not a single "detail view" bucket');
  console.log(`✓ Zone calculation correctly distinguishes main view (${mainViewDim?.drawingZone}) from Detail A (${detailAChamfer?.drawingZone}) and Detail C (${detailCChamfer?.drawingZone}) by each characteristic's real page position`);

  // 6. (Production hardening, 2026-10-05) Traceability invariant: EVERY extracted
  // characteristic — with no exceptions — must carry a source page, a source bounding box
  // (geometry on that page), a non-empty raw-text association, and a drawing zone. An XLS row
  // that can't be traced back to an actual location on the drawing is exactly the defect class
  // the already-ballooned-PDF contamination was: a "characteristic" with no genuine anchor in
  // the source.
  const untraceable = characteristics.filter(c =>
    typeof c.sheetNumber !== 'number' || c.sheetNumber < 1 ||
    !c.boundingBox || typeof c.boundingBox.x !== 'number' || typeof c.boundingBox.y !== 'number' ||
    !c.rawText || c.rawText.trim().length === 0 ||
    !c.drawingZone || c.drawingZone.trim().length === 0
  );
  assert(untraceable.length === 0, `${untraceable.length} characteristic(s) lack full source traceability (page/geometry/text/zone): ${untraceable.map(c => `#${c.itemNumber}`).join(', ')}`);
  console.log(`✓ All ${characteristics.length} characteristics carry full source traceability (page, geometry, raw text, zone) — none fabricated`);

  console.log('>>> ROTATED CUSTOMER DRAWING EXTRACTION TEST PASSED! <<<');
}

run();
