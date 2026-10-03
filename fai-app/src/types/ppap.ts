/**
 * LOONIST — Aerospace First Article Inspection Platform
 * Domain Model for AIAG PPAP (Production Part Approval Process) Exports
 *
 * Reference: AIAG PPAP Manual — 18 elements, 5 submission levels, and the
 * Part Submission Warrant (PSW) field set used by the automotive supply base.
 */

export type PpapSubmissionLevel = 1 | 2 | 3 | 4 | 5;

export const PPAP_SUBMISSION_LEVEL_LABELS: Record<PpapSubmissionLevel, string> = {
  1: 'Level 1: Warrant only submitted to customer',
  2: 'Level 2: Warrant with product samples and limited supporting data',
  3: 'Level 3: Warrant with product samples and complete supporting data',
  4: 'Level 4: Warrant and other requirements as defined by the customer',
  5: "Level 5: Warrant with product samples and complete supporting data reviewed at the organization's manufacturing location"
};

export const PPAP_SUBMISSION_LEVELS: PpapSubmissionLevel[] = [1, 2, 3, 4, 5];

export type PpapSubmissionReason =
  | 'Initial Submission'
  | 'Engineering Change(s)'
  | 'Tooling: Transfer'
  | 'Tooling: Replacement'
  | 'Tooling: Refurbishment'
  | 'Tooling: Additional'
  | 'Correction of Discrepancy'
  | 'Tooling Inactive > 1 Year'
  | 'Change in Part Processing'
  | 'Parts Produced at Additional Location'
  | 'Other';

export const PPAP_SUBMISSION_REASONS: PpapSubmissionReason[] = [
  'Initial Submission',
  'Engineering Change(s)',
  'Tooling: Transfer',
  'Tooling: Replacement',
  'Tooling: Refurbishment',
  'Tooling: Additional',
  'Correction of Discrepancy',
  'Tooling Inactive > 1 Year',
  'Change in Part Processing',
  'Parts Produced at Additional Location',
  'Other'
];

export type PpapWarrantDisposition = 'Approved' | 'Rejected' | 'Other';

export type PpapElementStatus = 'Submitted' | 'Retained' | 'Not Applicable';

export interface PpapElementDefinition {
  number: number;
  name: string;
}

// The 18 elements defined by the AIAG PPAP Manual.
export const PPAP_ELEMENTS: PpapElementDefinition[] = [
  { number: 1, name: 'Design Records' },
  { number: 2, name: 'Engineering Change Documents' },
  { number: 3, name: 'Customer Engineering Approval' },
  { number: 4, name: 'Design FMEA (DFMEA)' },
  { number: 5, name: 'Process Flow Diagrams' },
  { number: 6, name: 'Process FMEA (PFMEA)' },
  { number: 7, name: 'Control Plan' },
  { number: 8, name: 'Measurement System Analysis (MSA) Studies' },
  { number: 9, name: 'Dimensional Results' },
  { number: 10, name: 'Records of Material / Performance Test Results' },
  { number: 11, name: 'Initial Process Studies' },
  { number: 12, name: 'Qualified Laboratory Documentation' },
  { number: 13, name: 'Appearance Approval Report (AAR)' },
  { number: 14, name: 'Sample Production Parts' },
  { number: 15, name: 'Master Sample' },
  { number: 16, name: 'Checking Aids' },
  { number: 17, name: 'Records of Compliance with Customer-Specific Requirements' },
  { number: 18, name: 'Part Submission Warrant (PSW)' }
];

/**
 * The AIAG PPAP Manual's default pattern of which elements accompany the PSW
 * to the customer at each submission level (elements not sent are retained
 * on file at the supplier, available on request). Level 4 is explicitly
 * "as defined by the customer" so it is left to the user to configure.
 */
export function defaultElementStatusesForLevel(level: PpapSubmissionLevel): Record<number, PpapElementStatus> {
  const statuses: Record<number, PpapElementStatus> = {};
  for (const el of PPAP_ELEMENTS) {
    statuses[el.number] = 'Retained';
  }
  statuses[18] = 'Submitted'; // PSW always accompanies the submission

  if (level === 2) {
    statuses[9] = 'Submitted';  // Dimensional Results
    statuses[14] = 'Submitted'; // Sample Production Parts
  } else if (level === 3) {
    statuses[9] = 'Submitted';
    statuses[10] = 'Submitted'; // Material / Performance Test Results
    statuses[13] = 'Submitted'; // Appearance Approval Report (if applicable)
    statuses[14] = 'Submitted';
  }
  // Level 1: PSW only. Level 5: all elements reviewed on-site rather than submitted.
  // Level 4: customer-defined — left as "Retained" until the user adjusts it.
  return statuses;
}

export interface PpapWarrantData {
  // Organization (manufacturing site) information
  organizationName: string;
  organizationAddress: string;

  // Customer submittal information
  customerName: string;
  customerDivision: string;
  buyerName: string;
  buyerCode: string;
  application: string;

  // Part information not already captured by ProjectProperties
  safetyOrGovernmentRegulated: boolean;
  partWeightKg: string;
  purchaseOrderNumber: string;
  checkingAidNumber: string;
  checkingAidEngineeringLevel: string;
  checkingAidDate: string;

  // Reason for submission / submission level
  reasonsForSubmission: PpapSubmissionReason[];
  otherReasonExplanation: string;
  submissionLevel: PpapSubmissionLevel;

  // Submission results (dimensional is auto-derived from characteristic data at export time)
  materialFunctionalApplicable: boolean;
  materialFunctionalMeetsRequirements: boolean;
  appearanceApplicable: boolean;
  appearanceMeetsRequirements: boolean;
  statisticalPackageApplicable: boolean;
  statisticalPackageMeetsRequirements: boolean;
  moldCavityProductionProcess: string;

  // Declaration
  productionRateQty: string;
  productionRateHours: string;
  explanationComments: string;

  // Disposition & signature
  warrantDisposition: PpapWarrantDisposition;
  dispositionExplanation: string;
  authorizedSignatureName: string;
  authorizedSignatureTitle: string;
  authorizedSignaturePhone: string;
  authorizedSignatureEmail: string;
  authorizedSignatureDate: string;

  // Element Submission Status checklist (Element 1-18)
  elementStatuses: Record<number, PpapElementStatus>;
}

export function createDefaultPpapWarrant(): PpapWarrantData {
  return {
    organizationName: '',
    organizationAddress: '',
    customerName: '',
    customerDivision: '',
    buyerName: '',
    buyerCode: '',
    application: '',
    safetyOrGovernmentRegulated: false,
    partWeightKg: '',
    purchaseOrderNumber: '',
    checkingAidNumber: '',
    checkingAidEngineeringLevel: '',
    checkingAidDate: '',
    reasonsForSubmission: ['Initial Submission'],
    otherReasonExplanation: '',
    submissionLevel: 3,
    materialFunctionalApplicable: true,
    materialFunctionalMeetsRequirements: true,
    appearanceApplicable: false,
    appearanceMeetsRequirements: true,
    statisticalPackageApplicable: false,
    statisticalPackageMeetsRequirements: true,
    moldCavityProductionProcess: '',
    productionRateQty: '',
    productionRateHours: '',
    explanationComments: '',
    warrantDisposition: 'Approved',
    dispositionExplanation: '',
    authorizedSignatureName: '',
    authorizedSignatureTitle: '',
    authorizedSignaturePhone: '',
    authorizedSignatureEmail: '',
    authorizedSignatureDate: new Date().toLocaleDateString(),
    elementStatuses: defaultElementStatusesForLevel(3)
  };
}
