/**
 * Computes standard aerospace drawing grid zones (e.g. "C-4", "A-2")
 * from bounding box coordinates and sheet dimensions.
 */

/** A drawing's own printed zone ruler, detected from its border grid labels. */
export interface DetectedZoneRuler {
  /** Column number labels (e.g. "1".."16") in reading order, with their sheet x position. */
  columns: Array<{ label: string; position: number }>;
  /** Row letter labels (e.g. "A".."L") in reading order, with their sheet y position. */
  rows: Array<{ label: string; position: number }>;
}

export class GridZoneCalculator {
  private static readonly ROW_LABELS = [
    'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
    'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'
  ];

  /**
   * Finds the label of the ruler entry nearest to `position`, clamping to the first/last entry
   * when `position` falls outside the detected ruler's span (a feature drawn right at the sheet
   * edge, beyond the outermost tick).
   */
  private static nearestLabel(entries: Array<{ label: string; position: number }>, position: number): string {
    let best = entries[0];
    let bestDist = Math.abs(entries[0].position - position);
    for (let i = 1; i < entries.length; i++) {
      const dist = Math.abs(entries[i].position - position);
      if (dist < bestDist) {
        best = entries[i];
        bestDist = dist;
      }
    }
    return best.label;
  }

  /**
   * Maps a coordinate (x, y) on a sheet of given width and height to an ASME/ISO drawing zone.
   *
   * Prefers the drawing's OWN printed zone ruler when one was detected (see
   * DrawingExtractionService.findBorderGridLabels) — interpolating against the real column/row
   * label positions rather than guessing. A drawing's zone count is a company/drafting-standard
   * choice (commonly 4, 6, 8, 12, or 16 per side) that cannot be reliably inferred from rendered
   * pixel dimensions alone, so a detected ruler is the only way to get this right in general;
   * without one (e.g. a scanned sheet with no extractable zone-ruler text), this falls back to a
   * coarse pixel-size-based estimate, which is necessarily approximate.
   */
  public static calculateZone(
    x: number,
    y: number,
    sheetWidth: number,
    sheetHeight: number,
    ruler?: DetectedZoneRuler | null
  ): string {
    if (sheetWidth <= 0 || sheetHeight <= 0) return 'Zone A-1';

    if (ruler && ruler.columns.length >= 3 && ruler.rows.length >= 3) {
      const colLabel = this.nearestLabel(ruler.columns, x);
      const rowLabel = this.nearestLabel(ruler.rows, y);
      return `Zone ${rowLabel}-${colLabel}`;
    }

    // Clamped normalized coordinates (0.0 to 1.0)
    const normX = Math.max(0, Math.min(1, x / sheetWidth));
    const normY = Math.max(0, Math.min(1, y / sheetHeight));

    // Vertical row: 4 to 8 zones
    const numRows = sheetHeight > 1500 ? 8 : (sheetHeight > 800 ? 6 : 4);
    const rowIndex = Math.min(numRows - 1, Math.floor(normY * numRows));
    const rowLabel = this.ROW_LABELS[rowIndex] || 'A';

    // Horizontal column: 4 to 8 zones (Standard aerospace grids count from right to left or left to right)
    const numCols = sheetWidth > 2000 ? 8 : (sheetWidth > 1000 ? 6 : 4);
    const colIndex = Math.min(numCols, Math.floor(normX * numCols) + 1);

    return `Zone ${rowLabel}-${colIndex}`;
  }
}
