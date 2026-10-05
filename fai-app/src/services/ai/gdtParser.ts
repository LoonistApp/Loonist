/**
 * LOONIST — Industrial ASME Y14.5-2018 GD&T & Engineering Dimension Parser
 * Full compliance with ASME Y14.5 (GD&T standards), ASME B1.1 (Threads),
 * ANSI/ASME hole machining callouts, composite feature control frames, and fractional callouts.
 */

import type { 
  GdtFeatureControlFrame, 
  DimensionEnclosure, 
  CharacteristicType,
  HoleFeatureCallout,
  TitleBlockTolerancePreset,
  InspectionMethod
} from '../../types/characteristics';
import { DEFAULT_AEROSPACE_TOLERANCES } from '../../types/characteristics';
import { ToleranceEngine } from './toleranceEngine';
import { FractionParser } from './fractionParser';

export interface DeconstructedSubFeature {
  subNumberSuffix: string;
  displayRequirement: string;
  nominal: number | null;
  upperTol: number;
  lowerTol: number;
  minLimit: number | null;
  maxLimit: number | null;
  plusTol: number;
  minusTol: number;
  upperLimit?: number | null;
  lowerLimit?: number | null;
  units: 'in' | 'mm' | 'deg';
  type: CharacteristicType;
  subType: string;
  classification: 'Critical' | 'Major' | 'Minor';
  inspectionMethod: InspectionMethod;
  quantity?: number;
  isSecondarySub?: boolean;
}

export interface ParsedDimensionResult {
  rawText: string;
  nominal: number | null;
  upperTol: number;
  lowerTol: number;
  minLimit: number | null;
  maxLimit: number | null;
  type: CharacteristicType;
  enclosure: DimensionEnclosure;
  isToleranceInherited: boolean;
  toleranceSource: string;
  units: 'in' | 'mm' | 'deg';
  gdtFrame?: GdtFeatureControlFrame;
  holeCallout?: HoleFeatureCallout;
  multiplier: number;
  fractionStr?: string;
  isUnilateral?: boolean;
  isMaxOrMin?: 'MAX' | 'MIN';
  subFeatures?: DeconstructedSubFeature[];
}

