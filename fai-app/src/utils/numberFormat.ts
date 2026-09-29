/**
 * LOONIST — Industrial Precision Number Formatting & Locale Parsing
 * Supports US/Aerospace standard Period (.), European ISO Comma (,), and OS System Locale
 */

export type DecimalSeparatorPreference = 'system' | '.' | ',';

let cachedSystemSeparator: string | null = null;

export function getEffectiveDecimalSeparator(pref: DecimalSeparatorPreference = '.'): string {
  if (pref === '.') return '.';
  if (pref === ',') return ',';
  if (!cachedSystemSeparator) {
    try {
      const formatted = (1.1).toLocaleString();
      const match = formatted.match(/[^0-9]/);
      cachedSystemSeparator = match ? match[0] : '.';
    } catch {
      cachedSystemSeparator = '.';
    }
  }
  return cachedSystemSeparator;
}

/**
 * Format a number to a fixed precision string using the active decimal separator
 */
export function formatDecimal(
  val: number | null | undefined,
  precision: number = 4,
  pref: DecimalSeparatorPreference = '.'
): string {
  if (val === null || val === undefined || Number.isNaN(val)) return '--';
  const sep = getEffectiveDecimalSeparator(pref);
  const fixed = val.toFixed(precision);
  if (sep === '.') return fixed;
  return fixed.replace('.', sep);
}

/**
 * Format a number with dynamic trimmed trailing zeros (e.g. +0.05 instead of +0.0500)
 */
export function formatTolerance(
  val: number | null | undefined,
  pref: DecimalSeparatorPreference = '.',
  maxPrecision: number = 4
): string {
  if (val === null || val === undefined || Number.isNaN(val)) return '--';
  const sep = getEffectiveDecimalSeparator(pref);
  let str = val.toFixed(maxPrecision).replace(/\.?0+$/, '') || '0';
  if (sep !== '.') {
    str = str.replace('.', sep);
  }
  return str;
}

/**
 * Parse a user input string into a valid number, safely handling both '.' and ','
 */
export function parseDecimalInput(
  raw: string,
  pref: DecimalSeparatorPreference = '.'
): number {
  if (!raw) return NaN;
  let clean = raw.trim();
  const sep = getEffectiveDecimalSeparator(pref);
  
  if (sep === ',') {
    clean = clean.replace(/\s/g, '').replace(',', '.');
  } else {
    clean = clean.replace(/\s/g, '').replace(',', '.');
  }
  return parseFloat(clean);
}
