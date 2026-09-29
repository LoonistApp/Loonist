import type { ProjectProperties } from '../../types/characteristics';

export interface Form1ValidationResult {
  isValid: boolean;
  invalidFields: {
    partNumber?: boolean;
    partRevision?: boolean;
    cageCode?: boolean;
    drawingNumber?: boolean;
    drawingRevision?: boolean;
    partName?: boolean;
    lotSize?: boolean;
    samplingLevel?: boolean;
    samplingType?: boolean;
    aql?: boolean;
  };
  validatedRecord: ProjectProperties | null;
}

/**
 * Validates the entire AS9102 Form 1 dataset as one validated atomic record.
 * If any required field is blank, whitespace-only, or invalid, or if the record
 * has been cleared/deleted, the specification is immediately marked invalid.
 */
export function validateForm1Record(props: Partial<ProjectProperties> | null | undefined): Form1ValidationResult {
  const invalidFields: Form1ValidationResult['invalidFields'] = {};

  if (!props) {
    return {
      isValid: false,
      invalidFields: {
        partNumber: true,
        partRevision: true,
        cageCode: true,
        drawingNumber: true,
        drawingRevision: true,
        partName: true,
        lotSize: true,
        samplingLevel: true,
        samplingType: true,
        aql: true
      },
      validatedRecord: null
    };
  }

  // 1. Part Number: required non-empty string
  const partNumber = (props.partNumber ?? '').trim();
  if (!partNumber) invalidFields.partNumber = true;

  // 2. Part Revision: required non-empty string
  const partRevision = (props.partRevision ?? '').trim();
  if (!partRevision) invalidFields.partRevision = true;

  // 3. CAGE Code: required non-empty string
  const cageCode = (props.cageCode ?? '').trim();
  if (!cageCode) invalidFields.cageCode = true;

  // 4. Drawing Number: required non-empty string
  const drawingNumber = (props.drawingNumber ?? '').trim();
  if (!drawingNumber) invalidFields.drawingNumber = true;

  // 5. Drawing Revision: required non-empty string
  const drawingRevision = (props.drawingRevision ?? '').trim();
  if (!drawingRevision) invalidFields.drawingRevision = true;

  // 6. Part Name / Nomenclature: required non-empty string
  const partName = (props.partName ?? '').trim();
  if (!partName) invalidFields.partName = true;

  // 7. Production Lot Size: required positive integer >= 1
  const rawLot = props.lotSize as unknown;
  const lotNum = typeof rawLot === 'number' ? rawLot : Number(rawLot);
  if (rawLot === '' || rawLot === undefined || rawLot === null || isNaN(lotNum) || lotNum < 1) {
    invalidFields.lotSize = true;
  }

  // 8. Sampling Plan: required non-empty level & type
  const samplingLevel = (props.samplingLevel ?? '').trim();
  if (!samplingLevel) invalidFields.samplingLevel = true;

  const samplingType = (props.samplingType ?? '').trim();
  if (!samplingType) invalidFields.samplingType = true;

  // 9. AQL Threshold: required non-empty string
  const aql = (props.aql ?? '').trim();
  if (!aql) invalidFields.aql = true;

  const isValid = Object.keys(invalidFields).length === 0;

  const validatedRecord: ProjectProperties | null = isValid ? {
    partNumber,
    partRevision,
    cageCode,
    drawingNumber,
    drawingRevision,
    partName,
    lotSize: Math.floor(lotNum),
    samplingLevel,
    samplingType,
    aql,
    drawingName: props.drawingName || drawingNumber || partNumber
  } : null;

  return {
    isValid,
    invalidFields,
    validatedRecord
  };
}
