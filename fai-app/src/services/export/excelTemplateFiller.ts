import { unzipSync, zipSync, strFromU8, strToU8 } from 'fflate';
import * as XLSX from 'xlsx';
import type { EngineeringCharacteristic, ProjectProperties } from '../../types/characteristics';
import { As9102ExcelExporter } from './as9102ExcelExporter';

/**
 * Fills a customer-supplied Excel template (.xlsx / .xltx) with LOONIST inspection data.
 *
 * Works directly on the workbook XML so every style, logo, border, merged cell and
 * print setting in the customer's template is preserved exactly.
 *
 * Template syntax:
 * - `{{partNumber}}`, `{{drawingRevision}}`, ... anywhere in a cell → replaced by project fields.
 * - A row containing `{{char.*}}` placeholders is the Form 3 row: it is repeated once per
 *   characteristic and every row below it is shifted down.
 */

export type TemplateValue = string | number;

export const PROJECT_TOKENS: Record<string, string> = {
  partNumber: 'Part number',
  partName: 'Part name',
  partRevision: 'Part revision',
  drawingNumber: 'Drawing number',
  drawingName: 'Drawing name',
  drawingRevision: 'Drawing revision',
  cageCode: 'CAGE code',
  lotSize: 'Lot size',
  samplingLevel: 'Sampling level',
  samplingType: 'Sampling type',
  aql: 'AQL',
  units: 'Drawing units (in / mm)',
  fairNumber: 'FAIR number (FAIR-<part number>)',
  date: 'Export date',
  characteristicCount: 'Number of characteristics'
};

export const CHARACTERISTIC_TOKENS: Record<string, string> = {
  'char.itemNumber': 'Characteristic number',
  'char.subNumber': 'Sub number (e.g. 3.1)',
  'char.location': 'Reference location (sheet + zone)',
  'char.sheet': 'Sheet number',
  'char.zone': 'Drawing zone',
  'char.designator': 'Designator (Major / Minor / Reference / Basic)',
  'char.requirement': 'Requirement as written on the drawing',
  'char.nominal': 'Nominal value',
  'char.plusTol': 'Plus tolerance',
  'char.minusTol': 'Minus tolerance',
  'char.lowerLimit': 'Lower limit',
  'char.upperLimit': 'Upper limit',
  'char.units': 'Units',
  'char.result': 'Measured result',
  'char.deviation': 'Deviation from nominal',
  'char.method': 'Inspection method / tooling',
  'char.status': 'ACCEPT / REJECT / MARGINAL / PENDING',
  'char.comments': 'Comments / tolerance source'
};

export interface TemplateInspection {
  isValid: boolean;
  error?: string;
  projectTokens: string[];
  characteristicTokens: string[];
  unknownTokens: string[];
  repeatRowSheets: string[];
}

const TOKEN_RE = /\{\{\s*([A-Za-z][\w.]*)\s*\}\}/g;

