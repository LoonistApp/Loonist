import * as XLSX from 'xlsx';
import type { EngineeringCharacteristic, ProjectProperties } from '../../types/characteristics';
import type { PpapWarrantData } from '../../types/ppap';
import { PPAP_ELEMENTS, PPAP_SUBMISSION_LEVEL_LABELS } from '../../types/ppap';
import { As9102ExcelExporter } from './as9102ExcelExporter';

/**
 * Generates an AIAG PPAP (Production Part Approval Process) package workbook:
 * the Part Submission Warrant (Element 18), Dimensional Results (Element 9,
 * built from the same verified measurement data as the AS9102 Form 3 sheet),
 * and the PPAP Element Submission Status checklist for the other 16 elements
 * (Design Records, FMEAs, Control Plan, MSA, etc.), which LOONIST does not
 * capture and which are left for the inspector to attach or mark retained.
 */
export class PpapExcelExporter {
  public static exportToExcel(
    characteristics: EngineeringCharacteristic[],
    projectProps: ProjectProperties,
    warrant: PpapWarrantData,
    fileName: string = `${projectProps.partNumber || 'PPAP'}_PPAP_Package.xlsx`,
    balloonPrefix?: string
  ): void {
    const wb = PpapExcelExporter.buildWorkbook(characteristics, projectProps, warrant, balloonPrefix);
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    As9102ExcelExporter.downloadXlsx(new Uint8Array(wbout), fileName);
  }

