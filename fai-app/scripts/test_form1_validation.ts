/**
 * Test Suite: SAE AS9102 Form 1 (Part Accountability) Record Validation
 */
import { validateForm1Record } from '../src/services/validation/form1ValidationService';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion Failed: ${message}`);
  }
}

console.log('--- TEST: SAE AS9102 Form 1 Validation Service ---');

// 1. Valid Form 1 Dataset
const validRecord = {
  partNumber: 'AS9102-TMB-001',
  partRevision: 'C',
  cageCode: '1A2B3',
  drawingNumber: 'AS9102-TMB-001',
  drawingRevision: 'C',
  partName: 'TURBINE MOUNT BRACKET',
  lotSize: 200,
  samplingLevel: 'II',
  samplingType: 'NORMAL',
  aql: '1.0'
};

const resValid = validateForm1Record(validRecord);
assert(resValid.isValid === true, 'Complete valid record must pass validation');
assert(Object.keys(resValid.invalidFields).length === 0, 'No fields should be invalid');
assert(resValid.validatedRecord !== null, 'validatedRecord must be populated');
assert(resValid.validatedRecord?.lotSize === 200, 'lotSize must be parsed correctly');
console.log('✓ Valid Form 1 record passes validation successfully');

// 2. Empty / Null input
const resNull = validateForm1Record(null);
assert(resNull.isValid === false, 'Null record must fail validation');
assert(resNull.validatedRecord === null, 'validatedRecord must be null');
assert(resNull.invalidFields.partNumber === true, 'partNumber must be flagged');
assert(resNull.invalidFields.lotSize === true, 'lotSize must be flagged');
console.log('✓ Null/undefined record fails validation with all fields flagged');

// 3. Partial / Missing Fields
const missingRecord = {
  partNumber: '   ',
  partRevision: 'B',
  cageCode: '',
  drawingNumber: 'DWG-99',
  drawingRevision: 'A',
  partName: 'HOUSING',
  lotSize: 0, // Invalid lot size (must be >= 1)
  samplingLevel: 'I',
  samplingType: '',
  aql: '0.65'
};

const resPartial = validateForm1Record(missingRecord);
assert(resPartial.isValid === false, 'Partial/invalid record must fail validation');
assert(resPartial.invalidFields.partNumber === true, 'Whitespace partNumber must be invalid');
assert(resPartial.invalidFields.cageCode === true, 'Blank cageCode must be invalid');
assert(resPartial.invalidFields.lotSize === true, 'Lot size 0 must be invalid');
assert(resPartial.invalidFields.samplingType === true, 'Blank samplingType must be invalid');
assert(!resPartial.invalidFields.drawingNumber, 'Valid drawingNumber should not be flagged');
assert(!resPartial.invalidFields.partName, 'Valid partName should not be flagged');
console.log('✓ Partial and whitespace fields correctly identified and rejected');

// 4. String Lot Size Coercion
const stringLotRecord = {
  ...validRecord,
  lotSize: '150' as unknown as number
};
const resStringLot = validateForm1Record(stringLotRecord);
assert(resStringLot.isValid === true, 'String lot size should be converted if valid integer');
assert(resStringLot.validatedRecord?.lotSize === 150, 'String lot size correctly parsed to integer');
console.log('✓ String lot size conversion verified');

console.log('🎉 Form 1 Validation Test Suite Passed Cleanly!');
