/**
 * Computes standard aerospace drawing grid zones (e.g. "C-4", "A-2")
 * from bounding box coordinates and sheet dimensions.
 */
export class GridZoneCalculator {
  private static readonly ROW_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

  /**
   * Maps a coordinate (x, y) on a sheet of given width and height to an ASME drawing zone.
   * On engineering blueprints:
   * - Letters (A, B, C...) run vertically along the margins.
   * - Numbers (1, 2, 3...) run horizontally along the margins (usually from right to left in US aerospace or left to right).
   */
  public static calculateZone(
    x: number,
    y: number,
    sheetWidth: number,
    sheetHeight: number
  ): string {
    if (sheetWidth <= 0 || sheetHeight <= 0) return 'Zone A-1';

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
