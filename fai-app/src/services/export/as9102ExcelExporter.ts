import * as XLSX from 'xlsx';
import type { EngineeringCharacteristic, ProjectProperties } from '../../types/characteristics';
import { formatBalloonNumber } from '../../utils/balloonFormat';

export class As9102ExcelExporter {
  /**
   * Generates a fully formatted, genuine binary OpenXML multi-sheet AS9102 Rev B/C Excel Workbook (.xlsx)
   * containing Form 1, Form 2, and Form 3.
   * This completely prevents Microsoft Excel extension mismatch security warnings.
   */
  public static exportToExcel(
    characteristics: EngineeringCharacteristic[],
    projectProps: ProjectProperties,
    fileName: string = `${projectProps.partNumber || 'AS9102'}_FAIR_Report.xlsx`,
    balloonPrefix?: string
  ): void {
    const wb = As9102ExcelExporter.buildWorkbook(characteristics, projectProps, balloonPrefix);

    // Generate binary XLSX buffer
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });

    // Ensure .xlsx extension to prevent any Microsoft Excel format mismatch alerts
    const targetFileName = fileName.endsWith('.xlsx')
      ? fileName
      : `${fileName.replace(/\.xls$/i, '')}.xlsx`;

    // Trigger browser download
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = targetFileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  }

  /**
   * Generates a clean tabular CSV containing AS9102 Form 3 characteristic verification data.
   */
  public static exportToCsv(
    characteristics: EngineeringCharacteristic[],
    projectProps: ProjectProperties,
    fileName: string = `${projectProps.partNumber || 'AS9102'}_Characteristics.csv`,
    balloonPrefix?: string
  ): void {
    const wb = As9102ExcelExporter.buildWorkbook(characteristics, projectProps, balloonPrefix);
    const form3Sheet = wb.Sheets['Form 3 - Characteristics'] || wb.Sheets[wb.SheetNames[2]] || wb.Sheets[wb.SheetNames[0]];
    const csvContent = XLSX.utils.sheet_to_csv(form3Sheet);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const targetFileName = fileName.endsWith('.csv') ? fileName : `${fileName.replace(/\.xlsx?$/i, '')}.csv`;
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = targetFileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  }

  /**
   * Constructs the full XLSX Workbook containing AS9102 Form 1, Form 2, and Form 3.
   */
  public static buildWorkbook(
    characteristics: EngineeringCharacteristic[],
    projectProps: ProjectProperties,
    balloonPrefix?: string
  ): XLSX.WorkBook {
    const wb = XLSX.utils.book_new();

    // ==========================================
    // FORM 1: PART NUMBER ACCOUNTABILITY
    // ==========================================
    // Fields LOONIST does not capture are left blank for the inspector to complete
    const form1Data: any[][] = [
      ['SAE AS9102 REV B/C - FORM 1: PART NUMBER ACCOUNTABILITY'],
      [],
      ['1. Part Number:', projectProps.partNumber, '2. Part Name:', projectProps.partName],
      ['3. Serial Number:', '', '4. FAIR Identifier / Report Number:', `FAIR-${projectProps.partNumber}`],
      ['5. Part Revision Level:', projectProps.partRevision, '6. Drawing Number:', projectProps.drawingNumber],
      ['7. Drawing Revision Level:', projectProps.drawingRevision, '8. Organization Name / CAGE:', projectProps.cageCode],
      ['9. Manufacturing Process Reference:', '', '10. Purchase Order Number:', ''],
      ['11. Inspection Reason:', '', '12. FAI Complete (Yes/No):', ''],
      ['Lot Size:', projectProps.lotSize, 'Sampling Plan:', [projectProps.samplingLevel, projectProps.samplingType, projectProps.aql ? `AQL ${projectProps.aql}` : ''].filter(Boolean).join(' ')],
      [],
      ['13. Comments / Notes:', ''],
      ['14. Prepared By:', '', 'Date:', new Date().toLocaleDateString()]
    ];

    const wsForm1 = XLSX.utils.aoa_to_sheet(form1Data);
    wsForm1['!cols'] = [
      { wch: 32 },
      { wch: 38 },
      { wch: 32 },
      { wch: 38 }
    ];
    XLSX.utils.book_append_sheet(wb, wsForm1, 'Form 1');

    // ==========================================
    // FORM 2: PRODUCT ACCOUNTABILITY (MATERIALS & PROCESSES)
    // ==========================================
    const form2Data: any[][] = [
      ['SAE AS9102 REV B/C - FORM 2: PRODUCT ACCOUNTABILITY (MATERIALS & SPECIAL PROCESSES)'],
      [],
      ['1. Part Number:', projectProps.partNumber, '2. Part Name:', projectProps.partName],
      [],
      [
        '5. Material or Process Name',
        '6. Specification Number',
        '7. Code',
        '8. Special Process Supplier',
        '10. Certificate of Conformance #'
      ]
      // Materials and special processes are entered by the inspector
    ];

    const wsForm2 = XLSX.utils.aoa_to_sheet(form2Data);
    wsForm2['!cols'] = [
      { wch: 32 },
      { wch: 32 },
      { wch: 14 },
      { wch: 28 },
      { wch: 24 }
    ];
    XLSX.utils.book_append_sheet(wb, wsForm2, 'Form 2');

    // ==========================================
    // FORM 3: CHARACTERISTIC ACCOUNTABILITY
    // ==========================================
    const form3Data: any[][] = [
      ['SAE AS9102 REV B/C - FORM 3: CHARACTERISTIC ACCOUNTABILITY, VERIFICATION & COMPATIBILITY EVALUATION'],
      [],
      [
        '1. Part Number:',
        projectProps.partNumber,
        '2. Part Name:',
        projectProps.partName,
        '',
        '',
        '',
        '',
        '',
        '4. FAIR Number:',
        `FAIR-${projectProps.partNumber}`
      ],
      [],
      [
        '5. Char No.',
        '6. Sub No.',
        '7. Reference Location',
        '8. Designator',
        '9. Requirement / Nominal',
        '10. Lower Limit',
        '11. Upper Limit',
        '12. Results (Measured Actual)',
        '13. Deviation',
        '14. Inspection Tooling',
        '15. Additional Data / Tolerance Source',
        '16. Status'
      ]
    ];

    for (const char of characteristics) {
      const row = As9102ExcelExporter.buildForm3Row(char, balloonPrefix);
      form3Data.push([
        char.itemNumber,
        row.subNumber,
        row.location,
        row.designator,
        char.rawText,
        row.lowerLimit,
        row.upperLimit,
        row.result,
        row.deviation,
        char.inspectionMethod,
        row.comments,
        row.status
      ]);
    }

    const wsForm3 = XLSX.utils.aoa_to_sheet(form3Data);
    wsForm3['!cols'] = [
      { wch: 10 },
      { wch: 10 },
      { wch: 22 },
      { wch: 16 },
      { wch: 40 },
      { wch: 14 },
      { wch: 14 },
      { wch: 26 },
      { wch: 14 },
      { wch: 24 },
      { wch: 40 },
      { wch: 14 }
    ];
    XLSX.utils.book_append_sheet(wb, wsForm3, 'Form 3');

    return wb;
  }

  /**
   * Computes the AS9102 Form 3 values for one characteristic.
   * Shared by the built-in workbook and customer Excel templates.
   */
  public static buildForm3Row(char: EngineeringCharacteristic, balloonPrefix?: string): Form3RowValues {
    const isRef = char.forReference || char.enclosure === 'reference';
    const isBasic = char.isBasic || char.enclosure === 'basic';

    const designator = isRef
      ? 'Reference'
      : isBasic
      ? 'Basic'
      : char.classification;

    // In ASME Y14.5 and AS9102, reference dimensions have no tolerances or limits
    const lowerLimit = isRef
      ? '--'
      : char.lowerLimit !== null
      ? Number(char.lowerLimit.toFixed(4))
      : '--';

    const upperLimit = isRef
      ? '--'
      : char.upperLimit !== null
      ? Number(char.upperLimit.toFixed(4))
      : '--';

    // Sprint 5: Physical Measured Actual Value
    let result: string | number;
    if (char.measuredValue !== undefined && char.measuredValue !== null) {
      result = Number(char.measuredValue.toFixed(4));
    } else if (isRef) {
      result = 'REFERENCE';
    } else {
      result = 'UNMEASURED';
    }

    // Deviation from Nominal
    let deviation = '--';
    if (char.measuredValue !== undefined && char.measuredValue !== null && char.cleanNominal !== null) {
      const d = Number((char.measuredValue - char.cleanNominal).toFixed(4));
      deviation = d > 0 ? `+${d}` : String(d);
    }

    // Conformance Status
    let status = 'PENDING';
    if (char.conformanceStatus === 'FAIL') status = 'REJECT';
    else if (char.conformanceStatus === 'MARGINAL') status = 'MARGINAL';
    else if (char.conformanceStatus === 'PASS') status = 'ACCEPT';
    else if (isRef) status = 'ACCEPT';

    return {
      subNumber: formatBalloonNumber(char.itemNumber, char.subNumber, balloonPrefix),
      location: `${char.sourceCaptureOrSheet || `Sheet ${char.sheetNumber}`} (${char.drawingZone})`,
      designator,
      lowerLimit,
      upperLimit,
      result,
      deviation,
      comments: char.comments || char.toleranceSource,
      status
    };
  }

  /**
   * Saves a generated workbook through the browser download pipeline.
   */
  public static downloadXlsx(bytes: Uint8Array, fileName: string): void {
    const targetFileName = fileName.endsWith('.xlsx')
      ? fileName
      : `${fileName.replace(/\.xl[st]x?$/i, '')}.xlsx`;
    const blob = new Blob([bytes as BlobPart], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = targetFileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  }
}

export interface Form3RowValues {
  subNumber: string;
  location: string;
  designator: string;
  lowerLimit: string | number;
  upperLimit: string | number;
  result: string | number;
  deviation: string;
  comments: string | undefined;
  status: string;
}
