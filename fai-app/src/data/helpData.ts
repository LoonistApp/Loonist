/**
 * LOONIST — Production Help & Engineering Knowledge Base
 * 100% Offline Embedded Standards for Air-Gapped Aerospace Environments
 * ASME Y14.5-2018 GD&T & SAE AS9102 Rev B/C Compliance Guides
 */

export interface GdtSymbolInfo {
  symbol: string;
  name: string;
  category: 'Form' | 'Orientation' | 'Location' | 'Profile' | 'Runout';
  asmeReference: string;
  definition: string;
  datumRequired: boolean;
  recommendedInspection: string[];
}

export const ASME_Y14_5_SYMBOLS: GdtSymbolInfo[] = [
  // 1. FORM (No datums required)
  {
    symbol: '⏤',
    name: 'Straightness',
    category: 'Form',
    asmeReference: 'ASME Y14.5-2018 Sec. 8.2',
    definition: 'Specifies a tolerance zone within which the considered line element or derived median line of a cylindrical feature must lie.',
    datumRequired: false,
    recommendedInspection: ['Dial Indicator with Surface Plate', 'Optical Comparator', 'CMM']
  },
  {
    symbol: '⏥',
    name: 'Flatness',
    category: 'Form',
    asmeReference: 'ASME Y14.5-2018 Sec. 8.4',
    definition: 'Specifies that all surface elements must lie within a tolerance zone defined by two parallel planes separated by the specified tolerance.',
    datumRequired: false,
    recommendedInspection: ['Surface Plate with Dial Test Indicator', 'Height Gage', 'CMM']
  },
  {
    symbol: '○',
    name: 'Circularity (Roundness)',
    category: 'Form',
    asmeReference: 'ASME Y14.5-2018 Sec. 8.3',
    definition: 'Limits surface elements on a cylinder, cone, or sphere to lie within two concentric circles separated by the radial tolerance.',
    datumRequired: false,
    recommendedInspection: ['V-Block with Indicator', 'Roundness Gage (Talyrond)', 'CMM']
  },
  {
    symbol: '⌭',
    name: 'Cylindricity',
    category: 'Form',
    asmeReference: 'ASME Y14.5-2018 Sec. 8.5',
    definition: 'Simultaneously controls circularity, straightness, and parallelism of a cylinder within two coaxial cylinders.',
    datumRequired: false,
    recommendedInspection: ['Specialized Roundness Machine', 'Multi-plane CMM Scan']
  },

  // 2. ORIENTATION (Datums required)
  {
    symbol: '⟂',
    name: 'Perpendicularity',
    category: 'Orientation',
    asmeReference: 'ASME Y14.5-2018 Sec. 9.4',
    definition: 'Controls a surface, center plane, or axis at exactly 90° relative to one or more datum reference planes.',
    datumRequired: true,
    recommendedInspection: ['Squareness Comparator', 'CMM', 'Precision Angle Plate']
  },
  {
    symbol: '∥',
    name: 'Parallelism',
    category: 'Orientation',
    asmeReference: 'ASME Y14.5-2018 Sec. 9.3',
    definition: 'Controls a surface, center plane, or axis equidistant along its entire length relative to a datum reference plane.',
    datumRequired: true,
    recommendedInspection: ['Dial Indicator sweep on Surface Plate', 'CMM']
  },
  {
    symbol: '∠',
    name: 'Angularity',
    category: 'Orientation',
    asmeReference: 'ASME Y14.5-2018 Sec. 9.2',
    definition: 'Controls a surface, center plane, or axis at any specified basic angle other than 90° or 0° relative to datum planes.',
    datumRequired: true,
    recommendedInspection: ['Sine Bar with Gage Blocks', 'Optical Comparator', 'CMM']
  },

  // 3. LOCATION (Datums required)
  {
    symbol: '⌖',
    name: 'Position (True Position)',
    category: 'Location',
    asmeReference: 'ASME Y14.5-2018 Sec. 10',
    definition: 'Defines a cylindrical, spherical, or planar zone within which the center, axis, or center plane of a feature of size is permitted to vary from true theoretical position.',
    datumRequired: true,
    recommendedInspection: ['CMM (Recommended)', 'Functional Go/No-Go Pin Fixture', 'Optical Vision System']
  },
  {
    symbol: '◎',
    name: 'Concentricity',
    category: 'Location',
    asmeReference: 'ASME Y14.5-2009 / 2018 Note',
    definition: 'Controls the derived median points of diametrically opposed elements to be congruent with a datum axis.',
    datumRequired: true,
    recommendedInspection: ['Precision Spindle / Dial Indicator Opposed Probes', 'CMM point-grid scan']
  },
  {
    symbol: '⌯',
    name: 'Symmetry',
    category: 'Location',
    asmeReference: 'ASME Y14.5-2009 / 2018 Note',
    definition: 'Controls median points of all opposed elements of two or more feature surfaces to lie within a plane congruent with datum axis.',
    datumRequired: true,
    recommendedInspection: ['Opposed Indicator Setup', 'CMM']
  },

  // 4. PROFILE
  {
    symbol: '⌓',
    name: 'Profile of a Surface',
    category: 'Profile',
    asmeReference: 'ASME Y14.5-2018 Sec. 11',
    definition: '3D tolerance zone extending along the true profile shape within which all points of the considered surface must lie.',
    datumRequired: false,
    recommendedInspection: ['Continuous Contact Scanning CMM', '3D Laser Optical Scanner']
  },
  {
    symbol: '⌒',
    name: 'Profile of a Line',
    category: 'Profile',
    asmeReference: 'ASME Y14.5-2018 Sec. 11.2',
    definition: '2D tolerance zone extending along any single cross-sectional cut of the feature.',
    datumRequired: false,
    recommendedInspection: ['Optical Comparator overlay chart', 'Profilometer', 'CMM 2D line scan']
  },

  // 5. RUNOUT
  {
    symbol: '↗',
    name: 'Circular Runout',
    category: 'Runout',
    asmeReference: 'ASME Y14.5-2018 Sec. 12.2',
    definition: 'Composite control affecting form, orientation, and coaxiality during a 360° rotation of the part about a datum axis.',
    datumRequired: true,
    recommendedInspection: ['Bench Center with Dial Test Indicator (TIR)', 'CMM with rotary table']
  },
  {
    symbol: '⤐',
    name: 'Total Runout',
    category: 'Runout',
    asmeReference: 'ASME Y14.5-2018 Sec. 12.3',
    definition: 'Simultaneously controls circular runout, straightness, taper, and barrel shape across the entire rotating surface.',
    datumRequired: true,
    recommendedInspection: ['Bench Center with traversing Dial Indicator', 'Rotary scanning CMM']
  }
];