interface SheetEntry {
  path: string;
  name: string;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function buildProjectValues(
  projectProps: ProjectProperties,
  characteristicCount: number
): Record<string, TemplateValue> {
  return {
    partNumber: projectProps.partNumber ?? '',
    partName: projectProps.partName ?? '',
    partRevision: projectProps.partRevision ?? '',
    drawingNumber: projectProps.drawingNumber ?? '',
    drawingName: projectProps.drawingName ?? '',
    drawingRevision: projectProps.drawingRevision ?? '',
    cageCode: projectProps.cageCode ?? '',
    lotSize: projectProps.lotSize ?? '',
    samplingLevel: projectProps.samplingLevel ?? '',
    samplingType: projectProps.samplingType ?? '',
    aql: projectProps.aql ?? '',
    units: projectProps.units ?? '',
    fairNumber: `FAIR-${projectProps.partNumber ?? ''}`,
    date: new Date().toLocaleDateString(),
    characteristicCount
  };
}

export function buildCharacteristicValues(char: EngineeringCharacteristic, balloonPrefix?: string): Record<string, TemplateValue> {
  const row = As9102ExcelExporter.buildForm3Row(char, balloonPrefix);
  return {
    'char.itemNumber': char.itemNumber,
    'char.subNumber': row.subNumber,
    'char.location': row.location,
    'char.sheet': char.sheetNumber,
    'char.zone': char.drawingZone ?? '',
    'char.designator': row.designator,
    'char.requirement': char.rawText ?? '',
    'char.nominal': char.cleanNominal ?? '',
    'char.plusTol': char.plusTol ?? '',
    'char.minusTol': char.minusTol ?? '',
    'char.lowerLimit': row.lowerLimit,
    'char.upperLimit': row.upperLimit,
    'char.units': char.units ?? '',
    'char.result': row.result,
    'char.deviation': row.deviation,
    'char.method': char.inspectionMethod ?? '',
    'char.status': row.status,
    'char.comments': row.comments ?? ''
  };
}

/**
 * Generates a minimal starter template showing the placeholder syntax.
 * Users open it in Excel, apply their own layout and branding, and upload it back.
 */
export function buildStarterTemplate(): Uint8Array {
  const wb = XLSX.utils.book_new();

  const form1 = XLSX.utils.aoa_to_sheet([
    ['FORM 1: PART NUMBER ACCOUNTABILITY'],
    [],
    ['Part Number', '{{partNumber}}', 'Part Name', '{{partName}}'],
    ['Part Revision', '{{partRevision}}', 'Drawing Number', '{{drawingNumber}}'],
    ['Drawing Revision', '{{drawingRevision}}', 'CAGE Code', '{{cageCode}}'],
    ['FAIR Number', '{{fairNumber}}', 'Date', '{{date}}'],
    ['Lot Size', '{{lotSize}}', 'Sampling', '{{samplingLevel}} {{samplingType}} AQL {{aql}}']
  ]);
  form1['!cols'] = [{ wch: 20 }, { wch: 28 }, { wch: 20 }, { wch: 36 }];
  XLSX.utils.book_append_sheet(wb, form1, 'Form 1');

  const form3 = XLSX.utils.aoa_to_sheet([
    ['FORM 3: CHARACTERISTIC ACCOUNTABILITY'],
    ['Part Number', '{{partNumber}}', 'FAIR Number', '{{fairNumber}}'],
    [],
    ['Char No.', 'Sub No.', 'Location', 'Designator', 'Requirement', 'Lower Limit', 'Upper Limit', 'Result', 'Deviation', 'Tooling', 'Status', 'Comments'],
    ['{{char.itemNumber}}', '{{char.subNumber}}', '{{char.location}}', '{{char.designator}}', '{{char.requirement}}', '{{char.lowerLimit}}', '{{char.upperLimit}}', '{{char.result}}', '{{char.deviation}}', '{{char.method}}', '{{char.status}}', '{{char.comments}}'],
    [],
    ['Total characteristics', '{{characteristicCount}}'],
    ['Inspected by', '', 'Date', '{{date}}']
  ]);
  form3['!cols'] = [{ wch: 9 }, { wch: 9 }, { wch: 22 }, { wch: 12 }, { wch: 30 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 18 }, { wch: 10 }, { wch: 30 }];
  XLSX.utils.book_append_sheet(wb, form3, 'Form 3');

  return new Uint8Array(XLSX.write(wb, { bookType: 'xlsx', type: 'array' }));
}

/**
 * Validates an uploaded template and reports which placeholders it uses.
 */
export function inspectTemplate(bytes: Uint8Array): TemplateInspection {
  const empty: TemplateInspection = {
    isValid: false,
    projectTokens: [],
    characteristicTokens: [],
    unknownTokens: [],
    repeatRowSheets: []
  };

  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes);
  } catch {
    return { ...empty, error: 'This is not a valid .xlsx file. Save the template as an Excel Workbook (.xlsx) and try again.' };
  }
  if (!files['xl/workbook.xml']) {
    return { ...empty, error: 'This file does not contain an Excel workbook.' };
  }

  const shared = readSharedStrings(files);
  const found = new Set<string>();
  const repeatRowSheets: string[] = [];

  for (const sheet of listSheets(files)) {
    const xml = strFromU8(files[sheet.path]);
    let sheetHasRepeatRow = false;
    for (const rowXml of xml.match(/<row\b[\s\S]*?<\/row>/g) ?? []) {
      let rowHasCharToken = false;
      for (const cell of parseCells(rowXml)) {
        const text = cellText(cell, shared);
        if (text === null) continue;
        for (const m of text.matchAll(TOKEN_RE)) {
          found.add(m[1]);
          if (m[1].startsWith('char.')) rowHasCharToken = true;
        }
      }
      if (rowHasCharToken) sheetHasRepeatRow = true;
    }
    if (sheetHasRepeatRow) repeatRowSheets.push(sheet.name);
  }

  const projectTokens = [...found].filter(t => t in PROJECT_TOKENS);
  const characteristicTokens = [...found].filter(t => t in CHARACTERISTIC_TOKENS);
  const unknownTokens = [...found].filter(t => !(t in PROJECT_TOKENS) && !(t in CHARACTERISTIC_TOKENS));

  if (found.size === 0) {
    return {
      ...empty,
      error: 'No {{placeholders}} were found. Add fields such as {{partNumber}} and a Form 3 row with {{char.itemNumber}}, {{char.requirement}}, {{char.result}}.'
    };
  }

  return { isValid: true, projectTokens, characteristicTokens, unknownTokens, repeatRowSheets };
}

