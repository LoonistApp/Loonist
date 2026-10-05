import type { EngineeringCharacteristic, ConformanceStatus } from '../../types/characteristics';

export interface MeasurementEvaluationResult {
  status: ConformanceStatus;
  deviation: number | null;
}

export interface LotComplianceStatistics {
  total: number;
  measuredCount: number;
  unmeasuredCount: number;
  passCount: number;
  marginalCount: number;
  failCount: number;
  /** Deliberately marked out-of-scope for this physical part (e.g. a process-alternative
   * callout that doesn't apply to how this unit was actually made) — excluded from both the
   * measured and unmeasured buckets, and from the conformance rate, since it was never meant
   * to be physically inspected. */
  notApplicableCount: number;
  conformanceRatePercent: number;
  isLotConforming: boolean;
}

export class MeasurementEngine {
  private static readonly MARGINAL_RATIO = 0.10; // 10% of tolerance band threshold
  // Guards boundary-exact PASS/FAIL decisions against floating-point drift at 4-5 decimal
  // aerospace tolerances (e.g. a value computed as 1.2549999999999999 instead of 1.255).
  private static readonly EPSILON = 1e-9;

  /**
   * Evaluates a physical measured actual value against ASME Y14.5 / AS9102 characteristic limits.
   *
   * Rules:
   * - UNMEASURED: When value is null, undefined, or empty.
   * - REFERENCE: Informational only; marked dimensions pass automatically.
   * - FAIL (Red): Measured value strictly falls outside Lower Limit or Upper Limit.
   * - MARGINAL (Amber): Measured value is within 10% of either upper or lower tolerance boundary.
   * - PASS (Green): Measured value comfortably inside allowable tolerance band.
   */
  public static evaluateMeasurement(
    char: EngineeringCharacteristic,
    actual: number | null
  ): MeasurementEvaluationResult {
    if (actual === null || isNaN(actual)) {
      return { status: 'UNMEASURED', deviation: null };
    }

    const nominal = char.cleanNominal;
    const deviation = nominal !== null ? Number((actual - nominal).toFixed(4)) : null;

    // ASME Y14.5 Reference dimensions are for information only and have no inspection limits
    if (char.forReference || char.enclosure === 'reference') {
      return { status: 'PASS', deviation };
    }

    const lower = char.lowerLimit;
    const upper = char.upperLimit;

    // 1. Bilateral tolerance limits (Lower & Upper limit defined)
    if (lower !== null && upper !== null) {
      if (actual < lower - MeasurementEngine.EPSILON || actual > upper + MeasurementEngine.EPSILON) {
        return { status: 'FAIL', deviation };
      }

      const band = upper - lower;
      const threshold = Math.max(0.0001, band * MeasurementEngine.MARGINAL_RATIO);

      if (Math.abs(actual - lower) <= threshold || Math.abs(actual - upper) <= threshold) {
        return { status: 'MARGINAL', deviation };
      }

      return { status: 'PASS', deviation };
    }

    // 2. Unilateral Upper limit only (e.g. .030 MAX or Flatness/Runout spec)
    if (upper !== null && lower === null) {
      if (actual > upper + MeasurementEngine.EPSILON) {
        return { status: 'FAIL', deviation };
      }
      return { status: 'PASS', deviation };
    }

    // 3. Unilateral Lower limit only (e.g. .015 MIN)
    if (lower !== null && upper === null) {
      if (actual < lower - MeasurementEngine.EPSILON) {
        return { status: 'FAIL', deviation };
      }
      return { status: 'PASS', deviation };
    }

    // Standard basic dimensions linked to GD&T feature control frames
    return { status: 'PASS', deviation };
  }

  /**
   * Computes comprehensive AS9102 inspection lot compliance statistics.
   */
  public static computeLotStatistics(characteristics: EngineeringCharacteristic[]): LotComplianceStatistics {
    const total = characteristics.length;
    let measuredCount = 0;
    let passCount = 0;
    let marginalCount = 0;
    let failCount = 0;
    let notApplicableCount = 0;

    for (const char of characteristics) {
      const status = char.conformanceStatus || 'UNMEASURED';
      if (status === 'N/A') {
        notApplicableCount++;
      } else if (status !== 'UNMEASURED') {
        measuredCount++;
        if (status === 'PASS') passCount++;
        else if (status === 'MARGINAL') marginalCount++;
        else if (status === 'FAIL') failCount++;
      }
    }

    const unmeasuredCount = total - measuredCount - notApplicableCount;
    const conformingCount = passCount + marginalCount;
    const conformanceRatePercent = measuredCount > 0
      ? Number(((conformingCount / measuredCount) * 100).toFixed(1))
      : 100;

    const isLotConforming = failCount === 0;

    return {
      total,
      measuredCount,
      unmeasuredCount,
      passCount,
      marginalCount,
      failCount,
      notApplicableCount,
      conformanceRatePercent,
      isLotConforming
    };
  }

  public static calculateLotStatistics(characteristics: EngineeringCharacteristic[]): LotComplianceStatistics {
    return MeasurementEngine.computeLotStatistics(characteristics);
  }
}
