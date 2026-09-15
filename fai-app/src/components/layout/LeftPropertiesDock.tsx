import React, { useState } from 'react';
import type { 
  EngineeringCharacteristic, 
  ProjectProperties, 
  InspectionMethod 
} from '../../types/characteristics';
import { MeasurementEngine } from '../../services/compliance/measurementEngine';
import { 
  ChevronLeft, 
  ChevronRight, 
  ChevronsLeft,
  ChevronsRight,
  FileSpreadsheet, 
  FileDown,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  ListOrdered,
  Target, 
  SlidersHorizontal 
} from 'lucide-react';

interface LeftPropertiesDockProps {
  // Characteristics
  characteristics: EngineeringCharacteristic[];
  selectedChar: EngineeringCharacteristic | null;
  onSelectCharacteristic: (char: EngineeringCharacteristic) => void;
  onUpdateCharacteristic: (char: EngineeringCharacteristic) => void;
  onDeleteCharacteristic?: (id: string) => void;
  onRenumberAll?: () => void;

  // Project Properties
  projectProps: ProjectProperties;
  onUpdateProjectProps: (props: ProjectProperties) => void;

  // Export Deliverables
  onExportExcel: () => void;
  onExportPdf?: () => void;

  // Crop preview data URL from ViewportCanvas
  hudCropDataUrl?: string | null;

