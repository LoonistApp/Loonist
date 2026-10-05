import type { EngineeringCharacteristic } from '../../types/characteristics';

export interface ExportReadinessResult {
  /** Must be resolved (or explicitly acknowledged) before the export proceeds. */
  blockers: EngineeringCharacteristic[];
  /** Passed review but worth a second look; does not block export. */
  warnings: EngineeringCharacteristic[];
}

const LOW_CONFIDENCE_THRESHOLD = 0.6;

/**
 * Checks whether a characteristic set is safe to export as a customer-facing AS9102 deliverable.
 * Reference/basic dimensions are informational-only per ASME Y14.5 and are never physically
 * measured, so an UNMEASURED status on those is expected, not a blocker.
 */
export function evaluateExportReadiness(characteristics: EngineeringCharacteristic[]): ExportReadinessResult {
  const blockers: EngineeringCharacteristic[] = [];
  const warnings: EngineeringCharacteristic[] = [];

  for (const char of characteristics) {
    const isInformationalOnly = char.forReference || char.enclosure === 'reference' || char.isBasic;

    if (char.verificationStatus === 'needs_review') {
      blockers.push(char);
      continue;
    }

    if (!isInformationalOnly && (char.conformanceStatus === 'UNMEASURED' || !char.conformanceStatus)) {
      blockers.push(char);
      continue;
    }

    // An N/A disposition without a stated reason is exactly as opaque to an auditor as a
    // silently fabricated value — it must carry the inspector's justification (see
    // ConformanceStatus's 'N/A' doc comment) or it's treated the same as never having been
    // resolved at all.
    if (char.conformanceStatus === 'N/A' && !(char.comments || '').trim()) {
      blockers.push(char);
      continue;
    }

    if (typeof char.confidenceScore === 'number' && char.confidenceScore < LOW_CONFIDENCE_THRESHOLD) {
      warnings.push(char);
    }
  }

  return { blockers, warnings };
}
