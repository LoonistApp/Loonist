/**
 * LOONIST — Aerospace First Article Inspection Platform
 * Domain Model for Project Configuration, Drawing Extraction Rules,
 * Title Block Tolerancing, and AS9102 Compliance Settings
 */

import type { TitleBlockTolerancePreset } from './characteristics';
import { DEFAULT_AEROSPACE_TOLERANCES } from './characteristics';

export type DelimiterStyle = '.' | '-' | '/';

export type As9102StandardRevision = 'Rev B' | 'Rev C';

export type SecurityWatermark = 
  | 'NONE'
  | 'ITAR RESTRICTED'
  | 'COMPANY CONFIDENTIAL'
  | 'PRELIMINARY FAIR'
  | 'CUSTOMER APPROVED';

export type SamplingStandard = 'ANSI/ASQ Z1.4';

export type AqlLevel = '0.65' | '1.0' | '2.5' | '4.0';

export type InspectionLevel = 'Level I' | 'Level II' | 'Level III';

export type MultiplierBehavior = 'single_balloon' | 'split_sub_balloons';

export type TolerancePresetKey = 
  | 'asme-precision' 
  | 'asme-commercial' 
  | 'sheet-metal-inch' 
  | 'iso-fine' 
  | 'iso-medium' 
  | 'sheet-metal-metric' 
  | 'custom';

export type ExportFormatTemplate = 'AS9102' | 'NET_INSPECT';

export interface ProjectSettings {
  // Tab 1: Blueprint & Tolerances
  units: 'in' | 'mm';
  tolerancePreset?: TolerancePresetKey;
  tolerances: TitleBlockTolerancePreset;

  // Extraction & Ballooning Behavior
  multiplierBehavior: MultiplierBehavior;   // 'single_balloon' (Qty: 4 in row) vs 'split_sub_balloons' (1.1, 1.2, ...)
  autoBalloonNotes: boolean;                // Balloon general drawing notes as Form 3 characteristics
  autoDetectZones: boolean;                 // Auto-populate sheet zone coordinates (e.g. Sheet 1, Zone B-4)
  skipReferenceDimensions: boolean;         // Omit ASME Y14.5 reference dims (Dim) from Form 3
  skipBasicDimensions: boolean;             // Omit ASME Y14.5 basic dims [Dim] from Form 3
  ocrConfidenceThreshold: number;           // Minimum confidence (0.0 - 1.0) before tagging as needs_review

  // Tab 2: Numbering & Compliance
  startingNumber: number;                   // Initial balloon index (e.g. 1, 100, 1000)
  incrementStep: number;                    // Increment step (1, 5, 10)
  balloonPrefix: string;                    // Prefix string e.g. 'D-', 'N-', ''
  leadingZeros: boolean;                    // Formats 001, 002 vs 1, 2
  subDelimiter: DelimiterStyle;             // Delimiter for sub-characteristics: '1.1' vs '1-1' vs '1/1'

  // Compliance, Sampling & Export
  as9102Revision: As9102StandardRevision;
  exportFormat: ExportFormatTemplate;       // AS9102 Excel (.xlsx) vs Net-Inspect CSV
  watermark: SecurityWatermark;
  highResPdfExport: boolean;               // Publication-quality vector PDF
  samplingStandard: SamplingStandard;
  aqlLevel: AqlLevel;
  inspectionLevel: InspectionLevel;
}

export const DEFAULT_PROJECT_SETTINGS: ProjectSettings = {
  units: 'in',
  tolerancePreset: 'asme-precision',
  tolerances: { ...DEFAULT_AEROSPACE_TOLERANCES },
  multiplierBehavior: 'single_balloon',
  autoBalloonNotes: true,
  autoDetectZones: true,
  skipReferenceDimensions: true,
  skipBasicDimensions: false,
  ocrConfidenceThreshold: 0.85,
  startingNumber: 1,
  incrementStep: 1,
  balloonPrefix: '',
  leadingZeros: false,
  subDelimiter: '.',
  as9102Revision: 'Rev C',
  exportFormat: 'AS9102',
  watermark: 'NONE',
  highResPdfExport: true,
  samplingStandard: 'ANSI/ASQ Z1.4',
  aqlLevel: '1.0',
  inspectionLevel: 'Level II'
};
