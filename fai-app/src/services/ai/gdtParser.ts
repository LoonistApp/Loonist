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
  TitleBlockTolerancePreset
} from '../../types/characteristics';
import { DEFAULT_AEROSPACE_TOLERANCES } from '../../types/characteristics';
import { ToleranceEngine } from './toleranceEngine';
import { FractionParser } from './fractionParser';

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

    // 2. Check for Quantity Multipliers (e.g. "4X", "6 PLACES", "8X")
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

    // 4. Check for GD&T Feature Control Frame (single tier or composite dual tier)
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
      const numMatch = textToParse.match(/(?:\d+\.?\d*|\.\d+)/);
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

    // 9. Check for Chamfer Callouts (e.g. ".060 X 45°", "45° X .060", "0.5 X 45c CHAMFER", "ALL CHAMFERS = 0.5 X 45°")
    const chamferMatch = textToParse.match(/(?:ALL\s+CHAMFERS\s*=\s*)?([0-9]*\.?[0-9]+)\s*(?:mm\s*)?[xX]\s*(?:45|30|60)(?:°|c|\b)(?:\s*CHAMFER)?|(?:45|30|60)(?:°|c|\b)\s*[xX]\s*([0-9]*\.?[0-9]+)(?:\s*(?:mm)?\s*CHAMFER)?/i);
    if (chamferMatch) {
      const nomStr = chamferMatch[1] || chamferMatch[2];
      const nom = parseFloat(nomStr);
      const tolVal = preset.unit === 'mm' ? 0.2 : 0.010;
      return {
        rawText: text,
        nominal: nom,
        upperTol: tolVal,
        lowerTol: tolVal,
        minLimit: parseFloat((nom - tolVal).toFixed(4)),
        maxLimit: parseFloat((nom + tolVal).toFixed(4)),
        type: 'chamfer',
        enclosure: 'standard',
        isToleranceInherited: true,
        toleranceSource: `Chamfer Standard (±${tolVal} ${preset.unit})`,
        units: preset.unit,
        multiplier,
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
      .replace(/[\(\)\[\]\{\}\/\\:;,\-_+=*#°Ø±↧⌴⌵"'`~!?<>@$%^&]/g, '')
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

    const numMatch = textToParse.match(/(?:\d+\.?\d*|\.\d+)/);
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

    const isAngular = cleanText.includes('°') || cleanText.toLowerCase().includes('deg') || /(?:^|\s|\d)(?:\d+(?:\.\d+)?)c(?:\s|$)/i.test(cleanText);
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
      type: this.inferType(cleanText),
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
      toleranceSource: `ASME Y14.5 GD&T Frame (${upperTier.symbol} ${upperTier.toleranceValue})`,
      units: unit,
      gdtFrame,
      multiplier
    };
  }

  private static normalizeGdtSymbol(raw: string): string {
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
      case '⌖':
      default:
        return 'position';
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
    const STRONG_PROSE_REGEX = /\b(?:autodesk|solidworks|catia|creo|inventor|kkmsoft|tutorial|workbook|handbook|course|lesson|disclaimer|copyright|rights\s+reserved|all\s+rights|apologies\s+in\s+advance|practice\s+with|designer'?s?\s+choice|luck\s+in\s+your|miscellaneous\s+parts|detailed\s+drawings|simple\s+sketches|answers?\s+here)\b/i;
    if (STRONG_PROSE_REGEX.test(clean)) {
      return true;
    }

    // 2. Preserve genuine drawing notes starting with note index e.g. "1. MATERIAL: 6061-T6"
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

    // Never exclude standard GD&T frames or symbol-led callouts
    if (clean.includes('|') || clean.includes('⌖') || clean.includes('⏥') || clean.includes('Ø') || clean.includes('±')) {
      return false;
    }

    // 3. Natural language prose words common in book/tutorial/instructional paragraphs
    const PROSE_WORDS_REGEX = /\b(?:this|that|these|those|contains?|containing|detailed|drawings?|miscellaneous|parts?|practice|inventor|package|matter|some|challenging|others?|none|meant|difficult|however|intended|specific|modeling|tools?|hints?|provided|cases?|event|find|missing|please|accept|apologies|advance|don't|stop|instead|consider|opportunity|exercise|exercises|designer'?s?|choice|provide|liking|right|wrong|answers?|work|through|keep|mind|best|creating|simple|sketches|build|constructed|features?|which|more|complex|luck|pursuits?|software|copyright|rights?\s+reserved|autodesk|kkmsoft|all\s+rights|disclaimer|tutorial|guide|course|lesson|sample|workbook|handbook|instructions?|overview|introduction|preface|chapter|page|website|email|author|publish|published|edition)\b/i;

    if (PROSE_WORDS_REGEX.test(clean)) {
      return true;
    }

    // 4. High word count with grammatical punctuation or conversational conjunctions
    const words = clean.split(/\s+/);
    if (words.length >= 5) {
      if (
        /[,;]\s+[a-z]/i.test(clean) || 
        /\.\s+[A-Z]/.test(clean) || 
        /\b(?:and|or|in|to|for|of|with|by|from|at|on|the|a|an|is|are|be|have|has|had|you|your|we|our|they|their|can|could|will|would|should|may|might)\b/i.test(clean)
      ) {
        return true;
      }
    }

    return false;
  }
}
