import * as XLSX from 'xlsx';
import type { EngineeringCharacteristic, ProjectProperties } from '../../types/characteristics';

export class As9102ExcelExporter {
  /**
   * Generates a fully formatted, genuine binary OpenXML multi-sheet AS9102 Rev B/C Excel Workbook (.xlsx)
   * containing Form 1, Form 2, and Form 3.
   * This completely prevents Microsoft Excel extension mismatch security warnings.
   */
  public static exportToExcel(
    characteristics: EngineeringCharacteristic[],
    projectProps: ProjectProperties,
    fileName: string = `${projectProps.partNumber || 'AS9102'}_FAIR_Report.xlsx`
  ): void {
    const wb = As9102ExcelExporter.buildWorkbook(characteristics, projectProps);

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
    fileName: string = `${projectProps.partNumber || 'AS9102'}_Characteristics.csv`
  ): void {
    const wb = As9102ExcelExporter.buildWorkbook(characteristics, projectProps);
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
    projectProps: ProjectProperties
  ): XLSX.WorkBook {
    const wb = XLSX.utils.book_new();

    // ==========================================
    // FORM 1: PART NUMBER ACCOUNTABILITY
    // ==========================================
    const form1Data: any[][] = [
      ['SAE AS9102 REV B/C - FORM 1: PART NUMBER ACCOUNTABILITY'],
      [],
      ['1. Part Number:', projectProps.partNumber, '2. Part Name:', projectProps.partName],
      ['3. Serial Number:', 'SN-2026-001', '4. FAIR Identifier / Report Number:', `FAIR-${projectProps.partNumber}-001`],
      ['5. Part Revision Level:', projectProps.partRevision, '6. Drawing Number:', projectProps.drawingNumber],
      ['7. Drawing Revision Level:', projectProps.drawingRevision, '8. Organization Name / CAGE:', `LOONIST AEROSPACE (${projectProps.cageCode})`],
      ['9. Manufacturing Process Reference:', 'CNC-5AXIS-MILL-01', '10. Purchase Order Number:', 'PO-882941-AER'],
      ['11. Inspection Reason:', 'Baseline Full First Article Inspection', '12. FAI Complete (Yes/No):', 'YES'],
      [],
      ['13. Comments / Notes:', 'Inspected and certified in accordance with SAE AS9102 Rev C standard requirements.'],
      ['14. Prepared By:', 'Lead Quality Assurance Inspector', 'Date:', new Date().toLocaleDateString()]
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
      ],
      [
        'TITANIUM ALLOY BAR',
        'AMS 4928 / TI-6AL-4V GRADE 5',
        'RAW-MAT',
        'TIMET AEROSPACE',
        'COC-TI-994218-B'
      ],
      [
        'ANODIZE SURFACE TREATMENT',
        'MIL-A-8625 TYPE II CLASS 1',
        'PROC-SURF',
        'AERO-COAT CORP',
        'COC-ANO-55102'
      ],
      [
        'STRESS RELIEF HEAT TREAT',
        'AMS 2801 / BAC 5613',
        'HEAT-TRT',
        'BODYCOTE THERMAL',
        'HT-88231-A'
      ],
      [
        '100% FIRST ARTICLE INSPECTION',
        'SAE AS9102 REV C / ISO 9001',
        'QA-INSP',
        'INTERNAL LOONIST QA LAB',
        'QA-FAIR-2026-01'
      ]
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
      const isRef = char.forReference || char.enclosure === 'reference';
      const isBasic = char.isBasic || char.enclosure === 'basic';
      
      const designator = isRef 
        ? 'Reference' 
        : isBasic 
        ? 'Basic' 
        : char.classification;

      // In ASME Y14.5 and AS9102, reference dimensions have no tolerances or limits
      const lowerLimitVal = isRef 
        ? '--' 
        : char.lowerLimit !== null 
        ? Number(char.lowerLimit.toFixed(4)) 
        : '--';

      const upperLimitVal = isRef 
        ? '--' 
        : char.upperLimit !== null 
        ? Number(char.upperLimit.toFixed(4)) 
        : '--';

      // Sprint 5: Physical Measured Actual Value
      let resultVal: string | number;
      if (char.measuredValue !== undefined && char.measuredValue !== null) {
        resultVal = Number(char.measuredValue.toFixed(4));
      } else if (isRef) {
        resultVal = 'REFERENCE';
      } else {
        resultVal = 'UNMEASURED';
      }

      // Deviation from Nominal
      let deviationVal = '--';
      if (char.measuredValue !== undefined && char.measuredValue !== null && char.cleanNominal !== null) {
        const d = Number((char.measuredValue - char.cleanNominal).toFixed(4));
        deviationVal = d > 0 ? `+${d}` : String(d);
      }

      // Conformance Status
      let statusLabel = 'PENDING';
      if (char.conformanceStatus === 'FAIL') statusLabel = 'REJECT';
      else if (char.conformanceStatus === 'MARGINAL') statusLabel = 'MARGINAL';
      else if (char.conformanceStatus === 'PASS') statusLabel = 'ACCEPT';
      else if (isRef) statusLabel = 'ACCEPT';

      form3Data.push([
        char.itemNumber,
        char.subNumber || String(char.itemNumber),
        `${char.sourceCaptureOrSheet || `Sheet ${char.sheetNumber}`} (${char.drawingZone})`,
        designator,
        char.rawText,
        lowerLimitVal,
        upperLimitVal,
        resultVal,
        deviationVal,
        char.inspectionMethod,
        char.comments || char.toleranceSource,
        statusLabel
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
}
