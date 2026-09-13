/**
 * LOONIST — Industrial Fraction & Mixed Number Evaluator
 * Accurately parses fractional imperial dimensions (e.g. "1 3/8", "3/4-10 UNC", "± 1/64")
 * into high-precision engineering decimal values.
 */

export interface ParsedFraction {
  decimal: number;
  fractionStr: string;
  isMixed: boolean;
}

export class FractionParser {
  /**
   * Matches pure fractions: e.g. "3/8", "1/64", "5/16"
   */
  private static readonly PURE_FRACTION_REGEX = /^\b(\d+)\s*\/\s*(\d+)\b$/;

  /**
   * Matches mixed fractions: e.g. "1 3/8", "2-1/4", "3 5/16"
   */
  private static readonly MIXED_FRACTION_REGEX = /^\b(\d+)[\s-]+(\d+)\s*\/\s*(\d+)\b$/;

  /**
   * Parses a single fractional or mixed string into a decimal.
   * e.g. "1 3/8" -> 1.375, "1/64" -> 0.015625
   */
  public static parseFraction(valStr: string): ParsedFraction | null {
    const clean = valStr.trim();

    // 1. Check Mixed Fraction: "1 3/8" or "2-1/4"
    const mixedMatch = clean.match(this.MIXED_FRACTION_REGEX);
    if (mixedMatch) {
      const whole = parseInt(mixedMatch[1], 10);
      const num = parseInt(mixedMatch[2], 10);
      const den = parseInt(mixedMatch[3], 10);
      if (den !== 0) {
        const decimal = parseFloat((whole + num / den).toFixed(6));
        return {
          decimal,
          fractionStr: `${whole} ${num}/${den}`,
          isMixed: true
        };
      }
    }

    // 2. Check Pure Fraction: "3/8"
    const pureMatch = clean.match(this.PURE_FRACTION_REGEX);
    if (pureMatch) {
      const num = parseInt(pureMatch[1], 10);
      const den = parseInt(pureMatch[2], 10);
      if (den !== 0) {
        const decimal = parseFloat((num / den).toFixed(6));
        return {
          decimal,
          fractionStr: `${num}/${den}`,
          isMixed: false
        };
      }
    }

    return null;
  }

  /**
   * Scans a dimension callout text, replaces any mixed fractions or pure fractions
   * with their decimal equivalents while recording the original fraction string.
   * e.g. "DIA 1 3/8 ± 1/64" -> "DIA 1.375 ± 0.0156"
   */
  public static normalizeFractionsInText(text: string): {
    normalizedText: string;
    hasFractions: boolean;
    primaryFraction?: string;
    evaluatedDecimal?: number;
  } {
    let hasFractions = false;
    let primaryFraction: string | undefined;
    let evaluatedDecimal: number | undefined;

    // Replace mixed fractions first (e.g. "1 3/8" -> "1.375")
    let normalized = text.replace(/(\d+)[\s-]+(\d+)\s*\/\s*(\d+)/g, (match, whole, num, den) => {
      const w = parseInt(whole, 10);
      const n = parseInt(num, 10);
      const d = parseInt(den, 10);
      if (d !== 0) {
        hasFractions = true;
        const val = parseFloat((w + n / d).toFixed(5));
        if (!primaryFraction) {
          primaryFraction = match;
          evaluatedDecimal = val;
        }
        return val.toString();
      }
      return match;
    });

    // Replace standalone pure fractions (e.g. "± 1/64" -> "± 0.0156", "3/8-16 UNC" -> "0.375-16 UNC")
    normalized = normalized.replace(/(^|[^0-9/])(\d+)\s*\/\s*(\d+)/g, (match, prefix, num, den) => {
      const n = parseInt(num, 10);
      const d = parseInt(den, 10);
      if (d !== 0) {
        hasFractions = true;
        const val = parseFloat((n / d).toFixed(5));
        if (!primaryFraction) {
          primaryFraction = `${n}/${d}`;
          evaluatedDecimal = val;
        }
        return `${prefix}${val}`;
      }
      return match;
    });

    return {
      normalizedText: normalized,
      hasFractions,
      primaryFraction,
      evaluatedDecimal
    };
  }
}