/**
 * Produces a filled .xlsx from a template. The input bytes are not modified.
 */
export function fillExcelTemplate(
  templateBytes: Uint8Array,
  projectValues: Record<string, TemplateValue>,
  characteristicRows: Record<string, TemplateValue>[]
): Uint8Array {
  const files = unzipSync(templateBytes);
  const shared = readSharedStrings(files);

  for (const sheet of listSheets(files)) {
    const xml = strFromU8(files[sheet.path]);
    const filled = fillSheet(xml, shared, projectValues, characteristicRows);
    if (filled !== xml) {
      files[sheet.path] = strToU8(filled);
    }
  }

  // An .xltx template must be saved as a normal workbook
  const ct = files['[Content_Types].xml'];
  if (ct) {
    files['[Content_Types].xml'] = strToU8(
      strFromU8(ct).replace(
        'application/vnd.openxmlformats-officedocument.spreadsheetml.template.main+xml',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml'
      )
    );
  }

  // Excel recalculates formulas on open (cached values may reference the template rows)
  const wbXml = files['xl/workbook.xml'];
  if (wbXml) {
    let wb = strFromU8(wbXml);
    if (/<calcPr\b/.test(wb)) {
      if (!/fullCalcOnLoad=/.test(wb)) wb = wb.replace(/<calcPr\b/, '<calcPr fullCalcOnLoad="1"');
    } else {
      wb = wb.replace('</workbook>', '<calcPr fullCalcOnLoad="1"/></workbook>');
    }
    files['xl/workbook.xml'] = strToU8(wb);
  }
  delete files['xl/calcChain.xml'];

  return zipSync(files, { level: 6 });
}

// ---------------------------------------------------------------------------
// Sheet processing
// ---------------------------------------------------------------------------

interface ParsedCell {
  xml: string;
  ref: string;
  attrs: string;
  inner: string;
}

