import React, { useState, useEffect } from 'react';
import type { 
  EngineeringCharacteristic, 
  ProjectProperties, 
  InspectionMethod 
} from '../../types/characteristics';
import { MeasurementEngine } from '../../services/compliance/measurementEngine';
import { CharacteristicsInspectorTab } from './dock/CharacteristicsInspectorTab';
import { ExportModal } from './ExportModal';
import { useApplicationOptions } from '../../stores/useApplicationOptionsStore';
import { formatDecimal } from '../../utils/numberFormat';
import { 
  ChevronLeft, 
  ChevronRight, 
  ChevronsLeft,
  ChevronsRight,
  ChevronDown,
  FileSpreadsheet, 
  CheckCircle2,
  AlertTriangle,
  Trash2,
  ListOrdered,
  Search,
  Building2,
  Split,
  ZoomIn,
  ZoomOut,
  X 
} from 'lucide-react';

export type LeftDockTab = 'inspector' | 'characteristic' | 'project' | 'excel';

interface LeftPropertiesDockProps {
  // Characteristics
  characteristics: EngineeringCharacteristic[];
  selectedChar: EngineeringCharacteristic | null;
  onSelectCharacteristic: (char: EngineeringCharacteristic) => void;
  onClearSelectedCharacteristic?: () => void;
  onUpdateCharacteristic: (char: EngineeringCharacteristic) => void;
  onUpdateCharacteristics?: (chars: EngineeringCharacteristic[]) => void;
  onDeleteCharacteristic?: (id: string) => void;
  onRenumberAll?: () => void;

  // Project Properties
  projectProps: ProjectProperties;
  onUpdateProjectProps: (props: ProjectProperties) => void;

  // Export Deliverables
  onExportExcel: () => void;
  onExportPdf?: () => void;
  hasDrawing?: boolean;

  // Crop preview data URL from ViewportCanvas
  hudCropDataUrl?: string | null;

  // Panel state
  isOpen?: boolean;
  onToggleOpen?: (open: boolean) => void;
  width?: number;
  onWidthChange?: (width: number) => void;

  // Controlled tab (legacy support)
  activeTab?: LeftDockTab;
  onTabChange?: (tab: LeftDockTab) => void;

  // Inspect Overlay Drawer State
  isInspectOpen?: boolean;
  onToggleInspect?: () => void;
  onCloseInspect?: () => void;

  // Inspections Workspace & Results State
  hasInspectionResults?: boolean;
  onRunInspection?: () => void;
  isInspecting?: boolean;

  // Export Modal Trigger
  isExportOpen?: boolean;
  onOpenExportModal?: () => void;

  // Active Drawing Sheet from Bottom Viewport Sheet Bar
  activeSheetNumber?: number;
}

const INSPECTION_METHODS: InspectionMethod[] = [
  'Caliper',
  'Micrometer',
  'Height Gage',
  'CMM',
  'Optical Comparator',
  'Thread Gage',
  'Pin Gage',
  'Bore Gage',
  'Surface Plate',
  'Visual / Visual Inspection'
];

