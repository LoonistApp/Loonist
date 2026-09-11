import type { 
  GdtFeatureControlFrame, 
  DimensionEnclosure, 
  CharacteristicType 
} from '../../types/characteristics';
import { ToleranceEngine } from './toleranceEngine';

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
  multiplier: number;
}

export class GdtParser {
  /**
   * Main entry point to parse an engineering callout string.
   */
  public static parseCallout(rawText: string): ParsedDimensionResult {
    const text = rawText.trim();

    // 1. Check for Quantity Multipliers (e.g. "4X", "6 PLACES")
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

    // 2. Check for GD&T Feature Control Frame
    if (this.isGdtFrame(cleanText)) {
      return this.parseFeatureControlFrame(text, cleanText, multiplier);
    }

    // 3. Check for Basic Dimension [ 1.500 ] (Boxed)
    if (this.isBasicDimension(cleanText)) {
      const numStr = cleanText.replace(/[[\]]/g, '').trim();
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
        units: cleanText.includes('°') ? 'deg' : 'in',
        multiplier
      };
    }

    // 4. Check for Reference Dimension ( 2.750 ) (Parentheses)
    if (this.isReferenceDimension(cleanText)) {
      const numStr = cleanText.replace(/[()]/g, '').trim();
      const nominal = parseFloat(numStr);
      const tol = ToleranceEngine.resolveTitleBlockTolerance(numStr);
      const limits = ToleranceEngine.calculateLimits(nominal, tol.upperTol, tol.lowerTol);
      return {
        rawText: text,
        nominal: Number.isNaN(nominal) ? null : nominal,
        upperTol: tol.upperTol,
        lowerTol: tol.lowerTol,
        minLimit: limits.minLimit,
        maxLimit: limits.maxLimit,
        type: this.inferType(cleanText),
        enclosure: 'reference',
        isToleranceInherited: true,
        toleranceSource: `Reference (${tol.source})`,
        units: cleanText.includes('°') ? 'deg' : 'in',
        multiplier
      };
    }