function fillSheet(
  xml: string,
  shared: string[],
  projectValues: Record<string, TemplateValue>,
  characteristicRows: Record<string, TemplateValue>[]
): string {
  const sheetDataMatch = xml.match(/<sheetData\b[^>]*>([\s\S]*?)<\/sheetData>/);
  if (!sheetDataMatch) return xml;

  const rows = sheetDataMatch[1].match(/<row\b[\s\S]*?<\/row>|<row\b[^>]*\/>/g) ?? [];

  // Locate the first row containing characteristic placeholders
  let repeatIndex = -1;
  for (let i = 0; i < rows.length; i++) {
    if (parseCells(rows[i]).some(c => (cellText(c, shared) ?? '').match(/\{\{\s*char\./))) {
      repeatIndex = i;
      break;
    }
  }

  let changed = false;
  const outRows: string[] = [];
  let shift = 0;
  let repeatRowNumber = -1;

  for (let i = 0; i < rows.length; i++) {
    const rowXml = rows[i];
    const rowNum = rowNumber(rowXml);

    if (i === repeatIndex) {
      repeatRowNumber = rowNum;
      const values = characteristicRows.length > 0 ? characteristicRows : [];
      values.forEach((charValues, n) => {
        const merged = { ...projectValues, ...charValues };
        const cloned = shiftRow(rowXml, rowNum + n);
        outRows.push(replaceTokensInRow(cloned, shared, merged));
      });
      shift = values.length - 1;
      changed = true;
      continue;
    }

    let r = rowXml;
    if (repeatIndex !== -1 && i > repeatIndex && shift !== 0) {
      r = shiftRow(r, rowNum + shift);
      changed = true;
    }
    const replaced = replaceTokensInRow(r, shared, projectValues);
    if (replaced !== r) changed = true;
    outRows.push(replaced);
  }

  if (!changed) return xml;

  let out = xml.replace(sheetDataMatch[0], sheetDataMatch[0].replace(sheetDataMatch[1], outRows.join('')));

  if (repeatRowNumber !== -1 && shift !== 0) {
    out = shiftSheetRanges(out, repeatRowNumber, shift);
  }
  return out;
}

function replaceTokensInRow(rowXml: string, shared: string[], values: Record<string, TemplateValue>): string {
  return rowXml.replace(/<c\b[^>]*\/>|<c\b[^>]*>[\s\S]*?<\/c>/g, cellXml => {
    const cell = parseCell(cellXml);
    if (!cell) return cellXml;
    const text = cellText(cell, shared);
    if (text === null || !TOKEN_RE.test(text)) {
      TOKEN_RE.lastIndex = 0;
      return cellXml;
    }
    TOKEN_RE.lastIndex = 0;

    const attrs = cell.attrs.replace(/\s+t="[^"]*"/, '');

    // A cell holding exactly one placeholder keeps numeric values numeric
    const single = text.trim().match(/^\{\{\s*([A-Za-z][\w.]*)\s*\}\}$/);
    if (single) {
      const v = values[single[1]];
      if (typeof v === 'number' && Number.isFinite(v)) {
        return `<c${attrs}><v>${v}</v></c>`;
      }
    }

    const replaced = text.replace(TOKEN_RE, (_m, key: string) => {
      const v = values[key];
      return v === undefined || v === null ? '' : String(v);
    });
    return `<c${attrs} t="inlineStr"><is><t xml:space="preserve">${escapeXml(replaced)}</t></is></c>`;
  });
}

// ---------------------------------------------------------------------------
// Row / reference shifting
// ---------------------------------------------------------------------------

function rowNumber(rowXml: string): number {
  const m = rowXml.match(/<row\b[^>]*\br="(\d+)"/);
  return m ? parseInt(m[1], 10) : 0;
}

function shiftRow(rowXml: string, newRowNumber: number): string {
  return rowXml
    .replace(/(<row\b[^>]*\br=")\d+(")/, `$1${newRowNumber}$2`)
    .replace(/(<c\b[^>]*\br="[A-Z]+)\d+(")/g, `$1${newRowNumber}$2`);
}

function shiftRef(ref: string, fromRow: number, shift: number): string {
  return ref.replace(/(\$?[A-Z]+\$?)(\d+)/g, (_m, col: string, row: string) => {
    const n = parseInt(row, 10);
    return `${col}${n > fromRow ? n + shift : n}`;
  });
}

/**
 * Moves merged cells, the sheet dimension and conditional formats that sit below the
 * repeated row, and stretches ranges that span it.
 */
function shiftSheetRanges(xml: string, repeatRow: number, shift: number): string {
  const adjustRange = (range: string): string =>
    range
      .split(' ')
      .map(part => {
        const [a, b] = part.split(':');
        if (!b) return shiftRef(a, repeatRow, shift);
        // A range ending on the repeat row grows with it
        const endRow = parseInt((b.match(/\d+/) ?? ['0'])[0], 10);
        const end = endRow === repeatRow ? b.replace(/\d+/, String(endRow + shift)) : shiftRef(b, repeatRow, shift);
        return `${shiftRef(a, repeatRow, shift)}:${end}`;
      })
      .join(' ');

  const copies = shift + 1;
  const rowOf = (ref: string) => parseInt((ref.match(/\d+/) ?? ['0'])[0], 10);

  return xml
    .replace(/<mergeCells\b[^>]*>([\s\S]*?)<\/mergeCells>/, (_m, inner: string) => {
      const refs = [...inner.matchAll(/<mergeCell\b[^>]*\bref="([^"]+)"/g)].map(m => m[1]);
      const out: string[] = [];
      for (const ref of refs) {
        const [a, b] = ref.split(':');
        if (b && rowOf(a) === repeatRow && rowOf(b) === repeatRow) {
          // Merges inside the Form 3 row are repeated on every generated row
          for (let k = 0; k < copies; k++) {
            out.push(`${a.replace(/\d+/, String(repeatRow + k))}:${b.replace(/\d+/, String(repeatRow + k))}`);
          }
        } else {
          out.push(adjustRange(ref));
        }
      }
      if (out.length === 0) return '';
      return `<mergeCells count="${out.length}">${out.map(r => `<mergeCell ref="${r}"/>`).join('')}</mergeCells>`;
    })
    .replace(/(<dimension\b[^>]*\bref=")([^"]+)(")/g, (_m, p, r, s) => `${p}${adjustRange(r)}${s}`)
    .replace(/(<conditionalFormatting\b[^>]*\bsqref=")([^"]+)(")/g, (_m, p, r, s) => `${p}${adjustRange(r)}${s}`)
    .replace(/(<dataValidation\b[^>]*\bsqref=")([^"]+)(")/g, (_m, p, r, s) => `${p}${adjustRange(r)}${s}`);
}

// ---------------------------------------------------------------------------
// Workbook parsing helpers
// ---------------------------------------------------------------------------

function listSheets(files: Record<string, Uint8Array>): SheetEntry[] {
  const wb = files['xl/workbook.xml'] ? strFromU8(files['xl/workbook.xml']) : '';
  const rels = files['xl/_rels/workbook.xml.rels'] ? strFromU8(files['xl/_rels/workbook.xml.rels']) : '';

  const targets = new Map<string, string>();
  for (const m of rels.matchAll(/<Relationship\b[^>]*>/g)) {
    const id = m[0].match(/\bId="([^"]+)"/)?.[1];
    const target = m[0].match(/\bTarget="([^"]+)"/)?.[1];
    if (id && target) targets.set(id, target);
  }

  const sheets: SheetEntry[] = [];
  for (const m of wb.matchAll(/<sheet\b[^>]*>/g)) {
    const name = decodeXml(m[0].match(/\bname="([^"]*)"/)?.[1] ?? '');
    const rid = m[0].match(/\br:id="([^"]+)"/)?.[1];
    const target = rid ? targets.get(rid) : undefined;
    if (!target) continue;
    const path = target.startsWith('/') ? target.slice(1) : `xl/${target.replace(/^\.\//, '')}`;
    if (files[path]) sheets.push({ path, name });
  }
  return sheets;
}

function readSharedStrings(files: Record<string, Uint8Array>): string[] {
  const sst = files['xl/sharedStrings.xml'];
  if (!sst) return [];
  const xml = strFromU8(sst);
  return (xml.match(/<si\b[\s\S]*?<\/si>/g) ?? []).map(si =>
    // Rich text runs are concatenated so a placeholder split across runs is still found
    decodeXml((si.match(/<t\b[^>]*>[\s\S]*?<\/t>/g) ?? []).map(t => t.replace(/<[^>]+>/g, '')).join(''))
  );
}

function parseCells(rowXml: string): ParsedCell[] {
  return (rowXml.match(/<c\b[^>]*\/>|<c\b[^>]*>[\s\S]*?<\/c>/g) ?? [])
    .map(parseCell)
    .filter((c): c is ParsedCell => c !== null);
}

function parseCell(cellXml: string): ParsedCell | null {
  const m = cellXml.match(/^<c\b([^>]*?)\/?>([\s\S]*?)(?:<\/c>)?$/);
  if (!m) return null;
  const attrs = m[1].replace(/\/$/, '');
  return {
    xml: cellXml,
    ref: attrs.match(/\br="([^"]+)"/)?.[1] ?? '',
    attrs,
    inner: m[2] ?? ''
  };
}

function cellText(cell: ParsedCell, shared: string[]): string | null {
  const type = cell.attrs.match(/\bt="([^"]+)"/)?.[1];
  if (type === 's') {
    const idx = cell.inner.match(/<v>(\d+)<\/v>/)?.[1];
    return idx !== undefined ? shared[parseInt(idx, 10)] ?? null : null;
  }
  if (type === 'inlineStr') {
    return decodeXml((cell.inner.match(/<t\b[^>]*>[\s\S]*?<\/t>/g) ?? []).map(t => t.replace(/<[^>]+>/g, '')).join(''));
  }
  if (type === 'str') {
    const v = cell.inner.match(/<v>([\s\S]*?)<\/v>/)?.[1];
    return v !== undefined ? decodeXml(v) : null;
  }
  return null;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function decodeXml(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}
