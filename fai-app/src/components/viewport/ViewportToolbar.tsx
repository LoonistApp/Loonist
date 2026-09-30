import React, { useState, useRef, useEffect } from 'react';
import { 
  ZoomIn, 
  ZoomOut, 
  Maximize2, 
  RotateCw, 
  Hand, 
  MousePointer, 
  MoveHorizontal, 
  Crop 
} from 'lucide-react';
import type { ViewportTool } from '../../types/blueprint';

interface ViewportToolbarProps {
  scale: number;
  rotation: number;
  activeTool: ViewportTool;
  fps?: number;
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
  fps: _fps,
  onToolChange,
  onZoomIn,
  onZoomOut,
  onSetZoom,
  onFitPage,
  onFitWidth,
  onRotate
}) => {
  const [showPresets, setShowPresets] = useState(false);
  const [parentHeight, setParentHeight] = useState<number | null>(null);

  const toolbarRef = useRef<HTMLDivElement>(null);
  const presetsRef = useRef<HTMLDivElement>(null);
  const zoomPercent = Math.round(scale * 100);

  // Monitor available vertical height in real-time as TableManager or window is resized
  useEffect(() => {
    const parent = toolbarRef.current?.parentElement;
    if (!parent) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect) {
          setParentHeight(entry.contentRect.height);
        }
      }
    });

    observer.observe(parent);
    setParentHeight(parent.clientHeight);

    return () => observer.disconnect();
  }, []);

  // Close zoom presets popover on click outside
  useEffect(() => {
    if (!showPresets) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (presetsRef.current && !presetsRef.current.contains(e.target as Node)) {
        setShowPresets(false);
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, [showPresets]);

  // Industry-Standard Vertical Flex Compression:
  // The toolbar ALWAYS remains a single, slim, professional vertical stick (w-9).
  // When TableManager extends (reducing available height), button heights flatten
  // (w-8 h-8 -> w-8 h-7 -> w-8 h-6 -> w-8 h-5) and spacing compresses,
  // keeping the width constant and un-chopped without wrapping into columns.
  const tier = parentHeight === null
    ? 'normal'
    : parentHeight >= 360
    ? 'normal'
    : parentHeight >= 300
    ? 'medium'
    : parentHeight >= 240
    ? 'compressed'
    : 'ultra';

  // Constant button width w-8, flatter heights as height compresses
  const btnHeightClass = 
    tier === 'normal'
      ? 'w-8 h-8 rounded'
      : tier === 'medium'
      ? 'w-8 h-7 rounded'
      : tier === 'compressed'
      ? 'w-8 h-6 rounded'
      : 'w-8 h-5 rounded-xs';

  const iconSize = 
    tier === 'normal'
      ? 16
      : tier === 'medium'
      ? 15
      : tier === 'compressed'
      ? 14
      : 13;

  const gapClass = 
    tier === 'normal'
      ? 'gap-1'
      : tier === 'medium'
      ? 'gap-0.5'
      : 'gap-0';

  const groupPaddingClass = 
    tier === 'normal'
      ? 'pb-1'
      : tier === 'medium'
      ? 'pb-0.5'
      : 'pb-0';

  const groupZoomPaddingClass = 
    tier === 'normal'
      ? 'py-1'
      : tier === 'medium'
      ? 'py-0.5'
      : 'py-0';

  const groupFramingPaddingClass = 
    tier === 'normal'
      ? 'pt-1'
      : tier === 'medium'
      ? 'pt-0.5'
      : 'pt-0';

  const zoomBtnClass =
    tier === 'normal'
      ? 'w-8 h-6 py-0.5 text-[10px]'
      : tier === 'medium'
      ? 'w-8 h-5 py-0 text-[9.5px]'
      : tier === 'compressed'
      ? 'w-8 h-4 py-0 text-[8.5px]'
      : 'w-8 h-3.5 py-0 text-[8px]';

  const containerPaddingClass = 
    tier === 'normal'
      ? 'p-1'
      : 'p-0.5';

  const btnBaseClass = `${btnHeightClass} flex items-center justify-center transition cursor-pointer`;
  const btnInactiveClass = "hover:bg-slate-100 text-slate-600 hover:text-slate-900";
  const btnActiveClass = "bg-slate-800 text-white shadow-xs";

  return (
    <div
      ref={toolbarRef}
      className={`absolute right-4 top-1/2 -translate-y-1/2 z-20 w-9 flex flex-col items-center bg-white/95 backdrop-blur-xs border border-slate-300 rounded-lg shadow-lg select-none text-slate-700 transition-all duration-150 overflow-visible ${containerPaddingClass} ${gapClass}`}
    >
      {/* Tool Selectors */}
      <div className={`flex flex-col items-center border-b border-slate-200 w-full ${groupPaddingClass} ${gapClass}`}>
        <button
          type="button"
          onClick={() => onToolChange('pan')}
          className={`${btnBaseClass} ${activeTool === 'pan' ? btnActiveClass : btnInactiveClass}`}
          title="Pan Tool (or Hold Spacebar)"
        >
          <Hand size={iconSize} />
        </button>
        <button
          type="button"
          onClick={() => onToolChange('select')}
          className={`${btnBaseClass} ${activeTool === 'select' ? btnActiveClass : btnInactiveClass}`}
          title="Select Tool"
        >
          <MousePointer size={iconSize} />
        </button>
        <button
          type="button"
          onClick={() => onToolChange('box-capture')}
          className={`${btnBaseClass} ${activeTool === 'box-capture' ? btnActiveClass : btnInactiveClass}`}
          title="Custom Box Capture (Drag rectangle over drawing to auto-balloon)"
        >
          <Crop size={iconSize} />
        </button>
      </div>

      {/* Zoom Controls */}
      <div className={`flex flex-col items-center border-b border-slate-200 w-full relative ${groupZoomPaddingClass} ${gapClass}`}>
        <button
          type="button"
          onClick={onZoomIn}
          disabled={scale >= 32.0}
          className={`${btnBaseClass} ${btnInactiveClass} disabled:opacity-40`}
          title="Zoom In (Ctrl +)"
        >
          <ZoomIn size={iconSize} />
        </button>

        {/* Zoom Preset Trigger */}
        <div className="relative w-full flex justify-center" ref={presetsRef}>
          <button
            type="button"
            onClick={() => setShowPresets(!showPresets)}
            className={`${zoomBtnClass} rounded hover:bg-slate-100 text-center font-mono font-semibold text-slate-800 transition cursor-pointer flex items-center justify-center leading-none`}
            title="Select Zoom Preset"
          >
            {zoomPercent}%
          </button>

          {showPresets && (
            <div 
              className="absolute right-full mr-2 top-1/2 -translate-y-1/2 bg-white border border-slate-300 rounded-lg shadow-xl py-1 w-24 flex flex-col z-30"
            >
              {ZOOM_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => {
                    onSetZoom(preset);
                    setShowPresets(false);
                  }}
                  className={`px-3 py-1 text-xs font-mono text-left transition cursor-pointer ${
                    Math.abs(scale - preset) < 0.01 
                      ? 'text-slate-900 font-bold bg-slate-100' 
                      : 'text-slate-700 hover:bg-slate-50'
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
          onClick={onZoomOut}
          disabled={scale <= 0.25}
          className={`${btnBaseClass} ${btnInactiveClass} disabled:opacity-40`}
          title="Zoom Out (Ctrl -)"
        >
          <ZoomOut size={iconSize} />
        </button>
      </div>

      {/* Framing & View Presets */}
      <div className={`flex flex-col items-center w-full ${groupFramingPaddingClass} ${gapClass}`}>
        <button
          type="button"
          onClick={onFitPage}
          className={`${btnBaseClass} ${btnInactiveClass}`}
          title="Fit Whole Page"
        >
          <Maximize2 size={iconSize} />
        </button>
        <button
          type="button"
          onClick={onFitWidth}
          className={`${btnBaseClass} ${btnInactiveClass}`}
          title="Fit Width"
        >
          <MoveHorizontal size={iconSize} />
        </button>
        <button
          type="button"
          onClick={onRotate}
          className={`${btnBaseClass} ${btnInactiveClass}`}
          title={`Rotate 90° Clockwise (${rotation}°)`}
        >
          <RotateCw size={iconSize} />
        </button>
      </div>
    </div>
  );
};