export const LeftPropertiesDock: React.FC<LeftPropertiesDockProps> = ({
  characteristics,
  selectedChar,
  onSelectCharacteristic,
  onClearSelectedCharacteristic,
  onUpdateCharacteristic,
  onUpdateCharacteristics,
  onDeleteCharacteristic,
  onRenumberAll,
  projectProps,
  onUpdateProjectProps,
  onExportExcel,
  onExportPdf,
  hasDrawing,
  hudCropDataUrl,
  isOpen = true,
  onToggleOpen,
  width: dockWidth = 320,
  onWidthChange,
  isInspectOpen,
  onToggleInspect,
  onCloseInspect,
  hasInspectionResults = false,
  onRunInspection,
  isInspecting = false,
  isExportOpen = false,
  onOpenExportModal,
  activeSheetNumber
}) => {
  const [localIsInspectOpen, setLocalIsInspectOpen] = useState(false);
  const isInspectActive = isInspectOpen !== undefined ? isInspectOpen : localIsInspectOpen;

  const [appOptions] = useApplicationOptions();
  const availableMethods = appOptions.masterData.inspectionMethods.length > 0
    ? appOptions.masterData.inspectionMethods.map(m => m.name)
    : INSPECTION_METHODS;

  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const isExportActive = Boolean(isExportOpen || isExportModalOpen);
  const [selectedTemplate, setSelectedTemplate] = useState('AS9102C.xlt');

  // Contextual view mode: 'project' (default persistent) vs 'contextual' (when characteristic is selected)
  const [viewOverride, setViewOverride] = useState<'project' | 'contextual'>('project');

  // Digital Zoom for Heads-Up Crop
  const [isCropZoomed, setIsCropZoomed] = useState(false);

  // Collapsible Accordions for Characteristic Inspector (Image 1 benchmark)
  const [openSections, setOpenSections] = useState({
    general: true,
    tolerance: true,
    measurement: true,
    inspection: true,
  });

  const toggleSection = (section: keyof typeof openSections) => {
    setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  // 1-Click Quantity Splitter (#1.1, #1.2, ...) for pattern characteristics
  const handleSplitQuantity = () => {
    if (!selectedChar || selectedChar.quantity <= 1 || !onUpdateCharacteristics) return;
    const count = selectedChar.quantity;
    const baseItemNum = selectedChar.itemNumber;

    const newChars: EngineeringCharacteristic[] = [];
    for (let i = 1; i <= count; i++) {
      newChars.push({
        ...selectedChar,
        id: i === 1 ? selectedChar.id : `${selectedChar.id}_split_${i}_${Date.now()}`,
        subNumber: `${baseItemNum}.${i}`,
        quantity: 1,
        measuredValue: null,
        conformanceStatus: 'UNMEASURED',
        deviation: null,
        measuredAt: undefined,
      });
    }

    const charIdx = characteristics.findIndex((c) => c.id === selectedChar.id);
    if (charIdx !== -1) {
      const nextList = [
        ...characteristics.slice(0, charIdx),
        ...newChars,
        ...characteristics.slice(charIdx + 1)
      ];
      onUpdateCharacteristics(nextList);
      onSelectCharacteristic(newChars[0]);
    }
  };

  // When a characteristic is selected, contextually show its properties; when cleared, return to project overview
  useEffect(() => {
    if (selectedChar) {
      setViewOverride('contextual');
    } else {
      setViewOverride('project');
    }
  }, [selectedChar]);

  const currentIndex = selectedChar 
    ? characteristics.findIndex(c => c.id === selectedChar.id)
    : -1;
  const totalCount = characteristics.length;

  const handleStep = (targetIndex: number) => {
    if (targetIndex >= 0 && targetIndex < characteristics.length) {
      onSelectCharacteristic(characteristics[targetIndex]);
    }
  };

  const handleInsertSymbol = (symbol: string) => {
    if (!selectedChar) return;
    const currentVal = selectedChar.rawText || '';
    const updated: EngineeringCharacteristic = {
      ...selectedChar,
      rawText: `${currentVal} ${symbol}`.trim()
    };
    onUpdateCharacteristic(updated);
  };

  const handleToggleInspect = () => {
    if (onToggleInspect) {
      onToggleInspect();
    } else {
      setLocalIsInspectOpen((prev) => !prev);
    }
    // If currently open and toggling off, restore project
    if (isInspectActive) {
      setViewOverride('project');
    }
  };

  const handleCloseInspect = () => {
    if (onCloseInspect) {
      onCloseInspect();
    } else if (onToggleInspect && isInspectActive) {
      onToggleInspect();
    } else {
      setLocalIsInspectOpen(false);
    }
    setViewOverride('project');
  };

  const handleProjectClick = () => {
    if (isInspectActive) {
      handleCloseInspect();
    }
    setViewOverride('project');
    onClearSelectedCharacteristic?.();
  };

  const handleInspectClick = () => {
    if (!isInspectActive && dockWidth < 380 && onWidthChange) {
      onWidthChange(420);
    }
    handleToggleInspect();
  };

  const handleExportClick = () => {
    if (isInspectActive) {
      handleCloseInspect();
    }
    if (onOpenExportModal) {
      onOpenExportModal();
    } else {
      setIsExportModalOpen(true);
    }
  };

  const handleExpand = (target?: 'project' | 'inspect' | 'export') => {
    if (dockWidth < 200 && onWidthChange) {
      onWidthChange(target === 'inspect' ? 420 : 320);
    }
    onToggleOpen?.(true);
    if (target === 'inspect') {
      if (!isInspectActive) handleToggleInspect();
    } else if (target === 'project') {
      if (isInspectActive) handleCloseInspect();
      setViewOverride('project');
    } else if (target === 'export') {
      if (isInspectActive) handleCloseInspect();
      if (onOpenExportModal) {
        onOpenExportModal();
      } else {
        setIsExportModalOpen(true);
      }
    }
  };

  // If collapsed: Render slim 40px VS Code style Activity Bar
  if (!isOpen) {
    return (
      <aside className="w-10 h-full bg-slate-100 border-r border-slate-300 flex flex-col items-center py-2 select-none z-20 shrink-0 relative">
        {/* Top Expand Button */}
        <button
          type="button"
          onClick={() => handleExpand()}
          className="p-1.5 rounded hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition mb-3 cursor-pointer"
          title="Expand Side Panel (or drag right)"
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        {/* Vertical Tool Icons: Project | Inspect | Export */}
        <div className="flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={() => handleExpand('project')}
            className={`p-2 rounded transition cursor-pointer ${
              !isInspectActive && viewOverride === 'project'
                ? 'bg-white text-slate-900 shadow-xs border border-slate-300'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200'
            }`}
            title="Project Properties"
          >
            <Building2 className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => handleExpand('inspect')}
            className={`p-2 rounded transition cursor-pointer ${
              isInspectActive && !isExportActive
                ? 'bg-white text-slate-900 shadow-xs border border-slate-300'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200'
            }`}
            title="Inspections (Results Workspace)"
          >
            <Search className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => handleExpand('export')}
            className={`p-2 rounded transition cursor-pointer ${
              isExportActive
                ? 'bg-white text-slate-900 shadow-xs border border-slate-300'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200'
            }`}
            title="Export Deliverables"
          >
            <FileSpreadsheet className="w-4 h-4" />
          </button>
        </div>

        {/* Hidden ExportModal triggerable from collapsed bar when not provided at app root */}
        {!onOpenExportModal && (
          <ExportModal
            isOpen={isExportModalOpen}
            onClose={() => setIsExportModalOpen(false)}
            onExportExcel={onExportExcel}
            onExportPdf={onExportPdf}
            characteristicsCount={characteristics.length}
            hasDrawing={hasDrawing ?? characteristics.length > 0}
            selectedTemplate={selectedTemplate}
            onSelectTemplate={setSelectedTemplate}
          />
        )}
      </aside>
    );
  }

  const isContextualActive = !isInspectActive && selectedChar && viewOverride === 'contextual';
  const isProjectActive = !isInspectActive && !isContextualActive && !isExportActive;

  return (
    <aside 
      style={{ width: `${dockWidth}px` }}
      className="h-full bg-white flex flex-col select-none text-slate-800 text-xs shadow-xs z-20 overflow-hidden relative shrink-0"
    >
      {/* Top Workspace Navigation Strip: Project | Inspections | Export */}
      <div className="h-8 bg-slate-100 border-b border-slate-300 flex items-center px-1.5 gap-1 shrink-0">
        {/* 1. Project (Default & Persistent) */}
        <button
          type="button"
          onClick={handleProjectClick}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1 px-1 rounded font-bold text-[11px] transition cursor-pointer ${
            isProjectActive
              ? 'bg-white text-slate-900 shadow-xs border border-slate-300'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
          }`}
          title="Project Properties (Default Left Panel)"
        >
          <Building2 className="w-3.5 h-3.5" />
          <span>Project</span>
        </button>

        {/* 2. Inspections (Results Workspace) */}
        <button
          type="button"
          onClick={handleInspectClick}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1 px-1 rounded font-bold text-[11px] transition cursor-pointer ${
            isInspectActive && !isExportActive
              ? 'bg-white text-slate-900 shadow-xs border border-slate-300'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
          }`}
          title="Inspections Results Workspace (View Results)"
        >
          <Search className="w-3.5 h-3.5" />
          <span>Inspections</span>
        </button>

        {/* 3. Export (Top-Level Action Dialog) */}
        <button
          type="button"
          onClick={handleExportClick}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1 px-1 rounded font-bold text-[11px] transition cursor-pointer ${
            isExportActive
              ? 'bg-white text-slate-900 shadow-xs border border-slate-300'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
          }`}
          title="Export Deliverables (AS9102 Excel & Marked PDF Dialog)"
        >
          <FileSpreadsheet className="w-3.5 h-3.5" />
          <span>Export</span>
        </button>

        {/* Collapse Button */}
        <button
          type="button"
          onClick={() => onToggleOpen?.(false)}
          className="p-1 rounded hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition ml-0.5 cursor-pointer"
          title="Collapse Side Panel (Double-click border or drag left)"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Panel Body */}
      <div className="flex-1 w-full overflow-y-auto bg-white flex flex-col min-h-0 relative">
        {/* TOGGLEABLE OVERLAY / DRAWER: INSPECTIONS */}
        {isInspectActive && (
          <div className="absolute inset-0 z-30 bg-white flex flex-col overflow-hidden animate-in fade-in duration-100">
            {/* Drawer Header */}
            <div className="h-7 bg-slate-100 border-b border-slate-200 px-2.5 flex items-center justify-between shrink-0">
              <span className="font-bold text-[11px] text-slate-800">
                INSPECTIONS WORKSPACE
              </span>
              <button
                type="button"
                onClick={handleCloseInspect}
                className="p-1 rounded hover:bg-slate-200 text-slate-500 hover:text-slate-900 transition cursor-pointer"
                title="Close Inspections & Restore Project"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Inspections Review Content or Polished Empty State */}
            {hasInspectionResults && characteristics.length > 0 ? (
              <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
                <CharacteristicsInspectorTab
                  characteristics={characteristics}
                  selectedChar={selectedChar}
                  onSelectCharacteristic={onSelectCharacteristic}
                  onUpdateCharacteristic={onUpdateCharacteristic}
                  onUpdateCharacteristics={onUpdateCharacteristics}
                  onDeleteCharacteristic={onDeleteCharacteristic}
                  hudCropDataUrl={hudCropDataUrl}
                  activeSheetNumber={activeSheetNumber}
                />
              </div>
            ) : (
              <div className="flex-1 min-h-0 flex flex-col items-center justify-center p-6 text-center select-none bg-slate-50/50">
                <h3 className="text-sm font-bold text-slate-800 mb-1.5">
                  No inspection results
                </h3>
                <p className="text-xs text-slate-500 max-w-[220px] leading-relaxed mb-4">
                  Click Inspect to analyze the current drawing.
                </p>
                {onRunInspection && (
                  <button
                    type="button"
                    onClick={onRunInspection}
                    disabled={isInspecting || !hasDrawing}
                    style={{ paddingLeft: '1.25rem', paddingRight: '1.25rem', paddingTop: '7px', paddingBottom: '7px' }}
                    className="inline-flex items-center justify-center bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white rounded-md text-xs font-semibold shadow-xs transition cursor-pointer"
                    title="Inspect drawing"
                  >
                    <span>{isInspecting ? 'Inspecting...' : 'Inspect'}</span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* CONTEXTUAL PROPERTIES (Active when a characteristic is selected) */}
        {isContextualActive && selectedChar ? (
          <>
            {/* Contextual Properties Breadcrumb / Return to Project Banner */}
            <div className="h-7 bg-slate-100 border-b border-slate-300 px-2.5 flex items-center justify-between shrink-0">
              <button
                type="button"
                onClick={() => {
                  setViewOverride('project');
                  onClearSelectedCharacteristic?.();
                }}
                className="flex items-center gap-1 text-[11px] font-semibold text-slate-700 hover:text-slate-900 transition cursor-pointer"
                title="Return to Project Properties"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Project</span>
                <span className="text-slate-400">/</span>
                <span className="font-mono font-bold">
                  #{selectedChar.subNumber || selectedChar.itemNumber}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setViewOverride('project');
                  onClearSelectedCharacteristic?.();
                }}
                className="p-1 rounded hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition cursor-pointer"
                title="Close Characteristic Properties (Restore Project)"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
            {/* Header & Stepper Bar */}
            <div className="p-2 border-b border-slate-200 bg-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-bold text-slate-900">
                <span>Characteristic</span>
                <span className="text-slate-900 font-mono">
                  {selectedChar ? `#${selectedChar.subNumber || selectedChar.itemNumber}` : '--'}
                </span>
                <span className="text-slate-400 font-normal">
                  ({currentIndex >= 0 ? currentIndex + 1 : 0} / {totalCount})
                </span>
              </div>

              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => handleStep(0)}
                  disabled={currentIndex <= 0}
                  className="p-1 rounded hover:bg-slate-200 disabled:opacity-30 text-slate-600"
                  title="First Item"
                >
                  <ChevronsLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleStep(currentIndex - 1)}
                  disabled={currentIndex <= 0}
                  className="p-1 rounded hover:bg-slate-200 disabled:opacity-30 text-slate-600"
                  title="Previous Item"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleStep(currentIndex + 1)}
                  disabled={currentIndex >= totalCount - 1}
                  className="p-1 rounded hover:bg-slate-200 disabled:opacity-30 text-slate-600"
                  title="Next Item"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleStep(totalCount - 1)}
                  disabled={currentIndex >= totalCount - 1}
                  className="p-1 rounded hover:bg-slate-200 disabled:opacity-30 text-slate-600"
                  title="Last Item"
                >
                  <ChevronsRight className="w-3.5 h-3.5" />
                </button>
                <div className="w-[1px] h-3.5 bg-slate-300 mx-1" />
                <button
                  type="button"
                  onClick={() => {
                    if (selectedChar) {
                      onDeleteCharacteristic?.(selectedChar.id);
                    }
                  }}
                  disabled={!selectedChar}
                  className="p-1 rounded hover:bg-red-100 hover:text-red-700 disabled:opacity-30 text-slate-500 transition"
                  title={`Delete Characteristic #${selectedChar ? (selectedChar.subNumber || selectedChar.itemNumber) : ''} (Cascade Renumber)`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={onRenumberAll}
                  disabled={totalCount === 0}
                  className="p-1 rounded hover:bg-slate-200 hover:text-slate-800 disabled:opacity-30 text-slate-500 transition ml-0.5"
                  title="Renumber All Balloons Sequentially (AS9102 Rev B/C)"
                >
                  <ListOrdered className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="p-2.5 flex flex-col gap-2.5">
                {/* HEADS-UP DISPLAY (HUD) CROP PREVIEW (With Digital Zoom) */}
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                    <div className="flex items-center gap-1.5">
                      <span>Drawing Crop</span>
                      <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold font-mono uppercase ${
                        selectedChar.extractionSource === 'ocr'
                          ? 'bg-purple-100 text-purple-700 border border-purple-300'
                          : selectedChar.extractionSource === 'manual'
                          ? 'bg-slate-100 text-slate-600 border border-slate-300'
                          : 'bg-slate-200 text-slate-800 border border-slate-300'
                      }`}>
                        {selectedChar.extractionSource || 'Vector'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {selectedChar.drawingZone && (
                        <span className="font-mono text-xs font-semibold text-slate-700">
                          Zone {selectedChar.drawingZone.replace(/^zone\s*/i, '')}
                        </span>
                      )}
                      {hudCropDataUrl && (
                        <button
                          type="button"
                          onClick={() => setIsCropZoomed(!isCropZoomed)}
                          className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 font-mono text-[9px] flex items-center gap-1 cursor-pointer transition shadow-2xs"
                          title={isCropZoomed ? "Reset Zoom (1x)" : "Magnify Crop (2x)"}
                        >
                          {isCropZoomed ? <ZoomOut className="w-3 h-3 text-blue-600" /> : <ZoomIn className="w-3 h-3" />}
                          <span>{isCropZoomed ? '2x' : '1x'}</span>
                        </button>
                      )}
                    </div>
                  </div>
                  <div className={`w-full ${isCropZoomed ? 'h-32' : 'h-16'} bg-slate-50 rounded border border-slate-200 flex items-center justify-center overflow-auto relative shadow-inner p-1 transition-all duration-150`}>
                    {hudCropDataUrl ? (
                      <img
                        src={hudCropDataUrl}
                        alt="Heads up crop"
                        className={`max-h-full max-w-full object-contain transition-transform duration-150 ${isCropZoomed ? 'scale-150' : 'scale-100'}`}
                      />
                    ) : (
                      <div className="flex items-center justify-center font-mono text-xs font-bold text-slate-900 tracking-widest px-2 py-1 bg-slate-100 rounded border border-slate-300">
                        {selectedChar.rawText}
                      </div>
                    )}
                  </div>
                </div>

                {/* ACCORDION 1: GENERAL (Image 1 Benchmark) */}
                <div className="border border-slate-200 rounded-md overflow-hidden bg-white shadow-2xs">
                  <button
                    type="button"
                    onClick={() => toggleSection('general')}
                    className="w-full bg-slate-50 px-2.5 py-1.5 flex items-center justify-between font-bold text-slate-800 text-[11px] uppercase tracking-wide cursor-pointer hover:bg-slate-100 transition"
                  >
                    <span className="flex items-center gap-1.5">
                      {openSections.general ? <ChevronDown className="w-3.5 h-3.5 text-slate-500" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-500" />}
                      <span>General</span>
                    </span>
                    <span className="text-[10px] font-normal text-slate-400 capitalize">{selectedChar.displayType}</span>
                  </button>

                  {openSections.general && (
                    <div className="p-2.5 flex flex-col gap-2 border-t border-slate-200">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] text-slate-500 font-semibold block mb-0.5">Type</label>
                          <select
                            value={selectedChar.displayType}
                            onChange={(e) => onUpdateCharacteristic({ ...selectedChar, displayType: e.target.value as any })}
                            className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded px-2 py-1 text-xs"
                          >
                            <option value="Dimension">Dimension</option>
                            <option value="GEOMETRIC TOLERANCE">GD&T Frame</option>
                            <option value="Symbol">Symbol / Datum</option>
                            <option value="Note">Note / Spec</option>
                            <option value="Surface Finish">Surface Finish</option>
                          </select>
                        </div>

                        <div>
                          <label className="text-[10px] text-slate-500 font-semibold block mb-0.5">Sub-Type</label>
                          <select
                            value={selectedChar.subType}
                            onChange={(e) => onUpdateCharacteristic({ ...selectedChar, subType: e.target.value })}
                            className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded px-2 py-1 text-xs"
                          >
                            <option value="Linear Dimension">Linear Dimension</option>
                            <option value="Diameter">Diameter</option>
                            <option value="Radius">Radius</option>
                            <option value="Angle">Angle</option>
                            <option value="Position">Position (⌖)</option>
                            <option value="Total Runout">Total Runout (⌰)</option>
                            <option value="Perpendicularity">Perpendicularity (⟂)</option>
                            <option value="Datum">Datum</option>
                            <option value="FlagNote">Flag Note</option>
                            <option value="Thread / Fastener">Thread / Fastener</option>
                            <option value="General Note">General Note</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] text-slate-500 font-semibold block mb-0.5">Units</label>
                          <select
                            value={selectedChar.units}
                            onChange={(e) => onUpdateCharacteristic({ ...selectedChar, units: e.target.value as any })}
                            className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded px-2 py-1 text-xs"
                          >
                            <option value="in">Inches (in)</option>
                            <option value="mm">Millimeters (mm)</option>
                            <option value="deg">Degrees (°)</option>
                          </select>
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-0.5">
                            <label className="text-[10px] text-slate-500 font-semibold block">Quantity</label>
                            {selectedChar.quantity > 1 && onUpdateCharacteristics && (
                              <span className="text-[9px] text-blue-600 font-mono font-bold">Pattern</span>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              min={1}
                              value={selectedChar.quantity}
                              onChange={(e) => onUpdateCharacteristic({ ...selectedChar, quantity: Math.max(1, Number(e.target.value)) })}
                              className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded px-2 py-1 text-xs"
                            />
                            {selectedChar.quantity > 1 && onUpdateCharacteristics && (
                              <button
                                type="button"
                                onClick={handleSplitQuantity}
                                className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-[10px] font-bold shadow-xs transition flex items-center gap-1 shrink-0 cursor-pointer"
                                title={`Split into ${selectedChar.quantity} sub-balloons (#${selectedChar.itemNumber}.1 - #${selectedChar.itemNumber}.${selectedChar.quantity})`}
                              >
                                <Split className="w-3 h-3" />
                                <span>Split</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Full Specification (Verbatim Blueprint Callout) */}
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] text-slate-500 font-semibold">
                          Full Specification (Drawing Callout)
                        </label>
                        <textarea
                          rows={2}
                          value={selectedChar.rawText}
                          onChange={(e) => onUpdateCharacteristic({ ...selectedChar, rawText: e.target.value })}
                          className="w-full font-mono bg-slate-50 border border-slate-300 text-slate-900 rounded px-2 py-1 text-xs resize-none"
                          placeholder="e.g. 4X Ø .500 ±.005 THRU"
                        />
                        {/* Symbols Palette */}
                        <div className="flex items-center gap-1 flex-wrap mt-0.5">
                          <span className="text-[9px] text-slate-400 font-semibold mr-0.5">Symbols:</span>
                          {['Ø', '±', '⌖', '⏤', '⌒', '⏥', '∥', '⊥', '∠', 'Ⓜ', 'Ⓛ', 'Ⓢ', '°', '✕'].map((sym) => (
                            <button
                              key={sym}
                              type="button"
                              onClick={() => handleInsertSymbol(sym)}
                              className="w-5 h-5 rounded bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 font-mono font-bold text-[10px] transition cursor-pointer flex items-center justify-center"
                              title={`Insert ${sym}`}
                            >
                              {sym}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Nominal Value & Tolerance Type (Metrological Separation) */}
                      <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100">
                        <div>
                          <label className="text-[10px] text-slate-500 font-semibold block mb-0.5">
                            Nominal Value ({selectedChar.units || 'in'})
                          </label>
                          <input
                            type="number"
                            step="0.0001"
                            value={selectedChar.cleanNominal !== null && selectedChar.cleanNominal !== undefined ? selectedChar.cleanNominal : ''}
                            onChange={(e) => {
                              const val = e.target.value === '' ? null : parseFloat(e.target.value);
                              const nom = val ?? 0;
                              const plus = selectedChar.plusTol ?? selectedChar.upperTol ?? 0;
                              const minus = selectedChar.minusTol ?? (selectedChar.lowerTol ? -selectedChar.lowerTol : 0);
                              onUpdateCharacteristic({
                                ...selectedChar,
                                cleanNominal: val,
                                upperLimit: val !== null ? nom + plus : null,
                                maxLimit: val !== null ? nom + plus : null,
                                lowerLimit: val !== null ? nom + minus : null,
                                minLimit: val !== null ? nom + minus : null,
                              });
                            }}
                            className="w-full bg-slate-50 border border-slate-300 text-slate-900 rounded px-2 py-1 text-xs font-mono font-bold"
                            placeholder="e.g. 0.500"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-500 font-semibold block mb-0.5">
                            Tolerance Type
                          </label>
                          <select
                            value={selectedChar.isBasic ? 'Basic' : selectedChar.forReference ? 'Reference' : (selectedChar.plusTol === Math.abs(selectedChar.minusTol || 0) && (selectedChar.plusTol || 0) > 0 ? 'Symmetric' : 'Bilateral')}
                            onChange={(e) => {
                              const t = e.target.value;
                              if (t === 'Basic') {
                                onUpdateCharacteristic({ ...selectedChar, isBasic: true, forReference: false, plusTol: 0, minusTol: 0 });
                              } else if (t === 'Reference') {
                                onUpdateCharacteristic({ ...selectedChar, isBasic: false, forReference: true });
                              } else {
                                onUpdateCharacteristic({ ...selectedChar, isBasic: false, forReference: false });
                              }
                            }}
                            className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded px-2 py-1 text-xs"
                          >
                            <option value="Bilateral">Bilateral (±)</option>
                            <option value="Symmetric">Symmetric (± Equal)</option>
                            <option value="Limit">Limit Dimensions</option>
                            <option value="Basic">Basic (ASME Y14.5)</option>
                            <option value="Reference">Reference (Ref)</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* ACCORDION 2: TOLERANCE & LIMITS */}
                <div className="border border-slate-200 rounded-md overflow-hidden bg-white shadow-2xs">
                  <button
                    type="button"
                    onClick={() => toggleSection('tolerance')}
                    className="w-full bg-slate-50 px-2.5 py-1.5 flex items-center justify-between font-bold text-slate-800 text-[11px] uppercase tracking-wide cursor-pointer hover:bg-slate-100 transition"
                  >
                    <span className="flex items-center gap-1.5">
                      {openSections.tolerance ? <ChevronDown className="w-3.5 h-3.5 text-slate-500" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-500" />}
                      <span>Tolerance & Limits</span>
                    </span>
                    <span className="text-[10px] font-mono text-slate-400 font-normal">
                      {selectedChar.upperLimit != null && selectedChar.lowerLimit != null 
                        ? `[${formatDecimal(selectedChar.lowerLimit, 3, appOptions.workspace.decimalSeparator)}, ${formatDecimal(selectedChar.upperLimit, 3, appOptions.workspace.decimalSeparator)}]` 
                        : (selectedChar.toleranceSource || '')}
                    </span>
                  </button>

                  {openSections.tolerance && (
                    <div className="p-2.5 flex flex-col gap-2 border-t border-slate-200">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] text-slate-500 font-semibold block mb-0.5">+Tolerance</label>
                          <input
                            type="number"
                            step="0.001"
                            value={selectedChar.plusTol ?? selectedChar.upperTol ?? ''}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              const nom = selectedChar.cleanNominal || 0;
                              onUpdateCharacteristic({
                                ...selectedChar,
                                plusTol: val,
                                upperTol: val,
                                upperLimit: nom + val,
                                maxLimit: nom + val
                              });
                            }}
                            className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded px-2 py-1 text-xs font-mono"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] text-slate-500 font-semibold block mb-0.5">-Tolerance</label>
                          <input
                            type="number"
                            step="0.001"
                            value={selectedChar.lowerTol != null ? Math.abs(selectedChar.lowerTol) : (selectedChar.minusTol != null ? Math.abs(selectedChar.minusTol) : '')}
                            onChange={(e) => {
                              const val = Math.abs(parseFloat(e.target.value) || 0);
                              const nom = selectedChar.cleanNominal || 0;
                              onUpdateCharacteristic({
                                ...selectedChar,
                                minusTol: -val,
                                lowerTol: val,
                                lowerLimit: nom - val,
                                minLimit: nom - val
                              });
                            }}
                            className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded px-2 py-1 text-xs font-mono"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] text-slate-500 font-semibold block mb-0.5">Upper Limit</label>
                          <input
                            type="number"
                            step="0.0001"
                            value={selectedChar.upperLimit ?? selectedChar.maxLimit ?? ''}
                            onChange={(e) => onUpdateCharacteristic({ ...selectedChar, upperLimit: parseFloat(e.target.value) || null })}
                            className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs font-mono font-bold text-slate-900"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] text-slate-500 font-semibold block mb-0.5">Lower Limit</label>
                          <input
                            type="number"
                            step="0.0001"
                            value={selectedChar.lowerLimit ?? selectedChar.minLimit ?? ''}
                            onChange={(e) => onUpdateCharacteristic({ ...selectedChar, lowerLimit: parseFloat(e.target.value) || null })}
                            className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs font-mono font-bold text-slate-900"
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-4 mt-1">
                        <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-slate-600">
                          <input
                            type="checkbox"
                            checked={selectedChar.forReference}
                            onChange={(e) => onUpdateCharacteristic({ ...selectedChar, forReference: e.target.checked })}
                            className="rounded border-slate-300 accent-slate-700 text-slate-700"
                          />
                          <span>For Reference</span>
                        </label>

                        <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-slate-600">
                          <input
                            type="checkbox"
                            checked={selectedChar.isBasic}
                            onChange={(e) => onUpdateCharacteristic({ ...selectedChar, isBasic: e.target.checked })}
                            className="rounded border-slate-300 accent-slate-700 text-slate-700"
                          />
                          <span>Basic (Tol = 0)</span>
                        </label>
                      </div>
                    </div>
                  )}
                </div>

                {/* ACCORDION 3: PHYSICAL MEASUREMENT (FORM 3) */}
                <div className="border border-slate-200 rounded-md overflow-hidden bg-white shadow-2xs">
                  <button
                    type="button"
                    onClick={() => toggleSection('measurement')}
                    className="w-full bg-slate-50 px-2.5 py-1.5 flex items-center justify-between font-bold text-slate-800 text-[11px] uppercase tracking-wide cursor-pointer hover:bg-slate-100 transition"
                  >
                    <span className="flex items-center gap-1.5">
                      {openSections.measurement ? <ChevronDown className="w-3.5 h-3.5 text-slate-500" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-500" />}
                      <span>Physical Measurement (Form 3)</span>
                    </span>
                    <div>
                      {selectedChar.conformanceStatus === 'PASS' && (
                        <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold text-[9px] border border-emerald-200">
                          PASS
                        </span>
                      )}
                      {selectedChar.conformanceStatus === 'MARGINAL' && (
                        <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-bold text-[9px] border border-amber-300">
                          MARGINAL
                        </span>
                      )}
                      {selectedChar.conformanceStatus === 'FAIL' && (
                        <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-800 font-bold text-[9px] border border-red-300 animate-pulse">
                          FAIL
                        </span>
                      )}
                      {(!selectedChar.conformanceStatus || selectedChar.conformanceStatus === 'UNMEASURED') && (
                        <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-400 font-medium text-[9px]">
                          UNMEASURED
                        </span>
                      )}
                    </div>
                  </button>

                  {openSections.measurement && (
                    <div className="p-2.5 flex flex-col gap-2 border-t border-slate-200">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] text-slate-500 font-semibold block mb-0.5">Measured Actual</label>
                          <input
                            type="number"
                            step="0.0001"
                            placeholder="e.g. 1.2504"
                            value={selectedChar.measuredValue !== null && selectedChar.measuredValue !== undefined ? selectedChar.measuredValue : ''}
                            onChange={(e) => {
                              const val = e.target.value.trim();
                              const num = val === '' ? null : parseFloat(val);
                              if (val === '' || !isNaN(num as number)) {
                                const evalRes = MeasurementEngine.evaluateMeasurement(selectedChar, num);
                                onUpdateCharacteristic({
                                  ...selectedChar,
                                  measuredValue: num,
                                  conformanceStatus: evalRes.status,
                                  deviation: evalRes.deviation,
                                  measuredAt: new Date().toISOString()
                                });
                              }
                            }}
                            className="w-full bg-slate-50 border border-slate-300 focus:border-slate-800 rounded px-2 py-1 text-xs font-mono font-bold text-slate-900 focus:bg-white"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] text-slate-500 font-semibold block mb-0.5">Deviation</label>
                          <div className="w-full bg-slate-100 border border-slate-200 rounded px-2 py-1 text-xs font-mono font-semibold text-slate-700 h-[26px] flex items-center">
                            {selectedChar.deviation !== null && selectedChar.deviation !== undefined ? (
                              <span className={selectedChar.deviation > 0 ? 'text-amber-700' : 'text-slate-700'}>
                                {selectedChar.deviation > 0 ? `+${formatDecimal(selectedChar.deviation, 4, appOptions.workspace.decimalSeparator)}` : formatDecimal(selectedChar.deviation, 4, appOptions.workspace.decimalSeparator)} {selectedChar.units}
                              </span>
                            ) : (
                              <span className="text-slate-400">--</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] text-slate-500 font-semibold block mb-0.5">Inspector Initials</label>
                          <input
                            type="text"
                            maxLength={6}
                            placeholder="e.g. QC-1"
                            value={selectedChar.inspectorInitials || ''}
                            onChange={(e) => onUpdateCharacteristic({
                              ...selectedChar,
                              inspectorInitials: e.target.value.toUpperCase()
                            })}
                            className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded px-2 py-1 text-xs font-mono uppercase"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] text-slate-500 font-semibold block mb-0.5">Measurement Date</label>
                          <div className="w-full bg-slate-100 border border-slate-200 rounded px-2 py-1 text-[10px] font-mono text-slate-500 truncate h-[26px] flex items-center">
                            {selectedChar.measuredAt ? new Date(selectedChar.measuredAt).toLocaleDateString() : 'Pending'}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* ACCORDION 4: INSPECTION & TOOLING */}
                <div className="border border-slate-200 rounded-md overflow-hidden bg-white shadow-2xs">
                  <button
                    type="button"
                    onClick={() => toggleSection('inspection')}
                    className="w-full bg-slate-50 px-2.5 py-1.5 flex items-center justify-between font-bold text-slate-800 text-[11px] uppercase tracking-wide cursor-pointer hover:bg-slate-100 transition"
                  >
                    <span className="flex items-center gap-1.5">
                      {openSections.inspection ? <ChevronDown className="w-3.5 h-3.5 text-slate-500" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-500" />}
                      <span>Inspection & Tooling</span>
                    </span>
                    <span className="text-[10px] font-normal text-slate-400">{selectedChar.inspectionMethod}</span>
                  </button>

                  {openSections.inspection && (
                    <div className="p-2.5 flex flex-col gap-2.5 border-t border-slate-200">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] text-slate-500 font-semibold block mb-0.5">Classification</label>
                          <select
                            value={selectedChar.classification}
                            onChange={(e) => onUpdateCharacteristic({ ...selectedChar, classification: e.target.value as any })}
                            className={`w-full border rounded px-2 py-1 text-xs font-semibold ${
                              selectedChar.classification === 'Critical'
                                ? 'bg-red-50 border-red-300 text-red-700'
                                : selectedChar.classification === 'Major'
                                ? 'bg-amber-50 border-amber-300 text-amber-700'
                                : 'bg-slate-50 border-slate-200 text-slate-700'
                            }`}
                          >
                            <option value="Critical">Critical</option>
                            <option value="Major">Major</option>
                            <option value="Minor">Minor</option>
                          </select>
                        </div>

                        <div>
                          <label className="text-[10px] text-slate-500 font-semibold block mb-0.5">Method / Tool</label>
                          <select
                            value={selectedChar.inspectionMethod}
                            onChange={(e) => onUpdateCharacteristic({ ...selectedChar, inspectionMethod: e.target.value as any })}
                            className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded px-2 py-1 text-xs"
                          >
                            {availableMethods.map((m) => (
                              <option key={m} value={m}>{m}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="text-[10px] text-slate-500 font-semibold block mb-0.5">Comments / AS9102 Remark</label>
                        <textarea
                          rows={2}
                          value={selectedChar.comments || ''}
                          onChange={(e) => onUpdateCharacteristic({ ...selectedChar, comments: e.target.value })}
                          placeholder="Add inspection notes or AS9102 Form 3 remark..."
                          className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded p-1.5 text-xs resize-none placeholder:text-slate-400 focus:outline-hidden focus:ring-1 focus:ring-slate-500"
                        />
                      </div>

                      {/* Verification Status Banner */}
                      {(() => {
                        const isVerified = selectedChar.verificationStatus === 'verified' || selectedChar.verificationStatus === 'auto_accepted';
                        return (
                          <div className="flex items-center justify-between p-2 rounded bg-slate-50 border border-slate-200 shadow-2xs">
                            <div className="flex items-center gap-1.5">
                              {!isVerified ? (
                                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                              ) : (
                                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                              )}
                              <span className={`text-[11px] font-bold ${!isVerified ? 'text-amber-800' : 'text-slate-800'}`}>
                                {!isVerified ? 'Needs Review' : 'Verified / Accepted'}
                              </span>
                            </div>

                            <button
                              type="button"
                              onClick={() => onUpdateCharacteristic({
                                ...selectedChar,
                                verificationStatus: isVerified ? 'needs_review' : 'verified'
                              })}
                              className={`px-3 py-1 rounded text-[11px] font-bold shadow-xs transition cursor-pointer flex items-center gap-1.5 ${
                                isVerified ? 'btn-flag-review' : 'btn-accept-item'
                              }`}
                            >
                              {isVerified ? (
                                <>
                                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                  <span>Flag for Review</span>
                                </>
                              ) : (
                                <>
                                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                                  <span>Accept Item</span>
                                </>
                              )}
                            </button>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              </div>
          </>
        ) : !isInspectActive ? (
          /* PROJECT PROPERTIES (Persistent Default Left Panel) */
          <div className="p-3 flex flex-col gap-3">

            <div className="flex flex-col gap-2">
              <div>
                <label className="text-[10px] text-slate-500 font-semibold block mb-0.5">Part Name</label>
                <input
                  type="text"
                  placeholder="e.g. Turbine Mount Bracket"
                  value={projectProps.partName}
                  onChange={(e) => onUpdateProjectProps({ ...projectProps, partName: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded px-2 py-1 text-xs font-semibold focus:outline-hidden focus:border-slate-700"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-slate-500 font-semibold block mb-0.5">Part Number</label>
                  <input
                    type="text"
                    placeholder="e.g. AS9102-001"
                    value={projectProps.partNumber}
                    onChange={(e) => onUpdateProjectProps({ ...projectProps, partNumber: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded px-2 py-1 text-xs font-mono font-bold focus:outline-hidden focus:border-slate-700"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-slate-500 font-semibold block mb-0.5">Part Revision</label>
                  <input
                    type="text"
                    placeholder="e.g. A"
                    value={projectProps.partRevision}
                    onChange={(e) => onUpdateProjectProps({ ...projectProps, partRevision: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded px-2 py-1 text-xs font-mono focus:outline-hidden focus:border-slate-700"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-slate-500 font-semibold block mb-0.5">Drawing Number</label>
                  <input
                    type="text"
                    placeholder="e.g. DWG-001"
                    value={projectProps.drawingNumber}
                    onChange={(e) => onUpdateProjectProps({ ...projectProps, drawingNumber: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded px-2 py-1 text-xs font-mono focus:outline-hidden focus:border-slate-700"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-slate-500 font-semibold block mb-0.5">Drawing Rev</label>
                  <input
                    type="text"
                    placeholder="e.g. A"
                    value={projectProps.drawingRevision}
                    onChange={(e) => onUpdateProjectProps({ ...projectProps, drawingRevision: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded px-2 py-1 text-xs font-mono focus:outline-hidden focus:border-slate-700"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] text-slate-500 font-semibold block mb-0.5">CAGE Code</label>
                <input
                  type="text"
                  placeholder="e.g. 1A2B3"
                  value={projectProps.cageCode}
                  onChange={(e) => onUpdateProjectProps({ ...projectProps, cageCode: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded px-2 py-1 text-xs font-mono focus:outline-hidden focus:border-slate-700"
                />
              </div>
            </div>

            <span className="font-bold text-slate-900 text-xs uppercase tracking-wide border-b border-slate-200 pb-1 mt-2">
              Sampling & Quality Plan
            </span>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-slate-500 font-semibold block mb-0.5">Lot Size</label>
                <input
                  type="number"
                  value={projectProps.lotSize}
                  onChange={(e) => onUpdateProjectProps({ ...projectProps, lotSize: Number(e.target.value) })}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded px-2 py-1 text-xs focus:outline-hidden focus:border-slate-700"
                />
              </div>

              <div>
                <label className="text-[10px] text-slate-500 font-semibold block mb-0.5">Level</label>
                <select
                  value={projectProps.samplingLevel}
                  onChange={(e) => onUpdateProjectProps({ ...projectProps, samplingLevel: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded px-2 py-1 text-xs focus:outline-hidden focus:border-slate-700"
                >
                  <option value="I">Level I</option>
                  <option value="II">Level II (Normal)</option>
                  <option value="III">Level III (Tightened)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-slate-500 font-semibold block mb-0.5">Type</label>
                <select
                  value={projectProps.samplingType}
                  onChange={(e) => onUpdateProjectProps({ ...projectProps, samplingType: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded px-2 py-1 text-xs focus:outline-hidden focus:border-slate-700"
                >
                  <option value="NORMAL">NORMAL</option>
                  <option value="TIGHTENED">TIGHTENED</option>
                  <option value="REDUCED">REDUCED</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] text-slate-500 font-semibold block mb-0.5">AQL</label>
                <input
                  type="text"
                  value={projectProps.aql}
                  onChange={(e) => onUpdateProjectProps({ ...projectProps, aql: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded px-2 py-1 text-xs font-mono focus:outline-hidden focus:border-slate-700"
                />
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {/* EXPORT OPTIONS MODAL (Fallback when not provided at app root) */}
      {!onOpenExportModal && (
        <ExportModal
          isOpen={isExportModalOpen}
          onClose={() => setIsExportModalOpen(false)}
          onExportExcel={onExportExcel}
          onExportPdf={onExportPdf}
          characteristicsCount={characteristics.length}
          hasDrawing={hasDrawing ?? characteristics.length > 0}
          selectedTemplate={selectedTemplate}
          onSelectTemplate={setSelectedTemplate}
        />
      )}
    </aside>
  );
};