  // Panel state
  isOpen?: boolean;
  onToggleOpen?: (open: boolean) => void;
  width?: number;
  onWidthChange?: (width: number) => void;
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
  onUpdateCharacteristic,
  onDeleteCharacteristic,
  onRenumberAll,
  projectProps,
  onUpdateProjectProps,
  onExportExcel,
  onExportPdf,
  hudCropDataUrl,
  isOpen = true,
  onToggleOpen,
  width: dockWidth = 320,
  onWidthChange
}) => {
  const [activePanelTab, setActivePanelTab] = useState<'characteristic' | 'project' | 'excel'>('characteristic');
  const [selectedTemplate, setSelectedTemplate] = useState('AS9102B.xlt');

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

  const handleExpand = () => {
    if (dockWidth < 200 && onWidthChange) {
      onWidthChange(320);
    }
    onToggleOpen?.(true);
  };

  // If collapsed: Render slim 40px VS Code style Activity Bar
  if (!isOpen) {
    return (
      <aside className="w-10 h-full bg-slate-100 border-r border-slate-300 flex flex-col items-center py-2 select-none z-20 shrink-0 relative">
        {/* Top Expand Button */}
        <button
          type="button"
          onClick={handleExpand}
          className="p-1.5 rounded hover:bg-slate-200 text-slate-600 hover:text-blue-600 transition mb-3"
          title="Expand Side Panel (or drag right)"
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        {/* Vertical Tool Icons */}
        <div className="flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setActivePanelTab('characteristic');
              handleExpand();
            }}
            className={`p-2 rounded transition ${
              activePanelTab === 'characteristic'
                ? 'bg-white text-blue-600 shadow-xs border border-slate-300'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200'
            }`}
            title="Characteristic Properties"
          >
            <Target className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => {
              setActivePanelTab('project');
              handleExpand();
            }}
            className={`p-2 rounded transition ${
              activePanelTab === 'project'
                ? 'bg-white text-blue-600 shadow-xs border border-slate-300'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200'
            }`}
            title="Project Properties"
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => {
              setActivePanelTab('excel');
              handleExpand();
            }}
            className={`p-2 rounded transition ${
              activePanelTab === 'excel'
                ? 'bg-white text-emerald-600 shadow-xs border border-slate-300'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200'
            }`}
            title="Excel Export"
          >
            <FileSpreadsheet className="w-4 h-4" />
          </button>
        </div>

      </aside>
    );
  }

  return (
    <aside 
      style={{ width: `${dockWidth}px` }}
      className="h-full bg-white flex flex-col select-none text-slate-800 text-xs shadow-xs z-20 overflow-hidden relative shrink-0"
    >
      {/* Top Segmented Tab Strip */}
      <div className="h-8 bg-slate-100 border-b border-slate-300 flex items-center px-1.5 gap-1 shrink-0">
        <button
          type="button"
          onClick={() => setActivePanelTab('characteristic')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1 px-1 rounded font-bold text-[11px] transition ${
            activePanelTab === 'characteristic'
              ? 'bg-white text-blue-700 shadow-xs border border-slate-300'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
          }`}
        >
          <Target className="w-3.5 h-3.5 text-blue-600" />
          <span>Characteristic</span>
        </button>

        <button
          type="button"
          onClick={() => setActivePanelTab('project')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1 px-1 rounded font-bold text-[11px] transition ${
            activePanelTab === 'project'
              ? 'bg-white text-blue-700 shadow-xs border border-slate-300'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
          }`}
        >
          <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
          <span>Project</span>
        </button>

        <button
          type="button"
          onClick={() => setActivePanelTab('excel')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1 px-1 rounded font-bold text-[11px] transition ${
            activePanelTab === 'excel'
              ? 'bg-white text-emerald-700 shadow-xs border border-slate-300'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
          }`}
        >
          <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
          <span>Export</span>
        </button>

        {/* Collapse Button */}
        <button
          type="button"
          onClick={() => onToggleOpen?.(false)}
          className="p-1 rounded hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition ml-0.5"
          title="Collapse Side Panel (Double-click border or drag left)"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Panel Body */}
      <div className="flex-1 w-full overflow-y-auto bg-white flex flex-col min-h-0">
        {/* TAB 1: CHARACTERISTIC PROPERTIES */}
        {activePanelTab === 'characteristic' && (
          <>
            {/* Header & Stepper Bar */}
            <div className="p-2 border-b border-slate-200 bg-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-bold text-slate-900">
                <span>Characteristic</span>
                <span className="text-blue-700 font-mono">
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
                  className="p-1 rounded hover:bg-blue-100 hover:text-blue-700 disabled:opacity-30 text-slate-500 transition ml-0.5"
                  title="Renumber All Balloons Sequentially (AS9102 Rev B/C)"
                >
                  <ListOrdered className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {selectedChar ? (
              <div className="p-3 flex flex-col gap-3">
                {/* HEADS-UP DISPLAY (HUD) CROP PREVIEW (InspectionXpert Signature Feature) */}
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                    <div className="flex items-center gap-1.5">
                      <span>Drawing Crop</span>
                      <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold font-mono uppercase ${
                        selectedChar.extractionSource === 'ocr'
                          ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-700'
                          : selectedChar.extractionSource === 'manual'
                          ? 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 border border-slate-300 dark:border-zinc-700'
                          : 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-700'
                      }`}>
                        {selectedChar.extractionSource || 'Vector'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold font-mono ${
                        (selectedChar.confidenceScore ?? 1.0) >= 0.90
                          ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400'
                          : 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400'
                      }`}>
                        {Math.round((selectedChar.confidenceScore ?? 1.0) * 100)}% Conf
                      </span>
                      <span className="font-mono text-blue-600 dark:text-blue-400">{selectedChar.drawingZone}</span>
                    </div>
                  </div>
                  <div className="w-full h-16 bg-slate-900 rounded border border-slate-700 flex items-center justify-center overflow-hidden relative shadow-inner p-1">
                    {hudCropDataUrl ? (
                      <img
                        src={hudCropDataUrl}
                        alt="Heads up crop"
                        className="max-h-full max-w-full object-contain filter invert brightness-150 contrast-125"
                      />
                    ) : (
                      <div className="flex items-center justify-center font-mono text-xs font-bold text-white tracking-widest px-2 py-1 bg-blue-950/80 rounded border border-blue-500/30">
                        {selectedChar.rawText}
                      </div>
                    )}
                  </div>
                </div>

                {/* GENERAL SETTINGS */}
                <div className="flex flex-col gap-2 pt-1 border-t border-slate-200">
                  <span className="font-bold text-slate-900 text-[11px] uppercase tracking-wide">General</span>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-slate-500 font-semibold block mb-0.5">Type</label>
                      <select
                        value={selectedChar.displayType}
                        onChange={(e) => onUpdateCharacteristic({ ...selectedChar, displayType: e.target.value as any })}
                        className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs"
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
                        className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs"
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
                        className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs"
                      >
                        <option value="in">Inches (in)</option>
                        <option value="mm">Millimeters (mm)</option>
                        <option value="deg">Degrees (°)</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] text-slate-500 font-semibold block mb-0.5">Quantity</label>
                      <input
                        type="number"
                        min={1}
                        value={selectedChar.quantity}
                        onChange={(e) => onUpdateCharacteristic({ ...selectedChar, quantity: Number(e.target.value) })}
                        className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs"
                      />
                    </div>
                  </div>
                </div>

                {/* VALUE & SYMBOL INSERTION */}
                <div className="flex flex-col gap-1.5 pt-1 border-t border-slate-200">
                  <label className="text-[10px] text-slate-500 font-semibold">Value / Requirement</label>
                  <input
                    type="text"
                    value={selectedChar.rawText}
                    onChange={(e) => onUpdateCharacteristic({ ...selectedChar, rawText: e.target.value })}
                    className="w-full font-mono bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs"
                  />

                  {/* GD&T Symbol Palette */}
                  <div className="flex items-center gap-1 mt-0.5">
                    <span className="text-[10px] text-slate-400 font-semibold mr-1">Symbols:</span>
                    {['Ø', '±', '⌖', '⌓', '⟂', '⌰', 'Ⓜ'].map((sym) => (
                      <button
                        key={sym}
                        type="button"
                        onClick={() => handleInsertSymbol(sym)}
                        className="w-6 h-6 rounded bg-slate-100 hover:bg-blue-100 hover:text-blue-700 border border-slate-200 font-mono font-bold text-xs transition"
                        title={`Insert ${sym}`}
                      >
                        {sym}
                      </button>
                    ))}
                  </div>
                </div>

                {/* TOLERANCE & LIMITS */}
                <div className="flex flex-col gap-2 pt-1 border-t border-slate-200">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 text-[11px] uppercase tracking-wide">Tolerance & Limits</span>
                    <span className="text-[10px] text-slate-400 font-mono">{selectedChar.toleranceSource}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-slate-500 font-semibold block mb-0.5">+Tolerance</label>
                      <input
                        type="number"
                        step="0.001"
                        value={selectedChar.plusTol ?? selectedChar.upperTol}
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
                        className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs font-mono"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] text-slate-500 font-semibold block mb-0.5">-Tolerance</label>
                      <input
                        type="number"
                        step="0.001"
                        value={selectedChar.minusTol ?? -selectedChar.lowerTol}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          const nom = selectedChar.cleanNominal || 0;
                          onUpdateCharacteristic({
                            ...selectedChar,
                            minusTol: val,
                            lowerTol: Math.abs(val),
                            lowerLimit: nom - Math.abs(val),
                            minLimit: nom - Math.abs(val)
                          });
                        }}
                        className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs font-mono"
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
                        className="rounded border-slate-300 text-blue-600"
                      />
                      <span>For Reference</span>
                    </label>

                    <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-slate-600">
                      <input
                        type="checkbox"
                        checked={selectedChar.isBasic}
                        onChange={(e) => onUpdateCharacteristic({ ...selectedChar, isBasic: e.target.checked })}
                        className="rounded border-slate-300 text-blue-600"
                      />
                      <span>Basic (Tol = 0)</span>
                    </label>
                  </div>
                </div>

                {/* PHYSICAL MEASUREMENT & AS9102 FORM 3 ACTUALS */}
                <div className="flex flex-col gap-2 pt-1 border-t border-slate-200">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 text-[11px] uppercase tracking-wide">Physical Measurement (Form 3)</span>
                    {selectedChar.conformanceStatus === 'PASS' && (
                      <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[9px] border border-emerald-300">
                        PASS
                      </span>
                    )}
                    {selectedChar.conformanceStatus === 'MARGINAL' && (
                      <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-bold text-[9px] border border-amber-300" title="Measurement within 10% of tolerance boundary">
                        MARGINAL
                      </span>
                    )}
                    {selectedChar.conformanceStatus === 'FAIL' && (
                      <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-800 font-bold text-[9px] border border-red-300 animate-pulse" title="Out of tolerance specification">
                        FAIL
                      </span>
                    )}
                    {(!selectedChar.conformanceStatus || selectedChar.conformanceStatus === 'UNMEASURED') && (
                      <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-400 font-medium text-[9px]">
                        UNMEASURED
                      </span>
                    )}
                  </div>

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
                        className="w-full bg-slate-50 border border-blue-400 rounded px-2 py-1 text-xs font-mono font-bold text-slate-900 focus:bg-white"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] text-slate-500 font-semibold block mb-0.5">Deviation</label>
                      <div className="w-full bg-slate-100 border border-slate-200 rounded px-2 py-1 text-xs font-mono font-semibold text-slate-700 h-[26px] flex items-center">
                        {selectedChar.deviation !== null && selectedChar.deviation !== undefined ? (
                          <span className={selectedChar.deviation > 0 ? 'text-amber-700' : selectedChar.deviation < 0 ? 'text-blue-700' : 'text-slate-700'}>
                            {selectedChar.deviation > 0 ? `+${selectedChar.deviation.toFixed(4)}` : selectedChar.deviation.toFixed(4)} {selectedChar.units}
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
                        className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs font-mono uppercase"
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

                {/* INSPECTION METADATA */}
                <div className="flex flex-col gap-2 pt-1 border-t border-slate-200">
                  <span className="font-bold text-slate-900 text-[11px] uppercase tracking-wide">Inspection</span>

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
                      <label className="text-[10px] text-slate-500 font-semibold block mb-0.5">Method</label>
                      <select
                        value={selectedChar.inspectionMethod}
                        onChange={(e) => onUpdateCharacteristic({ ...selectedChar, inspectionMethod: e.target.value as any })}
                        className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs"
                      >
                        {INSPECTION_METHODS.map((m) => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-500 font-semibold block mb-0.5">Comments</label>
                    <textarea
                      rows={2}
                      value={selectedChar.comments || ''}
                      onChange={(e) => onUpdateCharacteristic({ ...selectedChar, comments: e.target.value })}
                      placeholder="Add inspection notes or AS9102 Form 3 remark..."
                      className="w-full bg-slate-50 border border-slate-200 rounded p-1.5 text-xs resize-none"
                    />
                  </div>

                  {/* Verification Status Banner */}
                  <div className="flex items-center justify-between p-2 rounded bg-slate-50 border border-slate-200 mt-1">
                    <div className="flex items-center gap-1.5">
                      {selectedChar.verificationStatus === 'needs_review' ? (
                        <AlertTriangle className="w-4 h-4 text-amber-500" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      )}
                      <span className="text-[11px] font-semibold">
                        {selectedChar.verificationStatus === 'needs_review' ? 'Needs Review' : 'Verified / Accepted'}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => onUpdateCharacteristic({
                        ...selectedChar,
                        verificationStatus: selectedChar.verificationStatus === 'verified' ? 'needs_review' : 'verified'
                      })}
                      className="px-2 py-1 rounded bg-white hover:bg-slate-100 border border-slate-300 text-[10px] font-bold text-slate-700 shadow-2xs transition"
                    >
                      {selectedChar.verificationStatus === 'verified' ? 'Flag Review' : 'Accept Item'}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-6 text-center text-slate-400">
                <p className="text-xs">Select a balloon or table row to inspect and edit characteristic properties.</p>
              </div>
            )}
          </>
        )}

        {/* TAB 2: PROJECT PROPERTIES (Part No, CAGE, Sampling Plan) */}
        {activePanelTab === 'project' && (
          <div className="p-3 flex flex-col gap-3">
            <span className="font-bold text-slate-900 text-xs uppercase tracking-wide border-b border-slate-200 pb-1">
              General Settings
            </span>

            <div className="flex flex-col gap-2">
              <div>
                <label className="text-[10px] text-slate-500 font-semibold block mb-0.5">Part Name</label>
                <input
                  type="text"
                  value={projectProps.partName}
                  onChange={(e) => onUpdateProjectProps({ ...projectProps, partName: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-slate-500 font-semibold block mb-0.5">Part Number</label>
                  <input
                    type="text"
                    value={projectProps.partNumber}
                    onChange={(e) => onUpdateProjectProps({ ...projectProps, partNumber: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-slate-500 font-semibold block mb-0.5">Part Revision</label>
                  <input
                    type="text"
                    value={projectProps.partRevision}
                    onChange={(e) => onUpdateProjectProps({ ...projectProps, partRevision: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-slate-500 font-semibold block mb-0.5">Drawing Number</label>
                  <input
                    type="text"
                    value={projectProps.drawingNumber}
                    onChange={(e) => onUpdateProjectProps({ ...projectProps, drawingNumber: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-slate-500 font-semibold block mb-0.5">Drawing Rev</label>
                  <input
                    type="text"
                    value={projectProps.drawingRevision}
                    onChange={(e) => onUpdateProjectProps({ ...projectProps, drawingRevision: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] text-slate-500 font-semibold block mb-0.5">CAGE Code</label>
                <input
                  type="text"
                  value={projectProps.cageCode}
                  onChange={(e) => onUpdateProjectProps({ ...projectProps, cageCode: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs font-mono"
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
                  className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs"
                />
              </div>

              <div>
                <label className="text-[10px] text-slate-500 font-semibold block mb-0.5">Level</label>
                <select
                  value={projectProps.samplingLevel}
                  onChange={(e) => onUpdateProjectProps({ ...projectProps, samplingLevel: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs"
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
                  className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs"
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
                  className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs font-mono"
                />
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: UNIFIED EXPORT DELIVERABLES (InspectionXpert AS9102 Certified Center) */}
        {activePanelTab === 'excel' && (
          <div className="p-3 flex flex-col gap-4">
            {/* Section 1: Marked Vector Blueprint PDF */}
            <div className="flex flex-col gap-2">
              <span className="font-bold text-slate-900 text-xs uppercase tracking-wide border-b border-slate-200 pb-1 flex items-center justify-between">
                <span>Marked Blueprint PDF</span>
                <span className="text-[10px] font-mono text-slate-400 font-normal">Vector Stamped</span>
              </span>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Export drawing with permanent ASME Y14.5 inspection balloons, leader lines, and certified AS9102 title stamp.
              </p>
              {onExportPdf && (
                <button
                  type="button"
                  onClick={onExportPdf}
                  disabled={characteristics.length === 0}
                  className="flex items-center justify-center gap-2 w-full py-2 bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white font-bold text-xs rounded border border-red-700 shadow-xs transition cursor-pointer"
                  title="Export Marked Vector Blueprint PDF with permanent balloons"
                >
                  <FileDown className="w-4 h-4 text-white" />
                  <span>Export Marked PDF (.pdf)</span>
                </button>
              )}
            </div>

            {/* Section 2: AS9102 Excel Workbook */}
            <div className="flex flex-col gap-2 pt-1 border-t border-slate-200">
              <span className="font-bold text-slate-900 text-xs uppercase tracking-wide border-b border-slate-200 pb-1 flex items-center justify-between">
                <span>AS9102 Excel Deliverables</span>
                <span className="text-[10px] font-mono text-slate-400 font-normal">Forms 1, 2, 3</span>
              </span>

              <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mt-1">
                Select Form Template
              </label>
              <div className="flex flex-col gap-1.5 border border-slate-200 rounded p-2 bg-slate-50 max-h-48 overflow-y-auto">
                {[
                  { name: 'AS9102B.xlsx', label: 'SAE AS9102 Rev B (Inches)' },
                  { name: 'AS9102B-Metric.xlsx', label: 'SAE AS9102 Rev B (Metric)' },
                  { name: 'AS9102C-2023.xlsx', label: 'SAE AS9102 Rev C (Current)' },
                  { name: 'PPAP-Level3.xlsx', label: 'Automotive PPAP Level 3' }
                ].map((tmpl) => (
                  <label key={tmpl.name} className="flex items-center gap-2 p-1.5 rounded hover:bg-white cursor-pointer transition">
                    <input
                      type="radio"
                      name="excel-template"
                      checked={selectedTemplate === tmpl.name}
                      onChange={() => setSelectedTemplate(tmpl.name)}
                      className="text-blue-600"
                    />
                    <div className="flex flex-col">
                      <span className="font-bold text-slate-800 text-[11px]">{tmpl.name}</span>
                      <span className="text-[10px] text-slate-500">{tmpl.label}</span>
                    </div>
                  </label>
                ))}
              </div>

              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mt-1">
                Document Snapshots
              </span>

              <div className="flex flex-col gap-1.5 text-[11px] text-slate-600">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" defaultChecked className="rounded border-slate-300 text-blue-600 cursor-pointer" />
                  <span>Include Callout Heads-Up Crops</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" defaultChecked className="rounded border-slate-300 text-blue-600 cursor-pointer" />
                  <span>Include Full Drawing Sheet Previews</span>
                </label>
              </div>

              <button
                type="button"
                onClick={onExportExcel}
                disabled={characteristics.length === 0}
                className="mt-2 flex items-center justify-center gap-2 w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-bold text-xs rounded border border-emerald-700 shadow-xs transition cursor-pointer"
                title="Export Certified SAE AS9102 Form 1, Form 2, and Form 3 Multi-Sheet Excel"
              >
                <FileSpreadsheet className="w-4 h-4 text-white" />
                <span>Export AS9102 Excel Workbook (.xlsx)</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
