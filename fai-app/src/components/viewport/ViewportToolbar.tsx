import React, { useState } from 'react';
import { 
  ZoomIn, 
  ZoomOut, 
  Maximize2, 
  RotateCw, 
  Hand, 
  MousePointer, 
  MoveHorizontal,
  Activity
} from 'lucide-react';
import type { ViewportTool } from '../../types/blueprint';

interface ViewportToolbarProps {
  scale: number;
  rotation: number;
  activeTool: ViewportTool;
  fps: number;
  onToolChange: (tool: ViewportTool) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onSetZoom: (scale: number) => void;
  onFitPage: () => void;
  onFitWidth: () => void;
  onRotate: () => void;
}

const ZOOM_PRESETS = [0.25, 0.5, 0.75, 1.0, 1.5, 2.0, 4.0, 8.0, 16.0, 32.0];

export const ViewportToolbar: React.FC<ViewportToolbarProps> = ({
  scale,
  rotation,
  activeTool,
  fps,
  onToolChange,
  onZoomIn,
  onZoomOut,
  onSetZoom,
  onFitPage,
  onFitWidth,
  onRotate
}) => {
  const [showPresets, setShowPresets] = useState(false);
  const zoomPercent = Math.round(scale * 100);

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 bg-slate-900/90 backdrop-blur-md border border-slate-700/80 rounded-xl p-1.5 shadow-2xl shadow-black/80 select-none text-slate-300">
      {/* Tool Selectors */}
      <div className="flex items-center gap-1 pr-1.5 border-r border-slate-700">
        <button
          type="button"
          onClick={() => onToolChange('pan')}
          className={`p-1.5 rounded-lg transition ${
            activeTool === 'pan'
              ? 'bg-cyan-600 text-white shadow-sm'
              : 'hover:bg-slate-800 text-slate-400 hover:text-slate-200'
          }`}
          title="Pan Tool (or Hold Spacebar)"
        >
          <Hand className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => onToolChange('select')}
          className={`p-1.5 rounded-lg transition ${
            activeTool === 'select'
              ? 'bg-cyan-600 text-white shadow-sm'
              : 'hover:bg-slate-800 text-slate-400 hover:text-slate-200'
          }`}
          title="Select Tool"
        >
          <MousePointer className="w-4 h-4" />
        </button>
      </div>

      {/* Zoom Controls */}
      <div className="flex items-center gap-1 px-1 border-r border-slate-700 relative">
        <button
          type="button"
          onClick={onZoomOut}
          disabled={scale <= 0.25}
          className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 disabled:opacity-40 transition"
          title="Zoom Out (Ctrl -)"
        >
          <ZoomOut className="w-4 h-4" />
        </button>

        {/* Zoom Preset Trigger */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowPresets(!showPresets)}
            className="w-16 py-1 px-1.5 rounded-md hover:bg-slate-800 text-center font-mono text-xs font-semibold text-cyan-400 transition"
            title="Select Zoom Preset"
          >
            {zoomPercent}%
          </button>

          {showPresets && (
            <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-slate-900 border border-slate-700 rounded-lg shadow-xl py-1 w-24 flex flex-col z-30">
              {ZOOM_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => {
                    onSetZoom(preset);
                    setShowPresets(false);
                  }}
                  className={`px-3 py-1 text-xs font-mono text-left hover:bg-slate-800 transition ${
                    Math.abs(scale - preset) < 0.01 ? 'text-cyan-400 font-bold bg-slate-800/50' : 'text-slate-300'
                  }`}
                >
                  {Math.round(preset * 100)}%
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={onZoomIn}
          disabled={scale >= 32.0}
          className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 disabled:opacity-40 transition"
          title="Zoom In (Ctrl +)"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
      </div>

      {/* Framing & View Presets */}
      <div className="flex items-center gap-1 px-1 border-r border-slate-700">
        <button
          type="button"
          onClick={onFitPage}
          className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition"
          title="Fit Whole Page"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={onFitWidth}
          className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition"
          title="Fit Width"
        >
          <MoveHorizontal className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={onRotate}
          className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition"
          title={`Rotate 90° Clockwise (${rotation}°)`}
        >
          <RotateCw className="w-4 h-4" />
        </button>
      </div>

      {/* Real-Time Performance & SLO Monitor */}
      <div className="hidden sm:flex items-center gap-2 pl-2 pr-1 font-mono text-[10px] text-slate-400">
        <div className="flex items-center gap-1 text-emerald-400">
          <Activity className="w-3 h-3" />
          <span>{fps} FPS</span>
        </div>
        <span>•</span>
        <span className="text-slate-400">300 DPI</span>
      </div>
    </div>
  );
};