  public static buildWorkbook(
    characteristics: EngineeringCharacteristic[],
    projectProps: ProjectProperties,
    warrant: PpapWarrantData,
    balloonPrefix?: string
  ): XLSX.WorkBook {
    const wb = XLSX.utils.book_new();

    const hasFailure = characteristics.some((c) => c.conformanceStatus === 'FAIL');
    const hasUnmeasured = characteristics.some(
      (c) => !c.forReference && c.enclosure !== 'reference' && (c.measuredValue === undefined || c.measuredValue === null)
    );
    const dimensionalMeetsRequirements = !hasFailure && !hasUnmeasured;

    const reasonText = warrant.reasonsForSubmission.includes('Other')
      ? [...warrant.reasonsForSubmission.filter((r) => r !== 'Other'), `Other: ${warrant.otherReasonExplanation}`].join('; ')
      : warrant.reasonsForSubmission.join('; ');

    // ==========================================
    // PART SUBMISSION WARRANT (ELEMENT 18)
    // ==========================================
    const pswData: any[][] = [
      ['AIAG PPAP: PART SUBMISSION WARRANT (PSW)'],
      [],
      ['PART INFORMATION'],
      ['Part Name:', projectProps.partName, 'Customer Part Number(s):', projectProps.partNumber],
      ['Shown on Drawing Number:', projectProps.drawingNumber, 'Engineering Drawing Change Level:', projectProps.drawingRevision],
      ['Part Revision Level:', projectProps.partRevision, 'Purchase Order Number:', warrant.purchaseOrderNumber],
      ['Safety and/or Government Regulated Part:', warrant.safetyOrGovernmentRegulated ? 'Yes' : 'No', 'Part Weight (kg):', warrant.partWeightKg],
      ['Checking Aid Number:', warrant.checkingAidNumber, 'Checking Aid Engineering Change Level:', warrant.checkingAidEngineeringLevel],
      ['Checking Aid Date:', warrant.checkingAidDate, '', ''],
      [],
      ['ORGANIZATION MANUFACTURING INFORMATION'],
      ['Organization Name / CAGE Code:', `${warrant.organizationName}${projectProps.cageCode ? ` / ${projectProps.cageCode}` : ''}`, 'Organization Address:', warrant.organizationAddress],
      [],
      ['CUSTOMER SUBMITTAL INFORMATION'],
      ['Customer Name / Division:', [warrant.customerName, warrant.customerDivision].filter(Boolean).join(' / '), 'Buyer / Buyer Code:', [warrant.buyerName, warrant.buyerCode].filter(Boolean).join(' / ')],
      ['Application:', warrant.application, '', ''],
      [],
      ['REASON FOR SUBMISSION:', reasonText],
      [],
      ['REQUESTED SUBMISSION LEVEL:', PPAP_SUBMISSION_LEVEL_LABELS[warrant.submissionLevel]],
      [],
      ['SUBMISSION RESULTS'],
      // Combined into one cell (rather than split label/value columns): these labels run
      // 40-70 characters, far past any column width that would still fit the shorter rows
      // on this sheet, so splitting them would always truncate one or the other on screen.
      [`Dimensional Measurements meet drawing/specification requirements: ${dimensionalMeetsRequirements ? 'YES' : 'NO (see Dimensional Results sheet)'}`],
      [`Material and Functional Tests meet requirements: ${warrant.materialFunctionalApplicable ? (warrant.materialFunctionalMeetsRequirements ? 'YES' : 'NO') : 'N/A'}`],
      [`Appearance Criteria meet requirements: ${warrant.appearanceApplicable ? (warrant.appearanceMeetsRequirements ? 'YES' : 'NO') : 'N/A'}`],
      [`Statistical Process Package meets requirements: ${warrant.statisticalPackageApplicable ? (warrant.statisticalPackageMeetsRequirements ? 'YES' : 'NO') : 'N/A'}`],
      ['Mold / Cavity / Production Process:', warrant.moldCavityProductionProcess],
      [],
      ['DECLARATION'],
      ['I affirm that the samples represented by this warrant are representative of our parts, which were made by a process that meets all Production Part Approval Process (PPAP) requirements. I further warrant these samples were produced at the stated production rate, and that documented evidence of such compliance is on file and available for review.'],
      ['Production Rate:', `${warrant.productionRateQty || '--'} pcs / ${warrant.productionRateHours || '--'} hrs`],
      ['Explanation / Comments:', warrant.explanationComments],
      [],
      ['PART WARRANT DISPOSITION:', warrant.warrantDisposition],
      ['Disposition Explanation:', warrant.dispositionExplanation],
      [],
      ['Organization Authorized Signature:', warrant.authorizedSignatureName],
      ['Title:', warrant.authorizedSignatureTitle, 'Phone:', warrant.authorizedSignaturePhone],
      ['Email:', warrant.authorizedSignatureEmail, 'Date:', warrant.authorizedSignatureDate],
      [],
      ['FOR CUSTOMER USE ONLY'],
      ['PPAP Warrant Disposition (Customer):', '☐ Approved   ☐ Rejected   ☐ Other'],
      ['Customer Signature:', '', 'Date:', '']
    ];

    const wsPsw = XLSX.utils.aoa_to_sheet(pswData);
    // Sized to the longest label/value actually placed in each column (e.g. "Safety and/or
    // Government Regulated Part:" in A, "Checking Aid Engineering Change Level:" in C) so a
    // non-empty neighbor cell never clips the one before it.
    wsPsw['!cols'] = [{ wch: 44 }, { wch: 40 }, { wch: 40 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(wb, wsPsw, 'PSW');

    // ==========================================
    // DIMENSIONAL RESULTS (ELEMENT 9)
    // ==========================================
    const dimData: any[][] = [
      ['PPAP ELEMENT 9: DIMENSIONAL RESULTS'],
      [],
      ['Part Number:', projectProps.partNumber, 'Part Name:', projectProps.partName, 'Customer:', warrant.customerName],
      [],
      [
        'Char No.',
        'Sub No.',
        'Reference Location',
        'Characteristic / Requirement',
        'Lower Limit',
        'Upper Limit',
        'Device / Method Used',
        'Measured Result',
        'Evaluation'
      ]
    ];

    for (const char of characteristics) {
      const row = As9102ExcelExporter.buildForm3Row(char, balloonPrefix);
      const evaluation = row.status === 'REJECT' ? 'REJECT' : row.status === 'MARGINAL' ? 'REVIEW REQUIRED' : row.status === 'PENDING' ? 'PENDING' : 'ACCEPT';
      dimData.push([
        char.itemNumber,
        row.subNumber,
        row.location,
        char.rawText,
        row.lowerLimit,
        row.upperLimit,
        char.inspectionMethod,
        row.result,
        evaluation
      ]);
    }

    const wsDim = XLSX.utils.aoa_to_sheet(dimData);
    wsDim['!cols'] = [
      { wch: 10 }, { wch: 10 }, { wch: 22 }, { wch: 40 },
      { wch: 14 }, { wch: 14 }, { wch: 22 }, { wch: 26 }, { wch: 16 }
    ];
    XLSX.utils.book_append_sheet(wb, wsDim, 'Dimensional Results');

    // ==========================================
    // PPAP ELEMENT SUBMISSION STATUS (ALL 18 ELEMENTS)
    // ==========================================
    const checklistData: any[][] = [
      ['PPAP ELEMENT SUBMISSION STATUS'],
      [],
      ['Part Number:', projectProps.partNumber, 'Requested Submission Level:', PPAP_SUBMISSION_LEVEL_LABELS[warrant.submissionLevel]],
      [],
      ['Element #', 'PPAP Element', 'Status', 'Notes'],
      ...PPAP_ELEMENTS.map((el) => [
        el.number,
        el.name,
        warrant.elementStatuses[el.number] || 'Retained',
        el.number === 9 ? 'See "Dimensional Results" sheet in this workbook' : ''
      ]),
      [],
      ['Submitted = included with this PPAP package.'],
      ['Retained = on file at the organization, available to the customer upon request.'],
      ['Not Applicable = does not apply to this part, process, or contract.']
    ];

    const wsChecklist = XLSX.utils.aoa_to_sheet(checklistData);
    // 62 fits the longest element name in full ("Records of Compliance with Customer-Specific
    // Requirements"), so it is never clipped by the non-empty Status cell beside it.
    wsChecklist['!cols'] = [{ wch: 10 }, { wch: 62 }, { wch: 16 }, { wch: 46 }];
    XLSX.utils.book_append_sheet(wb, wsChecklist, 'Element Status');

    return wb;
  }
}
