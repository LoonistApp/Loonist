/**
 * LOONIST — Aerospace First Article Inspection Platform
 * Application Options & Enterprise System Configuration
 * 
 * Defines schemas for Workspace Ergonomics, Factory Master Data,
 * AS9102 Templates, Net-Inspect Cloud Gateway, and Cloudflare Ed25519 Licensing.
 */

export interface TableColumnConfig {
  id: string;
  label: string;
  visible: boolean;
  minWidth: number;
  width?: number;
  isLocked?: boolean; // e.g. Char # is always visible
}

export type TablePresetView = 'as9102-standard' | 'shop-floor' | 'gdt-focus' | 'custom';

export interface WorkspaceSettings {
  invertWheelZoom: boolean;
  panWithMiddleClick: boolean;
  canvasBackground: 'white' | 'charcoal' | 'blueprint';
  decimalSeparator: 'system' | '.' | ',';
  tableColumns: TableColumnConfig[];
  tablePresetView: TablePresetView;
}

export interface InspectionMethodItem {
  id: string;
  name: string;
  category: 'Manual' | 'CMM / Automated' | 'Optical' | 'Gages' | 'Other';
  description?: string;
  isDefault?: boolean;
}

export interface ManufacturingOperationItem {
  id: string;
  name: string;
  department: string;
  isDefault?: boolean;
}

export interface ClassificationItem {
  id: string;
  name: string;
  color: string;
  level: 'critical' | 'major' | 'minor' | 'reference';
}

export interface CustomFieldDefinition {
  id: string;
  key: string;
  label: string;
  defaultValue?: string;
  netInspectSlot?: number; // 1 to 10
}

export interface MasterDataSettings {
  inspectionMethods: InspectionMethodItem[];
  manufacturingOperations: ManufacturingOperationItem[];
  classifications: ClassificationItem[];
  customFields: CustomFieldDefinition[];
}

export interface TemplateItem {
  id: string;
  name: string;
  filename: string;
  standard: 'AS9102 Rev C' | 'AS9102 Rev B' | 'PPAP Level 3' | 'Custom';
  isDefault: boolean;
  isCustom: boolean;
  lastModified?: string;
}

export interface TemplatesSettings {
  projectTemplatesFolder: string;
  exportTemplatesFolder: string;
  activeTemplateId: string;
  templates: TemplateItem[];
}

export interface NetInspectFieldMapping {
  customFieldKey: string;
  customFieldLabel: string;
  netInspectField: string;
  publish: boolean;
}

export interface NetInspectSettings {
  enforceFieldSizes: boolean;
  flagBasicAsReportable: boolean;
  flagReferenceAsReportable: boolean;
  populateProfileNominal: boolean;
  customFieldMappings: NetInspectFieldMapping[];
}

export type LicenseStatus = 'ACTIVE' | 'OFFLINE_LEASE' | 'UNLICENSED' | 'REVOKED' | 'EXPIRED';

export interface CloudflareLicensePayload {
  licenseId: string;
  deviceId: string;
  tenantId: string;
  expiresAt: string;
  features: string[];
}

export interface LicensingSettings {
  apiUrl: string;
  status: LicenseStatus;
  tokenInput: string;
  tenantId: string;
  tenantName: string;
  deviceId: string;
  licenseId: string;
  expiresAt: string | null;
  features: string[];
  signature: string;
  devicePublicKey: string;
  devicePrivateKeyHex: string;
  isAirGapped: boolean;
  lastValidatedAt: string | null;
}

export interface ItarPrivacySettings {
  localProcessingOnly: boolean;
  anonymousTelemetry: boolean;
  updateNotifications: boolean;
  hardwareAcceleration: boolean;
}

export interface ApplicationOptions {
  workspace: WorkspaceSettings;
  masterData: MasterDataSettings;
  templates: TemplatesSettings;
  netInspect: NetInspectSettings;
  licensing: LicensingSettings;
  itarPrivacy: ItarPrivacySettings;
}