export interface As9102FormField {
  fieldNumber: number;
  fieldName: string;
  isRequired: boolean;
  description: string;
  sampleValue: string;
}

export interface As9102FormSummary {
  formNumber: 1 | 2 | 3;
  formTitle: string;
  purpose: string;
  keyFields: As9102FormField[];
}

export const AS9102_FORMS_GUIDE: As9102FormSummary[] = [
  {
    formNumber: 1,
    formTitle: 'Part Number Accountability',
    purpose: 'Identifies the part being first-article inspected and any associated sub-assemblies, detail parts, and serial/lot numbers.',
    keyFields: [
      { fieldNumber: 1, fieldName: 'Part Number', isRequired: true, description: 'Customer drawing part number or model designation.', sampleValue: 'MS21250-04016' },
      { fieldNumber: 2, fieldName: 'Part Name', isRequired: true, description: 'Descriptive title of the component as identified on drawing.', sampleValue: 'BRACKET, MOUNTING TURBINE' },
      { fieldNumber: 3, fieldName: 'Serial Number', isRequired: false, description: 'Unique serialized component tracking identifier.', sampleValue: 'SN-2026-90412' },
      { fieldNumber: 4, fieldName: 'FAI Report Number', isRequired: true, description: 'Unique internal or customer FAIR tracking reference.', sampleValue: 'FAIR-2026-0811' },
      { fieldNumber: 5, fieldName: 'Drawing Number', isRequired: true, description: 'Base blueprint engineering drawing number.', sampleValue: 'DWG-90412-A' },
      { fieldNumber: 6, fieldName: 'Drawing Revision Level', isRequired: true, description: 'Active engineering revision level ballooned.', sampleValue: 'Rev C' },
      { fieldNumber: 7, fieldName: 'Organization Name', isRequired: true, description: 'Name and CAGE code of manufacturing supplier.', sampleValue: 'LOONIST AEROSPACE (CAGE 892X1)' },
      { fieldNumber: 8, fieldName: 'Supplier Code', isRequired: false, description: 'Vendor code assigned by the purchasing prime contractor.', sampleValue: 'V-99410' },
      { fieldNumber: 14, fieldName: 'Reason for FAI', isRequired: true, description: 'Baseline, delta, design change, or 2-year production lapse.', sampleValue: 'Baseline Initial Production Run' }
    ]
  },
  {
    formNumber: 2,
    formTitle: 'Product Process Accountability',
    purpose: 'Accounts for all raw materials, special processes (NDT, heat treat, passivate, anodize), and functional testing.',
    keyFields: [
      { fieldNumber: 1, fieldName: 'Process Name', isRequired: true, description: 'Special process name (e.g. Heat Treat, Anodize, NDT).', sampleValue: 'Fluorescent Penetrant Inspection (FPI)' },
      { fieldNumber: 2, fieldName: 'Specification Number', isRequired: true, description: 'Industry or customer material/process specification.', sampleValue: 'AMS 2175 Class 1 / ASTM E1417' },
      { fieldNumber: 3, fieldName: 'Code / CAGE', isRequired: false, description: 'Sub-tier supplier CAGE code executing the process.', sampleValue: 'CAGE 12345' },
      { fieldNumber: 4, fieldName: 'Special Process Supplier', isRequired: true, description: 'Approved processing facility certified by NADCAP.', sampleValue: 'AeroCoat Finishing Corp' },
      { fieldNumber: 5, fieldName: 'Customer Approval Verification', isRequired: true, description: 'Indicates if process source is on Prime Approved Supplier List.', sampleValue: 'Approved on OASIS / ASL' },
      { fieldNumber: 6, fieldName: 'Certificate of Conformance Number', isRequired: true, description: 'Traceable sub-tier physical certificate reference.', sampleValue: 'COC-88192-A' }
    ]
  },
  {
    formNumber: 3,
    formTitle: 'Characteristic Accountability, Verification and Compatibility Evaluation',
    purpose: 'Accounts for all dimensional, GD&T, electrical, visual, and metallurgical characteristics numbered by balloons.',
    keyFields: [
      { fieldNumber: 1, fieldName: 'Char Number (#Cha)', isRequired: true, description: 'Unique balloon callout index matching blueprint bubble.', sampleValue: '1, 2, 3... (or 1.1, 1.2)' },
      { fieldNumber: 2, fieldName: 'Reference Location', isRequired: true, description: 'Drawing sheet number and coordinate zone (e.g. Sheet 1, Zone D4).', sampleValue: 'Sht 1 [B3]' },
      { fieldNumber: 3, fieldName: 'Characteristic Designator', isRequired: false, description: 'Critical, Key, Major, or Minor designation.', sampleValue: 'Critical (Safety / Fit)' },
      { fieldNumber: 4, fieldName: 'Requirement', isRequired: true, description: 'Nominal dimension and allowable engineering limits.', sampleValue: '1.250 ±0.005 IN' },
      { fieldNumber: 5, fieldName: 'Results / Measured Value', isRequired: true, description: 'Actual physical measurement recorded by inspection gage.', sampleValue: '1.2514' },
      { fieldNumber: 6, fieldName: 'Designed Tooling / Inspection Equipment', isRequired: true, description: 'Specific instrument used for measurement.', sampleValue: 'Mitutoyo 0-1" Micrometer #QA-04' },
      { fieldNumber: 7, fieldName: 'Accept / Reject (Conformance)', isRequired: true, description: 'Evaluation outcome indicating if measurement is in-tolerance.', sampleValue: 'ACCEPT (Pass)' }
    ]
  }
];

