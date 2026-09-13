import React from 'react';
import type { BalloonAppearance } from '../../types/characteristics';
import type { ViewportTool } from '../../types/blueprint';
import {
  Sparkles,
  RotateCw,
  Maximize2,
  Move,
  Crosshair,
  Crop,
  FilePlus2,
  Lock,
  Unlock,
  Circle,
  Triangle,
  Hexagon,
  Square,
  ZoomIn,
  ZoomOut,
  ListOrdered,
  PanelLeft,
  PanelBottom,
  X,
  FolderOpen,
  Save,
  SlidersHorizontal,
  FileDown,
  FileSpreadsheet,
  Sun,
  Moon
} from 'lucide-react';

interface ProjectFileTab {
  id: string;
  name: string;
  type: 'pdf' | 'dwg' | 'catpart';
  filePath?: string;
}

interface RibbonBarProps {
  // Document actions
  onSmartExtract: () => void;
  isExtracting: boolean;
  onAddFile: () => void;
  onSaveProject?: () => void;
  onOpenProject?: () => void;
  onExportExcel?: () => void;
  onExportPdf?: () => void;
  onRenumberAll?: () => void;

  // Viewport actions
  activeTool: ViewportTool;
  onToolChange: (tool: ViewportTool) => void;
  onFitPage: () => void;
  onFitWidth: () => void;
  onRotateClockwise: () => void;
  onRotateCounterClockwise?: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;

  // Balloon appearance
  balloonAppearance: BalloonAppearance;
  onUpdateBalloonAppearance: (appearance: BalloonAppearance) => void;
  balloonsLocked: boolean;
  onToggleLockBalloons: () => void;

  // Multi-Document Tabs
  projectFiles: ProjectFileTab[];
  activeFileId: string;
  onSelectFile: (id: string) => void;
  onCloseFile?: (id: string) => void;

  // Antigravity IDE Panel Controls
  isLeftPanelOpen?: boolean;
  isBottomPanelOpen?: boolean;
  onToggleLeftPanel?: () => void;
  onToggleBottomPanel?: () => void;
  onToggleFullDrawing?: () => void;

  // Characteristics Review Drawer
  characteristicsCount?: number;
  isDrawerOpen?: boolean;
  onToggleDrawer?: () => void;

  // Aerospace CAD Dark Mode Theme
  isDarkMode?: boolean;
  onToggleDarkMode?: () => void;
}