export const DEFAULT_TABLE_COLUMNS: TableColumnConfig[] = [
  { id: 'balloonNumber', label: 'Char #', visible: true, minWidth: 60, isLocked: true },
  { id: 'rawText', label: 'Drawing Callout', visible: true, minWidth: 150 },
  { id: 'type', label: 'Type', visible: true, minWidth: 90 },
  { id: 'cleanNominal', label: 'Nominal', visible: true, minWidth: 80 },
  { id: 'plusTol', label: '+Tol', visible: true, minWidth: 70 },
  { id: 'minusTol', label: '-Tol', visible: true, minWidth: 70 },
  { id: 'upperLimit', label: 'Upper Limit', visible: true, minWidth: 85 },
  { id: 'lowerLimit', label: 'Lower Limit', visible: true, minWidth: 85 },
  { id: 'measuredValue', label: 'Actual Measured', visible: true, minWidth: 100 },
  { id: 'deviation', label: 'Deviation', visible: true, minWidth: 80 },
  { id: 'status', label: 'Status', visible: true, minWidth: 80 },
  { id: 'source', label: 'Sheet / Zone', visible: true, minWidth: 90 },
  { id: 'method', label: 'Tool / Method', visible: true, minWidth: 120 },
  { id: 'classification', label: 'Classification', visible: true, minWidth: 100 },
  { id: 'operation', label: 'Operation', visible: false, minWidth: 100 },
  { id: 'gdtCharacteristic', label: 'GD&T Sym', visible: false, minWidth: 75 },
  { id: 'datumReference', label: 'Datums', visible: false, minWidth: 90 },
  { id: 'notes', label: 'Inspector Notes', visible: false, minWidth: 120 },
];

export const DEFAULT_INSPECTION_METHODS: InspectionMethodItem[] = [
  { id: 'm-caliper', name: 'Caliper', category: 'Manual', isDefault: true },
  { id: 'm-micrometer', name: 'Micrometer', category: 'Manual', isDefault: true },
  { id: 'm-height-gage', name: 'Height Gage', category: 'Manual', isDefault: true },
  { id: 'm-cmm', name: 'CMM', category: 'CMM / Automated', isDefault: true },
  { id: 'm-optical-comp', name: 'Optical Comparator', category: 'Optical', isDefault: true },
  { id: 'm-thread-gage', name: 'Thread Gage', category: 'Gages', isDefault: true },
  { id: 'm-pin-gage', name: 'Pin Gage', category: 'Gages', isDefault: true },
  { id: 'm-bore-gage', name: 'Bore Gage', category: 'Gages', isDefault: true },
  { id: 'm-surface-plate', name: 'Surface Plate', category: 'Manual', isDefault: true },
  { id: 'm-visual', name: 'Visual / Visual Inspection', category: 'Manual', isDefault: true },
  { id: 'm-zeiss-prismo', name: 'Zeiss Prismo CMM', category: 'CMM / Automated' },
  { id: 'm-mitutoyo-digimatic', name: 'Mitutoyo Digimatic 8"', category: 'Manual' },
];

export const DEFAULT_MANUFACTURING_OPERATIONS: ManufacturingOperationItem[] = [
  { id: 'op-cnc-mill', name: 'CNC 5-Axis Milling', department: 'Machining', isDefault: true },
  { id: 'op-lathe', name: 'CNC Lathe Turning', department: 'Machining', isDefault: true },
  { id: 'op-wire-edm', name: 'Wire EDM', department: 'Machining', isDefault: true },
  { id: 'op-sheet-metal', name: 'Sheet Metal Brake', department: 'Fabrication', isDefault: true },
  { id: 'op-deburr', name: 'Deburr & Surface Prep', department: 'Finishing', isDefault: true },
  { id: 'op-heat-treat', name: 'Vacuum Heat Treat', department: 'Special Processing', isDefault: true },
  { id: 'op-anodize', name: 'Anodize Type II/III', department: 'Surface Finishing', isDefault: true },
  { id: 'op-final-insp', name: 'Final Quality Inspection', department: 'Quality Assurance', isDefault: true },
];

export const DEFAULT_CLASSIFICATIONS: ClassificationItem[] = [
  { id: 'cls-critical', name: 'Critical (Flight Safety)', color: '#ef4444', level: 'critical' },
  { id: 'cls-major', name: 'Major (Fit / Function)', color: '#f59e0b', level: 'major' },
  { id: 'cls-minor', name: 'Minor (Standard / General)', color: '#3b82f6', level: 'minor' },
  { id: 'cls-reference', name: 'Reference (Basic / Reference)', color: '#64748b', level: 'reference' },
];