export interface WorkflowStep {
  step: number;
  title: string;
  badge: string;
  description: string;
  keyAction: string;
}

export const QUICK_START_WORKFLOW: WorkflowStep[] = [
  {
    step: 1,
    title: 'Load Blueprint Drawing',
    badge: 'Vector PDF / TIFF',
    description: 'Open your multi-page engineering drawing via File Backstage menu (Ctrl+O) or Drag & Drop directly onto the viewport.',
    keyAction: 'Supports multi-sheet assemblies, vector geometry, and high-resolution CAD scans.'
  },
  {
    step: 2,
    title: 'Smart Extract & Auto-Balloon',
    badge: 'PaddleOCR + Vector Math',
    description: 'Click "Smart Extract" on the HOME tab. The engine automatically detects dimensions, GD&T feature control frames, notes, and assigns non-overlapping balloons.',
    keyAction: 'Balloons are automatically positioned using spatial R-Tree collision avoidance.'
  },
  {
    step: 3,
    title: 'Inspect & Verify Characteristics',
    badge: 'Lot QA / ASME Limits',
    description: 'Review characteristics in the bottom Table Manager. Enter physical measured values to see real-time Pass/Fail status, tolerance deviations, and assign inspection instruments.',
    keyAction: 'Balloons turn green (Pass) or red (Fail) dynamically on the canvas.'
  },
  {
    step: 4,
    title: 'Export Certified AS9102 FAIR',
    badge: 'SAE AS9102 Rev B/C',
    description: 'Click "Export AS9102 Excel" in File menu to generate certified multi-sheet Form 1, Form 2, and Form 3 workbooks, or export vector-marked blueprint PDFs with ITAR watermarks.',
    keyAction: 'Directly compatible with prime aerospace portals and Net-Inspect.'
  }
];