export const RibbonBar: React.FC<RibbonBarProps> = ({
  onSmartExtract,
  isExtracting,
  onAddFile,
  onSaveProject,
  onOpenProject,
  onExportExcel,
  onExportPdf,
  onRenumberAll,
  activeTool,
  onToolChange,
  onFitPage,
  onFitWidth,
  onRotateClockwise,
  onZoomIn,
  onZoomOut,
  balloonAppearance,
  onUpdateBalloonAppearance,
  balloonsLocked,
  onToggleLockBalloons,
  projectFiles,
  activeFileId,
  onSelectFile,
  onCloseFile,
  isLeftPanelOpen = true,
  isBottomPanelOpen = true,
  onToggleLeftPanel,
  onToggleBottomPanel,
  onToggleFullDrawing,
  characteristicsCount = 0,
  isDrawerOpen = false,
  onToggleDrawer,
  isDarkMode = false,
  onToggleDarkMode
}) => {
  return (
    <header className="flex flex-col w-full bg-slate-100 border-b border-slate-300 select-none text-slate-800 text-xs shadow-xs">
      {/* 1. Top Application Bar with Window & Compliance Branding */}
      <div className="h-8 bg-[#161616] text-slate-200 px-3 flex items-center justify-between border-b border-[#262626]">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 font-bold tracking-wider text-white">
            <span className="w-4 h-4 rounded bg-blue-600 flex items-center justify-center text-[10px] text-white font-mono font-black shadow-xs">L</span>
            <span className="text-sm tracking-tight font-black">LOONIST</span>
          </div>
          <span className="text-[#444444]">|</span>
          <span className="text-[11px] text-slate-400 font-medium">SAE AS9102 Rev B/C & ASME Y14.5 Inspection Platform</span>
        </div>

        <div className="flex items-center gap-3">
          {/* Subtle, clean ITAR compliance indicator */}
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-sans">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            <span>Air-Gapped Local</span>
          </div>

          <span className="h-3.5 w-px bg-[#333333]" />

          {/* Panel Layout Controls */}
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={onToggleLeftPanel}
              className={`p-1 rounded transition cursor-pointer ${
                isLeftPanelOpen
                  ? 'text-blue-400 bg-[#282828]'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[#282828]'
              }`}
              title={isLeftPanelOpen ? "Collapse Left Side Panel" : "Expand Left Side Panel"}
            >
              <PanelLeft className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={onToggleBottomPanel}
              className={`p-1 rounded transition cursor-pointer ${
                isBottomPanelOpen
                  ? 'text-blue-400 bg-[#282828]'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[#282828]'
              }`}
              title={isBottomPanelOpen ? "Collapse Bottom Table" : "Expand Bottom Table"}
            >
              <PanelBottom className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={onToggleFullDrawing}
              className={`p-1 rounded transition cursor-pointer ${
                !isLeftPanelOpen && !isBottomPanelOpen
                  ? 'text-emerald-400 bg-[#282828]'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[#282828]'
              }`}
              title="Full Drawing View"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>

          <span className="h-3.5 w-px bg-[#333333]" />

          {/* Minimalist CAD Dark / Light Mode Toggle */}
          <button
            type="button"
            onClick={onToggleDarkMode}
            className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-[#282828] transition cursor-pointer"
            title={isDarkMode ? 'Switch to CAD Light Mode' : 'Switch to CAD Dark Charcoal Mode'}
          >
            {isDarkMode ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* 2. Unified Functional Engineering Toolbar (Single High-Efficiency Tool Strip) */}
      <div className="h-16 bg-white px-3 flex items-center gap-3 overflow-x-auto border-b border-slate-300">
        {/* GROUP 1: EXTRACTION & INTERACTION */}
        <div className="flex items-center gap-2 pr-3 border-r border-slate-200 shrink-0">
          <button
            type="button"
            onClick={onSmartExtract}
            disabled={isExtracting}
            className="flex flex-col items-center justify-center px-3.5 py-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded border border-blue-700 shadow-xs transition group cursor-pointer"
            title="Automatically detect and balloon all dimensions, GD&T, and notes on this drawing"
          >
            <Sparkles className={`w-4 h-4 mb-0.5 text-amber-300 ${isExtracting ? 'animate-spin' : 'group-hover:scale-110 transition-transform'}`} />
            <span className="text-[10px] font-bold whitespace-nowrap">{isExtracting ? 'Extracting...' : 'Smart Extract'}</span>
          </button>

          {characteristicsCount > 0 && onToggleDrawer && (
            <button
              type="button"
              onClick={onToggleDrawer}
              className={`flex flex-col items-center justify-center px-2.5 py-1 rounded border transition cursor-pointer ${isDrawerOpen
                  ? 'bg-blue-50 text-blue-700 border-blue-400 font-bold'
                  : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-300 shadow-2xs'
                }`}
              title="Open HITL AI Characteristics Review Drawer (Magnified 300 DPI Crop Box)"
            >
              <SlidersHorizontal className="w-4 h-4 mb-0.5 text-blue-600" />
              <span className="text-[10px] whitespace-nowrap">Inspector ({characteristicsCount})</span>
            </button>
          )}

          <div className="flex items-center bg-slate-100 p-0.5 rounded border border-slate-200">
            <button
              type="button"
              onClick={() => onToolChange('select')}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded transition ${activeTool === 'select'
                  ? 'bg-white shadow-xs text-blue-700 font-bold border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
                }`}
              title="Select Tool: Click to inspect or edit balloons"
            >
              <Crosshair className="w-3.5 h-3.5" />
              <span className="text-[10px]">Select</span>
            </button>

            <button
              type="button"
              onClick={() => onToolChange('pan')}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded transition ${activeTool === 'pan'
                  ? 'bg-white shadow-xs text-blue-700 font-bold border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
                }`}
              title="Pan Tool: Click and drag to navigate the drawing canvas"
            >
              <Move className="w-3.5 h-3.5" />
              <span className="text-[10px]">Pan</span>
            </button>

            <button
              type="button"
              onClick={() => onToolChange('box-capture')}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded transition ${activeTool === 'box-capture'
                  ? 'bg-blue-600 text-white font-bold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
                }`}
              title="Box OCR: Drag a marquee box over any dimension or GD&T frame to balloon it"
            >
              <Crop className="w-3.5 h-3.5" />
              <span className="text-[10px]">Box OCR</span>
            </button>
          </div>

          <span className="text-[9px] text-slate-400 self-end font-mono uppercase tracking-wider pl-1 pb-0.5">Capture & Tools</span>
        </div>

        {/* GROUP 2: BALLOON FORMATTING */}
        <div className="flex items-center gap-3 pr-3 border-r border-slate-200 shrink-0">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-500 font-semibold uppercase">Shape:</span>
              <div className="flex items-center bg-slate-100 p-0.5 rounded border border-slate-200">
                <button
                  type="button"
                  onClick={() => onUpdateBalloonAppearance({ ...balloonAppearance, shape: 'circle' })}
                  title="Circle (Standard Dimensions)"
                  className={`p-1 rounded ${balloonAppearance.shape === 'circle' ? 'bg-white shadow-xs text-blue-600' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  <Circle className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => onUpdateBalloonAppearance({ ...balloonAppearance, shape: 'triangle' })}
                  title="Triangle (Flag Note)"
                  className={`p-1 rounded ${balloonAppearance.shape === 'triangle' ? 'bg-white shadow-xs text-amber-600' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  <Triangle className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => onUpdateBalloonAppearance({ ...balloonAppearance, shape: 'hexagon' })}
                  title="Hexagon (Critical GD&T)"
                  className={`p-1 rounded ${balloonAppearance.shape === 'hexagon' ? 'bg-white shadow-xs text-red-600' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  <Hexagon className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => onUpdateBalloonAppearance({ ...balloonAppearance, shape: 'square' })}
                  title="Square (Basic Dimension)"
                  className={`p-1 rounded ${balloonAppearance.shape === 'square' ? 'bg-white shadow-xs text-purple-600' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  <Square className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Color swatches */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded border border-slate-200" title="Balloon Color">
                {[
                  { name: 'blue', color: '#2563eb', title: 'Blue' },
                  { name: 'green', color: '#059669', title: 'Green' },
                  { name: 'amber', color: '#d97706', title: 'Amber' },
                  { name: 'red', color: '#dc2626', title: 'Red' },
                  { name: 'black', color: '#0f172a', title: 'Black' }
                ].map((c) => (
                  <button
                    key={c.name}
                    type="button"
                    onClick={() => onUpdateBalloonAppearance({ ...balloonAppearance, color: c.name })}
                    title={c.title}
                    style={{ backgroundColor: c.color }}
                    className={`w-3.5 h-3.5 rounded-full transition-transform cursor-pointer ${balloonAppearance.color === c.name
                        ? 'ring-2 ring-offset-1 ring-slate-700 scale-110'
                        : 'opacity-70 hover:opacity-100 hover:scale-105'
                      }`}
                  />
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-slate-500 font-semibold">Fit:</span>
                <select
                  value={balloonAppearance.fit}
                  onChange={(e) => onUpdateBalloonAppearance({ ...balloonAppearance, fit: Number(e.target.value) })}
                  className="text-[10px] bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5"
                >
                  <option value={1}>Tight</option>
                  <option value={2}>Standard</option>
                  <option value={3}>Relaxed</option>
                </select>
              </div>

              <label className="flex items-center gap-1 cursor-pointer text-[10px] text-slate-600 select-none">
                <input
                  type="checkbox"
                  checked={balloonAppearance.showLeaderLine}
                  onChange={(e) => onUpdateBalloonAppearance({ ...balloonAppearance, showLeaderLine: e.target.checked })}
                  className="rounded border-slate-300 text-blue-600 w-3 h-3"
                />
                <span>Leader Line</span>
              </label>
            </div>
          </div>

          <span className="text-[9px] text-slate-400 self-end font-mono uppercase tracking-wider pl-1 pb-0.5">Balloon Markup</span>
        </div>

        {/* GROUP 3: OPERATIONS & LOCKING */}
        <div className="flex items-center gap-2 pr-3 border-r border-slate-200 shrink-0">
          <button
            type="button"
            onClick={onRenumberAll}
            className="flex flex-col items-center justify-center px-3 py-1 rounded border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 transition cursor-pointer"
            title="Renumber all drawing balloons sequentially (1, 2, 3...)"
          >
            <ListOrdered className="w-4 h-4 mb-0.5 text-blue-600" />
            <span className="text-[10px] font-semibold whitespace-nowrap">Renumber All</span>
          </button>

          <button
            type="button"
            onClick={onToggleLockBalloons}
            className={`flex flex-col items-center justify-center px-3 py-1 rounded border transition cursor-pointer ${balloonsLocked
                ? 'bg-amber-50 border-amber-300 text-amber-700'
                : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-700'
              }`}
            title="Lock balloon positions to prevent accidental dragging"
          >
            {balloonsLocked ? <Lock className="w-4 h-4 mb-0.5 text-amber-600" /> : <Unlock className="w-4 h-4 mb-0.5 text-slate-500" />}
            <span className="text-[10px] font-semibold whitespace-nowrap">{balloonsLocked ? 'Locked' : 'Lock Balloons'}</span>
          </button>

          <span className="text-[9px] text-slate-400 self-end font-mono uppercase tracking-wider pl-1 pb-0.5">Organization</span>
        </div>

        {/* GROUP 4: VIEWPORT & ROTATION */}
        <div className="flex items-center gap-1.5 pr-3 border-r border-slate-200 shrink-0">
          <button
            type="button"
            onClick={onFitPage}
            className="p-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded border border-slate-200 transition cursor-pointer"
            title="Fit Entire Drawing Page to Viewport"
          >
            <Maximize2 className="w-3.5 h-3.5 text-blue-600" />
          </button>

          <button
            type="button"
            onClick={onFitWidth}
            className="p-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded border border-slate-200 transition cursor-pointer"
            title="Fit Drawing Width"
          >
            <Maximize2 className="w-3.5 h-3.5 text-slate-600 rotate-90" />
          </button>

          <button
            type="button"
            onClick={onRotateClockwise}
            className="p-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded border border-slate-200 transition cursor-pointer"
            title="Rotate Drawing 90° Clockwise"
          >
            <RotateCw className="w-3.5 h-3.5 text-slate-600" />
          </button>

          <div className="flex items-center bg-slate-100 p-0.5 rounded border border-slate-200 ml-1">
            <button
              type="button"
              onClick={onZoomOut}
              className="p-1 text-slate-600 hover:text-slate-900 rounded cursor-pointer"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={onZoomIn}
              className="p-1 text-slate-600 hover:text-slate-900 rounded cursor-pointer"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>

          <span className="text-[9px] text-slate-400 self-end font-mono uppercase tracking-wider pl-1 pb-0.5">View</span>
        </div>

        {/* GROUP 5: PROJECT & DRAWINGS */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onOpenProject}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded border border-slate-200 transition cursor-pointer"
            title="Open LOONIST Project (.loonist) [Ctrl+O]"
          >
            <FolderOpen className="w-3.5 h-3.5 text-amber-600" />
            <span className="text-[10px] font-semibold whitespace-nowrap">Open Project</span>
          </button>

          <button
            type="button"
            onClick={onSaveProject}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded border border-slate-200 transition cursor-pointer"
            title="Save LOONIST Project (.loonist) [Ctrl+S]"
          >
            <Save className="w-3.5 h-3.5 text-blue-600" />
            <span className="text-[10px] font-semibold whitespace-nowrap">Save Project</span>
          </button>

          <button
            type="button"
            onClick={onAddFile}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded border border-slate-200 transition cursor-pointer"
            title="Add another drawing or CAD file to this AS9102 inspection report"
          >
            <FilePlus2 className="w-3.5 h-3.5 text-blue-600" />
            <span className="text-[10px] font-semibold whitespace-nowrap">Add CAD/PDF</span>
          </button>

          <span className="text-[9px] text-slate-400 self-end font-mono uppercase tracking-wider pl-1 pb-0.5">Project</span>
        </div>

        {/* GROUP 6: AS9102 QUALITY EXPORTS */}
        <div className="flex items-center gap-2 shrink-0 pl-2 border-l border-slate-200">
          <button
            type="button"
            onClick={onExportPdf}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded border border-red-700 shadow-2xs transition cursor-pointer"
            title="Export Marked Vector Blueprint PDF with permanent balloons and leader lines"
          >
            <FileDown className="w-3.5 h-3.5 text-white" />
            <span className="text-[10px] font-bold whitespace-nowrap">Marked PDF</span>
          </button>

          <button
            type="button"
            onClick={onExportExcel}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded border border-emerald-700 shadow-2xs transition cursor-pointer"
            title="Export Certified SAE AS9102 Form 1, Form 2, and Form 3 Multi-Sheet Excel"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-white" />
            <span className="text-[10px] font-bold whitespace-nowrap">AS9102 Excel</span>
          </button>

          <span className="text-[9px] text-slate-400 self-end font-mono uppercase tracking-wider pl-1 pb-0.5">Publish</span>
        </div>
      </div>

      {/* 3. Multi-Document Project Tabs Bar (InspectionXpert Benchmark) */}
      <div className="h-7 bg-slate-200 px-2 flex items-center gap-1 border-b border-slate-300 overflow-x-auto select-none">
        {projectFiles.map((file) => {
          const isActive = file.id === activeFileId;
          return (
            <div
              key={file.id}
              role="tab"
              aria-selected={isActive}
              tabIndex={0}
              onClick={() => onSelectFile(file.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelectFile(file.id);
                }
              }}
              className={`group relative h-6 px-2.5 flex items-center gap-1.5 text-[11px] rounded-t font-mono cursor-pointer transition select-none shrink-0 ${isActive
                  ? 'bg-white text-slate-900 font-bold shadow-xs border-t border-x border-slate-300'
                  : 'text-slate-600 hover:bg-slate-300/80 hover:text-slate-900'
                }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isActive ? 'bg-blue-600' : 'bg-slate-400'}`} />
              <span className="truncate max-w-[220px]" title={file.name}>{file.name}</span>
              {onCloseFile && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCloseFile(file.id);
                  }}
                  className="ml-1 p-0.5 rounded hover:bg-slate-200 text-slate-400 hover:text-red-600 transition shrink-0"
                  title={`Close ${file.name}`}
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          );
        })}

        <button
          type="button"
          onClick={onAddFile}
          className="h-5 px-2 flex items-center gap-1 text-[10px] font-bold rounded bg-slate-300/80 hover:bg-slate-300 text-slate-700 ml-1 transition shrink-0 cursor-pointer"
          title="Add another drawing or CAD file to this AS9102 inspection report"
        >
          <span>+ Add File</span>
        </button>
      </div>
    </header>
  );
};