export class GdtParser {
  /**
   * Main entry point to parse any engineering callout string.
   */
  public static parseCallout(
    rawText: string,
    preset: TitleBlockTolerancePreset = DEFAULT_AEROSPACE_TOLERANCES
  ): ParsedDimensionResult {
    const text = rawText.trim();

    // 1. Filter out drawing view titles, section headers, detail labels, scales, and prose immediately
    if (
      /^(?:DETAIL|SECTION|VIEW)\s+[A-Z]/i.test(text) ||
      /SCALE\s*[:\s]\s*\d+\s*:\s*\d+/i.test(text) ||
      /\[SCALE\s+\d+:\d+\]/i.test(text) ||
      /^(?:TOP|FRONT|SIDE|ISOMETRIC|AUXILIARY)\s+VIEW/i.test(text) ||
      /^(?:GENERAL\s+)?NOTES?:?/i.test(text) ||
      GdtParser.isProseOrInstructionalText(text)
    ) {
      return {
        rawText: text,
        nominal: null,
        upperTol: 0,
        lowerTol: 0,
        minLimit: null,
        maxLimit: null,
        type: 'linear',
        enclosure: 'standard',
        isToleranceInherited: false,
        toleranceSource: 'Prose / Excluded Text',
        units: preset.unit,
        multiplier: 1
      };
    }

    // 2. Check for Chamfer Callouts per ASME Y14.5 § 1.8.16 (e.g. "3 X 45° CHAMFER", "45° X 3", "2X 3 X 45°")
    // Chamfers MUST be evaluated prior to greedy multiplier extraction so "3 X 45°" is not misidentified as 3X multiplier.
    const chamferEarlyResult = this.parseChamferCallout(text, preset);
    if (chamferEarlyResult) {
      return chamferEarlyResult;
    }

    // 3. Check for Quantity Multipliers (e.g. "4X", "6 PLACES", "8X")
    let multiplier = 1;
    let cleanText = text;

    const multiplierMatch = text.match(/^(\d+)\s*[xX]\s+(.*)$/);
    if (multiplierMatch) {
      multiplier = parseInt(multiplierMatch[1], 10);
      cleanText = multiplierMatch[2].trim();
    } else {
      const placesMatch = text.match(/^(.*?)\s*\(?(\d+)\s*PLACES\)?$/i);
      if (placesMatch) {
        multiplier = parseInt(placesMatch[2], 10);
        cleanText = placesMatch[1].trim();
      }
    }

    // Strip internal CAD tags like [DIM 1], [DIM 5], [FCF 1]
    cleanText = cleanText
      .replace(/\s*\[\s*DIM\s*\d+\s*\]/gi, '')
      .replace(/\s*\[\s*FCF\s*\d+\s*\]/gi, '')
      .trim();

    // 3. Extract Hole Machining Sub-Features (Depth, Counterbore, Countersink)
    const holeCallout = this.parseHoleCallout(cleanText);

    // 3b. Check for Multi-Feature Compound Callouts (Counterbore, Countersink, Drill Depth, Thread + Spotface)
    const compoundSubs = GdtParser.deconstructCompoundCallout(cleanText, preset);
    if (compoundSubs && compoundSubs.length > 1) {
      const primary = compoundSubs[0];
      return {
        rawText: text,
        nominal: primary.nominal,
        upperTol: primary.upperTol,
        lowerTol: primary.lowerTol,
        minLimit: primary.minLimit,
        maxLimit: primary.maxLimit,
        type: primary.type,
        enclosure: 'standard',
        isToleranceInherited: true,
        toleranceSource: `Compound Callout (${primary.subType})`,
        units: primary.units,
        // `primary.quantity` comes from deconstructCompoundCallout's OWN internal multiplier
        // detection (a trailing "N PLCS" inside the compound string itself), which defaults to
        // 1 when it finds nothing — not "unknown". `primary.quantity || multiplier` therefore
        // silently discarded a real leading "NX" multiplier (already extracted into the outer
        // `multiplier` here) any time the inner default of 1 was in play, since 1 is truthy.
        // Taking the max is correct either way: a real repeated-feature count is never lower
        // than both signals, whichever one actually found it.
        multiplier: Math.max(primary.quantity || 1, multiplier),
        holeCallout,
        subFeatures: compoundSubs
      };
    }

    // 4. Check for GD&T Feature Control Frame (single tier or composite dual tier)
    // Space-delimited shape first: some CAD exporters draw a frame's compartment dividers as
    // vector lines rather than literal "|" text glyphs, so the pipe-based detection below can
    // never match them even once the leading symbol is correctly read — this variant is
    // recognized by STRUCTURE (symbol, optional diameter marker, tolerance, 1-3 datum letters)
    // instead.
    const spaceDelimitedFrame = this.parseSpaceDelimitedFrame(cleanText);
    if (spaceDelimitedFrame) {
      const gdtResult = this.buildSpaceDelimitedFrameResult(text, spaceDelimitedFrame, multiplier, preset.unit);
      if (holeCallout) gdtResult.holeCallout = holeCallout;
      return gdtResult;
    }
    if (this.isGdtFrame(cleanText)) {
      const gdtResult = this.parseFeatureControlFrame(text, cleanText, multiplier, preset.unit);
      if (holeCallout) gdtResult.holeCallout = holeCallout;
      return gdtResult;
    }

    // 5. Evaluate Fractions & Mixed Numbers (e.g. "1 3/8", "± 1/64")
    const fractionResult = FractionParser.normalizeFractionsInText(cleanText);
    const textToParse = fractionResult.normalizedText;
    const fractionStr = fractionResult.primaryFraction;

    // 6. Check for Basic Dimension [ 1.500 ] (Boxed per ASME Y14.5 § 1.3.23)
    if (this.isBasicDimension(cleanText)) {
      const numStr = textToParse.replace(/[[\]]/g, '').trim();
      const nominal = parseFloat(numStr);
      return {
        rawText: text,
        nominal: Number.isNaN(nominal) ? null : nominal,
        upperTol: 0.0,
        lowerTol: 0.0,
        minLimit: nominal,
        maxLimit: nominal,
        type: this.inferType(cleanText),
        enclosure: 'basic',
        isToleranceInherited: false,
        toleranceSource: 'ASME Y14.5 Basic Dimension (Tol = 0)',
        units: cleanText.includes('°') ? 'deg' : preset.unit,
        multiplier,
        fractionStr,
        holeCallout
      };
    }

    // 7. Check for Reference Dimension ( 2.750 ) or "12.450 REF" (ASME Y14.5 § 1.3.33)
    if (this.isReferenceDimension(cleanText) || /\bREF\b/i.test(cleanText)) {
      // Leading "-?" so a genuinely negative reference value (e.g. "-0.5 REF") keeps its sign
      // instead of silently reporting the positive magnitude.
      const numMatch = textToParse.match(/-?(?:\d+\.?\d*|\.\d+)/);
      const nominal = numMatch ? parseFloat(numMatch[0]) : null;
      return {
        rawText: text,
        nominal,
        upperTol: 0.0,
        lowerTol: 0.0,
        minLimit: null,
        maxLimit: null,
        type: this.inferType(cleanText),
        enclosure: 'reference',
        isToleranceInherited: false,
        toleranceSource: 'ASME Y14.5 Reference Dimension (No Tolerance)',
        units: cleanText.includes('°') ? 'deg' : preset.unit,
        multiplier,
        fractionStr,
        holeCallout
      };
    }

    // 8. Check for MAX / MIN Callouts (e.g. "R .030 MAX", ".500 MIN")
    const maxMatch = textToParse.match(/(?:R|DIA|Ø)?\s*([0-9]*\.?[0-9]+)\s*MAX\b/i);
    if (maxMatch) {
      const val = parseFloat(maxMatch[1]);
      return {
        rawText: text,
        nominal: val,
        upperTol: 0,
        lowerTol: val,
        minLimit: 0,
        maxLimit: val,
        type: this.inferType(cleanText),
        enclosure: 'standard',
        isToleranceInherited: false,
        toleranceSource: 'Explicit Maximum (MAX)',
        units: preset.unit,
        multiplier,
        fractionStr,
        isMaxOrMin: 'MAX',
        holeCallout
      };
    }

    const minMatch = textToParse.match(/(?:R|DIA|Ø)?\s*([0-9]*\.?[0-9]+)\s*MIN\b/i);
    if (minMatch) {
      const val = parseFloat(minMatch[1]);
      return {
        rawText: text,
        nominal: val,
        upperTol: 0.010,
        lowerTol: 0,
        minLimit: val,
        maxLimit: null,
        type: this.inferType(cleanText),
        enclosure: 'standard',
        isToleranceInherited: false,
        toleranceSource: 'Explicit Minimum (MIN)',
        units: preset.unit,
        multiplier,
        fractionStr,
        isMaxOrMin: 'MIN',
        holeCallout
      };
    }

    // 9. Fallback Check for Chamfer Callouts (e.g. ".060 X 45°", "45° X .060", "0.5 X 45c CHAMFER", "ALL CHAMFERS = 0.5 X 45°")
    const chamferFallbackResult = this.parseChamferCallout(textToParse, preset);
    if (chamferFallbackResult) {
      return {
        ...chamferFallbackResult,
        multiplier: multiplier > 1 ? multiplier : chamferFallbackResult.multiplier,
        fractionStr,
        holeCallout
      };
    }

    // 10. Check for Standard Thread Callout
    // 10a. Unified Threads (e.g. ".375-16 UNC-2B", "1/4-20 UNC", "4X .375-16 UNC-2B THRU")
    const threadMatch = textToParse.match(/(?:\d+X\s+)?([0-9]*\.?[0-9]+)(?:-\d+)?\s*(?:UNC|UNF|UNEF|UNS|UN)(?:-[123][AB])?(?:\s+(?:THRU|DEEP|DEPTH))?/i);
    if (threadMatch) {
      const nomStr = threadMatch[1];
      const nom = parseFloat(nomStr);
      const validNom = Number.isNaN(nom) ? 0.375 : nom;
      return {
        rawText: text,
        nominal: validNom,
        upperTol: 0.005,
        lowerTol: 0.005,
        minLimit: parseFloat((validNom - 0.005).toFixed(4)),
        maxLimit: parseFloat((validNom + 0.005).toFixed(4)),
        type: 'thread',
        enclosure: 'standard',
        isToleranceInherited: false,
        toleranceSource: 'ASME B1.1 Thread Standard Class 2B',
        units: 'in',
        multiplier,
        fractionStr,
        holeCallout
      };
    }

    // 10b. Metric ISO Threads (e.g. "M10 x 1.5 - 6H", "4X M6x1.0 THRU", "M8 - 6g")
    const metricThreadMatch = textToParse.match(/(?:\d+X\s+)?\bM([0-9]+(?:\.[0-9]+)?)(?:\s*[xX]\s*([0-9.]+))?(?:-[456][gGhH])?(?:\s+(?:THRU|DEEP|DEPTH))?\b/i);
    if (metricThreadMatch) {
      const nom = parseFloat(metricThreadMatch[1]);
      const pitch = metricThreadMatch[2] ? parseFloat(metricThreadMatch[2]) : null;
      const tol = 0.10;
      return {
        rawText: text,
        nominal: nom,
        upperTol: tol,
        lowerTol: tol,
        minLimit: parseFloat((nom - tol).toFixed(3)),
        maxLimit: parseFloat((nom + tol).toFixed(3)),
        type: 'thread',
        enclosure: 'standard',
        isToleranceInherited: false,
        toleranceSource: pitch ? `ISO 965 Metric Thread (M${nom}x${pitch})` : `ISO 965 Metric Thread (M${nom})`,
        units: 'mm',
        multiplier,
        fractionStr,
        holeCallout
      };
    }

    // 10b. Stacked ISO 286 limit/deviation pair that the spatial clusterer joined from separate
    // lines (e.g. "Ø10.5 / -0.08", or "0 / Ø10.5 / -0.08" when the upper deviation was written
    // above the nominal) rather than a single "+0/-0.08" token. Recognized by segment CONTENT —
    // exactly one segment is a plain nominal number, the other one or two segments are each a
    // bare "0" or an explicitly signed number — regardless of which side of the nominal they
    // were written on, since ISO limit dimensioning puts the upper deviation above and the
    // lower deviation below. Without this, a real toleranced hole (e.g. 10.5 +0/-0.08) was
    // silently falling through to this part's generic default tolerance class, discarding the
    // drawing's actual limits.
    {
      const stackedSegments = textToParse.split('/').map(s => s.trim()).filter(s => s.length > 0);
      const isDeviationSeg = (s: string) => s === '0' || /^[+-][0-9]*\.?[0-9]+$/.test(s);
      if (stackedSegments.length >= 2 && stackedSegments.length <= 3) {
        const nominalIdx = stackedSegments.findIndex(s => /^Ø?[0-9]*\.?[0-9]+$/.test(s) && !isDeviationSeg(s));
        const deviationSegs = stackedSegments.filter((_, idx) => idx !== nominalIdx);
        if (nominalIdx >= 0 && deviationSegs.length >= 1 && deviationSegs.every(isDeviationSeg)) {
          const isDiameter = stackedSegments[nominalIdx].includes('Ø');
          const nominal = parseFloat(stackedSegments[nominalIdx].replace('Ø', ''));
          const devVals = deviationSegs.map(s => parseFloat(s));
          const upper = Math.max(0, ...devVals);
          const lower = Math.min(0, ...devVals);
          return {
            rawText: text,
            nominal,
            upperTol: upper,
            lowerTol: Math.abs(lower),
            minLimit: parseFloat((nominal + lower).toFixed(5)),
            maxLimit: parseFloat((nominal + upper).toFixed(5)),
            type: isDiameter ? 'diameter' : this.inferType(cleanText),
            enclosure: 'limit',
            isToleranceInherited: false,
            toleranceSource: `ISO 286 Stacked Limit Deviation (+${upper}/${lower})`,
            units: preset.unit,
            multiplier,
            fractionStr,
            holeCallout
          };
        }
      }
    }

    // 11. Check for Asymmetric / Unilateral Tolerance (e.g. "+0.010 / -0.000" or "+0.005 / -0.002")
    const asymMatch = textToParse.match(/([0-9]*\.?[0-9]+)\s*\+\s*([0-9]*\.?[0-9]+)\s*(?:\/|\s+)\s*-?\s*([0-9]*\.?[0-9]+)/i);
    if (asymMatch) {
      const nominal = parseFloat(asymMatch[1]);
      const upper = parseFloat(asymMatch[2]);
      const lower = parseFloat(asymMatch[3]);
      const maxLimit = parseFloat((nominal + upper).toFixed(5));
      const minLimit = parseFloat((nominal - lower).toFixed(5));
      const isUnilateral = upper === 0 || lower === 0;
      return {
        rawText: text,
        nominal: Number.isNaN(nominal) ? null : nominal,
        upperTol: upper,
        lowerTol: lower,
        minLimit,
        maxLimit,
        type: this.inferType(cleanText),
        enclosure: 'standard',
        isToleranceInherited: false,
        toleranceSource: isUnilateral ? `Unilateral (+${upper}/-${lower})` : `Explicit (+${upper}/-${lower})`,
        units: preset.unit,
        multiplier,
        fractionStr,
        isUnilateral,
        holeCallout
      };
    }

    // 12. Check for Explicit Bilateral / Plus-Minus (e.g. "DIA 2.500 +/- 0.005", "4.500 ± .010")
    const pmMatch = textToParse.match(/([0-9]*\.?[0-9]+)\s*(?:±|\+\/-)\s*([0-9]*\.?[0-9]+)/i);
    if (pmMatch) {
      const nominal = parseFloat(pmMatch[1]);
      const tolVal = parseFloat(pmMatch[2]);
      return {
        rawText: text,
        nominal: Number.isNaN(nominal) ? null : nominal,
        upperTol: tolVal,
        lowerTol: tolVal,
        minLimit: parseFloat((nominal - tolVal).toFixed(5)),
        maxLimit: parseFloat((nominal + tolVal).toFixed(5)),
        type: this.inferType(cleanText),
        enclosure: 'standard',
        isToleranceInherited: false,
        toleranceSource: `Explicit (±${tolVal})`,
        units: cleanText.includes('°') ? 'deg' : preset.unit,
        multiplier,
        fractionStr,
        holeCallout
      };
    }

    // 13. Check for Limit Dimensions (e.g. "1.505 / 1.495" or "1.250 - 1.255")
    const limitMatch = textToParse.match(/^([0-9]*\.?[0-9]+)\s*[/|-]\s*([0-9]*\.?[0-9]+)$/);
    if (limitMatch) {
      const val1 = parseFloat(limitMatch[1]);
      const val2 = parseFloat(limitMatch[2]);
      if (!Number.isNaN(val1) && !Number.isNaN(val2)) {
        const maxVal = Math.max(val1, val2);
        const minVal = Math.min(val1, val2);
        const nominal = parseFloat(((maxVal + minVal) / 2).toFixed(5));
        const upper = parseFloat((maxVal - nominal).toFixed(5));
        const lower = parseFloat((nominal - minVal).toFixed(5));
        return {
          rawText: text,
          nominal,
          upperTol: upper,
          lowerTol: lower,
          minLimit: minVal,
          maxLimit: maxVal,
          type: this.inferType(cleanText),
          enclosure: 'limit',
          isToleranceInherited: false,
          toleranceSource: 'Explicit Limit Dimension',
          units: preset.unit,
          multiplier,
          fractionStr,
          holeCallout
        };
      }
    }

    // 14. Fallback: Untoleranced Dimension -> Resolve via Title Block Precision Matrix
    // First, verify this is not prose or instructional text
    if (GdtParser.isProseOrInstructionalText(cleanText) || GdtParser.isProseOrInstructionalText(textToParse)) {
      return {
        rawText: text,
        nominal: null,
        upperTol: 0,
        lowerTol: 0,
        minLimit: null,
        maxLimit: null,
        type: 'linear',
        enclosure: 'standard',
        isToleranceInherited: false,
        toleranceSource: 'Prose Text / Non-Callout (Excluded)',
        units: preset.unit,
        multiplier
      };
    }

    // Second: Residual Word Validation
    // Strip numbers, decimals, fractions, standard drafting symbols, and whitelisted CAD keywords
    const strippedResidual = textToParse
      .replace(/(?:\d+\.?\d*|\.\d+)/g, '')
      .replace(/\b(?:TYP|TYPICAL|MAX|MIN|REF|REFERENCE|THRU|THROUGH|DP|DEPTH|BORE|CBORE|COUNTERBORE|CSINK|COUNTERSINK|CHAMFER|CHAM|PLCS|PLACES|DIA|DIAMETER|RAD|RADIUS|DEG|IN|MM|UNF|UNC|UNEF|NPT|METRIC|THREAD|THD|GA|GAGE|GAUGE|SQ|SQUARE|BASIC|TRUE|POS|SURF|PCD|BCD|STOCK|WALL|FLAT|OD|ID|PITCH|LEAD|SLOT|KEYWAY|DRILL|TAP|REAM)\b/gi, '')
      .replace(/[()[\]{}/\\:;,\-_+=*#°Ø±↧⌴⌵"'`~!?<>@$%^&]/g, '')
      .trim();

    // If there are lingering alphabetic words (length >= 3), this is descriptive sentence text, not a dimension
    const residualWords = strippedResidual.match(/[a-zA-Z]{3,}/g) || [];
    if (residualWords.length > 0) {
      return {
        rawText: text,
        nominal: null,
        upperTol: 0,
        lowerTol: 0,
        minLimit: null,
        maxLimit: null,
        type: 'linear',
        enclosure: 'standard',
        isToleranceInherited: false,
        toleranceSource: 'Non-Callout Text (Excluded)',
        units: preset.unit,
        multiplier
      };
    }

    // Leading "-?" so a bare negative dimension (e.g. "-0.1", a permissible edge-break/deviation
    // value) keeps its sign through to calculateLimits below. Without it, "-0.1" matched as just
    // "0.1" and a title-block ±0.1 tolerance then produced [0, 0.2] instead of the correct
    // [-0.2, 0] — calculateLimits itself is sign-correct; the nominal fed into it was not.
    const numMatch = textToParse.match(/-?(?:\d+\.?\d*|\.\d+)/);
    const nominal = numMatch ? parseFloat(numMatch[0]) : null;
    if (nominal === null || isNaN(nominal)) {
      return {
        rawText: text,
        nominal: null,
        upperTol: 0,
        lowerTol: 0,
        minLimit: null,
        maxLimit: null,
        type: 'linear',
        enclosure: 'standard',
        isToleranceInherited: false,
        toleranceSource: 'Invalid Nominal',
        units: preset.unit,
        multiplier
      };
    }

    const isAngular = numMatch ? GdtParser.isPrimaryNumberAngular(cleanText, numMatch[0]) : false;
    const tol = numMatch 
      ? ToleranceEngine.resolveTitleBlockTolerance(numMatch[0], isAngular, preset)
      : { upperTol: preset.threeDecimals, lowerTol: preset.threeDecimals, source: 'Default Standard' };
    
    const limits = ToleranceEngine.calculateLimits(nominal, tol.upperTol, tol.lowerTol);

    return {
      rawText: text,
      nominal,
      upperTol: tol.upperTol,
      lowerTol: tol.lowerTol,
      minLimit: limits.minLimit,
      maxLimit: limits.maxLimit,
      type: isAngular ? 'angle' : this.inferType(cleanText),
      enclosure: 'standard',
      isToleranceInherited: true,
      toleranceSource: tol.source,
      units: isAngular ? 'deg' : preset.unit,
      multiplier,
      fractionStr,
      holeCallout
    };
  }

  private static isBasicDimension(text: string): boolean {
    return /^\[\s*.*?\s*\]$/.test(text);
  }

  private static isReferenceDimension(text: string): boolean {
    return /^\(\s*.*?\s*\)$/.test(text);
  }

  private static isGdtFrame(text: string): boolean {
    const gdtSymbols = [
      '⌖', '⏥', '—', '○', '⌭', '⟂', '∥', '∠', '⌒', '⌓', '↗', '⌰', '◎', '⌯',
      'POS', 'FLAT', 'PERP', 'PARALLEL', 'RUNOUT', 'PROFILE', 'TRUE POS'
    ];
    return gdtSymbols.some(sym => text.includes(sym)) && text.includes('|');
  }

  /**
   * Deconstructs ANSI/ASME hole features: depth (↧), counterbore (⌴), countersink (⌵)
   */
  private static parseHoleCallout(text: string): HoleFeatureCallout | undefined {
    const hasDepth = text.includes('↧') || /\b(?:DEPTH|DP)\b/i.test(text);
    const hasCbore = text.includes('⌴') || /\bC'?BORE\b/i.test(text);
    const hasCsink = text.includes('⌵') || /\bC'?SINK\b/i.test(text);
    const isThru = /\bTHRU\b/i.test(text);

    if (!hasDepth && !hasCbore && !hasCsink && !isThru) {
      return undefined;
    }

    let holeType: 'thru' | 'blind' | 'counterbore' | 'countersink' = isThru ? 'thru' : 'blind';
    if (hasCbore) holeType = 'counterbore';
    else if (hasCsink) holeType = 'countersink';

    let depth: number | undefined;
    const depthMatch = text.match(/(?:↧|DEPTH|DP)\s*([0-9]*\.?[0-9]+)/i);
    if (depthMatch) depth = parseFloat(depthMatch[1]);

    let cboreDia: number | undefined;
    let cboreDepth: number | undefined;
    if (hasCbore) {
      const cbMatch = text.match(/(?:⌴|C'?BORE)\s*(?:Ø|DIA)?\s*([0-9]*\.?[0-9]+)(?:\s*(?:↧|DEPTH|DP)\s*([0-9]*\.?[0-9]+))?/i);
      if (cbMatch) {
        cboreDia = parseFloat(cbMatch[1]);
        if (cbMatch[2]) cboreDepth = parseFloat(cbMatch[2]);
      }
    }

    let csinkDia: number | undefined;
    let csinkAngle: number | undefined;
    if (hasCsink) {
      const csMatch = text.match(/(?:⌵|C'?SINK)\s*(?:Ø|DIA)?\s*([0-9]*\.?[0-9]+)(?:\s*[xX]\s*([0-9]+)°)?/i);
      if (csMatch) {
        csinkDia = parseFloat(csMatch[1]);
        if (csMatch[2]) csinkAngle = parseInt(csMatch[2], 10);
      }
    }

    return {
      holeType,
      depth,
      counterboreDia: cboreDia,
      counterboreDepth: cboreDepth,
      countersinkDia: csinkDia,
      countersinkAngle: csinkAngle,
      rawCallout: text
    };
  }

  /**
   * Strictly determines whether the primary nominal being measured is an angular value.
   * Prevents compound hole callouts containing a trailing countersink angle (e.g. "Ø12 ... 90°")
   * from corrupting the primary drill diameter into degrees.
   */
  public static isPrimaryNumberAngular(text: string, numStr: string): boolean {
    const trimmed = text.trim();
    // If text starts with or clearly indicates diameter, radius, or thread, it is NEVER an angle
    if (
      /^(?:Ø|ø|P\s*\d|DIA|DIAMETER|R|RAD|RADIUS|M\d|1\/\d)\b/i.test(trimmed) || 
      trimmed.startsWith('Ø') || 
      trimmed.startsWith('ø') ||
      (trimmed.startsWith('P') && /^[P\s]*\d/.test(trimmed))
    ) {
      return false;
    }
    // Check if the primary number is immediately accompanied by degree symbol or deg
    const escaped = numStr.replace('.', '\\.');
    const directAnglePattern = new RegExp(`(?:^|\\s)${escaped}\\s*(?:°|c|deg\\b|degrees\\b)`, 'i');
    if (directAnglePattern.test(trimmed)) {
      return true;
    }
    // Check if entire text is a simple angle (e.g. "120°", "2.5°", "45 deg", "120c")
    if (/^[0-9.]+\s*(?:°|c|\bdeg\b)/i.test(trimmed)) {
      return true;
    }
    return false;
  }

  /**
   * Deconstructs multi-feature compound callouts (counterbores, countersinks, drill depths,
   * threads + spotfaces) into individual inspectable sub-characteristics per AS9102 Form 3.
   */
  public static deconstructCompoundCallout(
    rawText: string,
    preset: TitleBlockTolerancePreset
  ): DeconstructedSubFeature[] | null {
    const text = rawText.trim();

    const hasAngle = /(?:°|c|\bdeg\b)/i.test(text) && /[xX×]\s*[0-9]+(?:°|c|deg)/i.test(text);
    const hasCsink = /[⌵Y⩡]/.test(text) || /\b(?:C'?SINK|COUNTERSINK)\b/i.test(text) || hasAngle || text.includes('90°') || text.includes('90c');
    const hasCbore = (/[⌴]/.test(text) || /\b(?:C'?BORE|COUNTERBORE)\b/i.test(text) || /(?:^|\s)X\s*(?:Ø|P|[0-9])/i.test(text)) && !hasAngle;
    const hasDepth = /[↧Z]/.test(text) || /\b(?:DEPTH|DP)\b/i.test(text);

    let multiplier = 1;
    const plcsMatch = text.match(/(\d+)\s*(?:PLCS|PLACES)\b/i) || text.match(/^(\d+)\s*[xX]\s+/);
    if (plcsMatch) {
      multiplier = parseInt(plcsMatch[1], 10);
    }

    // CASE 1: Compound Drill + Depth + Countersink (e.g. "Ø12 ↧ 55.73 / ⩡ Ø25 X 90°" or "Ø12 ↧ 55.73 / ⌵ Ø25 X 90c")
    if (hasCsink && hasDepth && !text.includes('UNC') && !text.includes('UNF')) {
      const subFeatures: DeconstructedSubFeature[] = [];

      // 1. Drill Diameter
      const drillMatch = text.match(/^(?:Ø|P)?\s*([0-9]*\.?[0-9]+)/i);
      if (drillMatch) {
        const nom = parseFloat(drillMatch[1]);
        const tol = ToleranceEngine.resolveTitleBlockTolerance(drillMatch[1], false, preset);
        const limits = ToleranceEngine.calculateLimits(nom, tol.upperTol, tol.lowerTol);
        subFeatures.push({
          subNumberSuffix: '1',
          displayRequirement: `Ø${drillMatch[1]}`,
          nominal: nom,
          upperTol: tol.upperTol,
          lowerTol: tol.lowerTol,
          plusTol: tol.upperTol,
          minusTol: -tol.lowerTol,
          minLimit: limits.minLimit,
          maxLimit: limits.maxLimit,
          upperLimit: limits.maxLimit,
          lowerLimit: limits.minLimit,
          units: preset.unit,
          type: 'diameter',
          subType: 'Diameter (Drill)',
          classification: 'Critical',
          inspectionMethod: 'Bore Gage',
          quantity: multiplier,
          isSecondarySub: false
        });
      }

      // 2. Drill Depth
      const depthMatch = text.match(/(?:↧|Z|DEPTH|DP)\s*([0-9]*\.?[0-9]+)/i);
      if (depthMatch) {
        const nom = parseFloat(depthMatch[1]);
        const tol = ToleranceEngine.resolveTitleBlockTolerance(depthMatch[1], false, preset);
        const limits = ToleranceEngine.calculateLimits(nom, tol.upperTol, tol.lowerTol);
        subFeatures.push({
          subNumberSuffix: '2',
          displayRequirement: `↧ ${depthMatch[1]}`,
          nominal: nom,
          upperTol: tol.upperTol,
          lowerTol: tol.lowerTol,
          plusTol: tol.upperTol,
          minusTol: -tol.lowerTol,
          minLimit: limits.minLimit,
          maxLimit: limits.maxLimit,
          upperLimit: limits.maxLimit,
          lowerLimit: limits.minLimit,
          units: preset.unit,
          type: 'linear',
          subType: 'Linear Dimension (Hole Depth)',
          classification: 'Major',
          inspectionMethod: 'Caliper',
          quantity: multiplier,
          isSecondarySub: true
        });
      }

      // 3. Countersink Diameter
      const csinkDiaMatch = text.match(/(?:⌵|Y|⩡|CSINK|COUNTERSINK|\/)?\s*(?:Ø|P)?\s*([0-9]*\.?[0-9]+)\s*[xX]\s*[0-9]+(?:°|c|deg)/i) ||
                            text.match(/(?:⌵|Y|⩡)\s*(?:Ø|P)?\s*([0-9]*\.?[0-9]+)/i);
      if (csinkDiaMatch) {
        const nom = parseFloat(csinkDiaMatch[1]);
        const tol = ToleranceEngine.resolveTitleBlockTolerance(csinkDiaMatch[1], false, preset);
        const limits = ToleranceEngine.calculateLimits(nom, tol.upperTol, tol.lowerTol);
        subFeatures.push({
          subNumberSuffix: '3',
          displayRequirement: `⩡ Ø${csinkDiaMatch[1]}`,
          nominal: nom,
          upperTol: tol.upperTol,
          lowerTol: tol.lowerTol,
          plusTol: tol.upperTol,
          minusTol: -tol.lowerTol,
          minLimit: limits.minLimit,
          maxLimit: limits.maxLimit,
          upperLimit: limits.maxLimit,
          lowerLimit: limits.minLimit,
          units: preset.unit,
          type: 'diameter',
          subType: 'Diameter (Countersink)',
          classification: 'Major',
          inspectionMethod: 'Optical Comparator',
          quantity: multiplier,
          isSecondarySub: true
        });
      }

      // 4. Countersink Angle
      const csinkAngleMatch = text.match(/[xX]\s*([0-9]+(?:\.[0-9]+)?)\s*(?:°|c|deg|\b)/i);
      if (csinkAngleMatch) {
        const angNumStr = csinkAngleMatch[1].replace(/[^0-9.]/g, '');
        const nom = parseFloat(angNumStr);
        const tol = ToleranceEngine.resolveTitleBlockTolerance(angNumStr, true, preset);
        const limits = ToleranceEngine.calculateLimits(nom, tol.upperTol, tol.lowerTol);
        subFeatures.push({
          subNumberSuffix: '4',
          displayRequirement: `${nom}°`,
          nominal: nom,
          upperTol: tol.upperTol,
          lowerTol: tol.lowerTol,
          plusTol: tol.upperTol,
          minusTol: -tol.lowerTol,
          minLimit: limits.minLimit,
          maxLimit: limits.maxLimit,
          upperLimit: limits.maxLimit,
          lowerLimit: limits.minLimit,
          units: 'deg',
          type: 'angle',
          subType: 'Angular Dimension (C-Sink Angle)',
          classification: 'Major',
          inspectionMethod: 'Optical Comparator',
          quantity: multiplier,
          isSecondarySub: true
        });
      }

      if (subFeatures.length > 1) {
        return subFeatures;
      }
    }

    // CASE 2: Compound Counterbore Hole (e.g. "Ø50 THRU / ⌴ Ø70 ↧ 12" or "Ø50 THRU ⌴ Ø70 ↧ 12")
    if (hasCbore && hasDepth && !hasCsink && !text.includes('UNC') && !text.includes('UNF')) {
      const subFeatures: DeconstructedSubFeature[] = [];

      // 1. Hole Diameter
      const mainDiaMatch = text.match(/^(?:Ø|P)?\s*([0-9]*\.?[0-9]+)/i);
      if (mainDiaMatch) {
        const nom = parseFloat(mainDiaMatch[1]);
        const tol = ToleranceEngine.resolveTitleBlockTolerance(mainDiaMatch[1], false, preset);
        const limits = ToleranceEngine.calculateLimits(nom, tol.upperTol, tol.lowerTol);
        subFeatures.push({
          subNumberSuffix: '1',
          displayRequirement: `Ø${mainDiaMatch[1]}${text.toUpperCase().includes('THRU') ? ' THRU' : ''}`,
          nominal: nom,
          upperTol: tol.upperTol,
          lowerTol: tol.lowerTol,
          plusTol: tol.upperTol,
          minusTol: -tol.lowerTol,
          minLimit: limits.minLimit,
          maxLimit: limits.maxLimit,
          upperLimit: limits.maxLimit,
          lowerLimit: limits.minLimit,
          units: preset.unit,
          type: 'diameter',
          subType: 'Diameter (Thru Hole)',
          classification: 'Critical',
          inspectionMethod: 'Bore Gage',
          quantity: multiplier,
          isSecondarySub: false
        });
      }

      // 2. Counterbore Diameter
      const cboreMatch = text.match(/(?:⌴|CBORE|COUNTERBORE|\bX\b)\s*(?:Ø|P)?\s*([0-9]*\.?[0-9]+)/i);
      if (cboreMatch) {
        const nom = parseFloat(cboreMatch[1]);
        const tol = ToleranceEngine.resolveTitleBlockTolerance(cboreMatch[1], false, preset);
        const limits = ToleranceEngine.calculateLimits(nom, tol.upperTol, tol.lowerTol);
        subFeatures.push({
          subNumberSuffix: '2',
          displayRequirement: `⌴ Ø${cboreMatch[1]}`,
          nominal: nom,
          upperTol: tol.upperTol,
          lowerTol: tol.lowerTol,
          plusTol: tol.upperTol,
          minusTol: -tol.lowerTol,
          minLimit: limits.minLimit,
          maxLimit: limits.maxLimit,
          upperLimit: limits.maxLimit,
          lowerLimit: limits.minLimit,
          units: preset.unit,
          type: 'diameter',
          subType: 'Diameter (Counterbore)',
          classification: 'Major',
          inspectionMethod: 'Caliper',
          quantity: multiplier,
          isSecondarySub: true
        });
      }

      // 3. Counterbore Depth
      const depthMatch = text.match(/(?:↧|Z|DEPTH|DP)\s*([0-9]*\.?[0-9]+)/i);
      if (depthMatch) {
        const nom = parseFloat(depthMatch[1]);
        const tol = ToleranceEngine.resolveTitleBlockTolerance(depthMatch[1], false, preset);
        const limits = ToleranceEngine.calculateLimits(nom, tol.upperTol, tol.lowerTol);
        subFeatures.push({
          subNumberSuffix: '3',
          displayRequirement: `↧ ${depthMatch[1]}`,
          nominal: nom,
          upperTol: tol.upperTol,
          lowerTol: tol.lowerTol,
          plusTol: tol.upperTol,
          minusTol: -tol.lowerTol,
          minLimit: limits.minLimit,
          maxLimit: limits.maxLimit,
          upperLimit: limits.maxLimit,
          lowerLimit: limits.minLimit,
          units: preset.unit,
          type: 'linear',
          subType: 'Linear Dimension (C-Bore Depth)',
          classification: 'Major',
          inspectionMethod: 'Caliper',
          quantity: multiplier,
          isSecondarySub: true
        });
      }

      if (subFeatures.length > 1) {
        return subFeatures;
      }
    }

    // CASE 3: Thread with Counterbore/Spotface & Multi-Place (e.g. "1/2-13 UNC - 2B / ⌴ Ø22 ↧ 5 / 3 PLCS")
    if (text.includes('UNC') || text.includes('UNF') || text.includes('UNEF') || /M\d+\s*x\s*[0-9.]+/i.test(text)) {
      const subFeatures: DeconstructedSubFeature[] = [];

      // 1. Thread Callout
      const threadMatch = text.match(/(?:[0-9/.]+(?:-[0-9]+)?\s*(?:UNC|UNF|UNEF)(?:\s*-\s*[1-3][AB])?|M\d+(?:\s*[xX]\s*[0-9.]+)?(?:\s*-\s*\d[HhGg])?)/i);
      if (threadMatch) {
        const thdStr = threadMatch[0];
        let nom = 0.5;
        if (thdStr.startsWith('1/2')) nom = 0.5;
        else if (thdStr.startsWith('1/4')) nom = 0.25;
        else if (thdStr.startsWith('3/8')) nom = 0.375;
        else if (thdStr.startsWith('5/8')) nom = 0.625;
        else if (thdStr.startsWith('3/4')) nom = 0.75;
        else {
          const mMatch = thdStr.match(/M(\d+)/i);
          if (mMatch) nom = parseFloat(mMatch[1]);
        }

        subFeatures.push({
          subNumberSuffix: '1',
          displayRequirement: `${thdStr}${multiplier > 1 ? ` (${multiplier} PLCS)` : ''}`,
          nominal: nom,
          upperTol: 0.005,
          lowerTol: 0.005,
          plusTol: 0.005,
          minusTol: -0.005,
          minLimit: nom - 0.005,
          maxLimit: nom + 0.005,
          upperLimit: nom + 0.005,
          lowerLimit: nom - 0.005,
          units: thdStr.toUpperCase().includes('M') ? 'mm' : 'in',
          type: 'thread',
          subType: 'Thread / Fastener',
          classification: 'Critical',
          inspectionMethod: 'Thread Gage',
          quantity: multiplier,
          isSecondarySub: false
        });
      }

      // 2. Spotface / Counterbore Diameter.
      // The bare "X" alternative must not match the "X" inside a metric thread's own pitch
      // notation (e.g. "M6X1" — diameter 6, pitch 1, no counterbore at all): without the
      // lookbehind, this matched that same "X" and misread the pitch digit as a fabricated
      // counterbore diameter, inventing a second sub-feature that doesn't exist on the drawing.
      const cboreMatch = text.match(/(?:⌴|CBORE|COUNTERBORE|(?<!\d)X)\s*(?:Ø|P)?\s*([0-9]*\.?[0-9]+)/i);
      if (cboreMatch) {
        const nom = parseFloat(cboreMatch[1]);
        const tol = ToleranceEngine.resolveTitleBlockTolerance(cboreMatch[1], false, preset);
        const limits = ToleranceEngine.calculateLimits(nom, tol.upperTol, tol.lowerTol);
        subFeatures.push({
          subNumberSuffix: '2',
          displayRequirement: `⌴ Ø${cboreMatch[1]}`,
          nominal: nom,
          upperTol: tol.upperTol,
          lowerTol: tol.lowerTol,
          plusTol: tol.upperTol,
          minusTol: -tol.lowerTol,
          minLimit: limits.minLimit,
          maxLimit: limits.maxLimit,
          upperLimit: limits.maxLimit,
          lowerLimit: limits.minLimit,
          units: preset.unit,
          type: 'diameter',
          subType: 'Diameter (Spotface/C-Bore)',
          classification: 'Major',
          inspectionMethod: 'Caliper',
          quantity: multiplier,
          isSecondarySub: true
        });
      }

      // 3. Counterbore / Spotface Depth
      const depthMatch = text.match(/(?:↧|Z|DEPTH|DP)\s*([0-9]*\.?[0-9]+)/i);
      if (depthMatch) {
        const nom = parseFloat(depthMatch[1]);
        const tol = ToleranceEngine.resolveTitleBlockTolerance(depthMatch[1], false, preset);
        const limits = ToleranceEngine.calculateLimits(nom, tol.upperTol, tol.lowerTol);
        subFeatures.push({
          subNumberSuffix: '3',
          displayRequirement: `↧ ${depthMatch[1]}`,
          nominal: nom,
          upperTol: tol.upperTol,
          lowerTol: tol.lowerTol,
          plusTol: tol.upperTol,
          minusTol: -tol.lowerTol,
          minLimit: limits.minLimit,
          maxLimit: limits.maxLimit,
          upperLimit: limits.maxLimit,
          lowerLimit: limits.minLimit,
          units: preset.unit,
          type: 'linear',
          subType: 'Linear Dimension (Depth)',
          classification: 'Major',
          inspectionMethod: 'Caliper',
          quantity: multiplier,
          isSecondarySub: true
        });
      }

      if (subFeatures.length > 1) {
        return subFeatures;
      }
    }

    return null;
  }

  /**
   * Recognizes a GD&T feature-control-frame rendered as space-separated tokens instead of the
   * usual "|"-delimited compartments (see the call site comment for why). Matched strictly by
   * ASME Y14.5 datum-reference STRUCTURE — leading symbol, optional diameter-zone marker,
   * decimal tolerance, then 1-3 datum references — never by guessing what the symbol means, so
   * this can't misfire on an ordinary dimension or note string. The leading symbol token is
   * required to be lowercase (or an already-recognized GD&T unicode glyph): real ASME Y14.5
   * datum letters are always uppercase, so a lowercase token in that position is structurally
   * never a datum — it's always this font's substitute for the real symbol glyph — which keeps
   * this from colliding with an unrelated "LETTER number LETTER" sequence elsewhere.
   */
  private static parseSpaceDelimitedFrame(
    text: string
  ): { symbol: string; hasDiameter: boolean; tolerance: number; datums: string[] } | null {
    const tokens = text.trim().split(/\s+/);
    if (tokens.length < 3 || tokens.length > 6) return null;

    let idx = 0;
    const symbol = tokens[idx];
    if (!/^(?:[a-z]{1,3}|[⌖⏥—○⌭⟂∥∠⌒⌓↗⌰◎⌯])$/.test(symbol)) return null;
    idx++;

    let hasDiameter = false;
    // 'O' is the same class of verified symbol-font substitution as SYMBOL_FONT_GLYPH_REGISTRY
    // above, for the diameter-modifier glyph specifically: confirmed against CINH91CDB11-B.pdf
    // that "SolidEdgeANSI1Symbols" draws the in-frame ⌀ modifier at the plain letter "O" (code
    // point 0x4F), immediately following the frame's leading symbol token. Kept as a dedicated
    // check here (rather than folded into the registry) because it is positional — only the
    // SECOND token of an already-structurally-confirmed frame — not a standalone symbol lookup.
    if (tokens[idx] === 'O' || tokens[idx] === 'Ø') {
      hasDiameter = true;
      idx++;
    }

    const tolToken = tokens[idx];
    if (!tolToken || !/^\d+(?:\.\d+)?$/.test(tolToken)) return null;
    const tolerance = parseFloat(tolToken);
    idx++;

    const datums: string[] = [];
    for (; idx < tokens.length; idx++) {
      if (!/^[A-Z](-[A-Z])?$/.test(tokens[idx])) return null;
      datums.push(tokens[idx]);
    }
    if (datums.length === 0 || datums.length > 3) return null;

    return { symbol, hasDiameter, tolerance, datums };
  }

  private static buildSpaceDelimitedFrameResult(
    fullText: string,
    parsed: { symbol: string; hasDiameter: boolean; tolerance: number; datums: string[] },
    multiplier: number,
    unit: 'in' | 'mm'
  ): ParsedDimensionResult {
    const charSymbol = this.normalizeGdtSymbol(parsed.symbol);
    const characteristic = this.mapGdtSymbolToType(charSymbol);
    const toDatum = (letter?: string) => (letter ? { datum: letter } : undefined);

    const gdtFrame: GdtFeatureControlFrame = {
      characteristic,
      symbol: charSymbol,
      toleranceValue: parsed.tolerance,
      diameterSymbol: parsed.hasDiameter,
      primaryDatum: toDatum(parsed.datums[0]),
      secondaryDatum: toDatum(parsed.datums[1]),
      tertiaryDatum: toDatum(parsed.datums[2]),
      rawText: fullText
    };

    return {
      rawText: fullText,
      nominal: 0.0,
      upperTol: parsed.tolerance,
      lowerTol: 0.0,
      minLimit: 0.0,
      maxLimit: parsed.tolerance,
      type: 'gdt',
      enclosure: 'standard',
      isToleranceInherited: false,
      toleranceSource: characteristic === 'unknown'
        ? `GD&T frame, symbol not recognized (raw glyph "${parsed.symbol}") — tolerance ${parsed.tolerance} to datum(s) ${parsed.datums.join(', ')}; verify characteristic type manually`
        : `ASME Y14.5 GD&T Frame — ${this.getCharacteristicLabel(characteristic)} (${charSymbol}), ${parsed.tolerance}`,
      units: unit,
      gdtFrame,
      multiplier
    };
  }

  /**
   * Deconstructs single-tier and composite dual-tier ASME Y14.5 Feature Control Frames.
   */
  private static parseFeatureControlFrame(
    fullText: string,
    cleanText: string, 
    multiplier: number,
    unit: 'in' | 'mm'
  ): ParsedDimensionResult {
    // Check if there are multiple tiers (separated by '/' or newline)
    const tiers = cleanText.split(/\s*\/\s*|\n/).filter(t => t.includes('|'));
    const upperTierText = tiers[0] || cleanText;
    const lowerTierText = tiers[1];

    const parseSingleTier = (tierStr: string) => {
      const segments = tierStr.split('|').map(s => s.trim()).filter(Boolean);
      const symbolRaw = segments[0] || '⌖';
      const tolSegment = segments[1] || '0.010';
      
      const charSymbol = this.normalizeGdtSymbol(symbolRaw);
      const tolValueMatch = tolSegment.match(/([0-9.]+)/);
      const tolVal = tolValueMatch ? parseFloat(tolValueMatch[1]) : 0.010;
      const hasDia = tolSegment.includes('Ø') || tolSegment.includes('DIA');
      
      let matModifier: 'MMC' | 'LMC' | 'RFS' | undefined;
      if (tolSegment.includes('Ⓜ') || tolSegment.includes('(M)') || tolSegment.includes('MMC')) matModifier = 'MMC';
      if (tolSegment.includes('Ⓛ') || tolSegment.includes('(L)') || tolSegment.includes('LMC')) matModifier = 'LMC';

      const parseDatum = (seg?: string) => {
        if (!seg) return undefined;
        const letterMatch = seg.match(/([A-Z](?:-[A-Z])?)/);
        if (!letterMatch) return undefined;
        let mod: 'MMC' | 'LMC' | 'RFS' | undefined;
        if (seg.includes('Ⓜ') || seg.includes('(M)')) mod = 'MMC';
        if (seg.includes('Ⓛ') || seg.includes('(L)')) mod = 'LMC';
        return { datum: letterMatch[1], modifier: mod };
      };

      return {
        characteristic: this.mapGdtSymbolToType(charSymbol),
        symbol: charSymbol,
        toleranceValue: tolVal,
        diameterSymbol: hasDia,
        materialModifier: matModifier,
        primaryDatum: parseDatum(segments[2]),
        secondaryDatum: parseDatum(segments[3]),
        tertiaryDatum: parseDatum(segments[4]),
        rawText: tierStr
      };
    };

    const upperTier = parseSingleTier(upperTierText);
    let compositeLowerTier: any = undefined;

    if (lowerTierText) {
      compositeLowerTier = parseSingleTier(lowerTierText);
    }

    const gdtFrame: GdtFeatureControlFrame = {
      ...upperTier,
      compositeLowerTier
    };

    return {
      rawText: fullText,
      nominal: 0.0,
      upperTol: upperTier.toleranceValue,
      lowerTol: 0.0,
      minLimit: 0.0,
      maxLimit: upperTier.toleranceValue,
      type: 'gdt',
      enclosure: 'standard',
      isToleranceInherited: false,
      toleranceSource: `ASME Y14.5 GD&T Frame — ${this.getCharacteristicLabel(upperTier.characteristic)} (${upperTier.symbol}), ${upperTier.toleranceValue}`,
      units: unit,
      gdtFrame,
      multiplier
    };
  }

  /**
   * Explicit, auditable table of verified CAD symbol-font glyph substitutions — PDFs exported
   * from CAD packages sometimes draw GD&T frame symbols using a dingbat font that maps its own
   * glyph shapes onto ordinary ASCII character codes rather than the real GD&T Unicode code
   * points, so the extracted text layer literally contains a plain letter instead of the GD&T
   * symbol that was actually drawn.
   *
   * Each entry here was added ONLY after being independently verified against a real customer
   * drawing — never guessed from a font name or vendor documentation (confirmed by research: no
   * publicly documented character-to-glyph table exists for these CAD dingbat fonts). An
   * unlisted glyph correctly falls through to 'unknown' + needs_review rather than being
   * guessed; see the per-entry verification note for how each one was confirmed.
   *
   * Why this is keyed by raw character alone, not by (font, character): pdf.js's public API
   * (page.getTextContent()) does not expose a CAD font's real PostScript/base name — only a
   * generic CSS fallback family ("sans-serif") — and the one API that does
   * (page.commonObjs.get(fontId)) only resolves AFTER a canvas render pass, which is
   * browser/Electron-only and not available at text-extraction time. Collision risk from this is
   * mitigated structurally instead: normalizeGdtSymbol is only ever reached with a bare 1-3 char
   * lowercase token after parseSpaceDelimitedFrame has already matched the full, specific
   * feature-control-frame shape (symbol + optional diameter modifier + tolerance number + 1-3
   * uppercase datum letters) — a shape ordinary prose or a real datum reference cannot produce.
   */
  private static readonly SYMBOL_FONT_GLYPH_REGISTRY: ReadonlyMap<string, { symbol: string; characteristic: string; verifiedAgainst: string }> = new Map([
    ['l', {
      symbol: '⌖',
      characteristic: 'Position',
      verifiedAgainst: 'CINH91CDB11-B.pdf — font "SolidEdgeANSI1Symbols" (confirmed via the PDF\'s embedded font dictionary, not pdf.js), cross-referenced against the rendered Position frames at that exact glyph position, and against the embedded font\'s own extracted cmap (code point 0x6C -> this glyph).'
    }],
    ['h', {
      symbol: '⌓',
      characteristic: 'Profile of a Line',
      verifiedAgainst: 'CINH91CDB11-B.pdf — font "SolidEdgeANSI1Symbols" (same verification method as "l"), cross-referenced against the rendered Profile-of-a-Line frames (the sheared/laser-cut edge callouts) at that exact glyph position, and against the embedded font\'s own extracted cmap (code point 0x68 -> this glyph).'
    }]
  ]);

  private static normalizeGdtSymbol(raw: string): string {
    const trimmedRaw = raw.trim();
    const registryHit = GdtParser.SYMBOL_FONT_GLYPH_REGISTRY.get(trimmedRaw);
    if (registryHit) return registryHit.symbol;

    const s = raw.toUpperCase();
    if (s.includes('⌖') || s.includes('POS')) return '⌖';
    if (s.includes('⏥') || s.includes('FLAT')) return '⏥';
    if (s.includes('—') || s.includes('STR')) return '—';
    if (s.includes('○') || s.includes('CIRC')) return '○';
    if (s.includes('⌭') || s.includes('CYL')) return '⌭';
    if (s.includes('⟂') || s.includes('PERP')) return '⟂';
    if (s.includes('∥') || s.includes('PARALLEL')) return '∥';
    if (s.includes('∠') || s.includes('ANG')) return '∠';
    if (s.includes('⌒') || s.includes('SURF') || s.includes('PROFILE') || s.includes('PROF')) return '⌒';
    if (s.includes('⌓') || s.includes('LINE')) return '⌓';
    if (s.includes('↗') || s.includes('CIRC RUNOUT')) return '↗';
    if (s.includes('⌰') || s.includes('RUNOUT')) return '⌰';
    if (s.includes('◎') || s.includes('CONC')) return '◎';
    if (s.includes('⌯') || s.includes('SYM')) return '⌯';
    return raw.trim() || '⌖';
  }

  private static mapGdtSymbolToType(symbol: string): GdtFeatureControlFrame['characteristic'] {
    switch (symbol) {
      case '⏥': return 'flatness';
      case '—': return 'straightness';
      case '○': return 'circularity';
      case '⌭': return 'cylindricity';
      case '⟂': return 'perpendicularity';
      case '∥': return 'parallelism';
      case '∠': return 'angularity';
      case '⌒': return 'profile_surface';
      case '⌓': return 'profile_line';
      case '↗': return 'circular_runout';
      case '⌰': return 'total_runout';
      case '◎': return 'concentricity';
      case '⌯': return 'symmetry';
      case '⌖': return 'position';
      default:
        // Never silently guess a specific GD&T characteristic for a symbol we didn't actually
        // recognize — see the 'unknown' doc comment on GdtFeatureControlFrame.characteristic.
        return 'unknown';
    }
  }

  /**
   * Plain-English name for a resolved GD&T characteristic — the single source of truth used
   * both for the Form 3 "Additional Data / Tolerance Source" text and for
   * DrawingExtractionService's displayed subType, so the two can never drift apart.
   *
   * Exists because the Unicode GD&T symbols themselves (⌖ U+2316, ⌓ U+2313, ⏥ U+26F6, etc.) sit
   * in the "Miscellaneous Technical" / "Miscellaneous Symbols" blocks, which Excel's default UI
   * fonts (Calibri/Segoe UI) do not fully cover — confirmed directly against a real exported
   * FAIR report: the symbol rendered as an unreadable "□" tofu box in Excel despite being the
   * correct character in the file. Embedding the symbol ALONE in the exported tolerance-source
   * string therefore made the GD&T type unreadable to anyone opening the report in Excel,
   * silently defeating the point of decoding it at all. The word is now always present; the
   * symbol is kept alongside it for tools/fonts that do render it.
   */
  public static getCharacteristicLabel(characteristic: GdtFeatureControlFrame['characteristic']): string {
    switch (characteristic) {
      case 'position': return 'Position';
      case 'flatness': return 'Flatness';
      case 'straightness': return 'Straightness';
      case 'circularity': return 'Circularity';
      case 'cylindricity': return 'Cylindricity';
      case 'perpendicularity': return 'Perpendicularity';
      case 'parallelism': return 'Parallelism';
      case 'angularity': return 'Angularity';
      case 'profile_surface': return 'Profile of a Surface';
      case 'profile_line': return 'Profile of a Line';
      case 'circular_runout': return 'Circular Runout';
      case 'total_runout': return 'Total Runout';
      case 'concentricity': return 'Concentricity';
      case 'symmetry': return 'Symmetry';
      case 'unknown': return 'Unrecognized GD&T Symbol — Verify Manually';
    }
  }

  private static inferType(text: string): CharacteristicType {
    const t = text.toUpperCase();
    if (t.includes('Ø') || t.includes('DIA') || /\bP\s*\d/.test(text)) return 'diameter';
    if ((t.startsWith('R') && !t.startsWith('REF') && !t.startsWith('RUNOUT')) || t.includes('RAD')) return 'radius';
    if (t.includes('CHAMFER') || ((t.includes('X') || t.includes('×')) && (t.includes('45°') || t.includes('45C') || t.includes('30°')))) return 'chamfer';
    if (t.includes('UNF') || t.includes('UNC') || t.includes('THD') || t.includes('THREAD')) return 'thread';
    if (t.includes('°') || t.includes('DEG') || /(?:^|\s)\d+(?:\.\d+)?c\b/i.test(text) || /\d+c\b/i.test(text)) return 'angle';
    return 'linear';
  }

  /**
   * Chamfer Callouts per ASME Y14.5 § 1.8.16.
   * Handles:
   *  - "3 X 45° CHAMFER", "3 X 45°", "3 X 45 CHAMFER", "3 x 45c"
   *  - "45° X 3", "45° X 3 CHAMFER"
   *  - "3 X 3 CHAMFER"
   *  - Multipliers: "4X 3 X 45° CHAMFER", "2X .060 X 45°", "3 X 45° (4 PLACES)"
   *  - Global notes: "ALL CHAMFERS = 0.5 X 45°"
   *  - Explicit tolerance: "3 ± 0.2 X 45°"
   */
  public static parseChamferCallout(
    text: string,
    preset: TitleBlockTolerancePreset
  ): ParsedDimensionResult | null {
    let clean = text
      .replace(/\s*\[\s*DIM\s*\d+\s*\]/gi, '')
      .replace(/\s*\[\s*FCF\s*\d+\s*\]/gi, '')
      .trim();

    // 1. Check for trailing places multiplier: e.g. "(4 PLACES)" or "4 PLACES"
    let multiplier = 1;
    const placesMatch = clean.match(/^(.*?)\s*\(?(\d+)\s*PLACES\)?$/i);
    if (placesMatch) {
      multiplier = parseInt(placesMatch[2], 10);
      clean = placesMatch[1].trim();
    }

    // 2. Check for leading multiplier prefix ONLY if followed by a full chamfer dimension:
    // e.g. "4X 3 X 45° CHAMFER" or "2X .060 X 45°" (must have at least two numbers and an 'X' in the remainder)
    const leadingMulMatch = clean.match(/^(\d+)\s*[xX]\s+([0-9]*\.?[0-9]+\s*[xX×].*)$/);
    if (leadingMulMatch) {
      const candidateRemainder = leadingMulMatch[2].trim();
      if (this.isChamferExpression(candidateRemainder)) {
        multiplier = parseInt(leadingMulMatch[1], 10);
        clean = candidateRemainder;
      }
    }

    // 3. Now check if clean is a chamfer expression
    if (!this.isChamferExpression(clean)) {
      return null;
    }

    // Strip leading "ALL CHAMFERS =" or "CHAMFER"
    let chamferBody = clean
      .replace(/^(?:ALL\s+)?CHAMFERS?\s*(?:=|\s)\s*/i, '')
      .replace(/^CHAMFER\s+/i, '')
      .trim();

    // Check for explicit tolerance on the depth, e.g. "3 ± 0.1 X 45°" or "0.5 +/- 0.05 X 45°"
    let explicitUpperTol: number | null = null;
    let explicitLowerTol: number | null = null;
    let explicitTolSource: string | null = null;

    const explicitTolMatch = chamferBody.match(/([0-9]*\.?[0-9]+)\s*(?:±|\+\/-)\s*([0-9]*\.?[0-9]+)/i);
    if (explicitTolMatch) {
      explicitUpperTol = parseFloat(explicitTolMatch[2]);
      explicitLowerTol = parseFloat(explicitTolMatch[2]);
      explicitTolSource = `Explicit (±${explicitTolMatch[2]})`;
      chamferBody = chamferBody.replace(/(?:±|\+\/-)\s*[0-9]*\.?[0-9]+/, '').trim();
    }

    // Pattern A: Depth X Angle (e.g. "3 X 45°", "3 X 45° CHAMFER", "3 X 45 CHAMFER", "3 X 45c", ".060 X 45°")
    const patternA = chamferBody.match(/^([0-9]*\.?[0-9]+)\s*(?:mm\s*)?[xX]\s*([0-9]+(?:\.[0-9]+)?)(?:°|c|deg|\b)(?:\s*(?:CHAMFER|CHAM))?$/i);

    // Pattern B: Angle X Depth (e.g. "45° X 3", "45° X 3 CHAMFER", "45c X .060")
    const patternB = chamferBody.match(/^([0-9]+(?:\.[0-9]+)?)(?:°|c|deg)\s*[xX]\s*([0-9]*\.?[0-9]+)(?:\s*(?:mm)?\s*(?:CHAMFER|CHAM))?$/i);

    // Pattern C: Two linear depths with CHAMFER keyword (e.g. "3 X 3 CHAMFER")
    const patternC = chamferBody.match(/^([0-9]*\.?[0-9]+)\s*(?:mm\s*)?[xX]\s*([0-9]*\.?[0-9]+)(?:\s*(?:mm)?\s*(?:CHAMFER|CHAM))$/i);

    // Pattern D: Bare ISO 13715 chamfer-leg symbol, no paired angle (e.g. "2c", "0.5C") — the
    // angle is simply never stated on the drawing for this form, so no angle sub-feature is
    // fabricated for it (angStr stays null below).
    const patternD = chamferBody.match(/^([0-9]*\.?[0-9]+)\s*[cC]$/);

    let nomStr = '';
    if (patternA) {
      nomStr = patternA[1];
    } else if (patternB) {
      nomStr = patternB[2];
    } else if (patternC) {
      nomStr = patternC[1];
    } else if (patternD) {
      nomStr = patternD[1];
    } else {
      return null;
    }

    const nom = parseFloat(nomStr);
    if (isNaN(nom)) return null;

    let upperTol: number;
    let lowerTol: number;
    let toleranceSource: string;
    let isToleranceInherited: boolean;

    if (explicitUpperTol !== null && explicitLowerTol !== null && explicitTolSource) {
      upperTol = explicitUpperTol;
      lowerTol = explicitLowerTol;
      toleranceSource = explicitTolSource;
      isToleranceInherited = false;
    } else {
      const tol = ToleranceEngine.resolveTitleBlockTolerance(nomStr, false, preset);
      upperTol = tol.upperTol;
      lowerTol = tol.lowerTol;
      toleranceSource = tol.source;
      isToleranceInherited = true;
    }

    const limits = ToleranceEngine.calculateLimits(nom, upperTol, lowerTol);

    const angStr = patternA ? patternA[2] : (patternB ? patternB[1] : null);
    const subFeatures: DeconstructedSubFeature[] = [
      {
        subNumberSuffix: '1',
        displayRequirement: `${nomStr} Chamfer Leg`,
        nominal: nom,
        upperTol,
        lowerTol,
        plusTol: upperTol,
        minusTol: -lowerTol,
        minLimit: limits.minLimit,
        maxLimit: limits.maxLimit,
        upperLimit: limits.maxLimit,
        lowerLimit: limits.minLimit,
        units: preset.unit,
        type: 'chamfer',
        subType: 'Chamfer',
        classification: 'Major',
        inspectionMethod: 'Optical Comparator',
        quantity: multiplier,
        isSecondarySub: false
      }
    ];

    if (angStr) {
      const angNom = parseFloat(angStr.replace(/[^0-9.]/g, ''));
      if (!isNaN(angNom)) {
        subFeatures.push({
          subNumberSuffix: '2',
          displayRequirement: `${angNom}° Chamfer Angle`,
          nominal: angNom,
          upperTol: preset.angular,
          lowerTol: preset.angular,
          plusTol: preset.angular,
          minusTol: -preset.angular,
          minLimit: angNom - preset.angular,
          maxLimit: angNom + preset.angular,
          upperLimit: angNom + preset.angular,
          lowerLimit: angNom - preset.angular,
          units: 'deg',
          type: 'angle',
          subType: 'Angular Dimension (Chamfer Angle)',
          classification: 'Minor',
          inspectionMethod: 'Optical Comparator',
          quantity: multiplier,
          isSecondarySub: true
        });
      }
    }

    return {
      rawText: text,
      nominal: nom,
      upperTol,
      lowerTol,
      minLimit: limits.minLimit,
      maxLimit: limits.maxLimit,
      type: 'chamfer',
      enclosure: 'standard',
      isToleranceInherited,
      toleranceSource,
      units: preset.unit,
      multiplier,
      subFeatures: subFeatures.length > 1 ? subFeatures : undefined
    };
  }

  /**
   * Helper to check if a string represents a chamfer expression
   */
  private static isChamferExpression(str: string): boolean {
    const s = str.trim();
    if (!s) return false;

    // Bare ISO 13715 chamfer-leg symbol: a lone number directly suffixed with "C"/"c" and
    // nothing else — e.g. "2c", "0.5C". This is the standard ISO 13715 edge-break shorthand for
    // a chamfer of that leg size with an unstated (implied) angle, and — unlike every other
    // chamfer form below — never pairs the leg size with a second "x angle" value, so it must
    // not require an 'x' to be recognized. Without this, GdtParser's generic numeric fallback
    // read the trailing "c" as a degree-sign substitute (real shorthand for "45c" meaning 45°,
    // used elsewhere in this engine) and misreported a chamfer size as an angle in that
    // class's title-block tolerance.
    if (/^[0-9]*\.?[0-9]+\s*[cC]$/.test(s)) return true;

    // Must have 'x' or 'X' or '×'
    if (!/[xX×]/.test(s)) return false;

    // Has explicit CHAMFER / CHAM keyword
    if (/\b(?:CHAMFER|CHAM)\b/i.test(s)) return true;

    // Has degree symbol with x, e.g. "3 X 45°", "45° X 3", "3 X 45c", "3 X 45 deg"
    if (/(?:°|c|\bdeg\b)/i.test(s)) {
      if (/[0-9.]+\s*[xX×]\s*[0-9.]+(?:°|c|deg)/i.test(s) || /[0-9.]+(?:°|c|deg)\s*[xX×]\s*[0-9.]+/i.test(s)) {
        return true;
      }
    }

    // Has common chamfer angle without degree (e.g. "3 X 45", "2 x 45", "0.5 x 45", "3 x 30", "2 x 60")
    if (/^[0-9]*\.?[0-9]+\s*[xX×]\s*(?:45|30|60)\b/i.test(s)) {
      return true;
    }

    // Has common chamfer angle without degree if prefixed by ALL CHAMFERS or CHAMFER
    if (/\b(?:ALL\s+CHAMFERS?|CHAMFER)\b/i.test(s) && /[0-9.]+\s*[xX×]\s*(?:45|30|60)\b/i.test(s)) {
      return true;
    }

    return false;
  }

  /**
   * Identifies administrative boilerplate, drafting standard citations, ITAR/export control notices,
   * quality management procedural statements, and legal disclaimers.
   * Under SAE AS9102 Section 3.8, these are NOT design characteristics and must NEVER be ballooned.
   */
  public static isAdministrativeBoilerplate(text: string): boolean {
    const clean = text.trim();
    if (!clean) return false;

    // 1. Drafting standard citations e.g. "INTERPRET DRAWING IN ACCORDANCE WITH ASME Y14.5-2018"
    if (/\b(?:INTERPRET\s+(?:DRAWINGS?|DIMENSIONS?)|ACCORDANCE\s+WITH\s+(?:ASME|ISO|ANSI|DIN)|ASME\s+Y14|ISO\s+1101|ANSI\s+Y14|DRAFTING\s+STANDARDS?)\b/i.test(clean)) {
      return true;
    }

    // 2. ITAR, export control, proprietary, copyright, and confidentiality notices
    if (/\b(?:ITAR\s+CONTROLLED|EXPORT\s+CONTROL(?:LED)?|EXPORT\s+REGULATIONS?|US\s+EXPORT|COMMERCE\s+CONTROL|EAR99|TECHNICAL\s+DATA\s+SUBJECT|PROPRIETARY\s+AND\s+CONFIDENTIAL|CONFIDENTIAL\s+INFORMATION|RESTRICTED\s+RIGHTS|ALL\s+RIGHTS\s+RESERVED|COPYRIGHT\s+\d{4})\b/i.test(clean)) {
      return true;
    }

    // 3. Procedural inspection/quality statements e.g. "100% FIRST ARTICLE INSPECTION PER SAE AS9102 REV C REQUIRED"
    if (/\b(?:FIRST\s+ARTICLE\s+INSPECTION|SAE\s+AS9102|AS9102\s+REV|100%\s+INSPECTION\s+REQUIRED|QUALITY\s+SYSTEM\s+REQUIREMENT|SAMPLING\s+PER\s+MIL-STD)\b/i.test(clean)) {
      return true;
    }

    // 4. Drawing sheet boilerplate notes
    if (/\b(?:DO\s+NOT\s+SCALE\s+(?:DRAWING|PRINT)|THIRD\s+ANGLE\s+PROJECTION|CAD\s+GENERATED\s+DRAWING|WORKMANSHIP\s+SHALL\s+BE\s+IN\s+ACCORDANCE|UNLESS\s+OTHERWISE\s+SPECIFIED|TOLERANCES\s+UNLESS\s+NOTED)\b/i.test(clean)) {
      return true;
    }

    return false;
  }

  /**
   * Detects conversational English sentences, tutorial instructions, book disclaimers,
   * and paragraph text that should never be ballooned as CAD dimensions.
   */
  public static isProseOrInstructionalText(text: string): boolean {
    const clean = text.trim();
    if (!clean) return false;

    // 0. Administrative boilerplate (ASME drafting standards, ITAR, AS9102 procedural statements)
    if (GdtParser.isAdministrativeBoilerplate(clean)) {
      return true;
    }

    // 1. Extreme prose / tutorial / book disclaimer indicators - ALWAYS prose even if numbered
    const STRONG_PROSE_REGEX = /\b(?:autodesk|solidworks|catia|creo|inventor|tutorial|workbook|handbook|course|lesson|disclaimer|copyright|rights\s+reserved|all\s+rights|apologies\s+in\s+advance|practice\s+with|designer'?s?\s+choice|miscellaneous\s+parts|detailed\s+drawings|simple\s+sketches|answers?\s+here|challengi\w*|practic\w*|miscellan\w*|missing\s+dimension|exercise\s+best|practice\s+files?|rougher\s+geometr\w*|chained\s+combination)\b/i;
    if (STRONG_PROSE_REGEX.test(clean)) {
      return true;
    }

    // 2. Conversational / grammatical prose indicators: Two or more common grammatical words in a snippet indicates prose
    const conversationalMatches = clean.match(/\b(?:the|this|that|these|those|some|any|we|you|your|our|they|their|are|is|was|were|have|has|had|can|could|will|would|should|may|might|in|to|for|of|with|by|from|at|on|and|or|but|if|then|else|when|where|why|how|than|more|less|into|about|after|before)\b/gi) || [];
    if (conversationalMatches.length >= 2) {
      return true;
    }

    // 3. Preserve genuine drawing notes starting with note index e.g. "1. MATERIAL: 6061-T6"
    if (/^\d+\.\s+[A-Z0-9]/.test(clean) && clean.length < 200) {
      // Re-verify it is not administrative boilerplate
      if (GdtParser.isAdministrativeBoilerplate(clean)) {
        return true;
      }
      // If it contains real manufacturing/material note vocabulary, it is a valid note
      if (/\b(?:MATERIAL|FINISH|BURR|EDGE|HEAT\s+TREAT|ANODIZE|COAT|PLATE|PLATING|TOLERANCE|PAINT|CLEAN|HARDNESS|TORQUE|PER|SPEC|ASTM|MIL|AMS|PASSIVATE|CAD|MODEL|SURFACE|CHAMFER|RADIUS|DIMENSIONS?|UNLESS|NOTED|ALL)\b/i.test(clean)) {
        return false;
      }
      // If it's short without conversational narrative, preserve as note
      if (!/\b(?:this|that|these|those|some|any|we|you|your|our|please|don't|can|will|should|would)\b/i.test(clean)) {
        return false;
      }
    }

    // Standard GD&T frames or symbol-led callouts are preserved ONLY if they don't contain conversational prose
    if (clean.includes('|') || clean.includes('⌖') || clean.includes('⏥') || clean.includes('Ø') || clean.includes('±')) {
      if (conversationalMatches.length > 0 || /\b(?:parts?|drawings?|practice|challenging|others?|package|matter|answers?)\b/i.test(clean)) {
        return true;
      }
      return false;
    }

    // 4. Natural language prose words common in book/tutorial/instructional paragraphs
    const PROSE_WORDS_REGEX = /\b(?:this|that|these|those|contains?|containing|detailed|drawings?|miscellaneous|parts?|practice|practicing|inventor|package|matter|some|challengi\w*|others?|none|meant|difficult|however|specific|tools?|hints?|provided|cases?|event|find|missing|please|accept|apologies|advance|don't|stop|instead|consider|opportunity|exercise|exercises|designer'?s?|choice|provide|liking|right|wrong|answers?|work|through|keep|mind|best|creating|simple|sketches|build|constructed|features?|which|more|complex|pursuits?|software|copyright|rights?\s+reserved|autodesk|all\s+rights|disclaimer|tutorial|guide|course|lesson|sample|workbook|handbook|instructions?|overview|introduction|preface|chapter|page|website|email|author|publish|published|edition)\b/i;

    if (PROSE_WORDS_REGEX.test(clean)) {
      return true;
    }

    // 5. High word count with grammatical punctuation or conversational conjunctions
    const words = clean.split(/\s+/);
    if (words.length >= 4) {
      if (
        /[,;]\s+[a-z]/i.test(clean) || 
        /\.\s+[A-Z]/.test(clean) || 
        conversationalMatches.length >= 1
      ) {
        return true;
      }
    }

    return false;
  }
}