export const CAD_MOUSE_CONTROLS = [
  { action: 'Double-Click to Pan Canvas', input: 'Double-Click drawing to pan & drag freely in any direction' },
  { action: 'Pan Viewport Canvas', input: 'Space + Left Click Drag (or Middle Mouse Drag)' },
  { action: 'Smooth Zoom In / Out', input: 'Mouse Wheel Scroll' },
  { action: 'Select Characteristic / Balloon', input: 'Left Click on Canvas Balloon or Table Row' },
  { action: 'Move / Reposition Balloon', input: 'Left Click Drag Balloon (when unlocked)' },
  { action: 'Rotate Blueprint 90° Clockwise', input: 'R Key' },
  { action: 'Reset View / Fit to Screen', input: 'Ctrl + 0' }
];

export const RELEASE_HIGHLIGHTS_V2 = [
  'SAE AS9102 Rev C Certified Export Engine with Form 1, Form 2, and Form 3 multi-tab workbooks.',
  'ASME Y14.5 Precision Decimal Tolerancing Matrix (.X, .XX, .XXX) with dynamic title block fallbacks.',
  'Skip rules for reference dimensions (1.500) and GD&T boxed basic dimensions [2.250].',
  'PaddleOCR confidence floor review threshold for air-gapped machine quality assurance.',
  'Spatial R-Tree collision avoidance placement for crisp, non-overlapping characteristic markup.',
  'Air-gapped ITAR & EAR security watermark rendering across exported marked PDF blueprints.'
];