    // 5. Check for Limit Dimensions (e.g. "1.505 / 1.495" or "1.505 - 1.495")
    const limitMatch = cleanText.match(/^([0-9.]+)\s*[/|-]\s*([0-9.]+)$/);
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
          units: 'in',
          multiplier
        };
      }
    }

    // 6. Check for Explicit Bilateral / Plus-Minus (e.g. "2.500 ± .005" or "2.500 +/- 0.005")
    const pmMatch = cleanText.match(/^([^ \t±+-]+)\s*(?:±|\+\/-)\s*([0-9.]+)/);
    if (pmMatch) {
      const nominal = parseFloat(pmMatch[1].replace(/[^0-9.]/g, ''));
      const tolVal = parseFloat(pmMatch[2]);
      const limits = ToleranceEngine.calculateLimits(nominal, tolVal, tolVal);
      return {
        rawText: text,
        nominal: Number.isNaN(nominal) ? null : nominal,
        upperTol: tolVal,
        lowerTol: tolVal,
        minLimit: limits.minLimit,
        maxLimit: limits.maxLimit,
        type: this.inferType(cleanText),
        enclosure: 'standard',
        isToleranceInherited: false,
        toleranceSource: `Explicit (±${tolVal})`,
        units: cleanText.includes('°') ? 'deg' : 'in',
        multiplier
      };
    }

    // 7. Check for Asymmetric Tolerance (e.g. "1.250 +0.010 / -0.002" or "1.250 +.010 -.002")
    const asymMatch = cleanText.match(/^([^ \t+-]+)\s*\+([0-9.]+)\s*-([0-9.]+)/);
    if (asymMatch) {
      const nominal = parseFloat(asymMatch[1].replace(/[^0-9.]/g, ''));
      const upper = parseFloat(asymMatch[2]);
      const lower = parseFloat(asymMatch[3]);
      const limits = ToleranceEngine.calculateLimits(nominal, upper, lower);
      return {
        rawText: text,
        nominal: Number.isNaN(nominal) ? null : nominal,
        upperTol: upper,
        lowerTol: lower,
        minLimit: limits.minLimit,
        maxLimit: limits.maxLimit,
        type: this.inferType(cleanText),
        enclosure: 'standard',
        isToleranceInherited: false,
        toleranceSource: `Explicit (+${upper}/-${lower})`,
        units: 'in',
        multiplier
      };
    }

    // 8. Fallback: Untoleranced Dimension -> Resolve via Title Block Precision Matrix
    const numMatch = cleanText.match(/([0-9]+\.?[0-9]*)/);
    const nominal = numMatch ? parseFloat(numMatch[1]) : null;
    const isAngular = cleanText.includes('°') || cleanText.toLowerCase().includes('deg');
    const tol = numMatch 
      ? ToleranceEngine.resolveTitleBlockTolerance(numMatch[1], isAngular)
      : { upperTol: 0.005, lowerTol: 0.005, source: 'Default Standard' };
    
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
      units: isAngular ? 'deg' : 'in',
      multiplier
    };
  }

  private static isBasicDimension(text: string): boolean {
    return /^\[\s*.*?\s*\]$/.test(text);
  }

  private static isReferenceDimension(text: string): boolean {
    return /^\(\s*.*?\s*\)$/.test(text);
  }

  private static isGdtFrame(text: string): boolean {
    const gdtSymbols = ['⌖', '⏥', '⟂', '∥', '⌒', '↗', '⌕', '◎', 'POS', 'FLAT', 'PERP', 'PARALLEL'];
    return gdtSymbols.some(sym => text.includes(sym)) && text.includes('|');
  }

  private static parseFeatureControlFrame(
    fullText: string, 
    cleanText: string, 
    multiplier: number
  ): ParsedDimensionResult {
    // Standard ASME Y14.5 syntax: | ⌖ | Ø .010 Ⓜ | A | B Ⓜ | C |
    const segments = cleanText.split('|').map(s => s.trim()).filter(Boolean);
    const charSymbol = segments[0] || '⌖';
    const tolSegment = segments[1] || '0.010';
    
    const tolValueMatch = tolSegment.match(/([0-9.]+)/);
    const tolVal = tolValueMatch ? parseFloat(tolValueMatch[1]) : 0.010;
    const hasDia = tolSegment.includes('Ø') || tolSegment.includes('DIA');
    
    let matModifier: 'MMC' | 'LMC' | 'RFS' | undefined;
    if (tolSegment.includes('Ⓜ') || tolSegment.includes('(M)') || tolSegment.includes('MMC')) matModifier = 'MMC';
    if (tolSegment.includes('Ⓛ') || tolSegment.includes('(L)') || tolSegment.includes('LMC')) matModifier = 'LMC';

    const parseDatum = (seg?: string) => {
      if (!seg) return undefined;
      const letterMatch = seg.match(/([A-Z])/);
      if (!letterMatch) return undefined;
      let mod: 'MMC' | 'LMC' | 'RFS' | undefined;
      if (seg.includes('Ⓜ') || seg.includes('(M)')) mod = 'MMC';
      if (seg.includes('Ⓛ') || seg.includes('(L)')) mod = 'LMC';
      return { datum: letterMatch[1], modifier: mod };
    };

    const gdtFrame: GdtFeatureControlFrame = {
      characteristic: 'position',
      symbol: charSymbol,
      toleranceValue: tolVal,
      diameterSymbol: hasDia,
      materialModifier: matModifier,
      primaryDatum: parseDatum(segments[2]),
      secondaryDatum: parseDatum(segments[3]),
      tertiaryDatum: parseDatum(segments[4]),
      rawText: cleanText
    };

    return {
      rawText: fullText,
      nominal: 0.0,
      upperTol: tolVal,
      lowerTol: 0.0,
      minLimit: 0.0,
      maxLimit: tolVal,
      type: 'gdt',
      enclosure: 'standard',
      isToleranceInherited: false,
      toleranceSource: `ASME Y14.5 GD&T Frame (${charSymbol} ${tolVal})`,
      units: 'in',
      gdtFrame,
      multiplier
    };
  }

  private static inferType(text: string): CharacteristicType {
    const t = text.toUpperCase();
    if (t.includes('Ø') || t.includes('DIA')) return 'diameter';
    if (t.includes('R ') || t.startsWith('R') || t.includes('RAD')) return 'radius';
    if (t.includes('°') || t.includes('DEG')) return 'angle';
    if (t.includes('UNF') || t.includes('UNC') || t.includes('THD') || t.includes('THREAD')) return 'thread';
    if (t.includes('X') && t.includes('45°')) return 'chamfer';
    return 'linear';
  }
}
