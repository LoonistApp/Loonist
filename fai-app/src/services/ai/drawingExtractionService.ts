import type * as pdfjsLib from 'pdfjs-dist';
import { Util, OPS } from 'pdfjs-dist';
import type { 
  EngineeringCharacteristic, 
  InspectionMethod,
  ProjectProperties,
  TitleBlockTolerancePreset
} from '../../types/characteristics';
import type { ProjectSettings } from '../../types/settings';
import { DEFAULT_AEROSPACE_TOLERANCES } from '../../types/characteristics';
import { GdtParser } from './gdtParser';
import { GridZoneCalculator } from './gridZoneCalculator';
import { SpatialClusteringEngine } from './spatialClusteringEngine';
import { ToleranceEngine, DEFAULT_METRIC_ISO_TOLERANCES } from './toleranceEngine';
import { SpatialPlacementService } from '../ballooning/spatialPlacementService';
import { RenumberingService } from '../ballooning/renumberingService';
import { ImagePreprocessingService } from './imagePreprocessingService';
import { OcrEngineService } from './ocrEngineService';

export type ExtractionJobState = 
  | 'IDLE'
  | 'PREPARING'
  | 'OCR_RUNNING'
  | 'PARSING'
  | 'COMPLETE'
  | 'FAILED';

export interface ExtractionProgress {
  state: ExtractionJobState;
  progressPercent: number;
  message: string;
  totalFound: number;
}

/**
 * Thrown when the source PDF is detected to already carry Loonist-generated balloon
 * annotations (see DrawingExtractionService.detectExistingBalloonBadges, the primary detector,
 * and detectExistingBalloonNumbering, its fallback). Extraction is refused outright rather than
 * silently proceeding, because every balloon's own item-number label reads as a plausible
 * bare-integer "dimension" to the text-based extractor — re-running extraction on an
 * already-ballooned export corrupts the result with one phantom characteristic per balloon. The
 * caller should surface `message` directly to the user.
 */
export class AlreadyBalloonedPdfError extends Error {
  public readonly sequenceStart: number;
  public readonly sequenceEnd: number;
  public readonly detectionMethod: 'badge' | 'sequence';

  constructor(sequenceStart: number, sequenceEnd: number, detectionMethod: 'badge' | 'sequence' = 'sequence') {
    const evidence = detectionMethod === 'badge'
      ? `${sequenceStart} small white-filled, stroked circular badges were found, each centered directly ` +
        `on its own short number — the literal vector shape this engine's own MarkedPdfExporter draws for ` +
        `every balloon, not something real drawing geometry produces`
      : `a dense numbered sequence from ${sequenceStart} to ${sequenceEnd} was found rendered in a single ` +
        `consistent font object — the signature of this engine's own balloon numbering, not real drawing content`;
    super(
      `This PDF appears to already contain Loonist-generated balloon numbers (${evidence}). ` +
      `Extracting from an already-ballooned drawing would misread every balloon's number as a phantom ` +
      `dimension. Please run extraction on the original, unballooned drawing file instead.`
    );
    this.name = 'AlreadyBalloonedPdfError';
    this.sequenceStart = sequenceStart;
    this.sequenceEnd = sequenceEnd;
    this.detectionMethod = detectionMethod;
  }
}

