import React from 'react';
import { 
  Crosshair, 
  Move, 
  Crop, 
  Maximize2, 
  ZoomIn, 
  ZoomOut, 
  RotateCw, 
  RotateCcw, 
  FilePlus2, 
  FileText, 
  Layers, 
  ChevronLeft, 
  ChevronRight 
} from 'lucide-react';
import { RibbonGroup } from '../RibbonGroup';
import { RibbonButton } from '../RibbonButton';
import type { ViewportTool, BlueprintDocument } from '../../../../types/blueprint';

interface DrawingRibbonTabProps {
  hasDrawing: boolean;
  document: BlueprintDocument | null;
  activeSheetIndex: number;
  onSelectSheet?: (index: number) => void;
  activeTool: ViewportTool;
  onToolChange: (tool: ViewportTool) => void;
  onFitPage: () => void;
  onFitWidth: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onRotateClockwise: () => void;
  onRotateCounterClockwise?: () => void;
  onAddFile?: () => void;
  onLoadSample?: () => void;
}

export const DrawingRibbonTab: React.FC<DrawingRibbonTabProps> = ({
  hasDrawing,
  document,
  activeSheetIndex,
  onSelectSheet,
  activeTool,
  onToolChange,
  onFitPage,
  onFitWidth,
  onZoomIn,
  onZoomOut,
  onRotateClockwise,
  onRotateCounterClockwise,
  onAddFile,
  onLoadSample
}) => {
  const numSheets = document?.numSheets || 1;

  return (
    <div className="flex items-center h-full overflow-x-auto select-none no-scrollbar">
      {/* 1. INTERACTION TOOLS */}
      <RibbonGroup title="TOOLS">
        <div className="flex flex-col gap-0.5 justify-center">
          <RibbonButton
            variant="small"
            icon={<Crosshair className="w-3.5 h-3.5" />}
            label="Select"
            active={activeTool === 'select'}
            disabled={!hasDrawing}
            title="Select Tool: Inspect or adjust annotations"
            onClick={() => onToolChange('select')}
          />
          <RibbonButton
            variant="small"
            icon={<Move className="w-3.5 h-3.5" />}
            label="Pan Canvas"
            hotkey="Space"
            active={activeTool === 'pan'}
            disabled={!hasDrawing}
            title="Pan Tool: Click and drag canvas"
            onClick={() => onToolChange('pan')}
          />
        </div>
        <div className="flex flex-col justify-center">
          <RibbonButton
            variant="small"
            icon={<Crop className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />}
            label="Box OCR"
            active={activeTool === 'box-capture'}
            disabled={!hasDrawing}
            title="Marquee Box OCR Tool"
            onClick={() => onToolChange('box-capture')}
          />
        </div>
      </RibbonGroup>

      {/* 2. ZOOM & FIT */}
      <RibbonGroup title="ZOOM & FIT">
        <RibbonButton
          variant="large"
          icon={<Maximize2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />}
          label="Fit Page"
          subLabel="To Viewport"
          disabled={!hasDrawing}
          title="Fit Entire Drawing Page to Viewport [Ctrl+0]"
          onClick={onFitPage}
        />

        <div className="flex flex-col gap-0.5 justify-center">
          <RibbonButton
            variant="small"
            icon={<Maximize2 className="w-3.5 h-3.5 rotate-90 text-slate-600 dark:text-slate-300" />}
            label="Fit Width"
            disabled={!hasDrawing}
            title="Fit Drawing Width to Canvas"
            onClick={onFitWidth}
          />
          <div className="flex items-center gap-1">
            <RibbonButton
              variant="icon-only"
              icon={<ZoomIn className="w-3.5 h-3.5" />}
              hotkey="Ctrl++"
              disabled={!hasDrawing}
              title="Zoom In"
              onClick={onZoomIn}
            />
            <RibbonButton
              variant="icon-only"
              icon={<ZoomOut className="w-3.5 h-3.5" />}
              hotkey="Ctrl+-"
              disabled={!hasDrawing}
              title="Zoom Out"
              onClick={onZoomOut}
            />
          </div>
        </div>
      </RibbonGroup>

      {/* 3. ORIENTATION & ROTATION */}
      <RibbonGroup title="ORIENTATION">
        <div className="flex flex-col gap-0.5 justify-center">
          <RibbonButton
            variant="small"
            icon={<RotateCw className="w-3.5 h-3.5 text-blue-600" />}
            label="Rotate 90° CW"
            hotkey="R"
            disabled={!hasDrawing}
            title="Rotate Drawing 90° Clockwise"
            onClick={onRotateClockwise}
          />
          {onRotateCounterClockwise && (
            <RibbonButton
              variant="small"
              icon={<RotateCcw className="w-3.5 h-3.5 text-slate-600" />}
              label="Rotate 90° CCW"
              disabled={!hasDrawing}
              title="Rotate Drawing 90° Counter-Clockwise"
              onClick={onRotateCounterClockwise}
            />
          )}
        </div>
      </RibbonGroup>

      {/* 4. MULTI-SHEET NAVIGATION */}
      <RibbonGroup title="SHEETS">
        <div className="flex flex-col gap-1 justify-center px-1">
          <div className="flex items-center gap-1 text-[10px] font-mono font-semibold bg-slate-100 dark:bg-zinc-800 px-2 py-0.5 rounded border border-slate-200 dark:border-zinc-700">
            <Layers className="w-3 h-3 text-blue-500" />
            <span>Sheet {activeSheetIndex + 1} of {numSheets}</span>
          </div>

          {numSheets > 1 && onSelectSheet && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={activeSheetIndex <= 0}
                onClick={() => onSelectSheet(activeSheetIndex - 1)}
                className="p-1 rounded bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 disabled:opacity-35 cursor-pointer text-slate-700 dark:text-slate-300"
                title="Previous Blueprint Sheet"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                disabled={activeSheetIndex >= numSheets - 1}
                onClick={() => onSelectSheet(activeSheetIndex + 1)}
                className="p-1 rounded bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 disabled:opacity-35 cursor-pointer text-slate-700 dark:text-slate-300"
                title="Next Blueprint Sheet"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </RibbonGroup>

      {/* 5. DRAWING INGESTION */}
      <RibbonGroup title="DRAWING FILES" noSeparator>
        <div className="flex flex-col gap-0.5 justify-center">
          {onAddFile && (
            <RibbonButton
              variant="small"
              icon={<FilePlus2 className="w-3.5 h-3.5 text-blue-600" />}
              label="Import Drawing"
              title="Add another PDF blueprint to this inspection package"
              onClick={onAddFile}
            />
          )}
          {onLoadSample && (
            <RibbonButton
              variant="small"
              icon={<FileText className="w-3.5 h-3.5 text-slate-500" />}
              label="Sample Drawing"
              title="Load pre-bundled AS9102 turbine bracket schematic"
              onClick={onLoadSample}
            />
          )}
        </div>
      </RibbonGroup>
    </div>
  );
};
