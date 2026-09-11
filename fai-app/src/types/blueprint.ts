export interface SheetMetadata {
  pageNumber: number;
  width: number;
  height: number;
  aspectRatio: number;
  label: string;
}

export interface BlueprintDocument {
  id: string;
  name: string;
  filePath?: string;
  fileSize: number;
  fileHash: string;
  numSheets: number;
  sheets: SheetMetadata[];
  activeSheetIndex: number;
}

export interface ViewportTransform {
  scale: number; // 0.25 to 32.0 (25% to 3200%)
  x: number;
  y: number;
  rotation: number; // 0, 90, 180, 270
}

export type ViewportTool = 'pan' | 'select' | 'zoom-in' | 'zoom-out';

export interface PerformanceStats {
  fps: number;
  memoryEstimateMB: number;
  renderTimeMs: number;
}