export class DrawingExtractionService {
  /**
   * Primary extraction pipeline: extracts all dimensions, GD&T, notes and specs
   * from the active PDF document across all sheets with strict exclusion of
   * margins (grid labels A-D, 1-8) and title blocks.
   */
  public static async extractCharacteristics(
    pdfDoc: pdfjsLib.PDFDocumentProxy,
    onProgress?: (progress: ExtractionProgress) => void,
    settings?: ProjectSettings,
    targetSheetNumber?: number,
    existingCharacteristics?: EngineeringCharacteristic[],
    // Only the bundled sample-blueprint loader should pass true. A real customer drawing that
    // the engine fails to parse (0 characteristics, no recognized title block) must never be
    // silently repopulated with the canned demo part's fake dimensions — that's presenting
    // fabricated data as a real extraction result on what could be a live inspection record.
    allowDemoFallback: boolean = false
  ): Promise<{
    characteristics: EngineeringCharacteristic[];
    projectProps: ProjectProperties;
    titleBlockWarning?: string;
    // Supplementary title-block fields that aren't part of the persisted ProjectProperties
    // model (material, special-process treatment, scale, mass, sheet count, paper format) —
    // recognized by the same structural label/value matching as the 4 core identity fields,
    // surfaced separately so they don't ripple into the forms/exports wired to ProjectProperties.
    titleBlockFields?: Partial<Record<'material' | 'treatment' | 'scale' | 'mass' | 'sheet' | 'format', string>>;
  }> {
    const characteristics: EngineeringCharacteristic[] = [];
    const sheetsMeta: Array<{ pageNumber: number; width: number; height: number }> = [];
    const step = Math.max(1, settings?.incrementStep ?? 1);
    const subDelim = settings?.subDelimiter ?? '.';
    const extractedProps: Partial<ProjectProperties> = {};
    const extractedTitleBlockFields: Partial<Record<'material' | 'treatment' | 'scale' | 'mass' | 'sheet' | 'format', string>> = {};
    const drawingTextObstaclesBySheet = new Map<number, Array<{ x: number; y: number; width: number; height: number }>>();

    // If extracting a specific target sheet, retain characteristics belonging to all other sheets
    const retainedCharacteristics = targetSheetNumber
      ? (existingCharacteristics || []).filter(c => c.sheetNumber !== targetSheetNumber)
      : [];

    let currentItemNumber = Math.max(1, settings?.startingNumber ?? 1);
    if (targetSheetNumber && retainedCharacteristics.length > 0) {
      const precedingChars = retainedCharacteristics.filter(c => c.sheetNumber < targetSheetNumber);
      if (precedingChars.length > 0) {
        const maxPreceding = precedingChars.reduce((max, c) => Math.max(max, c.itemNumber || 0), 0);
        currentItemNumber = maxPreceding + step;
      }
    }

    try {
      if (onProgress) {
        onProgress({
          state: 'PREPARING',
          progressPercent: 15,
          message: targetSheetNumber 
            ? `Initializing extraction for Sheet ${targetSheetNumber}...`
            : 'Initializing local vision models & vector geometry...',
          totalFound: 0
        });
      }

      await new Promise(resolve => setTimeout(resolve, 200));

      const numPages = pdfDoc.numPages;
      const startPage = targetSheetNumber ? Math.max(1, Math.min(numPages, targetSheetNumber)) : 1;
      const endPage = targetSheetNumber ? Math.max(1, Math.min(numPages, targetSheetNumber)) : numPages;

      for (let pageNum = startPage; pageNum <= endPage; pageNum++) {
        if (onProgress) {
          const stepPercent = Math.round(20 + ((pageNum - startPage + 1) / (endPage - startPage + 1)) * 50);
          onProgress({
            state: 'OCR_RUNNING',
            progressPercent: stepPercent,
            message: `Extracting vector callouts from Sheet ${pageNum} of ${numPages}...`,
            totalFound: characteristics.length
          });
        }

        const page = await pdfDoc.getPage(pageNum);
        const viewport = page.getViewport({ scale: 1.0 });
        sheetsMeta.push({ pageNumber: pageNum, width: viewport.width, height: viewport.height });
        const textContent = await page.getTextContent();

        // 1. Scan text elements in the vector drawing
        const rawStrings: Array<{ text: string; x: number; y: number; width: number; height: number; source: 'vector' | 'ocr'; fontId?: string }> = [];
        for (const item of textContent.items) {
          if ('str' in item && item.str.trim().length > 0) {
            const box = this.textItemToViewportBox(item as any, viewport);
            rawStrings.push({
              text: item.str.trim(),
              x: box.x,
              y: Math.max(0, box.y),
              width: box.width,
              height: box.height,
              source: 'vector',
              // pdf.js's own internal font key (e.g. "g_d0_f7") — not a human-readable font
              // name, but every glyph drawn with the SAME embedded font object shares it
              // exactly, which is what detectExistingBalloonNumbering below relies on.
              fontId: 'fontName' in item ? (item as any).fontName : undefined
            });
          }
        }

        // Cover / Introductory Sheet Check:
        // Exclude overview sheets, practice book covers, or pure prose text sheets from ballooning
        const isCoverSheet = DrawingExtractionService.isCoverOrIntroductorySheet(rawStrings, viewport.width, viewport.height);
        if (isCoverSheet) {
          console.info(`[DrawingExtractionService] Sheet ${pageNum} identified as cover/introductory page — skipping characteristic extraction.`);
          page.cleanup();
          continue;
        }

        let isScannedSheet = false;
        // 1b. Scanned Drawing Fallback: If no vector text exists, run image pre-processing & OCR
        if (rawStrings.length < 5 && typeof document !== 'undefined') {
          try {
            isScannedSheet = true;
            if (onProgress) {
              onProgress({
                state: 'OCR_RUNNING',
                progressPercent: Math.round(20 + (pageNum / numPages) * 50),
                message: `Sheet ${pageNum} is a scanned drawing — running image pre-processing & OCR...`,
                totalFound: characteristics.length
              });
            }

            const ocrScale = 2.0;
            const pageViewport = page.getViewport({ scale: ocrScale });
            const renderCanvas = document.createElement('canvas');
            renderCanvas.width = pageViewport.width;
            renderCanvas.height = pageViewport.height;
            const ctx = renderCanvas.getContext('2d');
            if (ctx) {
              await page.render({ canvasContext: ctx, viewport: pageViewport, canvas: renderCanvas } as any).promise;
              const preprocessed = ImagePreprocessingService.preprocessCanvas(renderCanvas);
              const ocrBoxes = await OcrEngineService.recognizeSheet(preprocessed);
              for (const b of ocrBoxes) {
                rawStrings.push({
                  text: b.text,
                  x: Math.round(b.x / ocrScale),
                  y: Math.round(b.y / ocrScale),
                  width: Math.round(b.width / ocrScale),
                  height: Math.round(b.height / ocrScale),
                  source: 'ocr'
                });
              }
            }
          } catch (ocrErr) {
            console.warn(`Scanned sheet OCR failed for sheet ${pageNum}:`, ocrErr);
          }
        }

        // 2. Normalize CAD symbol fonts and merge inline companion symbols horizontally
        const normalizedStrings = this.mergeHorizontalLineItems(rawStrings);

        // 3. Parse Title Block metadata: Sheet 1 establishes the master part metadata
        // Subsequent sheets must NOT overwrite master part name or drawing number
        // Boxes consumed by a matched title-block label/value pair — excluded from dimension
        // candidates below regardless of position, since the broadened search zones here (not
        // just the bottom-right corner) can otherwise let a matched value leak through as a
        // fake dimension if it happens to contain digits (e.g. a part number or CAGE code).
        const consumedTitleBlockBoxes: Array<{ x: number; y: number; width: number; height: number }> = [];
        if (pageNum === 1 || !extractedProps.partName) {
          const zones = this.getTitleBlockSearchZones(viewport.width, viewport.height);
          const boxItems = rawStrings.filter(s =>
            zones.some(z => s.x >= z.xMin && s.x <= z.xMax && s.y >= z.yMin && s.y <= z.yMax)
          );

          // 3a. Revision history is a table, not a single field: reading the row nearest a
          // "Revision" label would get the wrong answer if entries aren't appended where
          // expected. Resolving the current revision from whichever row carries the latest
          // date is a structural fact, not a per-template guess, so it's tried first and wins
          // over the simpler single-field match below when both are present.
          if (!extractedProps.partRevision) {
            const historyResult = this.findCurrentRevisionFromHistoryTable(boxItems);
            if (historyResult) {
              extractedProps.partRevision = historyResult.revision;
              extractedProps.drawingRevision = historyResult.revision;
              consumedTitleBlockBoxes.push(...historyResult.consumed);
            }
          }

          for (const s of boxItems) {
            for (const { field, regex } of this.TITLE_BLOCK_FIELD_PATTERNS) {
              if (this.titleBlockFieldAlreadySet(extractedProps, extractedTitleBlockFields, field)) continue;

              // Match against a diacritic-stripped copy so "Référence"/"Désignation" match the
              // plain "REFERENCE"/"DESIGNATION" synonyms, but slice the VALUE out of the
              // original text (stripping diacritics never changes string length for the
              // accented Latin letters these labels use) so an accented real value isn't mangled.
              const strippedText = this.stripDiacritics(s.text);
              const exactMatch = strippedText.match(regex);
              let value: string | undefined;
              if (exactMatch) {
                const labelLen = exactMatch[0].length - (exactMatch[1] || '').length;
                value = s.text.slice(labelLen).trim();
              } else if (s.source === 'ocr') {
                const fuzzy = this.fuzzyMatchTitleBlockLabel(s.text, field);
                if (fuzzy) value = fuzzy.value.trim();
              }
              if (value === undefined) continue;

              // A bilingual label glued into one run ("Référence / Part number") leaves its
              // OTHER half as the captured "value" once the first half is stripped as the
              // label — recognized generically as residue (the leftover segment is itself a
              // known label word in some language), not guessed per drawing. Treat it as no
              // inline value and fall through to the neighbor-cell search below, same as a
              // label run that captured nothing at all.
              if (value && this.isBilingualLabelResidue(value)) {
                value = '';
              }

              // A bilingual table-header CAPTION ("Description de la modification /
              // Description of the modification") starts with a real label word too, but what
              // follows is a sentence, not a value or label residue — accepting it would
              // silently fabricate a field from column-header text. Reject it outright rather
              // than falling through to the neighbor search, which would be equally wrong here.
              if (value && !this.isPlausibleTitleBlockValue(value)) continue;

              const consumed: Array<{ text: string; x: number; y: number; width: number; height: number }> = [
                { text: s.text, x: s.x, y: s.y, width: s.width, height: s.height }
              ];

              // Label run captured nothing inline — the value is split into a separate
              // adjacent cell (or several fragments of one value), possibly stacked below a
              // bilingual label row rather than beside it; look for it next to the label.
              if (!value) {
                const neighbor = this.findNeighborValueText(s, boxItems, this.TITLE_BLOCK_FIELD_PATTERNS);
                const candidate = neighbor?.text.trim();
                if (candidate && !this.isBilingualLabelResidue(candidate) && this.isPlausibleTitleBlockValue(candidate)) {
                  value = candidate;
                  consumed.push(...neighbor!.consumed);
                }
              }
              if (!value) continue;

              switch (field) {
                case 'partNumber':
                  extractedProps.partNumber = value;
                  extractedProps.drawingNumber = value;
                  break;
                case 'partRevision':
                  extractedProps.partRevision = value;
                  extractedProps.drawingRevision = value;
                  break;
                case 'cageCode': {
                  const codeMatch = value.match(/[A-Z0-9]+/i);
                  if (codeMatch) extractedProps.cageCode = codeMatch[0].toUpperCase();
                  break;
                }
                case 'partName':
                  extractedProps.partName = value;
                  extractedProps.drawingName = value;
                  break;
                case 'organizationName':
                  extractedProps.organizationName = value;
                  break;
                default:
                  extractedTitleBlockFields[field] = value;
                  break;
              }
              consumedTitleBlockBoxes.push(...consumed);
              break;
            }
          }

          // Fallback: no explicit "Company:"/"Manufacturer:" label exists on many European
          // title blocks (ISO 7200 has no mandatory numbered field for it either) — the
          // organization name is identified structurally instead (see detectOrganizationName:
          // an address-block-anchored signal when PHONE/FAX is present, and a general title-
          // block font-size-outlier signal when it isn't) rather than left blank just because it
          // has no text label. Never guesses when neither signal reaches a confident, singular
          // answer.
          if (!extractedProps.organizationName) {
            const orgName = DrawingExtractionService.detectOrganizationName(rawStrings, consumedTitleBlockBoxes, boxItems);
            if (orgName) extractedProps.organizationName = orgName;
          }
        }

        // 4. Identify drawing border grid coordinates using sequence & alignment analysis (ASME Y14.1 / ISO 5457)
        const borderGrid = DrawingExtractionService.findBorderGridLabels(normalizedStrings, viewport.width, viewport.height);
        const borderGridKeySet = borderGrid.excludedKeys;
        const pageZoneRuler = { columns: borderGrid.columns, rows: borderGrid.rows };

        // 4z. Refuse to extract from a PDF that already carries this engine's own balloon
        // markup — see AlreadyBalloonedPdfError. Checked AFTER border-grid labels are known so
        // the zone ruler's own legitimate "1, 2, 3...16" column sequence (and "A, B, C...L" rows)
        // is excluded from the candidate pool, never mistaken for balloon numbering itself.
        //
        // PRIMARY signal: the actual drawn vector shape of a Loonist balloon badge (see
        // detectExistingBalloonBadges) — a small white-filled, stroked circle immediately paired
        // with its own centered number, which is the literal structure MarkedPdfExporter draws
        // and essentially never occurs by coincidence in real drawing geometry.
        const badgeDetection = await DrawingExtractionService.detectExistingBalloonBadges(page, normalizedStrings, borderGridKeySet);
        if (badgeDetection) {
          throw new AlreadyBalloonedPdfError(badgeDetection.count, badgeDetection.count, 'badge');
        }

        // FALLBACK signal: if operator-list inspection found no badges (e.g. a future pdf.js
        // version changes how it reports paths, or the PDF was flattened/re-saved by another
        // tool in a way that lost the vector badge shapes but kept the text), still catch the
        // numbering-scheme signature as a safety net rather than silently extracting.
        const existingBalloons = DrawingExtractionService.detectExistingBalloonNumbering(normalizedStrings, borderGridKeySet);
        if (existingBalloons) {
          throw new AlreadyBalloonedPdfError(existingBalloons.sequenceStart, existingBalloons.sequenceEnd, 'sequence');
        }

        // Filter candidates: Exclude only outer borders, true title block metadata, and view headers
        const candidateStrings = normalizedStrings.filter(s => {
          const t = s.text;

          // 4a. Extreme sheet boundary bleed (print edge < 5 pt)
          if (s.x < 5 || s.x > viewport.width - 5 || s.y < 5 || s.y > viewport.height - 5) return false;

          // 4b. Exclude drawing border grid labels identified by multi-label sequence alignment
          if (borderGridKeySet.has(`${Math.round(s.x)}_${Math.round(s.y)}_${s.text}`)) return false;

          // 4b-bis. Exclude anything already consumed as a title-block label/value pair above.
          // Matched by bounding-box overlap rather than exact key equality because this item may
          // have been fused with a neighbor by mergeHorizontalLineItems since then, changing its
          // text/coordinates — the overlap still holds against whichever raw fragment(s) fed it.
          if (consumedTitleBlockBoxes.some(b =>
            !(s.x + s.width < b.x || s.x > b.x + b.width || s.y + s.height < b.y || s.y > b.y + b.height)
          )) return false;

          // 4c. Exclude standalone section cutting plane letters
          if (t === 'A' || t === 'B' || t === 'C' || t === 'D') return false;

          // 4d. Exclude general header notes and view titles
          if (t === 'GENERAL ENGINEERING NOTES:') return false;
          if (/^(?:DETAIL|SECTION|VIEW)\s+[A-Z]/i.test(t)) return false;
          if (/^STEP\s*\d+/i.test(t) || /\b(?:ACTUALLY|WOULD|IF\s+YOU)\b/i.test(t)) return false;
          if (/SCALE\s*[:\s]\s*\d+\s*:\s*\d+/i.test(t)) return false;
          if (/\[SCALE\s+\d+:\d+\]/i.test(t)) return false;
          // Bare "N:N" tokens (e.g. "1:1", "2:1", "1:5") are always a detail/section view scale
          // ratio per ASME Y14.3 — this notation is never used for a dimension, so this is safe
          // regardless of which specific ratio appears.
          if (/^\d{1,3}\s*:\s*\d{1,3}$/.test(t)) return false;
          // Title-block revision-table / metadata content, matched by SHAPE rather than position
          // or language: the fixed corner title-block exclusion box below only covers ASME-style
          // bottom-right title blocks, not e.g. a European full-height side-strip title block —
          // so content that is structurally never a dimension (a date, an ISO paper size code, a
          // bare "sheet N / N" count) is excluded regardless of where on the sheet it landed.
          if (/\d{1,2}\/\d{1,2}\/\d{4}/.test(t)) return false; // DD/MM/YYYY or MM/DD/YYYY revision date
          if (/^A[0-4]$/.test(t)) return false; // ISO 5457 paper size code (A0-A4)
          if (/^\d{1,3}\s*\/\s*\d{1,3}$/.test(t)) return false; // bilingual "Feuille/Sheet N / N" count
          if (/^(?:TOP|FRONT|SIDE|ISOMETRIC|AUXILIARY)\s+VIEW/i.test(t)) return false;
          if (/TOP VIEW\s*\(shown scaled down\)/i.test(t)) return false;
          if (t.includes('INTERNAL BORE & THREADS')) return false;
          if (/\.(?:pdf|dwg|dxf|sldprt|step|stp|ipt|iam|idw|prt|asm|catpart|catproduct)$/i.test(t) || t.includes('_fsi') || t.includes('_rd')) return false;

          // 4e. Exclude Title Block metadata fields & tolerance block headers
          if (/^(?:PART\s*(?:NO\.?|NUMBER|NAME)|P\/N|REV(?:ISION)?|CAGE(?:\s*CODE|\s*CD)?|DWG\s*(?:NO\.?|NUMBER)|DRAWING\s*(?:NO\.?|NUMBER)|TITLE|DESCRIPTION)\b/i.test(t)) return false;
          if (t.includes('TOLERANCES UNLESS NOTED') || t.includes('UNLESS OTHERWISE SPECIFIED')) return false;
          if (/SHEET\s+\d+\s+OF\s+\d+/i.test(t) || /^\d+\s+OF\s+\d+$/i.test(t)) return false;
          if (/\b(?:SHEET\s+\d+|\bOF\s+\d+)\b/i.test(t)) return false;
          if (/\b(?:FILE NAME|DESCRIPTION)\b/i.test(t)) return false;
          if (t === 'ALL DIMENSIONS' || t === 'ARE IN MILLIMETERS') return false;

          // 4f. Adaptive Title block bounding box:
          // In standard drafting (ASME Y14.1 / ISO 5457), the title block is strictly non-dimensional metadata (Part Name, Number, Sheet, File Name)
          const tbBoxSize = this.getTitleBlockBoxSize(viewport.width);
          const inTitleBlockBox = (s.x > viewport.width - tbBoxSize.width && s.y > viewport.height - tbBoxSize.height);
          if (inTitleBlockBox) return false;

          // 4g. Exclude administrative boilerplate (ASME Y14.5 drafting standards, ITAR, AS9102 statements)
          if (GdtParser.isAdministrativeBoilerplate(t)) return false;

          // 4h. Exclude conversational prose, tutorial instructions, and book disclaimers
          if (GdtParser.isProseOrInstructionalText(t)) return false;

          return (
            /\d/.test(t) || 
            t.includes('Ø') || 
            t.includes('±') || 
            t.includes('⌖') || 
            t.includes('|') || 
            /\[\s*Ø?\s*\d/.test(t) || 
            /\(\s*Ø?\s*\d/.test(t) ||
            /\b(?:TYP|PLCS)\b/i.test(t)
          );
        });

        // 2b. Automatically detect drawing units and dynamic title block tolerances
        const allPageText = rawStrings.map(s => s.text).join(' ');
        const explicitUnits = ToleranceEngine.detectDrawingUnits(allPageText);
        const detectedUnit: 'in' | 'mm' = explicitUnits || extractedProps.units || settings?.units || 'in';
        if (explicitUnits) {
          extractedProps.units = explicitUnits;
        }

        const basePreset: TitleBlockTolerancePreset =
          ToleranceEngine.parseCustomTitleBlockTolerances(allPageText, detectedUnit) ||
          (explicitUnits === 'mm'
            ? DEFAULT_METRIC_ISO_TOLERANCES
            : (settings?.tolerances || (detectedUnit === 'mm' ? DEFAULT_METRIC_ISO_TOLERANCES : DEFAULT_AEROSPACE_TOLERANCES)));

        // Spread into a fresh object — basePreset may be a shared default/settings constant, and
        // must never be mutated in place.
        const declaredIso2768Class = ToleranceEngine.detectIso2768Class(allPageText) || undefined;
        const dynamicPreset: TitleBlockTolerancePreset = declaredIso2768Class
          ? { ...basePreset, declaredIso2768Class }
          : basePreset;

        // 3b. Split any fused adjacent standalone numbers (e.g. "65 35" in a dimension chain)
        const refinedCandidates: Array<{ text: string; x: number; y: number; width: number; height: number }> = [];
        for (const cand of candidateStrings) {
          const fusedMatch = cand.text.match(/^(\d+(?:\.\d+)?)\s{1,}(\d+(?:\.\d+)?)$/);
          if (fusedMatch) {
            const firstNum = fusedMatch[1];
            const secondNum = fusedMatch[2];
            const halfW = Math.max(10, Math.round(cand.width / 2));
            refinedCandidates.push({
              text: firstNum,
              x: cand.x,
              y: cand.y,
              width: halfW,
              height: cand.height
            });
            refinedCandidates.push({
              text: secondNum,
              x: cand.x + halfW,
              y: cand.y,
              width: halfW,
              height: cand.height
            });
          } else {
            refinedCandidates.push(cand);
          }
        }

        // Collect drawing text obstacles (view titles like SIDE, FRONT, TOP, notes, sheet info)
        const candSet = new Set(candidateStrings);
        const textObstacles = normalizedStrings
          .filter(s => !candSet.has(s) && s.width > 8 && s.height > 6)
          .map(s => ({ x: s.x, y: s.y, width: s.width, height: s.height }));
        drawingTextObstaclesBySheet.set(pageNum, textObstacles);

        // 4. Cluster companion lines (e.g. diameter + depth + GD&T frame) into unified callouts
        const clusteredCallouts = SpatialClusteringEngine.clusterTextElements(refinedCandidates);

        const pageNoteChars: EngineeringCharacteristic[] = [];

        for (const cluster of clusteredCallouts) {
          const t = cluster.combinedText;

          // Exclude administrative boilerplate immediately
          if (GdtParser.isAdministrativeBoilerplate(t)) {
            continue;
          }

          // Exclude conversational prose, tutorial instructions, and non-callout text immediately
          if (GdtParser.isProseOrInstructionalText(t)) {
            continue;
          }

          // Check if it's a general engineering note
          const noteMatch = t.match(/^(\d+)\.\s+(.*)/);
          // A standalone caption citing a recognized process/finish standard (e.g. "Outside
          // edge according to ISO13715 :") is just as real an inspectable requirement as a
          // numbered note — it simply isn't formatted as a numbered list item. Recognized
          // generically by the presence of a real standard citation (ISO/ASTM/MIL/AMS/DIN/BS/EN
          // followed by a 2-6 digit spec number) rather than by this drawing's specific wording,
          // so it also covers e.g. "Surface finish per ASTM B456" on an unrelated drawing.
          const standardCitationMatch = !noteMatch
            ? t.match(/\b((?:ISO|ASTM|MIL(?:-[A-Z])?|AMS|DIN|BS|EN)[\s-]?\d{2,6}(?:-\d+)?)\b/i)
            : null;
          if (noteMatch || standardCitationMatch) {
            if (settings?.autoBalloonNotes === false) {
              continue;
            }
            const noteNum = noteMatch ? noteMatch[1] : null;
            const noteContent = noteMatch ? noteMatch[2].trim() : t;

            // Under SAE AS9102 Section 3.8, verify it contains an authentic physical/material inspection requirement
            const hasInspectableRequirement =
              /\b(?:MATERIAL|FINISH|BURR|EDGE|HEAT\s+TREAT|ANODIZE|COAT|PLATE|PLATING|HARDNESS|TORQUE|SURFACE|Ra|MAX|MIN|SPEC|AMS|ASTM|MIL)\b/i.test(noteContent) ||
              /\d+(?:\.\d+)?\s*(?:MAX|MIN|Ra|RC|HB)/i.test(noteContent) ||
              !!standardCitationMatch;

            if (!hasInspectableRequirement) {
              continue;
            }

            const noteId = noteNum ?? standardCitationMatch![1].replace(/\s+/g, '');
            const noteZoneLabel = noteNum ? `NOTE ${noteNum}` : `NOTE (${standardCitationMatch![1].replace(/\s+/g, '')})`;
            const toleranceSourceLabel = noteNum ? `General Note #${noteNum}` : `Drawing Note (${standardCitationMatch![1].replace(/\s+/g, '')})`;

            // Industry Standard Clean Canvas Rule:
            // Legitimate drawing notes (e.g. Material AMS 4928, Surface Finish 32 Ra, Deburr 0.015 MAX)
            // are accounted for in AS9102 Form 3 Table with Reference Location set to "NOTE X",
            // but their visual balloon rendering on the CAD sheet is suppressed (skipBalloonRender: true)
            // to avoid visual number collision with drawing notes and keep the blueprint canvas clean.
            pageNoteChars.push({
              id: `char-sheet-${pageNum}-note-${noteId}`,
              itemNumber: 0, // Assigned sequentially after drawing dimensions
              sheetNumber: pageNum,
              drawingZone: noteZoneLabel,
              type: 'note',
              displayType: 'Note',
              subType: 'General Note',
              classification: 'Major',
              enclosure: 'standard',
              rawText: t,
              cleanNominal: null,
              upperTol: 0,
              lowerTol: 0,
              minLimit: null,
              maxLimit: null,
              plusTol: null,
              minusTol: null,
              upperLimit: null,
              lowerLimit: null,
              units: detectedUnit,
              isToleranceInherited: false,
              toleranceSource: toleranceSourceLabel,
              quantity: 1,
              inspectionMethod: /SURFACE|Ra/i.test(t) ? 'Optical Comparator' : /BURR|EDGE/i.test(t) ? 'Optical Comparator' : 'Visual / Visual Inspection',
              confidenceScore: isScannedSheet ? 0.88 : 0.98,
              verificationStatus: isScannedSheet ? 'needs_review' : 'auto_accepted',
              extractionSource: isScannedSheet ? 'ocr' : 'vector',
              extractionConfidence: isScannedSheet ? 0.88 : 0.98,
              isBasic: false,
              forReference: false,
              sourceCaptureOrSheet: `Sheet ${pageNum}`,
              boundingBox: cluster.boundingBox,
              skipBalloonRender: true
            });
            continue;
          }

          // Parse with industrial ASME Y14.5 GdtParser
          const parsed = GdtParser.parseCallout(cluster.combinedText, dynamicPreset);

          // GD&T Feature Control Frame
          if (parsed.type === 'gdt' && parsed.gdtFrame) {
            const zone = settings?.autoDetectZones === false
              ? ''
              : GridZoneCalculator.calculateZone(
                cluster.boundingBox.x + cluster.boundingBox.width / 2,
                cluster.boundingBox.y + cluster.boundingBox.height / 2,
                viewport.width,
                viewport.height,
                pageZoneRuler
              );

            // Determine specific GD&T subType label — GdtParser.getCharacteristicLabel is the
            // single source of truth for this (also used to build the exported Form 3 tolerance
            // source text), so the displayed subType and the exported text can never drift apart.
            const gdtType = parsed.gdtFrame.characteristic;
            const subTypeLabel = GdtParser.getCharacteristicLabel(gdtType);

            // Master Quality Inspector Tooling Selection
            let method: InspectionMethod = 'CMM';
            if (gdtType === 'flatness' || gdtType === 'straightness') {
              method = 'Surface Plate';
            } else if (gdtType === 'circular_runout') {
              method = 'Optical Comparator';
            }

            // A frame whose leading symbol glyph wasn't recognized (see the 'unknown' doc
            // comment on GdtFeatureControlFrame.characteristic) must never auto-accept — the
            // tolerance value and datums are correctly captured, but WHICH GD&T characteristic
            // this is (flatness vs. position vs. profile, each inspected completely
            // differently) was never actually determined, so a human has to confirm it.
            const gdtConfidence = gdtType === 'unknown' ? 0.4 : (isScannedSheet ? 0.88 : 0.98);
            const gdtVerification = gdtType === 'unknown' ? 'needs_review' : (isScannedSheet ? 'needs_review' : 'auto_accepted');

            const gdtMultiplier = parsed.multiplier || 1;
            const gdtShouldSplit = gdtMultiplier > 1 &&
              (settings?.multiplierBehavior ?? 'single_balloon') === 'split_sub_balloons';
            const gdtParentId = `char-sheet-${pageNum}-${currentItemNumber}`;

            if (gdtShouldSplit) {
              for (let m = 1; m <= gdtMultiplier; m++) {
                characteristics.push({
                  id: `${gdtParentId}-${m}`,
                  itemNumber: currentItemNumber,
                  subNumber: `${currentItemNumber}${subDelim}${m}`,
                  sheetNumber: pageNum,
                  drawingZone: zone,
                  type: 'gdt',
                  displayType: 'GEOMETRIC TOLERANCE',
                  subType: subTypeLabel,
                  classification: 'Critical',
                  enclosure: parsed.enclosure,
                  rawText: cluster.combinedText,
                  cleanNominal: parsed.nominal,
                  upperTol: parsed.upperTol,
                  lowerTol: parsed.lowerTol,
                  minLimit: parsed.minLimit,
                  maxLimit: parsed.maxLimit,
                  plusTol: parsed.upperTol,
                  minusTol: 0,
                  upperLimit: parsed.maxLimit,
                  lowerLimit: parsed.minLimit,
                  units: parsed.units,
                  isToleranceInherited: false,
                  toleranceSource: parsed.toleranceSource,
                  gdtFrame: parsed.gdtFrame,
                  holeCallout: parsed.holeCallout,
                  quantity: 1,
                  isExpandedMultiplier: true,
                  parentCharacteristicId: gdtParentId,
                  inspectionMethod: method,
                  confidenceScore: gdtConfidence,
                  verificationStatus: gdtVerification,
                  extractionSource: isScannedSheet ? 'ocr' : 'vector',
                  extractionConfidence: gdtConfidence,
                  isBasic: false,
                  forReference: false,
                  sourceCaptureOrSheet: `Sheet ${pageNum}`,
                  boundingBox: cluster.boundingBox,
                  skipBalloonRender: m > 1
                });
              }
            } else {
              characteristics.push({
                id: gdtParentId,
                itemNumber: currentItemNumber,
                sheetNumber: pageNum,
                drawingZone: zone,
                type: 'gdt',
                displayType: 'GEOMETRIC TOLERANCE',
                subType: subTypeLabel,
                classification: 'Critical',
                enclosure: parsed.enclosure,
                rawText: cluster.combinedText,
                cleanNominal: parsed.nominal,
                upperTol: parsed.upperTol,
                lowerTol: parsed.lowerTol,
                minLimit: parsed.minLimit,
                maxLimit: parsed.maxLimit,
                plusTol: parsed.upperTol,
                minusTol: 0,
                upperLimit: parsed.maxLimit,
                lowerLimit: parsed.minLimit,
                units: parsed.units,
                isToleranceInherited: false,
                toleranceSource: parsed.toleranceSource,
                gdtFrame: parsed.gdtFrame,
                holeCallout: parsed.holeCallout,
                quantity: gdtMultiplier,
                inspectionMethod: method,
                confidenceScore: gdtConfidence,
                verificationStatus: gdtVerification,
                extractionSource: isScannedSheet ? 'ocr' : 'vector',
                extractionConfidence: gdtConfidence,
                isBasic: false,
                forReference: false,
                sourceCaptureOrSheet: `Sheet ${pageNum}`,
                boundingBox: cluster.boundingBox
              });
            }
            currentItemNumber += step;
            continue;
          }

          // Settings: Skip rules for Reference and Basic dimensions
          if (settings?.skipReferenceDimensions && parsed.enclosure === 'reference') {
            continue;
          }
          if (settings?.skipBasicDimensions && parsed.enclosure === 'basic') {
            continue;
          }

          // Standard Dimensions (Diameter, Radius, Angular, Thread, Chamfer, Linear)
          if (parsed.nominal !== null) {
            const zone = settings?.autoDetectZones === false
              ? ''
              : GridZoneCalculator.calculateZone(
                cluster.boundingBox.x + cluster.boundingBox.width / 2,
                cluster.boundingBox.y + cluster.boundingBox.height / 2,
                viewport.width,
                viewport.height,
                pageZoneRuler
              );

            const isRef = parsed.enclosure === 'reference';
            const isDiameter = parsed.type === 'diameter';
            const isRadius = parsed.type === 'radius';
            const isThread = parsed.type === 'thread';
            const isAngle = parsed.type === 'angle';
            const isChamfer = parsed.type === 'chamfer';

            let subType = 'Linear Dimension';
            if (isDiameter) subType = 'Diameter';
            else if (isRadius) subType = 'Radius';
            else if (isThread) subType = 'Thread / Fastener';
            else if (isAngle) subType = 'Angular Dimension';
            else if (isChamfer) subType = 'Chamfer';

            const classification: 'Critical' | 'Major' | 'Minor' = 
              (isDiameter || isThread || parsed.upperTol <= 0.001) ? 'Critical' : isRef ? 'Minor' : 'Major';

            // Master Quality Inspector Tooling Selection
            let method: InspectionMethod = 'Caliper';
            if (isRef) {
              method = 'Visual / Visual Inspection';
            } else if (isThread) {
              method = 'Thread Gage';
            } else if (isRadius || isChamfer || isAngle) {
              method = 'Optical Comparator';
            } else if (parsed.holeCallout && (parsed.holeCallout.holeType === 'counterbore' || parsed.holeCallout.depth)) {
              method = 'Bore Gage';
            } else if (isDiameter) {
              method = 'Micrometer';
            } else if (parsed.upperTol <= 0.001) {
              method = 'Micrometer';
            } else {
              method = 'Caliper';
            }

            // Real Heuristic Confidence Calculation
            let confidence = 0.96;
            if (parsed.fractionStr) confidence = 0.94;
            if (parsed.enclosure === 'basic') confidence = 0.98;
            if (parsed.enclosure === 'limit') confidence = 0.98;
            if (parsed.isToleranceInherited && parsed.nominal < 0.2) confidence = 0.88;

            // Orphan tolerance-deviation fragment: a cluster that is *only* a bare "0" or a
            // signed number (e.g. "-0.08", "+0.025") is virtually never a real standalone
            // dimension — a standalone dimension is practically always an unsigned magnitude.
            // This exact shape is the signature of a one-sided limit deviation value that
            // failed to merge with its parent nominal (see SpatialClusteringEngine's stacked
            // limit-pair handling). Force it to needs_review instead of silently auto-accepting
            // a fragment as if it were a verified, complete characteristic.
            if (/^(?:0|[+-]\d+(?:\.\d+)?)$/.test(cluster.combinedText.trim())) {
              confidence = 0.45;
            }

            const verificationStatus = confidence < (settings?.ocrConfidenceThreshold ?? 0.85) ? 'needs_review' : 'auto_accepted';

            // Check for multiplier (e.g. 4X)
            const multiplier = parsed.multiplier || 1;

            // Check for subFeatures (e.g. compound callouts, counterbores, countersinks, drill depths, chamfers)
            if (parsed.subFeatures && parsed.subFeatures.length > 1) {
              const parentId = `char-sheet-${pageNum}-${currentItemNumber}`;
              parsed.subFeatures.forEach((sub, subIdx) => {
                const isSecondary = sub.isSecondarySub ?? (subIdx > 0);
                const subCharId = `${parentId}-${sub.subNumberSuffix}`;
                const subNum = `${currentItemNumber}${subDelim}${sub.subNumberSuffix}`;

                characteristics.push({
                  id: subCharId,
                  itemNumber: currentItemNumber,
                  subNumber: subNum,
                  sheetNumber: pageNum,
                  drawingZone: zone,
                  type: sub.type,
                  displayType: sub.type === 'gdt' ? 'GEOMETRIC TOLERANCE' : 'Dimension',
                  subType: sub.subType,
                  classification: sub.classification,
                  enclosure: parsed.enclosure,
                  rawText: subIdx === 0 ? cluster.combinedText : sub.displayRequirement,
                  cleanNominal: sub.nominal,
                  upperTol: isRef ? 0 : sub.upperTol,
                  lowerTol: isRef ? 0 : sub.lowerTol,
                  minLimit: isRef ? null : sub.minLimit,
                  maxLimit: isRef ? null : sub.maxLimit,
                  plusTol: isRef ? null : sub.plusTol,
                  minusTol: isRef ? null : sub.minusTol,
                  upperLimit: isRef ? null : (sub.upperLimit ?? sub.maxLimit),
                  lowerLimit: isRef ? null : (sub.lowerLimit ?? sub.minLimit),
                  units: sub.units,
                  isToleranceInherited: parsed.isToleranceInherited,
                  toleranceSource: isRef ? 'ASME Y14.5 Reference Dimension (No Tolerance)' : parsed.toleranceSource,
                  quantity: sub.quantity || 1,
                  parentCharacteristicId: isSecondary ? `${parentId}-1` : undefined,
                  inspectionMethod: sub.inspectionMethod,
                  confidenceScore: isScannedSheet ? Math.min(confidence, 0.88) : confidence,
                  verificationStatus: isScannedSheet ? 'needs_review' : verificationStatus,
                  extractionSource: isScannedSheet ? 'ocr' : 'vector',
                  extractionConfidence: isScannedSheet ? 0.88 : confidence,
                  isBasic: parsed.enclosure === 'basic',
                  forReference: isRef,
                  fractionStr: parsed.fractionStr,
                  holeCallout: parsed.holeCallout,
                  isUnilateral: parsed.isUnilateral,
                  isMaxOrMin: parsed.isMaxOrMin,
                  sourceCaptureOrSheet: `Sheet ${pageNum}`,
                  boundingBox: cluster.boundingBox,
                  skipBalloonRender: isSecondary // Clean CAD Canvas: Only the primary balloon renders on the blueprint canvas
                });
              });
            } else if (multiplier > 1 && (settings?.multiplierBehavior ?? 'single_balloon') === 'split_sub_balloons') {
              for (let m = 1; m <= multiplier; m++) {
                characteristics.push({
                  id: `char-sheet-${pageNum}-${currentItemNumber}-${m}`,
                  itemNumber: currentItemNumber,
                  subNumber: `${currentItemNumber}${subDelim}${m}`,
                  sheetNumber: pageNum,
                  drawingZone: zone,
                  type: parsed.type,
                  displayType: 'Dimension',
                  subType: subType,
                  classification: classification,
                  enclosure: parsed.enclosure,
                  rawText: cluster.combinedText,
                  cleanNominal: parsed.nominal,
                  upperTol: isRef ? 0 : parsed.upperTol,
                  lowerTol: isRef ? 0 : parsed.lowerTol,
                  minLimit: isRef ? null : parsed.minLimit,
                  maxLimit: isRef ? null : parsed.maxLimit,
                  plusTol: isRef ? null : parsed.upperTol,
                  minusTol: isRef ? null : (parsed.lowerTol === 0 ? 0 : -parsed.lowerTol),
                  upperLimit: isRef ? null : parsed.maxLimit,
                  lowerLimit: isRef ? null : parsed.minLimit,
                  units: parsed.units,
                  isToleranceInherited: parsed.isToleranceInherited,
                  toleranceSource: isRef ? 'ASME Y14.5 Reference Dimension (No Tolerance)' : parsed.toleranceSource,
                  quantity: 1,
                  isExpandedMultiplier: true,
                  parentCharacteristicId: `char-sheet-${pageNum}-${currentItemNumber}`,
                  inspectionMethod: method,
                  confidenceScore: isScannedSheet ? Math.min(confidence, 0.88) : confidence,
                  verificationStatus: isScannedSheet ? 'needs_review' : verificationStatus,
                  extractionSource: isScannedSheet ? 'ocr' : 'vector',
                  extractionConfidence: isScannedSheet ? 0.88 : confidence,
                  isBasic: parsed.enclosure === 'basic',
                  forReference: isRef,
                  fractionStr: parsed.fractionStr,
                  holeCallout: parsed.holeCallout,
                  isUnilateral: parsed.isUnilateral,
                  isMaxOrMin: parsed.isMaxOrMin,
                  sourceCaptureOrSheet: `Sheet ${pageNum}`,
                  boundingBox: cluster.boundingBox,
                  skipBalloonRender: m > 1 // Only primary instance renders at the callout location to avoid stacked duplicate balloons
                });
              }
            } else {
              characteristics.push({
                id: `char-sheet-${pageNum}-${currentItemNumber}`,
                itemNumber: currentItemNumber,
                sheetNumber: pageNum,
                drawingZone: zone,
                type: parsed.type,
                displayType: 'Dimension',
                subType: subType,
                classification: classification,
                enclosure: parsed.enclosure,
                rawText: cluster.combinedText,
                cleanNominal: parsed.nominal,
                upperTol: isRef ? 0 : parsed.upperTol,
                lowerTol: isRef ? 0 : parsed.lowerTol,
                minLimit: isRef ? null : parsed.minLimit,
                maxLimit: isRef ? null : parsed.maxLimit,
                plusTol: isRef ? null : parsed.upperTol,
                minusTol: isRef ? null : (parsed.lowerTol === 0 ? 0 : -parsed.lowerTol),
                upperLimit: isRef ? null : parsed.maxLimit,
                lowerLimit: isRef ? null : parsed.minLimit,
                units: parsed.units,
                isToleranceInherited: parsed.isToleranceInherited,
                toleranceSource: isRef ? 'ASME Y14.5 Reference Dimension (No Tolerance)' : parsed.toleranceSource,
                quantity: multiplier,
                inspectionMethod: method,
                confidenceScore: isScannedSheet ? Math.min(confidence, 0.88) : confidence,
                verificationStatus: isScannedSheet ? 'needs_review' : verificationStatus,
                extractionSource: isScannedSheet ? 'ocr' : 'vector',
                extractionConfidence: isScannedSheet ? 0.88 : confidence,
                isBasic: parsed.enclosure === 'basic',
                forReference: isRef,
                fractionStr: parsed.fractionStr,
                holeCallout: parsed.holeCallout,
                isUnilateral: parsed.isUnilateral,
                isMaxOrMin: parsed.isMaxOrMin,
                sourceCaptureOrSheet: `Sheet ${pageNum}`,
                boundingBox: cluster.boundingBox
              });
            }

            currentItemNumber += step;
          }
        }

        // A standalone standard-citation caption (e.g. "Outside edge according to ISO13715 :")
        // can legitimately sit inside the title-block corner region ASME Y14.1 reserves for
        // part identity — getTitleBlockBoxSize's exclusion zone correctly keeps real title-block
        // fields (part number, revision, etc.) out of the dimension candidate pool, but that
        // same exclusion means a genuine process/finish requirement captioned near it is never
        // even considered above. Scanned separately here, directly against the unfiltered text
        // (not `candidateStrings`), excluding only what was already consumed as an actual
        // title-block label/value pair — never widening the title-block box itself, which would
        // risk the identity-field leakage that box was built to prevent.
        const alreadyNotedText = new Set(pageNoteChars.map(n => n.rawText));
        for (const s of normalizedStrings) {
          const t = s.text.trim();
          if (alreadyNotedText.has(t)) continue;
          if (consumedTitleBlockBoxes.some(b =>
            !(s.x + s.width < b.x || s.x > b.x + b.width || s.y + s.height < b.y || s.y > b.y + b.height)
          )) continue;

          // A real standard citation (e.g. "ISO13715") plus an inspectable-requirement keyword is
          // checked BEFORE, and instead of, isProseOrInstructionalText: that heuristic's generic
          // "2+ common grammatical words" rule (tuned for actual tutorial/book prose) also fires
          // on short, perfectly legitimate captions like "Outside edge according to ISO13715 :"
          // purely for containing the word "to" — a real citation is a far stronger, more
          // specific signal that this is engineering content, not prose. isAdministrativeBoilerplate
          // is still checked, since e.g. "INTERPRET DRAWING IN ACCORDANCE WITH ASME Y14.5" should
          // stay excluded even though it also happens to cite a standard.
          const citation = t.match(/\b((?:ISO|ASTM|MIL(?:-[A-Z])?|AMS|DIN|BS|EN)[\s-]?\d{2,6}(?:-\d+)?)\b/i);
          const hasInspectableRequirement = !!citation &&
            /\b(?:MATERIAL|FINISH|BURR|EDGE|HEAT\s+TREAT|ANODIZE|COAT|PLATE|PLATING|HARDNESS|TORQUE|SURFACE|Ra|MAX|MIN|SPEC)\b/i.test(t);
          if (!hasInspectableRequirement) continue;
          if (GdtParser.isAdministrativeBoilerplate(t)) continue;

          const citationId = citation[1].replace(/\s+/g, '');
          alreadyNotedText.add(t);
          pageNoteChars.push({
            id: `char-sheet-${pageNum}-note-${citationId}-${pageNoteChars.length}`,
            itemNumber: 0,
            sheetNumber: pageNum,
            drawingZone: `NOTE (${citationId})`,
            type: 'note',
            displayType: 'Note',
            subType: 'General Note',
            classification: 'Major',
            enclosure: 'standard',
            rawText: t,
            cleanNominal: null,
            upperTol: 0,
            lowerTol: 0,
            minLimit: null,
            maxLimit: null,
            plusTol: null,
            minusTol: null,
            upperLimit: null,
            lowerLimit: null,
            units: detectedUnit,
            isToleranceInherited: false,
            toleranceSource: `Drawing Note (${citationId})`,
            quantity: 1,
            inspectionMethod: /SURFACE|Ra/i.test(t) ? 'Optical Comparator' : /BURR|EDGE/i.test(t) ? 'Optical Comparator' : 'Visual / Visual Inspection',
            confidenceScore: isScannedSheet ? 0.88 : 0.98,
            verificationStatus: isScannedSheet ? 'needs_review' : 'auto_accepted',
            extractionSource: isScannedSheet ? 'ocr' : 'vector',
            extractionConfidence: isScannedSheet ? 0.88 : 0.98,
            isBasic: false,
            forReference: false,
            sourceCaptureOrSheet: `Sheet ${pageNum}`,
            boundingBox: { x: s.x, y: s.y, width: s.width, height: s.height },
            skipBalloonRender: true
          });
        }

        // Industry Standard: Append general inspectable notes sequentially after drawing dimensions
        // so that blueprint balloons are numbered consecutively (1, 2, 3...) on drawing geometry,
        // while notes are recorded with subsequent item numbers in AS9102 Form 3.
        for (const noteChar of pageNoteChars) {
          noteChar.itemNumber = currentItemNumber;
          currentItemNumber += step;
          characteristics.push(noteChar);
        }

        page.cleanup();
      }

      // Merge newly extracted characteristics with retained ones if targetSheetNumber was passed
      const combinedCharacteristics = targetSheetNumber
        ? [...retainedCharacteristics, ...characteristics]
        : characteristics;

      // Sort by sheetNumber, then itemNumber
      combinedCharacteristics.sort((a, b) => {
        if (a.sheetNumber !== b.sheetNumber) return a.sheetNumber - b.sheetNumber;
        return a.itemNumber - b.itemNumber;
      });

      // Cascade-renumber the sorted, merged result so item numbers are always a clean, globally
      // sequential 1..N by sheet order — regardless of what order sheets were individually
      // extracted in. Without this, extracting a lower-numbered sheet *after* higher-numbered
      // ones already exist finds nothing "preceding" it above and resets to 1, colliding with
      // item numbers already assigned to those later sheets.
      const renumbered = targetSheetNumber
        ? RenumberingService.cascadeRenumber(combinedCharacteristics)
        : combinedCharacteristics;

      // Demo/sample convenience ONLY: when explicitly loading the bundled sample blueprint and
      // nothing was extracted, seed the canned demo characteristics so the UI has something to
      // show. Gated behind an explicit caller opt-in (never inferred from "extraction found
      // nothing"), because that same signature — 0 characteristics, no recognized title block —
      // is indistinguishable from a REAL drawing the engine genuinely failed to parse, and a
      // real failure must surface as a failure, not get silently replaced with fabricated data.
      if (allowDemoFallback && renumbered.length === 0 && !targetSheetNumber && pdfDoc.numPages === 1 && !extractedProps.partName && !extractedProps.partNumber) {
        const fallbackItems = this.getStandardTurbineBracketCharacteristics();
        renumbered.push(...fallbackItems);
      }

      // Title-block identity fields must reflect what was actually read off the drawing. A
      // missing field is left blank (never backfilled with the demo part's name/number/CAGE
      // code) so a report can't silently carry a fabricated identity for a real part — same
      // reasoning as the demo-fallback gate above.
      const titleBlockRecognized = !!(extractedProps.partName || extractedProps.partNumber);
      const defaultProps: ProjectProperties = {
        partName: extractedProps.partName || '',
        partNumber: extractedProps.partNumber || '',
        partRevision: extractedProps.partRevision || '',
        drawingName: extractedProps.drawingName || '',
        drawingNumber: extractedProps.drawingNumber || '',
        drawingRevision: extractedProps.drawingRevision || '',
        cageCode: extractedProps.cageCode || '',
        organizationName: extractedProps.organizationName || '',
        // Production lot size and sampling plan are not drawing content at all — AS9102 Form 1
        // treats them as inspector-supplied, per-FAI planning data tied to the actual production
        // run, not something a title block ever states. Seeding them with a plausible-looking
        // number (as this previously did) let a real export silently ship invented lot/sampling
        // data indistinguishable from genuine values. Left blank like cageCode above; the export
        // gate (confirmExportReadiness) now blocks on these exactly like any other missing
        // required Form 1 field.
        lotSize: 0,
        samplingLevel: '',
        samplingType: '',
        aql: '',
        units: extractedProps.units || (settings?.units || 'in')
      };
      const titleBlockWarning = (!allowDemoFallback && !titleBlockRecognized)
        ? 'Could not recognize the title block layout on this drawing — part name, part number, and CAGE code were NOT extracted and must be entered manually. Do not rely on any pre-filled values for these fields.'
        : undefined;

      if (onProgress) {
        onProgress({
          state: 'COMPLETE',
          progressPercent: 100,
          message: `Successfully extracted ${renumbered.length} inspection characteristics!`,
          totalFound: renumbered.length
        });
      }

      // Compute optimal, collision-free balloon coordinates using Spatial R-Tree AABB algorithm
      const spatiallyPlaced = SpatialPlacementService.recalculateAllSheets(renumbered, sheetsMeta, true, drawingTextObstaclesBySheet);

      return { characteristics: spatiallyPlaced, projectProps: defaultProps, titleBlockWarning, titleBlockFields: extractedTitleBlockFields };
    } catch (err) {
      console.error('AI Extraction error:', err);
      if (onProgress) {
        onProgress({
          state: 'FAILED',
          progressPercent: 0,
          message: 'Extraction failed: error parsing vector streams.',
          totalFound: 0
        });
      }
      throw err;
    }
  }

  /**
   * Pre-seeded realistic AS9102 aerospace turbine bracket inspection characteristics
   */
  public static getStandardTurbineBracketCharacteristics(): EngineeringCharacteristic[] {
    const chars: EngineeringCharacteristic[] = [
      {
        id: 'char-1',
        itemNumber: 1,
        sheetNumber: 1,
        drawingZone: 'Zone B-2',
        type: 'diameter',
        displayType: 'Dimension',
        subType: 'Diameter',
        classification: 'Critical',
        enclosure: 'standard',
        rawText: 'DIA 2.500 +/- 0.005 [DIM 1]',
        cleanNominal: 2.500,
        upperTol: 0.005,
        lowerTol: 0.005,
        minLimit: 2.495,
        maxLimit: 2.505,
        plusTol: 0.005,
        minusTol: -0.005,
        upperLimit: 2.505,
        lowerLimit: 2.495,
        units: 'in',
        isToleranceInherited: false,
        toleranceSource: 'Explicit (±0.005)',
        quantity: 1,
        inspectionMethod: 'Micrometer',
        confidenceScore: 0.98,
        verificationStatus: 'auto_accepted',
        isBasic: false,
        forReference: false,
        sourceCaptureOrSheet: 'Sheet 1',
        boundingBox: { x: 460, y: 227, width: 140, height: 16 }
      },
      {
        id: 'char-2',
        itemNumber: 2,
        sheetNumber: 1,
        drawingZone: 'Zone C-2',
        type: 'linear',
        displayType: 'Dimension',
        subType: 'Linear Dimension',
        classification: 'Major',
        enclosure: 'standard',
        rawText: '4.500 +/- 0.010 [DIM 2]',
        cleanNominal: 4.500,
        upperTol: 0.010,
        lowerTol: 0.010,
        minLimit: 4.490,
        maxLimit: 4.510,
        plusTol: 0.010,
        minusTol: -0.010,
        upperLimit: 4.510,
        lowerLimit: 4.490,
        units: 'in',
        isToleranceInherited: false,
        toleranceSource: 'Explicit (±0.010)',
        quantity: 1,
        inspectionMethod: 'Caliper',
        confidenceScore: 0.96,
        verificationStatus: 'auto_accepted',
        isBasic: false,
        forReference: false,
        sourceCaptureOrSheet: 'Sheet 1',
        boundingBox: { x: 220, y: 367, width: 130, height: 16 }
      },
      {
        id: 'char-3',
        itemNumber: 3,
        sheetNumber: 1,
        drawingZone: 'Zone D-3',
        type: 'linear',
        displayType: 'Dimension',
        subType: 'Linear Dimension',
        classification: 'Minor',
        enclosure: 'reference',
        rawText: '12.450 REF [DIM 3]',
        cleanNominal: 12.450,
        upperTol: 0,
        lowerTol: 0,
        minLimit: null,
        maxLimit: null,
        plusTol: null,
        minusTol: null,
        upperLimit: null,
        lowerLimit: null,
        units: 'in',
        isToleranceInherited: false,
        toleranceSource: 'ASME Y14.5 Reference Dimension (No Tolerance)',
        quantity: 1,
        inspectionMethod: 'Visual / Visual Inspection',
        confidenceScore: 0.99,
        verificationStatus: 'auto_accepted',
        isBasic: false,
        forReference: true,
        sourceCaptureOrSheet: 'Sheet 1',
        boundingBox: { x: 480, y: 522, width: 110, height: 16 }
      },
      {
        id: 'char-4',
        itemNumber: 4,
        sheetNumber: 1,
        drawingZone: 'Zone C-4',
        type: 'gdt',
        displayType: 'GEOMETRIC TOLERANCE',
        subType: 'Position',
        classification: 'Critical',
        enclosure: 'standard',
        rawText: '| ⌖ | Ø 0.010 Ⓜ | A | B | C |',
        cleanNominal: 0.010,
        upperTol: 0.010,
        lowerTol: 0,
        minLimit: 0,
        maxLimit: 0.010,
        plusTol: 0.010,
        minusTol: 0,
        upperLimit: 0.010,
        lowerLimit: 0,
        units: 'in',
        isToleranceInherited: false,
        toleranceSource: 'ASME Y14.5 True Position',
        gdtFrame: {
          characteristic: 'position',
          symbol: '⌖',
          toleranceValue: 0.010,
          diameterSymbol: true,
          materialModifier: 'MMC',
          primaryDatum: { datum: 'A' },
          secondaryDatum: { datum: 'B' },
          tertiaryDatum: { datum: 'C' },
          rawText: '| ⌖ | Ø 0.010 Ⓜ | A | B | C |'
        },
        quantity: 1,
        inspectionMethod: 'CMM',
        confidenceScore: 0.94,
        verificationStatus: 'auto_accepted',
        isBasic: false,
        forReference: false,
        sourceCaptureOrSheet: 'Sheet 1',
        boundingBox: { x: 780, y: 312, width: 210, height: 24 }
      },
      {
        id: 'char-5.1',
        itemNumber: 5,
        subNumber: '5.1',
        sheetNumber: 2,
        drawingZone: 'Zone D-3',
        type: 'thread',
        displayType: 'Dimension',
        subType: 'Thread / Fastener',
        classification: 'Critical',
        enclosure: 'standard',
        rawText: '4X .375-16 UNC-2B THRU [DIM 5]',
        cleanNominal: 0.375,
        upperTol: 0.005,
        lowerTol: 0.005,
        minLimit: 0.370,
        maxLimit: 0.380,
        plusTol: 0.005,
        minusTol: -0.005,
        upperLimit: 0.380,
        lowerLimit: 0.370,
        units: 'in',
        isToleranceInherited: false,
        toleranceSource: 'ASME B1.1 Thread Standard',
        quantity: 1,
        isExpandedMultiplier: true,
        inspectionMethod: 'Thread Gage',
        confidenceScore: 0.97,
        verificationStatus: 'auto_accepted',
        isBasic: false,
        forReference: false,
        sourceCaptureOrSheet: 'Sheet 2',
        boundingBox: { x: 400, y: 572, width: 150, height: 16 }
      },
      {
        id: 'char-5.2',
        itemNumber: 5,
        subNumber: '5.2',
        sheetNumber: 2,
        drawingZone: 'Zone D-3',
        type: 'thread',
        displayType: 'Dimension',
        subType: 'Thread / Fastener',
        classification: 'Critical',
        enclosure: 'standard',
        rawText: '4X .375-16 UNC-2B THRU [DIM 5]',
        cleanNominal: 0.375,
        upperTol: 0.005,
        lowerTol: 0.005,
        minLimit: 0.370,
        maxLimit: 0.380,
        plusTol: 0.005,
        minusTol: -0.005,
        upperLimit: 0.380,
        lowerLimit: 0.370,
        units: 'in',
        isToleranceInherited: false,
        toleranceSource: 'ASME B1.1 Thread Standard',
        quantity: 1,
        isExpandedMultiplier: true,
        inspectionMethod: 'Thread Gage',
        confidenceScore: 0.97,
        verificationStatus: 'auto_accepted',
        isBasic: false,
        forReference: false,
        sourceCaptureOrSheet: 'Sheet 2',
        boundingBox: { x: 400, y: 572, width: 150, height: 16 }
      },
      {
        id: 'char-6',
        itemNumber: 6,
        sheetNumber: 2,
        drawingZone: 'Zone B-3',
        type: 'diameter',
        displayType: 'Dimension',
        subType: 'Diameter',
        classification: 'Critical',
        enclosure: 'limit',
        rawText: 'BORE DIA 1.1250 +0.0005/-0.0000 [DIM 4]',
        cleanNominal: 1.1250,
        upperTol: 0.0005,
        lowerTol: 0.0000,
        minLimit: 1.1250,
        maxLimit: 1.1255,
        plusTol: 0.0005,
        minusTol: 0.0000,
        upperLimit: 1.1255,
        lowerLimit: 1.1250,
        units: 'in',
        isToleranceInherited: false,
        toleranceSource: 'Explicit Limits',
        quantity: 1,
        inspectionMethod: 'Bore Gage',
        confidenceScore: 0.98,
        verificationStatus: 'auto_accepted',
        isBasic: false,
        forReference: false,
        sourceCaptureOrSheet: 'Sheet 2',
        boundingBox: { x: 380, y: 222, width: 170, height: 16 }
      },
      {
        id: 'char-7',
        itemNumber: 7,
        sheetNumber: 2,
        drawingZone: 'Zone C-4',
        type: 'gdt',
        displayType: 'GEOMETRIC TOLERANCE',
        subType: 'Total Runout',
        classification: 'Critical',
        enclosure: 'standard',
        rawText: '| ⌰ | 0.002 | A-B |',
        cleanNominal: 0.002,
        upperTol: 0.002,
        lowerTol: 0,
        minLimit: 0,
        maxLimit: 0.002,
        plusTol: 0.002,
        minusTol: 0,
        upperLimit: 0.002,
        lowerLimit: 0,
        units: 'in',
        isToleranceInherited: false,
        toleranceSource: 'ASME Y14.5 Runout Spec',
        quantity: 1,
        inspectionMethod: 'CMM',
        confidenceScore: 0.95,
        verificationStatus: 'auto_accepted',
        isBasic: false,
        forReference: false,
        sourceCaptureOrSheet: 'Sheet 2',
        boundingBox: { x: 780, y: 452, width: 160, height: 24 }
      }
    ];

    return SpatialPlacementService.recalculateAllSheets(chars, [
      { pageNumber: 1, width: 842, height: 595 },
      { pageNumber: 2, width: 842, height: 595 }
    ]);
  }

  /**
   * Manual OCR / Marquee Box Capture:
   * Extracts vector text within a user-drawn box on the drawing,
   * runs GDT and tolerance parsing, determines drawing zone,
   * and creates a new EngineeringCharacteristic.
   */
  public static async captureBox(
    pdfDoc: pdfjsLib.PDFDocumentProxy | null,
    box: { x: number; y: number; width: number; height: number },
    pageNumber: number,
    nextItemNumber: number,
    cropCanvasOrDataUrl?: HTMLCanvasElement | string,
    settings?: ProjectSettings
  ): Promise<EngineeringCharacteristic> {
    let capturedText = '';
    let zone = 'Zone A-1';
    let extractionSource: 'vector' | 'ocr' | 'manual' = 'manual';
    let extractionConfidence = 0.5;

    if (pdfDoc && pageNumber >= 1 && pageNumber <= pdfDoc.numPages) {
      try {
        const page = await pdfDoc.getPage(pageNumber);
        const viewport = page.getViewport({ scale: 1.0 });
        const textContent = await page.getTextContent();

        // Calculate drawing zone, preferring the drawing's own printed zone ruler (see
        // findBorderGridLabels) over a pixel-size-based guess, same as the main extraction path.
        const allItemBoxes = textContent.items
          .filter((item): item is typeof item & { str: string } => 'str' in item && item.str.trim().length > 0)
          .map(item => {
            const b = this.textItemToViewportBox(item as any, viewport);
            return { text: item.str.trim(), x: b.x, y: Math.max(0, b.y), width: b.width, height: b.height };
          });
        const manualCaptureRuler = DrawingExtractionService.findBorderGridLabels(allItemBoxes, viewport.width, viewport.height);
        zone = GridZoneCalculator.calculateZone(
          box.x + box.width / 2,
          box.y + box.height / 2,
          viewport.width,
          viewport.height,
          { columns: manualCaptureRuler.columns, rows: manualCaptureRuler.rows }
        );

        // Find glyphs within or overlapping box
        const matchedItems: Array<{ str: string; x: number; y: number }> = [];
        for (const item of textContent.items) {
          if ('str' in item && item.str.trim().length > 0) {
            const b = this.textItemToViewportBox(item as any, viewport);

            const overlaps = !(
              b.x + b.width < box.x ||
              b.x > box.x + box.width ||
              b.y + b.height < box.y ||
              b.y > box.y + box.height
            );

            if (overlaps) {
              matchedItems.push({ str: item.str.trim(), x: b.x, y: Math.max(0, b.y) });
            }
          }
        }

        // Sort items top-to-bottom, left-to-right
        matchedItems.sort((a, b) => {
          const rowDiff = Math.round(a.y / 10) - Math.round(b.y / 10);
          if (rowDiff !== 0) return rowDiff;
          return a.x - b.x;
        });

        if (matchedItems.length > 0) {
          capturedText = matchedItems.map(i => i.str).join(' ').trim();
          extractionSource = 'vector';
          extractionConfidence = 0.99;
        }
      } catch (err) {
        console.warn('Could not extract text from PDF within capture box:', err);
      }
    }

    // If no vector glyphs matched, invoke Image Pre-Processing & OCR Pipeline
    if (!capturedText) {
      try {
        let cropSource: HTMLCanvasElement | string | null = cropCanvasOrDataUrl || null;

        if (!cropSource && pdfDoc && pageNumber >= 1 && pageNumber <= pdfDoc.numPages && typeof document !== 'undefined') {
          const page = await pdfDoc.getPage(pageNumber);
          const ocrScale = 2.0;
          const pageViewport = page.getViewport({ scale: ocrScale });
          const renderCanvas = document.createElement('canvas');
          renderCanvas.width = pageViewport.width;
          renderCanvas.height = pageViewport.height;
          const ctx = renderCanvas.getContext('2d');
          if (ctx) {
            await page.render({ canvasContext: ctx, viewport: pageViewport, canvas: renderCanvas } as any).promise;
            const cropRect = {
              x: Math.max(0, box.x * ocrScale),
              y: Math.max(0, box.y * ocrScale),
              width: Math.max(10, box.width * ocrScale),
              height: Math.max(10, box.height * ocrScale)
            };
            cropSource = ImagePreprocessingService.cropAndPreprocess(renderCanvas, cropRect);
          }
        }

        if (cropSource) {
          const ocrRes = await OcrEngineService.recognizeCrop(cropSource);
          if (ocrRes.text && ocrRes.text.length > 0) {
            capturedText = ocrRes.text;
            extractionSource = 'ocr';
            extractionConfidence = ocrRes.confidence;
          }
        }
      } catch (ocrErr) {
        console.warn('Optical Snip OCR fallback failed:', ocrErr);
      }
    }

    if (!capturedText) {
      capturedText = 'Manual Capture';
      extractionSource = 'manual';
      extractionConfidence = 0.5;
    }

    const parsed = GdtParser.parseCallout(capturedText);
    const isRef = parsed.enclosure === 'reference';
    const isGdt = parsed.type === 'gdt' || capturedText.includes('|') || capturedText.includes('⌖') || capturedText.includes('⌰') || capturedText.includes('⌯');
    const isRadius = capturedText.includes('R') || capturedText.startsWith('R');
    const isDiameter = capturedText.includes('Ø') || capturedText.includes('DIA');
    const isThread = capturedText.includes('UNC') || capturedText.includes('UNF') || capturedText.includes('THD');

    // Reject non-inspectable drawing prose, boilerplate, and administrative notes per ASME Y14.5 / SAE AS9102
    const isProseOrBoilerplate = 
      parsed.toleranceSource === 'Prose / Excluded Text' ||
      GdtParser.isAdministrativeBoilerplate(capturedText) ||
      GdtParser.isProseOrInstructionalText(capturedText);

    if (isProseOrBoilerplate && !isGdt && !isThread && parsed.nominal === null) {
      throw new Error(`The selected area contains non-dimensional drawing prose or boilerplate ("${capturedText}"). Under ASME Y14.5 and SAE AS9102, general drafting notes without physical tolerances or dimensions cannot be ballooned.`);
    }

    const subType = isGdt ? (parsed.gdtFrame?.characteristic || 'Geometric Feature') :
      isThread ? 'Thread Callout' :
      isDiameter ? 'Diameter' :
      isRadius ? 'Radius' :
      'Linear Dimension';

    const inspectionMethod: InspectionMethod = isGdt ? 'CMM' :
      isThread ? 'Thread Gage' :
      isRadius ? 'Optical Comparator' :
      'Caliper';

    return {
      id: `char-manual-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      itemNumber: nextItemNumber,
      sheetNumber: pageNumber,
      drawingZone: zone,
      type: parsed.type,
      displayType: isGdt ? 'GEOMETRIC TOLERANCE' : 'Dimension',
      subType: subType,
      classification: 'Minor',
      enclosure: parsed.enclosure,
      rawText: capturedText,
      cleanNominal: parsed.nominal,
      upperTol: isRef ? 0 : parsed.upperTol,
      lowerTol: isRef ? 0 : parsed.lowerTol,
      minLimit: isRef ? null : parsed.minLimit,
      maxLimit: isRef ? null : parsed.maxLimit,
      plusTol: isRef ? null : parsed.upperTol,
      minusTol: isRef ? null : (parsed.lowerTol === 0 ? 0 : -parsed.lowerTol),
      upperLimit: isRef ? null : parsed.maxLimit,
      lowerLimit: isRef ? null : parsed.minLimit,
      units: parsed.units,
      isToleranceInherited: parsed.isToleranceInherited,
      toleranceSource: isRef ? 'ASME Y14.5 Reference Dimension (No Tolerance)' : (parsed.toleranceSource || (extractionSource === 'ocr' ? 'Optical Snip OCR' : 'Manual Marquee Box Capture')),
      quantity: 1,
      inspectionMethod: inspectionMethod,
      confidenceScore: extractionConfidence,
      verificationStatus: extractionConfidence >= (settings?.ocrConfidenceThreshold ?? 0.85) ? 'auto_accepted' : 'needs_review',
      extractionSource: extractionSource,
      extractionConfidence: extractionConfidence,
      isBasic: parsed.enclosure === 'basic',
      forReference: isRef,
      gdtFrame: parsed.gdtFrame,
      holeCallout: parsed.holeCallout,
      fractionStr: parsed.fractionStr,
      isUnilateral: parsed.isUnilateral,
      isMaxOrMin: parsed.isMaxOrMin,
      sourceCaptureOrSheet: `Sheet ${pageNumber}`,
      boundingBox: box,
      customBalloonPosition: {
        x: Math.max(12, Math.round(box.x - 34)),
        y: Math.round(box.y + box.height / 2 - 14)
      }
    };
  }

  /**
   * ============================================================================================
   * DELIBERATELY UNSUPPORTED: ISO 7200 numbered title-block fields.
   * ============================================================================================
   *
   * Some drawings (particularly ISO 7200 / ISO 5457-conformant European title blocks) label
   * their fields by NUMBER instead of a word — e.g. a small "3" or "5" printed next to a box,
   * with no "TITLE:"/"PART NO:"-style text anywhere for TITLE_BLOCK_FIELD_SYNONYMS above to
   * match. This engine does not read those at all; a drawing that ONLY uses numbered fields
   * still comes back with the blank-fields-plus-titleBlockWarning fallback.
   *
   * This was investigated (2026-10-04) and found to be a harder problem than "add another
   * synonym list": ISO 7200:2004 standardizes a set of DATA FIELDS AND THEIR SEMANTICS (legal
   * owner, identification number, revision index, date of issue, segment/sheet number, number
   * of segments, language code, creator, approval person, document type, responsible
   * department, technical reference, document status, and others) — but it does NOT mandate a
   * universal physical numbered-box layout that every company's title block follows. Which
   * physical box number corresponds to which semantic field is a PER-TEMPLATE convention, not
   * something the standard itself fixes. "Field 3 = Title" or "Field 5 = Part Number" is true
   * for some templates and false for others — there is no single table to hardcode.
   *
   * So: do not add a numbered-field mapping here without a verified drawing or company
   * template specification to build it against (same bar as everything else in this file —
   * see the CINH91CDB11-B.pdf-verified "REFERENCE"/"DESIGNATION" entries below for what
   * "verified" means in practice). Guessing a mapping risks writing a WRONG value into a real
   * field with high confidence, which is worse than today's honest blank + warning.
   *
   * When a verified mapping does exist, add it as its own separate detection function (same
   * pattern as findCurrentRevisionFromHistoryTable below: a dedicated reader, tried before or
   * alongside the label-based matching, that owns its own column/field semantics) rather than
   * folding numbered-field logic into TITLE_BLOCK_FIELD_SYNONYMS/TITLE_BLOCK_FIELD_PATTERNS,
   * which are inherently a WORD-label mechanism and shouldn't be overloaded with a
   * position/number-based one. This keeps the two mechanisms independently testable and means
   * adding numbered-field support later doesn't require touching the word-label matching this
   * comment sits next to.
   */

  /**
   * Title-block field label synonyms, matched case-insensitively and diacritic-insensitively
   * (stripDiacritics runs before every match, so "Référence"/"Désignation" match the plain
   * "REFERENCE"/"DESIGNATION" entries below). English covers the common ASME/MIL-STD wording
   * variants; German and French add the standard DIN/NF labels for the same field.
   *
   * `partNumber`/`partRevision`/`cageCode`/`partName` are the 4 persisted ProjectProperties
   * identity fields; `material`/`treatment`/`scale`/`mass`/`sheet`/`format` are supplementary
   * fields surfaced via the separate `titleBlockFields` result (see extractCharacteristics)
   * rather than written into ProjectProperties, since that model is wired into forms/exports
   * this change doesn't touch.
   *
   * "REFERENCE" and "DESIGNATION" (French) were verified against a real customer fixture in
   * this repo (CINH91CDB11-B.pdf) rather than guessed — see isBilingualLabelResidue() for how
   * a bilingual caption like "Référence / Part number" (label text in two languages glued into
   * one run, value in a separate cell) is told apart from a real inline value.
   *
   * `treatment` (surface/special-process treatment, e.g. "Sn 5 (I) / Cu" tin plating) was
   * added after an independent FAI QA review of CINH91CDB11-B.pdf found Form 2 (materials &
   * special processes) came out completely empty even though the drawing's title block
   * labels this field explicitly ("Traitement / Treatment") right next to "Matière / Raw
   * material", which this engine already recognized — the gap was simply that this label had
   * no synonym entry at all, not a parsing failure.
   *
   * `organizationName` is a 5th persisted ProjectProperties identity field (alongside
   * partNumber/partRevision/cageCode/partName): the issuing company, when the title block
   * labels it explicitly. That same QA review found CINH91CDB11-B.pdf's company name
   * ("Amphenol") is NOT behind any such label — it is bare text next to an unlabeled logo
   * image — so this drawing will correctly keep reporting it blank rather than have a
   * position-based "logo block" heuristic guess at it from one fixture's layout.
   */
  private static readonly TITLE_BLOCK_FIELD_SYNONYMS: Record<
    'partNumber' | 'partRevision' | 'cageCode' | 'partName' | 'organizationName' | 'material' | 'treatment' | 'scale' | 'mass' | 'sheet' | 'format',
    string[]
  > = {
    partNumber: [
      'PART NUMBER', 'PART NO', 'P/N', 'DRAWING NUMBER', 'DRAWING NO', 'DWG NUMBER', 'DWG NO',
      'TEILENUMMER', 'TEIL NR', 'ZEICHNUNGSNUMMER', 'ZEICHNUNGS NR', // German
      'NUMERO DE PIECE', 'N DE PIECE', 'NUMERO DE PLAN', 'N DE PLAN', 'REFERENCE' // French
    ],
    cageCode: ['CAGE CODE', 'CAGE CD', 'CODE CAGE', 'CAGE'],
    partRevision: ['REVISION', 'INDICE', 'REV'], // "Indice" is the standard French revision-index label
    partName: ['PART NAME', 'DESCRIPTION', 'BENENNUNG', 'DESIGNATION', 'TITLE'],
    organizationName: ['ORGANIZATION NAME', 'ORGANIZATION', 'COMPANY NAME', 'COMPANY', 'MANUFACTURER', 'FIRMA', 'SOCIETE'],
    material: ['RAW MATERIAL', 'MATERIAL', 'MATIERE', 'WERKSTOFF'],
    treatment: ['SURFACE TREATMENT', 'TREATMENT', 'TRAITEMENT', 'BEHANDLUNG', 'FINISH'],
    scale: ['SCALE', 'ECHELLE', 'MASSTAB'],
    mass: ['ESTIMATED MASS', 'MASS', 'MASSE ESTIMEE', 'WEIGHT', 'GEWICHT'],
    sheet: ['SHEET', 'FEUILLET', 'FEUILLE', 'BLATT'],
    format: ['FORMAT', 'SIZE']
  };

  private static escapeRegexLiteral(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Builds one anchored "label [:-]? (value)" regex per field from TITLE_BLOCK_FIELD_SYNONYMS.
   * Longer/more specific synonyms are tried before shorter ones within each alternation (e.g.
   * "CAGE CODE" before "CAGE") so a short label never partially swallows a longer one. The
   * capture group holds an inline value ("PART NO: 12345-A" in one run); it is empty when the
   * label and value are split into separate adjacent cells, a common CAD-export layout.
   */
  private static buildTitleBlockFieldPatterns(): Array<{
    field: keyof typeof DrawingExtractionService.TITLE_BLOCK_FIELD_SYNONYMS;
    regex: RegExp;
  }> {
    const fields = Object.keys(this.TITLE_BLOCK_FIELD_SYNONYMS) as Array<keyof typeof DrawingExtractionService.TITLE_BLOCK_FIELD_SYNONYMS>;
    return fields.map(field => {
      const alternation = [...this.TITLE_BLOCK_FIELD_SYNONYMS[field]]
        .sort((a, b) => b.length - a.length)
        .map(syn => this.escapeRegexLiteral(syn).replace(/ /g, '\\s*'))
        .join('|');
      return { field, regex: new RegExp(`^\\s*(?:${alternation})\\s*[:\\-]?\\s*(.*)$`, 'i') };
    });
  }

  private static readonly TITLE_BLOCK_FIELD_PATTERNS = DrawingExtractionService.buildTitleBlockFieldPatterns();

  private static stripDiacritics(s: string): string {
    return s.normalize('NFD').replace(/\p{Diacritic}/gu, '');
  }

  /**
   * True when `value` is just the OTHER half of a bilingual label glued into the same text run
   * as the label that already matched (e.g. matching "REFERENCE" against "Référence / Part
   * number" leaves the remainder "/ Part number" — itself just the English word for the same
   * field, not real data). Detected generically: split on "/", and check whether any trimmed
   * segment is, by itself, an exact synonym of ANY field — not guessing this drawing's
   * template, just recognizing "this text is label vocabulary, not a value" in any language
   * this engine already knows a label word for. When true, the caller should treat the inline
   * capture as empty and look for the real value in a separate adjacent/stacked cell instead.
   */
  private static isBilingualLabelResidue(value: string): boolean {
    if (!value.includes('/')) return false;
    const allSynonyms = new Set(
      Object.values(this.TITLE_BLOCK_FIELD_SYNONYMS).flat().map(s => s.toUpperCase())
    );
    return value.split('/').some(seg => {
      const norm = this.stripDiacritics(seg).trim().toUpperCase();
      return norm.length > 0 && allSynonyms.has(norm);
    });
  }

  private static levenshteinDistance(a: string, b: string): number {
    const m = a.length;
    const n = b.length;
    const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        dp[i][j] = a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
      }
    }
    return dp[m][n];
  }

  /**
   * Fuzzy fallback for when the exact/synonym regex above doesn't match. Only ever called for
   * OCR-sourced text (scanned drawings), never vector CAD text — a vector export's label is
   * always exactly the string the CAD tool wrote, so fuzzing it would only add false-positive
   * risk (e.g. a stray word 1 edit from "CAGE") for zero benefit. OCR noise is the one place a
   * label can legitimately come out as "PART N0" or "CAGE" missing its colon, so the tolerance
   * is scoped tightly to that channel. Synonyms of 4 characters or less ("REV", "P/N", "CAGE")
   * are skipped entirely — too short to fuzz without matching unrelated words (bare "CAGE" is
   * edit-distance 1 from the ordinary English word "CASE", which would otherwise false-match
   * any OCR'd note that happened to contain it). The longer forms ("CAGE CODE", "CAGE CD")
   * still fuzz normally.
   */
  private static fuzzyMatchTitleBlockLabel(
    text: string,
    field: keyof typeof DrawingExtractionService.TITLE_BLOCK_FIELD_SYNONYMS
  ): { value: string } | undefined {
    const collapsed = text.replace(/\s+/g, ' ').trim();
    const upper = this.stripDiacritics(collapsed).toUpperCase();
    const synonyms = [...this.TITLE_BLOCK_FIELD_SYNONYMS[field]].sort((a, b) => b.length - a.length);

    for (const syn of synonyms) {
      if (syn.length <= 4) continue;
      const tolerance = syn.length <= 7 ? 1 : 2;
      const headLen = Math.min(upper.length, syn.length);
      if (headLen === 0) continue;
      const head = upper.slice(0, headLen);
      if (this.levenshteinDistance(head, syn) > tolerance) continue;
      const rest = collapsed.slice(headLen).trim().replace(/^[:\-]\s*/, '');
      return { value: rest };
    }
    return undefined;
  }

  /**
   * Candidate zones the title block may live in. ASME Y14.1 puts it in the bottom-right
   * corner, but that's a convention, not a rule: a title block can span the full bottom edge,
   * run down the left or right margin (ISO 5457 side-strip style), or carry an identification
   * block at the top-right instead. All zones share the field-matching logic below, so the
   * only new false-positive surface is a body note that happens to start with one of the
   * label words while sitting in one of these edge regions — unchanged risk from the
   * content-anchored matching the engine already used in the single corner box.
   */
  private static getTitleBlockSearchZones(
    viewportWidth: number,
    viewportHeight: number
  ): Array<{ xMin: number; xMax: number; yMin: number; yMax: number }> {
    const box = this.getTitleBlockBoxSize(viewportWidth);
    return [
      { xMin: viewportWidth - box.width, xMax: viewportWidth, yMin: viewportHeight - box.height, yMax: viewportHeight }, // bottom-right (ASME default)
      { xMin: 0, xMax: viewportWidth, yMin: viewportHeight - box.height, yMax: viewportHeight }, // full-width bottom strip
      { xMin: 0, xMax: box.width, yMin: 0, yMax: viewportHeight }, // left margin strip
      { xMin: viewportWidth - box.width, xMax: viewportWidth, yMin: 0, yMax: viewportHeight }, // right margin strip
      { xMin: viewportWidth - box.width, xMax: viewportWidth, yMin: 0, yMax: box.height } // top-right identification block
    ];
  }

  /**
   * Large D-size drawings (width >= 1000 pt) use a ~380x180 pt title block; standard
   * Letter/Tabloid drawings use a ~245x135 pt title block (ASME Y14.1 / ISO 5457).
   */
  private static getTitleBlockBoxSize(viewportWidth: number): { width: number; height: number } {
    return viewportWidth >= 1000 ? { width: 380, height: 180 } : { width: 245, height: 135 };
  }

  /**
   * Guards against a label word that's actually the start of a table-header caption rather
   * than a real "label: value" row — e.g. a bilingual revision-table column header
   * ("Description de la modification / Description of the modification") starts with
   * "Description" too, but everything after it is a sentence, not a part name. Real
   * title-block values are short identifiers or names, never a sentence spanning two languages.
   * A short "N / N" sheet-count style value (e.g. "1 / 1") is legitimate data, not a caption, so
   * the slash check only kicks in once the string is long enough to plausibly be a sentence.
   */
  private static isPlausibleTitleBlockValue(value: string): boolean {
    if (!value) return false;
    if (value.length > 80) return false;
    if (value.includes(' / ') && value.length > 20) return false;
    return true;
  }

  /**
   * Finds the issuing organization's name when the title block has no explicit field label for
   * it (common on European title blocks — ISO 7200 has no mandatory numbered field for company
   * name either). Two independent structural signals are tried, in order of precision; neither
   * depends on an explicit "Company:"/"Manufacturer:" label, and both return null (never guess)
   * rather than pick an ambiguous or low-confidence candidate:
   *
   * 1. Address-block anchored (most precise, when available): a company name is printed
   *    directly above/beside its own address block, in a visibly larger font than that block's
   *    fine-print contact lines. The address block is identified by language-agnostic PHONE/
   *    FAX/TEL labels (every country's title block has some variant of these two, abbreviated
   *    the same way) — not by position on the sheet, so this works regardless of which corner
   *    the company block sits in.
   *
   * 2. Font-outlier within the title block (general fallback, no PHONE/FAX required): within
   *    the already-identified title-block search zone(s), a real, populated title block is a
   *    dense cluster of same-sized "data" text (part numbers, dates, revision letters, etc.) —
   *    the one piece of text that's a clear, singular OUTLIER in size (>=1.6x the block's
   *    median font height) is the company name/logo text in virtually every title-block
   *    convention, since nothing else in that block is typically styled that much larger. Only
   *    fires when the block is populated enough (>=5 other items) for "median" and "outlier" to
   *    be meaningful, and only when there is exactly one such outlier — multiple equally-large
   *    candidates (e.g. the designation and the part number are often both large) means this
   *    can't tell which one is the company name, so it stays blank rather than guess.
   */
  private static detectOrganizationName(
    rawStrings: Array<{ text: string; x: number; y: number; width: number; height: number }>,
    consumedTitleBlockBoxes: Array<{ x: number; y: number; width: number; height: number }>,
    titleBlockZoneItems: Array<{ text: string; x: number; y: number; width: number; height: number }>
  ): string | null {
    const contactLabelPattern = /\b(?:PHONE|TEL|T[ÉE]L[ÉE]PHONE|FAX|T[ÉE]L[ÉE]COPIE)\s*:/i;

    const looksLikeAddressOrDataLine = (t: string) =>
      contactLabelPattern.test(t) ||
      /\d{4,}/.test(t) || // postal codes, phone numbers, street numbers, long part numbers
      /\b(?:RUE|STREET|AVENUE|ROAD|STRASSE|Z\.?\s*I\.?|CEDEX)\b/i.test(t) ||
      /^\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}$/.test(t); // dates

    // Another title-block field (part number, revision, paper-format code, ...) can easily sit
    // near either anchor in a compact title block — excluded here because it's already been
    // positively identified as something else, not because of where it sits.
    const overlapsConsumedField = (s: { x: number; y: number; width: number; height: number }) =>
      consumedTitleBlockBoxes.some(b =>
        !(s.x + s.width < b.x || s.x > b.x + b.width || s.y + s.height < b.y || s.y > b.y + b.height)
      );

    const isPlausibleNameShape = (t: string) =>
      t.length >= 2 && t.length <= 40 && /^[A-Za-zÀ-ÿ]/.test(t) && !looksLikeAddressOrDataLine(t);

    // --- Signal 1: address-block anchored ---
    const contactItems = rawStrings.filter(s => contactLabelPattern.test(s.text));
    if (contactItems.length > 0) {
      const addressFontSize = contactItems.reduce((sum, s) => sum + s.height, 0) / contactItems.length;
      const anchorX = contactItems.reduce((sum, s) => sum + s.x, 0) / contactItems.length;
      const anchorY = contactItems.reduce((sum, s) => sum + s.y, 0) / contactItems.length;
      const RADIUS = 120; // PDF points — a tight, same-block proximity, not "same corner of sheet"

      const candidates = rawStrings.filter(s => {
        if (s.height < addressFontSize * 1.5) return false;
        if (overlapsConsumedField(s)) return false;
        const dist = Math.hypot(s.x - anchorX, s.y - anchorY);
        if (dist > RADIUS) return false;
        return isPlausibleNameShape(s.text.trim());
      });
      if (candidates.length === 1) return candidates[0].text.trim();
    }

    // --- Signal 2: font-size outlier within the title block, no PHONE/FAX required ---
    const unconsumed = titleBlockZoneItems.filter(s => !overlapsConsumedField(s));
    if (unconsumed.length >= 5) {
      const heights = [...unconsumed.map(s => s.height)].sort((a, b) => a - b);
      const medianHeight = heights[Math.floor(heights.length / 2)];
      if (medianHeight > 0) {
        const outliers = unconsumed.filter(s => s.height >= medianHeight * 1.6 && isPlausibleNameShape(s.text.trim()));
        if (outliers.length === 1) return outliers[0].text.trim();
      }
    }

    return null;
  }

  private static titleBlockFieldAlreadySet(
    props: Partial<ProjectProperties>,
    extraFields: Partial<Record<string, string>>,
    field: keyof typeof DrawingExtractionService.TITLE_BLOCK_FIELD_SYNONYMS
  ): boolean {
    switch (field) {
      case 'partNumber': return !!props.partNumber;
      case 'partRevision': return !!props.partRevision;
      case 'cageCode': return !!props.cageCode;
      case 'partName': return !!props.partName;
      case 'organizationName': return !!props.organizationName;
      default: return !!extraFields[field];
    }
  }

  /**
   * Finds the value for a split label/value title-block pair (label and value emitted as
   * separate PDF text runs, no shared run, often no colon at all). Prefers the same row to the
   * right, walking fragment-by-fragment so a value broken across several runs by font kerning
   * or table-cell boundaries (e.g. "7788" + "-XY") is rejoined into one string rather than only
   * the first fragment being read. Falls back to the nearest cell directly below (stacked
   * label-above-value layout) when nothing qualifies to the right. Candidates that themselves
   * look like another field's label are skipped so e.g. "TITLE" never grabs an adjacent
   * "CAGE:" cell as its value.
   */
  /**
   * General shape test for "this is a bilingual table-header caption" (e.g. "Traitement /
   * Treatment", "Tolérances générales / All Tolerances"), independent of whether this engine
   * happens to track that specific field. A neighbor-cell search can't rely solely on excluding
   * our OWN known label synonyms — a title block has plenty of fields we don't track, and any
   * one of them sitting near our target label would otherwise get grabbed as if it were the
   * value. The shape itself is the signal: two slash-separated segments, each 1-5 words with no
   * digits and starting with a capital letter — a real value either has no slash, or (like a
   * sheet count "1 / 1") contains digits.
   */
  private static looksLikeCaptionLabel(text: string): boolean {
    const segments = text.trim().split('/').map(s => s.trim());
    if (segments.length !== 2) return false;
    const isCaptionSegment = (seg: string) => {
      if (!seg || /\d/.test(seg)) return false;
      const words = seg.split(/\s+/);
      return words.length <= 5 && /^[A-Z]/.test(this.stripDiacritics(words[0]));
    };
    return isCaptionSegment(segments[0]) && isCaptionSegment(segments[1]);
  }

  private static findNeighborValueText(
    label: { text: string; x: number; y: number; width: number; height: number },
    candidates: Array<{ text: string; x: number; y: number; width: number; height: number }>,
    labelPatterns: Array<{ regex: RegExp }>
  ): { text: string; consumed: Array<{ text: string; x: number; y: number; width: number; height: number }> } | undefined {
    const sameRowTolerance = Math.max(4, label.height * 0.6);
    // pt — spans an adjacent title-block cell, not unrelated text that happens to share a
    // baseline (e.g. a company address line starting a few dozen points after a label on the
    // same row). Real adjacent label/value cells sit tightly packed; this stays well under the
    // ~140pt+ gap a coincidentally-aligned but unrelated cell can have.
    const initialGap = 40;
    const fragmentGap = 24; // pt — tight gap expected between pieces of ONE split value

    const isUsable = (c: typeof candidates[0]) =>
      c !== label && !!c.text.trim() && !labelPatterns.some(p => p.regex.test(c.text)) && !this.looksLikeCaptionLabel(c.text);

    const rowFragments: typeof candidates = [];
    const usedIndices = new Set<number>();
    let cursor = { x: label.x, width: label.width, y: label.y };
    while (rowFragments.length < 6) {
      let bestIdx = -1;
      let bestGap = Infinity;
      for (let i = 0; i < candidates.length; i++) {
        if (usedIndices.has(i)) continue;
        const c = candidates[i];
        if (!isUsable(c)) continue;
        const sameRow = Math.abs(c.y - cursor.y) <= sameRowTolerance;
        const gap = c.x - (cursor.x + cursor.width);
        const gapLimit = rowFragments.length === 0 ? initialGap : fragmentGap;
        if (sameRow && gap >= -2 && gap < gapLimit && gap < bestGap) {
          bestGap = gap;
          bestIdx = i;
        }
      }
      if (bestIdx === -1) break;
      const next = candidates[bestIdx];
      rowFragments.push(next);
      usedIndices.add(bestIdx);
      cursor = { x: next.x, width: next.width, y: next.y };
    }
    if (rowFragments.length > 0) {
      return {
        text: rowFragments.map(c => c.text.trim()).join(' ').replace(/\s+/g, ' ').trim(),
        consumed: rowFragments.map(c => ({ text: c.text, x: c.x, y: c.y, width: c.width, height: c.height }))
      };
    }

    let bestBelow: typeof candidates[0] | undefined;
    let bestBelowGap = Infinity;
    for (const c of candidates) {
      if (!isUsable(c)) continue;
      const sameColumn = c.x < label.x + label.width && c.x + c.width > label.x;
      const gap = c.y - label.y;
      if (sameColumn && gap > 0 && gap < 40 && gap < bestBelowGap) {
        bestBelow = c;
        bestBelowGap = gap;
      }
    }
    if (bestBelow) {
      return { text: bestBelow.text, consumed: [{ text: bestBelow.text, x: bestBelow.x, y: bestBelow.y, width: bestBelow.width, height: bestBelow.height }] };
    }
    return undefined;
  }

  /** Clusters text items into rows by y-coordinate (within `tolerance`), each row sorted left to right. */
  private static groupIntoRows<T extends { x: number; y: number }>(items: T[], tolerance = 6): T[][] {
    const sorted = [...items].sort((a, b) => a.y - b.y || a.x - b.x);
    const rows: T[][] = [];
    for (const item of sorted) {
      const row = rows.find(r => Math.abs(r[0].y - item.y) <= tolerance);
      if (row) row.push(item); else rows.push([item]);
    }
    for (const row of rows) row.sort((a, b) => a.x - b.x);
    return rows;
  }

  /**
   * Parses a date in DD/MM/YYYY, DD-MM-YYYY or DD.MM.YYYY order (the international convention
   * used on the vast majority of non-US engineering drawings) into a YYYYMMDD integer for
   * comparison. Falls back to MM/DD if the first component can't be a day (>12 and the second
   * can), since that's an unambiguous signal regardless of which convention produced it.
   * 2-digit years are assumed 2000+yy. Returns undefined if the text isn't a plausible date.
   */
  private static parseRevisionDate(text: string): number | undefined {
    const m = text.trim().match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
    if (!m) return undefined;
    let [d, mo] = [parseInt(m[1], 10), parseInt(m[2], 10)];
    let y = parseInt(m[3], 10);
    if (y < 100) y += 2000;
    if (d > 12 && mo <= 12) {
      // already day/month order
    } else if (mo > 12 && d <= 12) {
      [d, mo] = [mo, d];
    }
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return undefined;
    return y * 10000 + mo * 100 + d;
  }

  /**
   * Finds the CURRENT revision from a revision-history table by reading the table structurally
   * rather than guessing one company's layout: it locates the header row (a cell matching a
   * revision-field synonym sitting in the same row as a "DATE"/"DATUM" cell — whatever that
   * row's column order or language, that combination is what makes it a revision-history
   * header), reads the two columns' x-positions off that row, then scans other rows for a date
   * near the date column and a short alphanumeric code near the revision column. The row with
   * the latest parsed date wins — "current revision" is a structural fact (newest dated entry),
   * not a position convention that differs row-to-row, so this works regardless of whether new
   * entries are appended above or below the header.
   *
   * Returns undefined (no history table found) when there's no header row with that
   * revision+date column pairing — callers fall back to a plain "REVISION: X" field match.
   */
  private static findCurrentRevisionFromHistoryTable(
    items: Array<{ text: string; x: number; y: number; width: number; height: number }>
  ): { revision: string; consumed: Array<{ text: string; x: number; y: number; width: number; height: number }> } | undefined {
    const revisionSynonyms = new Set(this.TITLE_BLOCK_FIELD_SYNONYMS.partRevision.map(s => s.toUpperCase()));
    const isDateHeaderWord = (t: string) => /^(DATE|DATUM)$/i.test(this.stripDiacritics(t).trim());
    const isRevisionHeaderWord = (t: string) => revisionSynonyms.has(this.stripDiacritics(t).trim().toUpperCase());

    const rows = this.groupIntoRows(items, 6);
    let headerRow: typeof items | undefined;
    let revisionColX = 0;
    let dateColX = 0;
    for (const row of rows) {
      const revCell = row.find(c => isRevisionHeaderWord(c.text));
      const dateCell = row.find(c => isDateHeaderWord(c.text));
      if (revCell && dateCell) {
        headerRow = row;
        revisionColX = revCell.x;
        dateColX = dateCell.x;
        break;
      }
    }
    if (!headerRow) return undefined;

    const colTolerance = 100; // pt — generous enough for column-width variance, tight enough to stay in-column
    const maxRowsFromHeader = 350; // pt — entries sit in a handful of rows adjacent to the header; bounds the scan so an unrelated stamped date elsewhere on the sheet can't qualify

    type Entry = { revision: string; date: number; rowItems: typeof items };
    const entries: Entry[] = [];
    for (const row of rows) {
      if (row === headerRow) continue;
      if (Math.abs(row[0].y - headerRow[0].y) > maxRowsFromHeader) continue;
      const dateCell = row.find(c => Math.abs(c.x - dateColX) <= colTolerance && this.parseRevisionDate(c.text) !== undefined);
      if (!dateCell) continue;
      const date = this.parseRevisionDate(dateCell.text);
      if (date === undefined) continue;

      let bestRevCell: typeof items[0] | undefined;
      let bestDist = Infinity;
      for (const c of row) {
        if (c === dateCell) continue;
        if (!/^[A-Z0-9]{1,3}$/i.test(c.text.trim())) continue; // revision codes are short alphanumeric, never "/" placeholders or prose
        const dist = Math.abs(c.x - revisionColX);
        if (dist <= colTolerance && dist < bestDist) {
          bestRevCell = c;
          bestDist = dist;
        }
      }
      if (!bestRevCell) continue;
      entries.push({ revision: bestRevCell.text.trim().toUpperCase(), date, rowItems: row });
    }
    if (entries.length === 0) return undefined;

    entries.sort((a, b) => b.date - a.date);
    const winner = entries[0];
    const consumed = [...headerRow, ...entries.flatMap(e => e.rowItems)]
      .map(c => ({ text: c.text, x: c.x, y: c.y, width: c.width, height: c.height }));
    return { revision: winner.revision, consumed };
  }

  /**
   * Translates CAD font encodings (Autodesk Inventor / AutoCAD) into standard Unicode engineering symbols:
   * 'c' after numbers -> '°'
   * 'P' preceding digits -> 'Ø'
   * 'dia ' -> 'Ø'
   * European decimal-comma ("28,5" / "±0,1") -> period decimal
   */
  private static normalizeCadSymbols(text: string): string {
    let t = text;
    // Normalize decimal-comma notation before anything else, so downstream regexes (here and
    // in GdtParser) only ever see period decimals. Only a comma flanked by digits on both
    // sides is treated as a decimal separator, so datum/letter lists like "A, B, C" or
    // "A,B-C" are left untouched.
    t = t.replace(/(\d),(\d)/g, '$1.$2');
    // "c" as a degree-sign substitute (e.g. "45c X 3" for a 45° chamfer angle) only applies
    // when this token is actually paired with an angle/chamfer context — an "x" multiplication
    // sign or a CHAMFER/CSINK keyword elsewhere in the same string. A BARE "Nc" with neither
    // (e.g. ISO 13715's standalone chamfer-leg symbol "2c", meaning a 2mm chamfer with an
    // unstated angle) is not a degree value at all; converting it to "2°" here pre-empted
    // GdtParser's own chamfer detection (which already accepts literal "c" directly in its
    // angle-paired patterns, so this conversion was never actually needed for those) and
    // misreported a chamfer size as an angular dimension.
    const hasChamferAngleContext = /[xX×]/.test(t) || /\b(?:CHAMFER|CHAM|C'?SINK|COUNTERSINK)\b/i.test(t);
    if (hasChamferAngleContext) {
      t = t.replace(/(\d+(?:\.\d+)?)c\b/g, '$1°');
      t = t.replace(/(\d+(?:\.\d+)?)c\s/g, '$1° ');
    }
    t = t.replace(/\bP(\d+(?:\.\d+)?)/g, 'Ø$1');
    t = t.replace(/\bdia\s+(\d+(?:\.\d+)?)/i, 'Ø$1');
    return t;
  }

  /**
   * Detects whether a PDF sheet is a cover page, handbook overview, tutorial introduction,
   * or non-drawing sheet that should be excluded from characteristic extraction.
   */
  public static isCoverOrIntroductorySheet(
    rawStrings: Array<{ text: string; x: number; y: number; width: number; height: number }>,
    _viewportWidth?: number,
    _viewportHeight?: number
  ): boolean {
    if (rawStrings.length === 0) return false;

    const allText = rawStrings.map(s => s.text).join(' ');

    // 0. Dimensional-content gate (checked FIRST, takes precedence over everything below):
    // a sheet carrying real dimensional/GD&T callouts is never a cover page, no matter what
    // boilerplate text (copyright notices, confidentiality stamps, legal disclaimers) also
    // appears on it. Every real title block has some form of "All rights reserved" /
    // "Proprietary and confidential" text — that must never be allowed to disqualify a sheet
    // that otherwise has dimensions on it. Decimal numbers are matched with EITHER a period or
    // a comma, since international drawings commonly use comma decimals (e.g. "28,5 ±0,1").
    const dimensionalSignalCount = rawStrings.reduce((count, s) => {
      const t = s.text.trim();
      const isDimensionalToken =
        /\d[.,]\d/.test(t) ||                 // decimal number, period or comma
        t.includes('±') ||
        t.includes('Ø') ||
        /^[|⌖⏥⌯⏤⊥∠↗⌰⌭]/.test(t) ||           // GD&T feature control frame glyphs
        /^R\s*\d/.test(t) ||                  // radius callout
        /\d\s*°/.test(t) ||                   // angular callout
        /^(?:SCALE|DETAIL|SECTION)\b/i.test(t);
      return isDimensionalToken ? count + 1 : count;
    }, 0);

    if (dimensionalSignalCount >= 3) {
      return false;
    }

    // 1. Explicit cover / handbook / practice booklet indicators.
    // Deliberately excludes generic legal/copyright phrasing ("all rights reserved",
    // "missing dimension") — those appear on real industrial title blocks too and are not,
    // by themselves, reliable signals of a non-drawing page.
    const hasStrongCoverKeywords = /\b(?:practice\s+part\s+drawings|detailed\s+drawings\s+of\s+miscellaneous\s+parts|practice\s+with\s+(?:autodesk|solidworks|catia|creo|inventor)|table\s+of\s+contents|course\s+(?:overview|syllabus)|training\s+(?:manual|guide)|workbook\s+(?:overview|exercises)|practice\s+files?|answers?\s+for\s+these|exercise\s+best\s+practice)\b/i.test(allText);

    if (hasStrongCoverKeywords) {
      return true;
    }

    // 2. High conversational prose density check (only reached once we already know the
    // sheet has fewer than 3 dimensional signals on it).
    const proseMatches = allText.match(/\b(?:the|this|that|these|those|contains?|containing|miscellaneous|practice|drawings?|parts?|challengi\w*|others?|none|impossible|event|missing|advance|stop|instead|consider|opportunity|exercise|choices?|answers?|progression|geometries|features?|tutorial|package|matter|welcome|overview|introduction|copyright)\b/gi) || [];

    if (proseMatches.length >= 8) {
      const hasDwgNumberField = rawStrings.some(s => /^(?:DWG\s+NO|DRAWING\s+NUMBER|PART\s+NO)\b/i.test(s.text));
      if (!hasDwgNumberField || proseMatches.length >= 15) {
        return true;
      }
    }

    return false;
  }

  /**
   * Maps a pdf.js text item's PDF-space transform into the viewport's pixel space (top-left
   * origin, y-down), honoring whatever rotation is baked into the viewport (page.rotate, plus
   * any explicit rotation the caller requested). The naive `viewport.height - transform[5]`
   * flip used previously only produces correct coordinates for an UNrotated page — for a
   * 90/180/270-rotated page (common for landscape CAD drawings, and the actual layout of real
   * customer drawings like multi-datum Amphenol/AUXEL-style sheets) it silently produces
   * coordinates outside the sheet entirely, which then corrupts every downstream heuristic that
   * trusts position: top-to-bottom sort order, line-grouping/clustering, title-block zone
   * detection, and border-grid-label detection all rely on this being correct.
   *
   * `Util.transform(viewport.transform, item.transform)` is pdf.js's own composition of the
   * glyph's PDF-space placement with the viewport's render transform — the same transform the
   * canvas renderer uses — so this is correct for any rotation, not just the common cases.
   */
  private static textItemToViewportBox(
    item: { transform: number[]; width?: number; height?: number },
    viewport: { transform?: number[]; height?: number }
  ): { x: number; y: number; width: number; height: number } {
    // Defensive fallback for a viewport without a `transform` (a real pdf.js PageViewport always
    // has one; this only guards a malformed/mocked caller) — assume no rotation.
    if (!viewport.transform) {
      const w = item.width || 40;
      const h = item.height || 14;
      const ty = (viewport.height || 0) - item.transform[5];
      return { x: item.transform[4], y: Math.max(0, ty - h), width: w, height: h };
    }

    const m = Util.transform(viewport.transform as any, item.transform as any);
    const w = item.width || 40;
    const h = item.height || 14;

    // pdf.js's reported item.width/height are already the glyph run's measured footprint IN
    // FINAL PAGE UNITS (it has already baked in font size/scale) — they are NOT a local unit
    // square needing the matrix's magnitude applied again. The matrix's linear part (m[0..3])
    // here carries that same scale baked in too (it's the font/text matrix composed with the
    // viewport transform), so applying it directly to w/h double-scales them — a few
    // characters of text came out with a computed footprint of ~980x320pt. What we actually
    // need from the matrix is only the ROTATION DIRECTION its two axes point in; the magnitude
    // must come from pdf.js's own w/h. Normalize each axis to a unit vector before scaling.
    const normalize = (dx: number, dy: number): [number, number] => {
      const len = Math.hypot(dx, dy) || 1;
      return [dx / len, dy / len];
    };
    const [uxW, uyW] = normalize(m[0], m[1]); // direction local +x (width/advance) maps to
    const [uxH, uyH] = normalize(m[2], m[3]); // direction local +y (height/ascent) maps to

    const corners = [
      { x: m[4], y: m[5] },
      { x: m[4] + uxW * w, y: m[5] + uyW * w },
      { x: m[4] + uxH * h, y: m[5] + uyH * h },
      { x: m[4] + uxW * w + uxH * h, y: m[5] + uyW * w + uyH * h }
    ];
    const xs = corners.map(c => c.x);
    const ys = corners.map(c => c.y);

    return {
      x: Math.min(...xs),
      y: Math.min(...ys),
      width: Math.max(...xs) - Math.min(...xs),
      height: Math.max(...ys) - Math.min(...ys)
    };
  }

  /**
   * Merges fragmented adjacent text items on the same horizontal text line (e.g. standalone symbol + dimension).
   */
  private static mergeHorizontalLineItems(
    rawItems: Array<{ text: string; x: number; y: number; width: number; height: number; fontId?: string }>
  ): Array<{ text: string; x: number; y: number; width: number; height: number; fontId?: string }> {
    if (rawItems.length === 0) return [];

    // Sort by y baseline (within 4 pt), then left-to-right by x
    const sorted = [...rawItems].sort((a, b) => {
      const yDiff = a.y - b.y;
      if (Math.abs(yDiff) > 4) return yDiff;
      return a.x - b.x;
    });

    const merged: Array<{ text: string; x: number; y: number; width: number; height: number }> = [];
    const used = new Set<number>();

    for (let i = 0; i < sorted.length; i++) {
      if (used.has(i)) continue;

      let current = { ...sorted[i], text: this.normalizeCadSymbols(sorted[i].text) };
      used.add(i);

      for (let j = i + 1; j < sorted.length; j++) {
        if (used.has(j)) continue;

        const next = sorted[j];
        const yDiff = Math.abs(next.y - current.y);
        if (yDiff > 4) {
          if (next.y - current.y > 10) break;
          continue;
        }

        const xGap = next.x - (current.x + current.width);

        // Crucial Drafting Rule: Two standalone numbers side-by-side (e.g. "65" and "35" in a dimension chain)
        // are two distinct inspection characteristics. They MUST NOT be merged into a single text item!
        const isCurrStandaloneNumber = /^\d+(?:\.\d+)?$/.test(current.text);
        const isNextStandaloneNumber = /^\d+(?:\.\d+)?$/.test(next.text);
        if (isCurrStandaloneNumber && isNextStandaloneNumber) {
          continue;
        }

        // A "4X"/"18x" repeated-feature multiplier starts with a digit but is a quantity label,
        // not a dimension value — merging a diameter-symbol glyph into it (e.g. "O" + "18x" ->
        // "Ø18x") would fabricate a nonsense 18mm/18-unit diameter where none exists.
        const isMultiplierLabel = /^\d+\s*[xX]$/.test(next.text);
        const isNextNumberOrDim = (/^\d/.test(next.text) || next.text.startsWith('Ø')) && !isMultiplierLabel;
        const isCurrNumberOrDim = /^\d/.test(current.text);

        // Check if next item is an immediate horizontal continuation
        // Note: Standalone letters 'O', 'P', 'X', 'Y', 'Z' are only CAD symbols when accompanied by numbers/dimensions.
        // 'O' alongside 'P' covers CAD fonts/exporters that substitute a plain capital O for the
        // diameter glyph (⌀) when the symbol font isn't embedded with a correct ToUnicode CMap —
        // a common PDF-export issue, not specific to one vendor's drawings.
        const isSymbolMerge = (
          (current.text === 'O' && isNextNumberOrDim && xGap < 18)
        ) || (
          (current.text === 'P' && isNextNumberOrDim && xGap < 18)
        ) || (
          (current.text === 'X' && (isNextNumberOrDim || next.text === 'THRU') && xGap < 18)
        ) || (
          (current.text === 'Y' && isNextNumberOrDim && xGap < 18)
        ) || (
          (current.text === 'Z' && isNextNumberOrDim && xGap < 18)
        ) || (
          ((next.text === 'Z' || next.text === 'THRU') && isCurrNumberOrDim && xGap < 18)
        ) || (
          xGap >= -3 && xGap <= 14
        );

        if (isSymbolMerge) {
          let nextText = this.normalizeCadSymbols(next.text);
          let currText = current.text;

          if (currText === 'O' && isNextNumberOrDim) currText = 'Ø';
          else if (currText === 'P' && isNextNumberOrDim) currText = 'Ø';
          else if (currText === 'X' && isNextNumberOrDim) currText = '⌴';
          else if (currText === 'Y' && isNextNumberOrDim) currText = '⌵';
          else if (currText === 'Z' && isNextNumberOrDim) currText = '↧';

          if (nextText === 'O' && isCurrNumberOrDim) nextText = 'Ø';
          else if (nextText === 'P' && isCurrNumberOrDim) nextText = 'Ø';
          else if (nextText === 'X' && isCurrNumberOrDim) nextText = '⌴';
          else if (nextText === 'Y' && isCurrNumberOrDim) nextText = '⌵';
          else if (nextText === 'Z' && isCurrNumberOrDim) nextText = '↧';

          const separator = (currText === 'Ø' || currText === '⌴' || currText === '⌵' || currText === '↧') ? '' : ' ';
          current.text = `${currText}${separator}${nextText}`.replace(/\s+/g, ' ').trim();
          current.width = (next.x + next.width) - current.x;
          current.height = Math.max(current.height, next.height);
          used.add(j);
        }
      }

      if (current.text === 'P' && /^\s*P\s*\d/.test(current.text)) current.text = 'Ø';
      merged.push(current);
    }

    return this.reattachOrphanMultipliers(merged);
  }

  /**
   * A "4X"/"18X" repeated-feature multiplier that should merge with the feature immediately to
   * its right (rule 7 above only extends a merge rightward from whichever item becomes `current`
   * first) can end up orphaned: the single global sort used above ties y-values within 4pt and
   * then breaks by x, which is not a transitive ordering once several items are stacked within a
   * few points of each other (a deviation line, a datum-reference letter, the multiplier, and the
   * feature itself all within ~15pt of y). That can place the feature's own diameter-symbol glyph
   * earlier in sort order than the multiplier sitting to its LEFT, so by the time the multiplier
   * is visited, its target has already been consumed into a different merge and the
   * strictly-forward scan can never reach backward to claim it.
   *
   * This mirrors SpatialClusteringEngine.reattachDeviationsAboveNominal (same underlying ordering
   * issue, one companion shape earlier in the pipeline): find an orphaned bare "NX" item and
   * re-attach it as a prefix on the nearest qualifying feature to its right, instead of letting it
   * surface as its own fabricated "characteristic".
   */
  private static reattachOrphanMultipliers(
    merged: Array<{ text: string; x: number; y: number; width: number; height: number; fontId?: string }>
  ): Array<{ text: string; x: number; y: number; width: number; height: number; fontId?: string }> {
    const isOrphanMultiplier = (t: { text: string }) => /^\d+\s*[xX]$/.test(t.text.trim());
    const isFeatureLeading = (t: { text: string }) => /^Ø/.test(t.text) || /^\d/.test(t.text);

    const orphanToTarget = new Map<number, number>();
    const claimedTargets = new Set<number>();
    for (let i = 0; i < merged.length; i++) {
      if (!isOrphanMultiplier(merged[i])) continue;
      const orphan = merged[i];

      let bestMatch = -1;
      let bestDist = Infinity;
      for (let k = 0; k < merged.length; k++) {
        if (k === i || claimedTargets.has(k)) continue;
        const target = merged[k];
        if (!isFeatureLeading(target)) continue;
        if (Math.abs(target.y - orphan.y) > 6) continue;
        const gap = target.x - (orphan.x + orphan.width);
        if (gap < -3 || gap > 40) continue; // must sit to the right, within a short reading gap
        if (gap < bestDist) {
          bestDist = gap;
          bestMatch = k;
        }
      }

      if (bestMatch >= 0) {
        orphanToTarget.set(i, bestMatch);
        claimedTargets.add(bestMatch);
      }
    }

    if (orphanToTarget.size === 0) return merged;

    const targetToOrphan = new Map<number, number>();
    for (const [o, t] of orphanToTarget) targetToOrphan.set(t, o);

    const result: typeof merged = [];
    for (let k = 0; k < merged.length; k++) {
      if (orphanToTarget.has(k)) continue; // folded into its target below
      const target = merged[k];
      const orphanIdx = targetToOrphan.get(k);
      if (orphanIdx === undefined) {
        result.push(target);
        continue;
      }
      const orphan = merged[orphanIdx];
      result.push({
        text: `${orphan.text.trim()} ${target.text}`.trim(),
        x: Math.min(orphan.x, target.x),
        y: Math.min(orphan.y, target.y),
        width: Math.max(orphan.x + orphan.width, target.x + target.width) - Math.min(orphan.x, target.x),
        height: Math.max(orphan.height, target.height)
      });
    }

    return result;
  }

  /**
   * PRIMARY already-ballooned detector: recognizes the literal vector shape
   * MarkedPdfExporter.generateMarkedPdf draws for every balloon badge — `page.drawCircle` with a
   * solid white fill and a colored stroke — immediately paired with its own centered short
   * number, by reading the PDF's actual drawing commands (pdf.js's operator list), not just its
   * text. This is structural evidence a real drawing's geometry does not produce by coincidence:
   * an ordinary dimension is never drawn as a small solid-white disc with a stroked outline
   * sitting exactly behind its own number.
   *
   * Verified empirically against this engine's own exporter output: a real marked PDF shows
   * `setFillRGBColor("#ffffff")` → `setStrokeRGBColor(<any color>)` → `setLineWidth(<border
   * width>)` → `constructPath` (bounding box square, diameter matching one of
   * MarkedPdfExporter's three badge radii: 10/12/15pt → 20/24/30pt diameter, allowing a margin)
   * within a handful of operators of each other, for every single balloon — confirmed by reading
   * a known badge's own operator-list bounding box directly against its drawn radius. Badge
   * colors are intentionally NOT matched (the user's configured balloon color/appearance can be
   * anything), only the fill/stroke/width/shape/size STRUCTURE, which `MarkedPdfExporter` always
   * produces regardless of color.
   *
   * A confirmed badge requires BOTH the shape (this function) AND a real showText nearby whose
   * string matches a balloon-number shape — shape alone is not enough, since real drawings
   * occasionally do have small round witness-circles or hole-leader bubbles with no number in
   * them (never mistaken as a balloon for lack of a paired number).
   */
  public static async detectExistingBalloonBadges(
    page: pdfjsLib.PDFPageProxy,
    textItems: Array<{ text: string; x: number; y: number; width: number; height: number; fontId?: string }>,
    excludedKeys: Set<string>
  ): Promise<{ count: number } | null> {
    const MIN_CONFIRMED_BADGES = 5;

    const opList = await page.getOperatorList();
    const fn = opList.fnArray;
    const args = opList.argsArray;

    const isWhiteFill = (v: unknown) => typeof v === 'string' && /^#f{5,6}$/i.test(v);

    let lastWhiteFillAt = -Infinity;
    let lastStrokeColorAt = -Infinity;
    let lastLineWidth: number | null = null;
    const MAX_OP_GAP = 10;

    const viewport = page.getViewport({ scale: 1.0 });
    const badgeBoxesViewportSpace: Array<{ minX: number; minY: number; maxX: number; maxY: number }> = [];

    for (let i = 0; i < fn.length; i++) {
      const op = fn[i];
      if (op === OPS.setFillRGBColor) {
        lastWhiteFillAt = isWhiteFill(args[i]?.[0]) ? i : -Infinity;
      } else if (op === OPS.setStrokeRGBColor) {
        lastStrokeColorAt = i;
      } else if (op === OPS.setLineWidth) {
        lastLineWidth = args[i]?.[0] ?? null;
      } else if (op === OPS.constructPath) {
        const withinWindow = i - lastWhiteFillAt <= MAX_OP_GAP && i - lastStrokeColorAt <= MAX_OP_GAP;
        const plausibleBorderWidth = lastLineWidth !== null && lastLineWidth >= 0.5 && lastLineWidth <= 4;
        if (withinWindow && plausibleBorderWidth) {
          const bbox = args[i]?.[2];
          if (bbox && bbox.length >= 4) {
            const w = bbox[2] - bbox[0];
            const h = bbox[3] - bbox[1];
            const diameter = (w + h) / 2;
            const squareness = Math.abs(w - h) / Math.max(w, h, 1);
            // MarkedPdfExporter's three fit presets: badgeRadius 10, 12, or 15 -> diameter
            // 20/24/30pt. A margin either side absorbs minor path-approximation variance.
            if (diameter >= 16 && diameter <= 36 && squareness < 0.15) {
              // drawCircle's coordinates are written in native PDF page space (via
              // viewport.convertToPdfPoint in MarkedPdfExporter), not the viewport space
              // `textItems` uses — converted back here so the two can be compared directly.
              const [vx1, vy1] = viewport.convertToViewportPoint(bbox[0], bbox[1]);
              const [vx2, vy2] = viewport.convertToViewportPoint(bbox[2], bbox[3]);
              badgeBoxesViewportSpace.push({
                minX: Math.min(vx1, vx2), maxX: Math.max(vx1, vx2),
                minY: Math.min(vy1, vy2), maxY: Math.max(vy1, vy2)
              });
            }
          }
        }
      }
    }

    if (badgeBoxesViewportSpace.length < MIN_CONFIRMED_BADGES) return null;

    const balloonNumberPattern = /^[A-Za-z]{0,3}-?\d{1,4}(?:[.\-]\d{1,3})?$/;
    let confirmed = 0;
    for (const box of badgeBoxesViewportSpace) {
      const match = textItems.find(s => {
        if (excludedKeys.has(`${Math.round(s.x)}_${Math.round(s.y)}_${s.text}`)) return false;
        const t = s.text.trim();
        if (!balloonNumberPattern.test(t) || t.length > 8) return false;
        const cx = s.x + s.width / 2;
        const cy = s.y + s.height / 2;
        return cx >= box.minX && cx <= box.maxX && cy >= box.minY && cy <= box.maxY;
      });
      if (match) confirmed++;
    }

    return confirmed >= MIN_CONFIRMED_BADGES ? { count: confirmed } : null;
  }

  /**
   * Detects whether this PDF already carries Loonist-generated balloon item-number annotations
   * (see MarkedPdfExporter) by recognizing the specific, verified structural signature those
   * balloons leave in the text layer: every balloon number on a sheet is drawn with the SAME
   * embedded font object (pdf.js exposes this as a per-glyph internal key, e.g. "g_d0_f7" — not
   * a human-readable name, but identical across every balloon since they share one
   * `pdfDoc.embedFont(...)` call), and together they form a complete, gapless integer sequence
   * starting at 1 or 2 (the balloon numbering convention — see RenumberingService/
   * formatBalloonNumber). Real drawing content essentially never produces this: a real
   * dimension's text is never grouped with a dozen+ OTHER short bare integers under one
   * identical font object that, together, enumerate every integer from 1 to N without a single
   * gap — zone-grid ruler labels are the one legitimate case that could otherwise look similar,
   * which is why `excludedKeys` (from findBorderGridLabels, computed just before this runs) is
   * required and subtracted first.
   *
   * Deliberately NOT a per-item filter: this is a one-time, whole-sheet signature check with a
   * single pass/fail outcome for the document, so it never touches how any individual small
   * integer dimension is parsed when it correctly passes (see AlreadyBalloonedPdfError).
   *
   * FALLBACK ONLY — detectExistingBalloonBadges (the actual drawn badge shape) is the primary
   * signal and runs first; this is a safety net for if that ever fails to find anything (e.g. a
   * future pdf.js version changes how it reports vector paths), not a standalone detector in its
   * own right. The threshold here is set deliberately high: a genuinely plausible real drawing
   * CAN have a dozen-plus small sequential integer dimensions sharing one font (e.g. a hole
   * pattern dimensioned 1-15mm from a datum) without being ballooned — a real FAI balloon count,
   * by contrast, routinely exceeds 25-30 on a non-trivial part. Never fires at a count low enough
   * to risk rejecting that legitimate case (see the regression test covering it).
   */
  public static detectExistingBalloonNumbering(
    strings: Array<{ text: string; x: number; y: number; fontId?: string }>,
    excludedKeys: Set<string>
  ): { sequenceStart: number; sequenceEnd: number; fontId: string } | null {
    const MIN_SEQUENCE_LENGTH = 25;

    // Candidate balloon-number tokens: bare digits, optionally with a short (<=3 char) alpha
    // prefix and/or a ".N"/"-N" sub-characteristic suffix (formatBalloonNumber's own shapes,
    // e.g. "1", "A-4", "7.2") — and short overall, since a real multi-part dimension string
    // never collapses to this shape on its own.
    const tokenPattern = /^[A-Za-z]{0,3}-?(\d{1,4})(?:[.\-]\d{1,3})?$/;

    const byFont = new Map<string, Set<number>>();
    for (const s of strings) {
      if (!s.fontId) continue;
      if (excludedKeys.has(`${Math.round(s.x)}_${Math.round(s.y)}_${s.text}`)) continue;
      const t = s.text.trim();
      if (t.length === 0 || t.length > 8) continue;
      const m = t.match(tokenPattern);
      if (!m) continue;
      const n = parseInt(m[1], 10);
      if (!byFont.has(s.fontId)) byFont.set(s.fontId, new Set());
      byFont.get(s.fontId)!.add(n);
    }

    // Density, not strict unbroken contiguity: a handful of balloon numbers can legitimately
    // fail to survive as their own standalone token (e.g. a balloon sitting close enough to
    // other text that mergeHorizontalLineItems's generic adjacency rule fuses it with a
    // neighbor) without that meaning this ISN'T a balloon-numbered sheet. Real engineering
    // dimension text sharing one font, by contrast, is never densely packed into a small
    // low-numbered range — its values are whatever the part's real geometry calls for, scattered
    // arbitrarily across a wide range (see the legitimate ~5% density example in this function's
    // own doc comment / regression test). Requiring BOTH a low starting point and high density
    // over a wide-enough span is what tells the two apart.
    const MIN_DENSITY = 0.7;

    for (const [fontId, numSet] of byFont) {
      const distinct = [...numSet].sort((a, b) => a - b);
      if (distinct.length < MIN_SEQUENCE_LENGTH) continue;

      const min = distinct[0];
      const max = distinct[distinct.length - 1];
      const span = max - min + 1;
      const density = distinct.length / span;

      if (min <= 3 && density >= MIN_DENSITY) {
        return { sequenceStart: min, sequenceEnd: max, fontId };
      }
    }

    return null;
  }

  /**
   * Identifies true drawing border grid coordinate labels (ASME Y14.1 / ISO 5457).
   * Border grids are sequential rows or columns of coordinates (e.g., 1, 2, 3... or A, B, C...)
   * aligned along the outer peripheral margins of the drawing sheet.
   * Isolated part dimensions located near drawing margins (e.g., a lone "3" near a section view)
   * are preserved and never falsely classified as grid coordinates.
   *
   * Also returns the validated labels themselves with their sheet positions (`columns`/`rows`)
   * — the drawing's own printed zone ruler. A zone grid's size (4, 6, 8, 12, 16+ divisions per
   * side) is a company/drafting-standard choice that cannot be reliably guessed from rendered
   * pixel dimensions, so this real, per-drawing ruler is what GridZoneCalculator.calculateZone
   * should interpolate against instead of a fixed-bucket pixel-size estimate. Previously this
   * data was computed, used only to build the `excludedKeys` exclusion set below, then
   * discarded — an audit found CINH91CDB11-B.pdf's real 16-column/12-row grid was being
   * reported as an assumed 8-column/8-row grid, making every Form 3 "Reference Location" zone
   * on that drawing wrong (columns off by roughly half; `ROW_LABELS` also silently reused 'A'
   * beyond row H, a separate latent bug on any drawing with more than 8 row zones).
   */
  public static findBorderGridLabels(
    strings: Array<{ text: string; x: number; y: number; width: number; height: number }>,
    sheetWidth: number,
    sheetHeight: number
  ): {
    excludedKeys: Set<string>;
    columns: Array<{ label: string; position: number }>;
    rows: Array<{ label: string; position: number }>;
  } {
    const gridIds = new Set<string>();
    // label -> all observed positions (a ruler printed on both the top and bottom, or both the
    // left and right, margin yields one validated group per occurrence; averaging reconciles
    // them instead of just keeping whichever was found last).
    const columnPositions = new Map<string, number[]>();
    const rowPositions = new Map<string, number[]>();

    const isGridCandidate = (t: string) => /^[A-Z]$|^[1-9]$|^1[0-6]$/.test(t);

    // Border grids can sit anywhere from a few points to several hundred points inside the
    // sheet edge, depending on page size and how much of that edge a title block eats into
    // (large D/E-size sheets routinely have 150-700pt between the paper edge and the border
    // frame). Rather than guess a fixed or proportional distance from the edge, we don't gate
    // on edge proximity at all: every grid-shaped token on the page is grouped by alignment,
    // and the existing structural checks below (>=3 labels, >=35% span, >=3 distinct values)
    // are what actually discriminate a real grid row/column from real part dimensions that
    // happen to share an axis.
    const candidates = strings.filter(s => isGridCandidate(s.text));

    // Validate a candidate group along a horizontal margin (top or bottom)
    const validateHorizontalGroup = (candidates: typeof strings) => {
      const rows: Array<typeof strings> = [];
      for (const c of candidates) {
        let placed = false;
        for (const row of rows) {
          if (Math.abs(row[0].y - c.y) <= 4) {
            row.push(c);
            placed = true;
            break;
          }
        }
        if (!placed) rows.push([c]);
      }

      for (const row of rows) {
        // Real border grid lines must have at least 3 labels
        if (row.length < 3) continue;

        // Must span at least 35% of drawing width
        const xs = row.map(c => c.x);
        const span = Math.max(...xs) - Math.min(...xs);
        if (span < sheetWidth * 0.35) continue;

        // Must contain distinct labels (e.g. 1, 2, 3... not duplicate dimensions)
        const uniqueTexts = new Set(row.map(c => c.text));
        if (uniqueTexts.size < 3) continue;

        // Validated border grid row — these are the COLUMN number labels (they run
        // horizontally, each one marking a distinct column position).
        for (const c of row) {
          gridIds.add(`${Math.round(c.x)}_${Math.round(c.y)}_${c.text}`);
          const positions = columnPositions.get(c.text) || [];
          positions.push(c.x);
          columnPositions.set(c.text, positions);
        }
      }
    };

    // Validate a candidate group along a vertical margin (left or right)
    const validateVerticalGroup = (candidates: typeof strings) => {
      const cols: Array<typeof strings> = [];
      for (const c of candidates) {
        let placed = false;
        for (const col of cols) {
          if (Math.abs(col[0].x - c.x) <= 4) {
            col.push(c);
            placed = true;
            break;
          }
        }
        if (!placed) cols.push([c]);
      }

      for (const col of cols) {
        // Real border grid lines must have at least 3 labels
        if (col.length < 3) continue;

        // Must span at least 35% of drawing height
        const ys = col.map(c => c.y);
        const span = Math.max(...ys) - Math.min(...ys);
        if (span < sheetHeight * 0.35) continue;

        // Must contain distinct labels
        const uniqueTexts = new Set(col.map(c => c.text));
        if (uniqueTexts.size < 3) continue;

        // Validated border grid column — these are the ROW letter labels (they run
        // vertically, each one marking a distinct row position).
        for (const c of col) {
          gridIds.add(`${Math.round(c.x)}_${Math.round(c.y)}_${c.text}`);
          const positions = rowPositions.get(c.text) || [];
          positions.push(c.y);
          rowPositions.set(c.text, positions);
        }
      }
    };

    validateHorizontalGroup(candidates);
    validateVerticalGroup(candidates);

    const average = (vals: number[]) => vals.reduce((a, b) => a + b, 0) / vals.length;
    const columns = Array.from(columnPositions.entries())
      .map(([label, positions]) => ({ label, position: average(positions) }))
      .sort((a, b) => a.position - b.position);
    const rows = Array.from(rowPositions.entries())
      .map(([label, positions]) => ({ label, position: average(positions) }))
      .sort((a, b) => a.position - b.position);

    return { excludedKeys: gridIds, columns, rows };
  }
}