export const DEFAULT_NET_INSPECT_MAPPINGS: NetInspectFieldMapping[] = [
  { customFieldKey: 'custom1', customFieldLabel: 'Heat / Lot Number', netInspectField: 'Heat / Melt Number', publish: true },
  { customFieldKey: 'custom2', customFieldLabel: 'Serial Number', netInspectField: 'Part Serial Number', publish: true },
  { customFieldKey: 'custom3', customFieldLabel: 'Raw Material Spec', netInspectField: 'Raw Material Heat Treat Code', publish: true },
  { customFieldKey: 'custom4', customFieldLabel: 'CMM Routine ID', netInspectField: 'CMM Program Number', publish: false },
  { customFieldKey: 'custom5', customFieldLabel: 'Inspector Badge ID', netInspectField: 'Inspector Identification', publish: true },
  { customFieldKey: 'custom6', customFieldLabel: 'Work Order #', netInspectField: 'Shop Order / Traveler #', publish: true },
  { customFieldKey: 'custom7', customFieldLabel: 'Purchase Order #', netInspectField: 'Customer Purchase Order', publish: false },
  { customFieldKey: 'custom8', customFieldLabel: 'Sub-Tier Supplier CAGE', netInspectField: 'Sub-tier Vendor Code', publish: false },
  { customFieldKey: 'custom9', customFieldLabel: 'Process Specification', netInspectField: 'Special Process Code', publish: false },
  { customFieldKey: 'custom10', customFieldLabel: 'Audit Record ID', netInspectField: 'Quality System Record #', publish: false },
];

export const DEFAULT_APPLICATION_OPTIONS: ApplicationOptions = {
  workspace: {
    invertWheelZoom: false,
    panWithMiddleClick: true,
    canvasBackground: 'charcoal',
    decimalSeparator: '.',
    tableColumns: DEFAULT_TABLE_COLUMNS,
    tablePresetView: 'as9102-standard'
  },
  masterData: {
    inspectionMethods: DEFAULT_INSPECTION_METHODS,
    manufacturingOperations: DEFAULT_MANUFACTURING_OPERATIONS,
    classifications: DEFAULT_CLASSIFICATIONS,
    customFields: DEFAULT_NET_INSPECT_MAPPINGS.map((m, i) => ({
      id: `cf-${i + 1}`,
      key: m.customFieldKey,
      label: m.customFieldLabel,
      netInspectSlot: i + 1
    }))
  },
  templates: {
    projectTemplatesFolder: 'C:\\LOONIST\\Templates\\Projects',
    exportTemplatesFolder: 'C:\\LOONIST\\Templates\\Excel',
    activeTemplateId: 'as9102-rev-c',
    templates: [
      { id: 'as9102-rev-c', name: 'SAE AS9102 Rev C (Standard Aerospace)', filename: 'AS9102C_Standard.xlsx', standard: 'AS9102 Rev C', isDefault: true, isCustom: false },
      { id: 'as9102-rev-b', name: 'SAE AS9102 Rev B (Legacy Aerospace)', filename: 'AS9102B_Legacy.xlsx', standard: 'AS9102 Rev B', isDefault: false, isCustom: false },
      { id: 'boeing-d6', name: 'Boeing D6-36230 Form 3 Layout', filename: 'Boeing_D6_36230.xlsx', standard: 'AS9102 Rev C', isDefault: false, isCustom: true },
      { id: 'ppap-level3', name: 'AIAG PPAP Level 3 Dimensional Results', filename: 'PPAP_Form3_Dimensional.xlsx', standard: 'PPAP Level 3', isDefault: false, isCustom: false }
    ]
  },
  netInspect: {
    enforceFieldSizes: true,
    flagBasicAsReportable: false,
    flagReferenceAsReportable: false,
    populateProfileNominal: true,
    customFieldMappings: DEFAULT_NET_INSPECT_MAPPINGS
  },
  licensing: {
    apiUrl: 'https://licensing.loonist.com',
    status: 'ACTIVE',
    tokenInput: '',
    tenantId: 'tenant-aerospace-corp-01',
    tenantName: 'LOONIST Aerospace Systems',
    deviceId: 'dev_' + Math.random().toString(36).substring(2, 10),
    licenseId: 'lic_enterprise_ed25519_demo',
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    features: ['ALL', 'AS9102_REV_C', 'NET_INSPECT_EXPORT', 'OFFLINE_AIRGAP'],
    signature: '7f9a8b1c4d2e3f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a',
    devicePublicKey: '3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b',
    devicePrivateKeyHex: '',
    isAirGapped: false,
    lastValidatedAt: new Date().toISOString()
  },
  itarPrivacy: {
    localProcessingOnly: true,
    anonymousTelemetry: false,
    updateNotifications: true,
    hardwareAcceleration: true
  }
};
