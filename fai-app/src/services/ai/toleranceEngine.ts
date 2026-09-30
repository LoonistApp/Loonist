import type { TitleBlockTolerancePreset } from '../../types/characteristics';
import { DEFAULT_AEROSPACE_TOLERANCES } from '../../types/characteristics';

export const DEFAULT_METRIC_ISO_TOLERANCES: TitleBlockTolerancePreset = {
  oneDecimal: 0.10,    // .X = ±0.10 mm (ISO 2768-m)
  twoDecimals: 0.05,   // .XX = ±0.05 mm
  threeDecimals: 0.01, // .XXX = ±0.01 mm
  fourDecimals: 0.002, // .XXXX = ±0.002 mm
  angular: 0.5,
  unit: 'mm'
};

export class ToleranceEngine {
  /**
   * Automatically detects whether a blueprint is configured in Inches or Millimeters
   * by analyzing general drawing notes, title block tags, and standard headers.
   */
  public static detectDrawingUnits(drawingText: string): 'in' | 'mm' | null {
    const textUpper = drawingText.replace(/\s+/g, ' ').toUpperCase();
    
    // Explicit metric indicators (notes, standard headers, drawing tags)
    if (
      textUpper.includes('DIMENSIONS ARE IN MILLIMETERS') ||
      textUpper.includes('DIMENSIONS IN MILLIMETERS') ||
      textUpper.includes('DIMENSIONS ARE MILLIMETERS') ||
      textUpper.includes('ALL DIMENSIONS ARE IN MILLIMETERS') ||
      textUpper.includes('ALL DIMENSIONS IN MILLIMETERS') ||
      textUpper.includes('ALL DIMENSIONS ARE MILLIMETERS') ||
      textUpper.includes('DIMENSIONS IN MM') ||
      textUpper.includes('UNLESS OTHERWISE SPECIFIED: MM') ||
      textUpper.includes('UNITS: MM') ||
      textUpper.includes('MILLIMETERS') ||
      textUpper.includes('MILLIMETER') ||
      textUpper.includes('ISO 2768') ||
      textUpper.includes('METRIC')
    ) {
      return 'mm';
    }

    // Explicit imperial indicators
    if (
      textUpper.includes('DIMENSIONS ARE IN INCHES') ||
      textUpper.includes('DIMENSIONS IN INCHES') ||
      textUpper.includes('ALL DIMENSIONS ARE IN INCHES') ||
      textUpper.includes('ALL DIMENSIONS IN INCHES') ||
      textUpper.includes('UNLESS OTHERWISE SPECIFIED: IN') ||
      textUpper.includes('UNITS: IN') ||
      textUpper.includes('INCHES') ||
      textUpper.includes('INCH')
    ) {
      return 'in';
    }

    return null;
  }

  /**
   * Parses dynamic title block tolerance notes if specified on the drawing.
   * e.g. "TOLERANCES: .X ±.030, .XX ±.010, .XXX ±.002, ANGLES ±1°"
   */
  public static parseCustomTitleBlockTolerances(
    titleBlockText: string,
    unit: 'in' | 'mm' = 'in'
  ): TitleBlockTolerancePreset | null {
    const base = unit === 'mm' ? { ...DEFAULT_METRIC_ISO_TOLERANCES } : { ...DEFAULT_AEROSPACE_TOLERANCES };
    let foundAny = false;

    // .X or 1 PLACE
    const xMatch = titleBlockText.match(/(?:\.X|1\s*DECIMAL|1\s*PLACE)\s*(?:±|\+\/-)\s*([0-9.]+)/i);
    if (xMatch) {
      base.oneDecimal = parseFloat(xMatch[1]);
      foundAny = true;
    }

    // .XX or 2 PLACES
    const xxMatch = titleBlockText.match(/(?:\.XX|2\s*DECIMALS|2\s*PLACES)\s*(?:±|\+\/-)\s*([0-9.]+)/i);
    if (xxMatch) {
      base.twoDecimals = parseFloat(xxMatch[1]);
      foundAny = true;
    }

    // .XXX or 3 PLACES
    const xxxMatch = titleBlockText.match(/(?:\.XXX|3\s*DECIMALS|3\s*PLACES)\s*(?:±|\+\/-)\s*([0-9.]+)/i);
    if (xxxMatch) {
      base.threeDecimals = parseFloat(xxxMatch[1]);
      foundAny = true;
    }

    // .XXXX or 4 PLACES
    const xxxxMatch = titleBlockText.match(/(?:\.XXXX|4\s*DECIMALS|4\s*PLACES)\s*(?:±|\+\/-)\s*([0-9.]+)/i);
    if (xxxxMatch) {
      base.fourDecimals = parseFloat(xxxxMatch[1]);
      foundAny = true;
    }

    // ANGLES
    const angleMatch = titleBlockText.match(/(?:ANGLES?|ANGULAR)\s*(?:±|\+\/-)\s*([0-9.]+)/i);
    if (angleMatch) {
      base.angular = parseFloat(angleMatch[1]);
      foundAny = true;
    }

    return foundAny ? base : null;
  }

  /**
   * Computes decimal precision from a numeric string.
   * e.g. "2.5" -> 1, "2.50" -> 2, "2.500" -> 3, "2.5000" -> 4
   */
  public static getDecimalPrecision(valStr: string): number {
    const clean = valStr.trim();
    const parts = clean.split('.');
    if (parts.length < 2) return 0;
    return parts[1].replace(/[^0-9]/g, '').length;
  }

