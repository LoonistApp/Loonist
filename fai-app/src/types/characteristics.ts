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

export type ConformanceStatus = 
  | 'PASS'          // Measured within tolerance band
  | 'MARGINAL'      // Within 10% of upper or lower tolerance boundary
  | 'FAIL'          // Out of tolerance
  | 'UNMEASURED';   // Pending physical measurement entry

export interface GdtFeatureControlFrame {
  characteristic: 
    | 'position'
    | 'flatness'
    | 'straightness'
    | 'circularity'
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
  projectedZone?: number;     // e.g. Ⓟ .500 projected tolerance zone height
  tangentPlane?: boolean;     // Ⓣ Tangent Plane modifier
  freeState?: boolean;        // Ⓕ Free State modifier
  compositeLowerTier?: {
    symbol?: string;
    toleranceValue: number;
    diameterSymbol?: boolean;
    materialModifier?: 'MMC' | 'LMC' | 'RFS';
    primaryDatum?: {
      datum: string;
      modifier?: 'MMC' | 'LMC' | 'RFS';
    };
    secondaryDatum?: {
      datum: string;
      modifier?: 'MMC' | 'LMC' | 'RFS';
    };
    tertiaryDatum?: {
      datum: string;
      modifier?: 'MMC' | 'LMC' | 'RFS';
    };
    rawText: string;
  };
  rawText: string;
}

export interface BoundingBox {
  x: number;          // PDF points relative to sheet origin (top-left)
  y: number;
  width: number;
  height: number;
}

export interface HoleFeatureCallout {
  holeType: 'thru' | 'blind' | 'counterbore' | 'countersink';
  depth?: number;
  counterboreDia?: number;
  counterboreDepth?: number;
  countersinkDia?: number;
  countersinkAngle?: number;
  rawCallout?: string;
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
  
  // InspectionXpert & AS9102 Form 3 Categorization
  displayType: 'Dimension' | 'GEOMETRIC TOLERANCE' | 'Symbol' | 'Note' | 'Surface Finish';
  subType: string;                // e.g. "Linear Dimension", "Diameter", "Radius", "Position", "Datum", "Note"
  classification: 'Critical' | 'Major' | 'Minor';
  isCritical?: boolean;
  operation?: string;
  comments?: string;
  isBasic: boolean;
  forReference: boolean;
  plusTol: number | null;
  minusTol: number | null;
  upperLimit: number | null;
  lowerLimit: number | null;
  sourceCaptureOrSheet?: string;

  gdtFrame?: GdtFeatureControlFrame;
  holeCallout?: HoleFeatureCallout;
  fractionStr?: string;
  isUnilateral?: boolean;
  isMaxOrMin?: 'MAX' | 'MIN';
  
  quantity: number;               // Quantity multiplier (e.g. 4 for "4X")
  isExpandedMultiplier?: boolean; // True if this row was auto-split from a 4X callout
  parentCharacteristicId?: string;
  
  inspectionMethod: InspectionMethod;
  
  // High-Confidence Quality Metrics
  confidenceScore: number;        // 0.0 to 1.0
  verificationStatus: VerificationStatus;
  extractionSource?: 'vector' | 'ocr' | 'manual';
  extractionConfidence?: number;  // Direct OCR/vision raw confidence (0.0 to 1.0)
  
  // Spatial coordinates on the blueprint canvas
  boundingBox: BoundingBox;

  // Custom user-dragged balloon coordinates (overrides default auto-placement)
  customBalloonPosition?: { x: number; y: number };

  // Clean Canvas Rule: Suppresses floating balloon rendering on CAD canvas for general notes while preserving row in Form 3 table
  skipBalloonRender?: boolean;

  // Sprint 5: Physical Quality Inspection & Conformance Measurement
  measuredValue?: number | null;
  conformanceStatus?: ConformanceStatus;
  inspectorInitials?: string;
  measuredAt?: string;
  deviation?: number | null;
}

export type BalloonShape = 'circle' | 'triangle' | 'hexagon' | 'square';

export interface BalloonAppearance {
  shape: BalloonShape;
  fit: number;
  fontSize: number;
  color: string;
  showLeaderLine: boolean;
  balloonGeneralNotes?: boolean; // When true, renders balloons on general notes block. Default false (Clean Canvas).
}

export interface ProjectProperties {
  partName: string;
  partNumber: string;
  partRevision: string;
  drawingName: string;
  drawingNumber: string;
  drawingRevision: string;
  cageCode: string;
  lotSize: number;
  samplingLevel: string;
  samplingType: string;
  aql: string;
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

