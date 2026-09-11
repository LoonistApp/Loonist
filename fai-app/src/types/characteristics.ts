/**
 * LOONIST — Aerospace First Article Inspection Platform
 * Domain Model for Engineering Characteristics, ASME Y14.5 GD&T, and AS9102 Form 3
 */

export type CharacteristicType = 
  | 'linear' 
  | 'diameter' 
  | 'radius' 
  | 'angle' 
  | 'gdt' 
  | 'thread' 
  | 'chamfer' 
  | 'note'
  | 'surface_finish';

export type DimensionEnclosure = 
  | 'standard'    // Standard toleranced dimension e.g. 1.500 ± .005
  | 'basic'       // ASME Y14.5 Basic dimension enclosed in box [ 1.500 ] (Tol = 0, linked to GD&T)
  | 'reference'   // Reference dimension enclosed in parens ( 2.750 ) (Informational only)
  | 'limit';      // Limit dimension specified as high/low e.g. 1.255 / 1.245

export type InspectionMethod = 
  | 'Caliper'
  | 'Micrometer'
  | 'Height Gage'
  | 'CMM'
  | 'Optical Comparator'
  | 'Thread Gage'
  | 'Pin Gage'
  | 'Bore Gage'
  | 'Surface Plate'
  | 'Visual / Visual Inspection'
  | 'Custom';

export type VerificationStatus = 
  | 'auto_accepted'   // Confidence >= 0.90
  | 'needs_review'    // Confidence < 0.90 or syntax anomaly
  | 'verified';       // Human validated by Quality Engineer

export interface GdtFeatureControlFrame {
  characteristic: 
    | 'position'
    | 'flatness'
    | 'straightness'
    | 'cylindricity'
    | 'perpendicularity'
    | 'parallelism'
    | 'angularity'
    | 'profile_surface'
    | 'profile_line'
    | 'circular_runout'
    | 'total_runout'
    | 'concentricity'
    | 'symmetry';
  symbol: string;               // e.g. "⌖", "⏥", "⟂", "∥", "⌒"
  toleranceValue: number;       // e.g. 0.010
  diameterSymbol?: boolean;     // e.g. Ø .010
  materialModifier?: 'MMC' | 'LMC' | 'RFS'; // Maximum Material Condition (Ⓜ), Least (Ⓛ), Regardless of Feature Size
  primaryDatum?: {
    datum: string;              // e.g. "A"
    modifier?: 'MMC' | 'LMC' | 'RFS';
  };
  secondaryDatum?: {
    datum: string;              // e.g. "B"
    modifier?: 'MMC' | 'LMC' | 'RFS';
  };
  tertiaryDatum?: {
    datum: string;              // e.g. "C"
    modifier?: 'MMC' | 'LMC' | 'RFS';
  };
  rawText: string;
}

export interface BoundingBox {
  x: number;          // PDF points relative to sheet origin (top-left)
  y: number;
  width: number;
  height: number;
}

export interface EngineeringCharacteristic {
  id: string;                     // Unique UUID / identifier
  itemNumber: number;             // Sequence number (1, 2, 3...)
  subNumber?: string;             // Sub-item sequence for multipliers e.g. "1.1", "1.2"
  sheetNumber: number;            // Blueprint sheet index (1-based)
  drawingZone: string;            // Standard Drawing Grid Zone e.g. "C-4", "B-2"
  type: CharacteristicType;
  enclosure: DimensionEnclosure;
  
  rawText: string;                // Raw string as OCR/Vision recognized
  cleanNominal: number | null;    // Mathematical nominal value e.g. 1.500
  upperTol: number;               // Upper allowable tolerance e.g. +0.005
  lowerTol: number;               // Lower allowable tolerance e.g. -0.005
  minLimit: number | null;        // CleanNominal - LowerTol
  maxLimit: number | null;        // CleanNominal + UpperTol
  units: 'in' | 'mm' | 'deg';
  
  isToleranceInherited: boolean;  // True if tolerance came from Title Block General Tolerances
  toleranceSource: string;        // e.g. "Explicit (±.005)" or "Title Block (.XXX)"
  
  gdtFrame?: GdtFeatureControlFrame;
  
  quantity: number;               // Quantity multiplier (e.g. 4 for "4X")
  isExpandedMultiplier?: boolean; // True if this row was auto-split from a 4X callout
  parentCharacteristicId?: string;
  
  inspectionMethod: InspectionMethod;
  
  // High-Confidence Quality Metrics
  confidenceScore: number;        // 0.0 to 1.0
  verificationStatus: VerificationStatus;
  
  // Spatial coordinates on the blueprint canvas
  boundingBox: BoundingBox;
}

export interface TitleBlockTolerancePreset {
  oneDecimal: number;     // .X default (e.g. ±0.030)
  twoDecimals: number;    // .XX default (e.g. ±0.010)
  threeDecimals: number;  // .XXX default (e.g. ±0.005)
  fourDecimals: number;   // .XXXX default (e.g. ±0.0005)
  angular: number;        // Angles default (e.g. ±0.5°)
  unit: 'in' | 'mm';
}

export const DEFAULT_AEROSPACE_TOLERANCES: TitleBlockTolerancePreset = {
  oneDecimal: 0.030,
  twoDecimals: 0.010,
  threeDecimals: 0.005,
  fourDecimals: 0.0005,
  angular: 0.5,
  unit: 'in'
};