  /**
   * Resolves general tolerance from the Title Block based on decimal precision.
   */
  public static resolveTitleBlockTolerance(
    nominalStr: string,
    isAngular: boolean = false,
    preset: TitleBlockTolerancePreset = DEFAULT_AEROSPACE_TOLERANCES
  ): { upperTol: number; lowerTol: number; source: string } {
    if (isAngular) {
      return {
        upperTol: preset.angular,
        lowerTol: preset.angular,
        source: `Title Block (Angles ±${preset.angular}°)`
      };
    }

    // ISO 2768-1 general tolerances are selected by the dimension's nominal SIZE
    // bracket, not by how many decimal places were written on the drawing (that's
    // an inch/shop-convention idiom). When a preset declares an ISO 2768 class,
    // always resolve through the real size-bracket table instead of the
    // decimal-place grid below.
    if (preset.iso2768Class) {
      const nomNum = parseFloat(nominalStr);
      if (!Number.isNaN(nomNum)) {
        return this.resolveMetricIso2768Tolerance(nomNum, preset.iso2768Class);
      }
    }

    const precision = this.getDecimalPrecision(nominalStr);
    const unitLabel = preset.unit === 'mm' ? 'mm' : 'in';

    switch (precision) {
      case 1:
        return {
          upperTol: preset.oneDecimal,
          lowerTol: preset.oneDecimal,
          source: `Title Block (.X ±${preset.oneDecimal} ${unitLabel})`
        };
      case 2:
        return {
          upperTol: preset.twoDecimals,
          lowerTol: preset.twoDecimals,
          source: `Title Block (.XX ±${preset.twoDecimals} ${unitLabel})`
        };
      case 3:
        return {
          upperTol: preset.threeDecimals,
          lowerTol: preset.threeDecimals,
          source: `Title Block (.XXX ±${preset.threeDecimals} ${unitLabel})`
        };
      case 4:
      default:
        if (precision >= 4) {
          return {
            upperTol: preset.fourDecimals,
            lowerTol: preset.fourDecimals,
            source: `Title Block (.XXXX ±${preset.fourDecimals} ${unitLabel})`
          };
        }
        // Precision 0 (integer)
        if (preset.unit === 'mm') {
          const nomNum = parseFloat(nominalStr);
          if (!isNaN(nomNum) && nomNum > 0) {
            return this.resolveMetricIso2768Tolerance(nomNum);
          }
        }
        return {
          upperTol: preset.oneDecimal,
          lowerTol: preset.oneDecimal,
          source: `Title Block (.X ±${preset.oneDecimal} ${unitLabel})`
        };
    }
  }

  /**
   * ISO 2768-1 general linear tolerance tables (mm), by size bracket, per class.
   * Brackets are upper-inclusive: e.g. "30" covers >6 to 30mm.
   */
  private static readonly ISO_2768_TABLE: Record<'f' | 'm' | 'c' | 'v', Array<[number, number]>> = {
    // [bracket upper bound (mm), tolerance (±mm)]
    f: [[3, 0.05], [6, 0.05], [30, 0.1], [120, 0.15], [400, 0.2], [1000, 0.3], [2000, 0.5], [4000, 0.8]],
    m: [[3, 0.1], [6, 0.1], [30, 0.2], [120, 0.3], [400, 0.5], [1000, 0.8], [2000, 1.2], [4000, 2]],
    c: [[3, 0.2], [6, 0.3], [30, 0.5], [120, 0.8], [400, 1.2], [1000, 2], [2000, 3], [4000, 4]],
    v: [[6, 0.5], [30, 1], [120, 1.5], [400, 2.5], [1000, 4], [2000, 6], [4000, 8]]
  };

  /**
   * Resolves standard ISO 2768-1 general metric tolerances by nominal dimension
   * size bracket (not by decimal precision) for the given tolerance class:
   * f = fine, m = medium, c = coarse, v = very coarse.
   */
  public static resolveMetricIso2768Tolerance(
    nominal: number,
    tolClass: 'f' | 'm' | 'c' | 'v' = 'm'
  ): { upperTol: number; lowerTol: number; source: string } {
    const absNom = Math.abs(nominal);
    const brackets = this.ISO_2768_TABLE[tolClass];
    const match = brackets.find(([upperBound]) => absNom <= upperBound);
    const tol = (match ?? brackets[brackets.length - 1])[1];

    return {
      upperTol: tol,
      lowerTol: tol,
      source: `ISO 2768-${tolClass} (±${tol} mm, size bracket)`
    };
  }

  /**
   * Calculates minimum and maximum allowable limits from nominal and bilateral tolerances.
   */
  public static calculateLimits(
    nominal: number | null,
    upperTol: number,
    lowerTol: number
  ): { minLimit: number | null; maxLimit: number | null } {
    if (nominal === null || Number.isNaN(nominal)) {
      return { minLimit: null, maxLimit: null };
    }
    const max = parseFloat((nominal + Math.abs(upperTol)).toFixed(5));
    const min = parseFloat((nominal - Math.abs(lowerTol)).toFixed(5));
    return { minLimit: min, maxLimit: max };
  }
}
