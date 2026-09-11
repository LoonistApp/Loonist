import type { TitleBlockTolerancePreset } from '../../types/characteristics';
import { DEFAULT_AEROSPACE_TOLERANCES } from '../../types/characteristics';

export class ToleranceEngine {
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

    const precision = this.getDecimalPrecision(nominalStr);

    switch (precision) {
      case 1:
        return {
          upperTol: preset.oneDecimal,
          lowerTol: preset.oneDecimal,
          source: `Title Block (.X ±${preset.oneDecimal})`
        };
      case 2:
        return {
          upperTol: preset.twoDecimals,
          lowerTol: preset.twoDecimals,
          source: `Title Block (.XX ±${preset.twoDecimals})`
        };
      case 3:
        return {
          upperTol: preset.threeDecimals,
          lowerTol: preset.threeDecimals,
          source: `Title Block (.XXX ±${preset.threeDecimals})`
        };
      case 4:
      default:
        if (precision >= 4) {
          return {
            upperTol: preset.fourDecimals,
            lowerTol: preset.fourDecimals,
            source: `Title Block (.XXXX ±${preset.fourDecimals})`
          };
        }
        // Precision 0 (integer)
        return {
          upperTol: preset.oneDecimal,
          lowerTol: preset.oneDecimal,
          source: `Title Block (.X ±${preset.oneDecimal})`
        };
    }
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
