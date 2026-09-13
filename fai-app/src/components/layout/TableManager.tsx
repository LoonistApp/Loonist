import React, { useState, useCallback, useMemo } from 'react';
import type { EngineeringCharacteristic, InspectionMethod } from '../../types/characteristics';
import { MeasurementEngine } from '../../services/compliance/measurementEngine';
import { 
  ChevronUp, 
  Filter, 
  Layers, 
  FileSpreadsheet, 
  Trash2, 
  ListOrdered, 
  Maximize2, 
  Minimize2, 
  X,
  Move,
  AlertCircle
} from 'lucide-react';

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

interface TableManagerProps {
  characteristics: EngineeringCharacteristic[];
  selectedCharId: string | null;
  onSelectCharacteristic: (char: EngineeringCharacteristic) => void;
  onUpdateCharacteristic?: (char: EngineeringCharacteristic) => void;
  onExportExcel: () => void;
  onDeleteCharacteristic?: (id: string) => void;
  onRenumberAll?: () => void;
  onRepositionBalloons?: () => void;
  isOpen?: boolean;
  onToggleOpen?: (open: boolean) => void;
  panelHeight?: number;
  onHeightChange?: (height: number) => void;
  isMaximized?: boolean;
  onToggleMaximize?: () => void;
}

export const TableManager: React.FC<TableManagerProps> = ({
  characteristics,
  selectedCharId,
  onSelectCharacteristic,
  onUpdateCharacteristic,
  onExportExcel,
  onDeleteCharacteristic,
  onRenumberAll,
  onRepositionBalloons,
  isOpen = true,
  onToggleOpen,
  panelHeight = 220,
  onHeightChange,
  isMaximized = false,
  onToggleMaximize
}) => {
  const [activeTab, setActiveTab] = useState<'characteristics' | 'bom' | 'specifications'>('characteristics');
  const [filterType, setFilterType] = useState<'all' | 'critical' | 'review'>('all');
  const [editingCell, setEditingCell] = useState<{
    charId: string;
    field: 'rawText' | 'cleanNominal' | 'plusTol' | 'minusTol' | 'measuredValue';
  } | null>(null);
  const [editingValue, setEditingValue] = useState<string>('');

  const stats = useMemo(() => MeasurementEngine.calculateLotStatistics(characteristics), [characteristics]);

  const handleCellSave = useCallback((char: EngineeringCharacteristic) => {
    if (!editingCell || editingCell.charId !== char.id) return;
    const val = editingValue.trim();

    if (editingCell.field === 'rawText') {
      if (val) {
        onUpdateCharacteristic?.({ ...char, rawText: val });
      }
    } else if (editingCell.field === 'cleanNominal') {
      const num = parseFloat(val);
      if (!isNaN(num)) {
        const pTol = char.plusTol ?? 0;
        const mTol = char.minusTol ?? 0;
        const updatedChar = {
          ...char,
          cleanNominal: num,
          upperLimit: Number((num + pTol).toFixed(4)),
          lowerLimit: Number((num + mTol).toFixed(4)),
          maxLimit: Number((num + pTol).toFixed(4)),
          minLimit: Number((num + mTol).toFixed(4)),
        };
        const evalRes = MeasurementEngine.evaluateMeasurement(updatedChar, updatedChar.measuredValue ?? null);
        onUpdateCharacteristic?.({
          ...updatedChar,
          conformanceStatus: evalRes.status,
          deviation: evalRes.deviation
        });
      }
    } else if (editingCell.field === 'plusTol') {
      const num = parseFloat(val.replace(/^\+/, ''));
      if (!isNaN(num)) {
        const absTol = Math.abs(num);
        const nom = char.cleanNominal ?? 0;
        const updatedChar = {
          ...char,
          plusTol: absTol,
          upperTol: absTol,
          upperLimit: Number((nom + absTol).toFixed(4)),
          maxLimit: Number((nom + absTol).toFixed(4)),
        };
        const evalRes = MeasurementEngine.evaluateMeasurement(updatedChar, updatedChar.measuredValue ?? null);
        onUpdateCharacteristic?.({
          ...updatedChar,
          conformanceStatus: evalRes.status,
          deviation: evalRes.deviation
        });
      }
    } else if (editingCell.field === 'minusTol') {
      const num = parseFloat(val);
      if (!isNaN(num)) {
        const negTol = -Math.abs(num);
        const nom = char.cleanNominal ?? 0;
        const updatedChar = {
          ...char,
          minusTol: negTol,
          lowerTol: Math.abs(num),
          lowerLimit: Number((nom + negTol).toFixed(4)),
          minLimit: Number((nom + negTol).toFixed(4)),
        };
        const evalRes = MeasurementEngine.evaluateMeasurement(updatedChar, updatedChar.measuredValue ?? null);
        onUpdateCharacteristic?.({
          ...updatedChar,
          conformanceStatus: evalRes.status,
          deviation: evalRes.deviation
        });
      }
    } else if (editingCell.field === 'measuredValue') {
      const num = val === '' ? null : parseFloat(val);
      if (val === '' || !isNaN(num as number)) {
        const evalRes = MeasurementEngine.evaluateMeasurement(char, num);
        onUpdateCharacteristic?.({
          ...char,
          measuredValue: num,
          conformanceStatus: evalRes.status,
          deviation: evalRes.deviation,
          measuredAt: new Date().toISOString()
        });
      }
    }
    setEditingCell(null);
  }, [editingCell, editingValue, onUpdateCharacteristic]);

  const isCollapsed = !isOpen;

  const handleToggleCollapse = useCallback(() => {
    onToggleOpen?.(!isOpen);
  }, [isOpen, onToggleOpen]);

  const handleToggleMaximize = useCallback(() => {
    if (onToggleMaximize) {
      onToggleMaximize();
    } else {
      onToggleOpen?.(true);
      onHeightChange?.(isMaximized ? 220 : Math.round(window.innerHeight * 0.65));
    }
  }, [isMaximized, onToggleMaximize, onToggleOpen, onHeightChange]);

  const filteredCharacteristics = useMemo(() => {
    return characteristics.filter((c) => {
      if (filterType === 'critical') return c.classification === 'Critical';
      if (filterType === 'review') return c.verificationStatus === 'needs_review';
      return true;
    });
  }, [characteristics, filterType]);

  return (
    <footer
      className="w-full bg-slate-100 dark:bg-[#161616] flex flex-col select-none text-slate-800 dark:text-slate-200 text-xs shadow-md z-30 relative shrink-0"
      style={{ height: isCollapsed ? '28px' : `${panelHeight}px` }}
    >
      {/* Table Manager Header Bar with Tabs & Filter Controls */}
      <div className="h-7 bg-slate-200 dark:bg-[#1c1c1c] px-3 flex items-center justify-between border-b border-slate-300 dark:border-[#2d2d2d] shrink-0">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => {
              setActiveTab('characteristics');
              if (isCollapsed) {
                onToggleOpen?.(true);
                if (panelHeight < 60 && onHeightChange) onHeightChange(220);
              }
            }}
            className={`px-3 py-1 font-semibold text-[11px] rounded-t transition cursor-pointer ${
              activeTab === 'characteristics' && !isCollapsed
                ? 'bg-white dark:bg-[#181818] text-blue-700 dark:text-white font-bold border-t border-x border-slate-300 dark:border-[#2d2d2d] shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-300/80 dark:hover:bg-[#252525]'
            }`}
          >
            Characteristics ({characteristics.length})
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('specifications');
              if (isCollapsed) {
                onToggleOpen?.(true);
                if (panelHeight < 60 && onHeightChange) onHeightChange(220);
              }
            }}
            className={`px-3 py-1 font-semibold text-[11px] rounded-t transition cursor-pointer ${
              activeTab === 'specifications' && !isCollapsed
                ? 'bg-white dark:bg-[#181818] text-blue-700 dark:text-white font-bold border-t border-x border-slate-300 dark:border-[#2d2d2d] shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-300/80 dark:hover:bg-[#252525]'
            }`}
          >
            Specifications (6)
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('bom');
              if (isCollapsed) {
                onToggleOpen?.(true);
                if (panelHeight < 60 && onHeightChange) onHeightChange(220);
              }
            }}
            className={`px-3 py-1 font-semibold text-[11px] rounded-t transition cursor-pointer ${
              activeTab === 'bom' && !isCollapsed
                ? 'bg-white dark:bg-[#181818] text-blue-700 dark:text-white font-bold border-t border-x border-slate-300 dark:border-[#2d2d2d] shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-300/80 dark:hover:bg-[#252525]'
            }`}
          >
            Bill of Material
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/* Quick Filter Pill */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-[#1c1c1c] px-2 py-0.5 rounded border border-slate-300 dark:border-[#2d2d2d] text-[10px]">
            <Filter className="w-3 h-3 text-slate-500 dark:text-slate-400" />
            <span className="font-semibold text-slate-500 dark:text-slate-400">Filter:</span>
            <button
              type="button"
              onClick={() => setFilterType('all')}
              className={`px-1.5 py-0.5 rounded text-[10px] transition cursor-pointer ${
                filterType === 'all' 
                  ? 'bg-slate-800 dark:bg-[#333333] text-white font-bold' 
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setFilterType('critical')}
              className={`px-1 rounded transition cursor-pointer ${
                filterType === 'critical' 
                  ? 'bg-red-600 text-white font-bold' 
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Critical
            </button>
            <button
              type="button"
              onClick={() => setFilterType('review')}
              className={`px-1 rounded transition cursor-pointer ${
                filterType === 'review' 
                  ? 'bg-amber-500 text-white font-bold' 
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Review
            </button>
          </div>

          {/* Live Lot Inspection Conformance Telemetry */}
          <div className="flex items-center gap-1.5 bg-white dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-300 dark:border-slate-700 text-[10px] font-mono shadow-2xs">
            <span className="text-slate-500 dark:text-slate-400 font-sans font-semibold">Lot FAI:</span>
            <span className="font-bold text-slate-700 dark:text-slate-200">{stats.measuredCount}/{stats.total} Measured</span>
            <span className="text-slate-300 dark:text-slate-600">|</span>
            {stats.measuredCount === 0 ? (
              <span className="font-semibold text-slate-400 dark:text-slate-500">
                --% Pass (Pending)
              </span>
            ) : (
              <span className={`font-bold ${stats.failCount > 0 ? 'text-red-600' : stats.passCount > 0 ? 'text-emerald-600' : 'text-slate-500'}`}>
                {stats.conformanceRatePercent}% Pass
              </span>
            )}
            {stats.failCount > 0 && (
              <span className="flex items-center gap-0.5 px-1 rounded bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 font-bold text-[9px]">
                <AlertCircle className="w-2.5 h-2.5" />
                {stats.failCount} FAIL
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={onRenumberAll}
            disabled={characteristics.length === 0}
            className="flex items-center gap-1 px-2 py-0.5 rounded bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-[10px] transition disabled:opacity-40 cursor-pointer"
            title="Renumber all characteristics sequentially (AS9102 Rev B/C)"
          >
            <ListOrdered className="w-3 h-3 text-blue-600 dark:text-blue-400" />
            <span>Renumber All</span>
          </button>

          <button
            type="button"
            onClick={onRepositionBalloons}
            disabled={characteristics.length === 0}
            className="flex items-center gap-1 px-2 py-0.5 rounded bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-[10px] transition disabled:opacity-40 cursor-pointer"
            title="Auto-reposition all balloons to avoid collisions (Spatial R-Tree AABB)"
          >
            <Move className="w-3 h-3 text-purple-600 dark:text-purple-400" />
            <span>Reposition Balloons</span>
          </button>

          <button
            type="button"
            onClick={onExportExcel}
            className="flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] transition cursor-pointer"
            title="Export Characteristics to AS9102 Excel"
          >
            <FileSpreadsheet className="w-3 h-3" />
            <span>Export Table</span>
          </button>

          {/* Antigravity IDE Window Controls (Maximize & Close) */}
          <div className="flex items-center gap-0.5 pl-1.5 border-l border-slate-300 dark:border-slate-700 ml-1">
            <button
              type="button"
              onClick={handleToggleMaximize}
              className="p-1 rounded hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition cursor-pointer"
              title={isMaximized ? 'Restore Terminal Size' : 'Maximize Terminal Panel'}
            >
              {isMaximized ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>

            <button
              type="button"
              onClick={handleToggleCollapse}
              className="p-1 rounded hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 hover:text-red-600 transition cursor-pointer"
              title={isCollapsed ? 'Expand Terminal' : 'Close Terminal (View Full Drawing)'}
            >
              {isCollapsed ? <ChevronUp className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" /> : <X className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Table Body */}
      {!isCollapsed && (
        <div className="flex-1 min-h-0 w-full overflow-auto bg-white dark:bg-[#141414] border-t border-slate-200 dark:border-[#2a2a2a] relative">
          {activeTab === 'characteristics' && (
            <table className="min-w-full w-max border-separate border-spacing-0 text-left font-sans">
              <thead className="sticky top-0 z-20 bg-slate-100 shadow-2xs">
                <tr>
                  {/* Industry Standard Frozen Column: #ID (locked on left during horizontal scroll) */}
                  <th 
                    style={{ position: 'sticky', left: 0, zIndex: 30 }}
                    className="sticky top-0 left-0 z-30 sticky-left-0 bg-slate-100 dark:bg-[#202020] py-1.5 px-2 border-r border-b border-slate-300 dark:border-[#2d2d2d] w-10 min-w-[40px] max-w-[40px] text-center text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider"
                  >
                    #ID
                  </th>
                  {/* Industry Standard Frozen Column: #Cha (locked on left during horizontal scroll) */}
                  <th 
                    style={{ position: 'sticky', left: '40px', zIndex: 30 }}
                    className="sticky top-0 left-[40px] z-30 sticky-left-cha bg-slate-100 dark:bg-[#202020] py-1.5 px-2 border-r-2 border-b border-slate-300 dark:border-[#2d2d2d] w-12 min-w-[48px] max-w-[48px] text-center text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider shadow-[2px_0_4px_-1px_rgba(0,0,0,0.08)]"
                  >
                    #Cha
                  </th>
                  <th className="sticky top-0 z-20 bg-slate-100 py-1.5 px-2 border-r border-b border-slate-300 w-28 text-[10px] font-bold text-slate-600 uppercase tracking-wider">Type</th>
                  <th className="sticky top-0 z-20 bg-slate-100 py-1.5 px-2 border-r border-b border-slate-300 w-32 text-[10px] font-bold text-slate-600 uppercase tracking-wider">SubType</th>
                  <th className="sticky top-0 z-20 bg-slate-100 py-1.5 px-2 border-r border-b border-slate-300 min-w-[180px] text-[10px] font-bold text-slate-600 uppercase tracking-wider">Value / Requirement</th>
                  <th className="sticky top-0 z-20 bg-slate-100 py-1.5 px-2 border-r border-b border-slate-300 w-16 text-right text-[10px] font-bold text-slate-600 uppercase tracking-wider">Nominal</th>
                  <th className="sticky top-0 z-20 bg-slate-100 py-1.5 px-2 border-r border-b border-slate-300 w-10 text-center text-[10px] font-bold text-slate-600 uppercase tracking-wider">Unit</th>
                  <th className="sticky top-0 z-20 bg-slate-100 py-1.5 px-2 border-r border-b border-slate-300 w-14 text-right text-[10px] font-bold text-slate-600 uppercase tracking-wider">+Tol</th>
                  <th className="sticky top-0 z-20 bg-slate-100 py-1.5 px-2 border-r border-b border-slate-300 w-14 text-right text-[10px] font-bold text-slate-600 uppercase tracking-wider">-Tol</th>
                  <th className="sticky top-0 z-20 bg-slate-100 py-1.5 px-2 border-r border-b border-slate-300 w-16 text-right text-[10px] font-bold text-slate-600 uppercase tracking-wider">Upper Limit</th>
                  <th className="sticky top-0 z-20 bg-slate-100 py-1.5 px-2 border-r border-b border-slate-300 w-16 text-right text-[10px] font-bold text-slate-600 uppercase tracking-wider">Lower Limit</th>
                  <th className="sticky top-0 z-20 bg-blue-50/70 py-1.5 px-2 border-r border-b border-slate-300 w-18 text-right text-[10px] font-bold text-slate-600 uppercase tracking-wider">Measured</th>
                  <th className="sticky top-0 z-20 bg-slate-100 py-1.5 px-2 border-r border-b border-slate-300 w-16 text-right text-[10px] font-bold text-slate-600 uppercase tracking-wider">Deviation</th>
                  <th className="sticky top-0 z-20 bg-slate-100 py-1.5 px-2 border-r border-b border-slate-300 w-20 text-center text-[10px] font-bold text-slate-600 uppercase tracking-wider">Status</th>
                  <th className="sticky top-0 z-20 bg-slate-100 py-1.5 px-2 border-r border-b border-slate-300 w-24 text-[10px] font-bold text-slate-600 uppercase tracking-wider">Sheet / View</th>
                  <th className="sticky top-0 z-20 bg-slate-100 py-1.5 px-2 border-r border-b border-slate-300 w-28 text-[10px] font-bold text-slate-600 uppercase tracking-wider">Method</th>
                  <th className="sticky top-0 z-20 bg-slate-100 py-1.5 px-2 border-r border-b border-slate-300 w-20 text-center text-[10px] font-bold text-slate-600 uppercase tracking-wider">Class</th>
                  <th className="sticky top-0 z-20 bg-slate-100 py-1.5 px-2 border-b border-slate-300 w-12 text-center text-[10px] font-bold text-slate-600 uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#252525] font-mono text-[11px]">
                {filteredCharacteristics.map((char) => {
                  const isSelected = selectedCharId === char.id;
                  const isNeedsReview = char.verificationStatus === 'needs_review';

                  const stickyBg = isSelected
                    ? 'bg-blue-600 dark:bg-[#282d35] text-white'
                    : isNeedsReview
                    ? 'bg-amber-50 dark:bg-amber-950/40 text-slate-800 dark:text-slate-200'
                    : 'bg-white dark:bg-[#181818] text-slate-700 dark:text-slate-300';

                  return (
                    <tr
                      key={char.id}
                      onClick={() => onSelectCharacteristic(char)}
                      className={`cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-blue-600 dark:bg-[#282d35] text-white font-semibold'
                          : isNeedsReview
                          ? 'bg-amber-50/70 hover:bg-amber-100/80 dark:bg-amber-950/30 dark:hover:bg-amber-900/40 text-slate-800 dark:text-slate-200'
                          : 'bg-white hover:bg-slate-50 dark:bg-[#181818] dark:hover:bg-[#222222] text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {/* Frozen Column 1: #ID */}
                      <td 
                        style={{ position: 'sticky', left: 0, zIndex: 10 }}
                        className={`py-1 px-2 border-r border-slate-200/50 dark:border-[#262626] text-center font-bold sticky-left-0 ${stickyBg}`}
                      >
                        {char.itemNumber}
                      </td>

                      {/* Frozen Column 2: #Cha */}
                      <td 
                        style={{ position: 'sticky', left: '40px', zIndex: 10 }}
                        className={`py-1 px-2 border-r-2 border-slate-300 dark:border-[#2d2d2d] text-center font-bold shadow-[2px_0_4px_-1px_rgba(0,0,0,0.08)] sticky-left-cha ${stickyBg}`}
                      >
                        {char.subNumber || char.itemNumber}
                      </td>

                      <td className="py-1 px-2 border-r border-slate-200/50 dark:border-[#262626] font-sans truncate">
                        {char.displayType}
                      </td>

                      <td className="py-1 px-2 border-r border-slate-200/50 dark:border-[#262626] font-sans truncate">
                        {char.subType}
                      </td>

                      <td 
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          setEditingCell({ charId: char.id, field: 'rawText' });
                          setEditingValue(char.rawText);
                        }}
                        className="py-1 px-2 border-r border-slate-200/50 dark:border-[#262626] font-mono truncate font-medium cursor-text"
                        title="Double-click to edit requirement"
                      >
                        {editingCell?.charId === char.id && editingCell.field === 'rawText' ? (
                          <input
                            type="text"
                            value={editingValue}
                            autoFocus
                            onFocus={(e) => e.target.select()}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => setEditingValue(e.target.value)}
                            onBlur={() => handleCellSave(char)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleCellSave(char);
                              else if (e.key === 'Escape') setEditingCell(null);
                            }}
                            className="w-full bg-white dark:bg-[#1a1a1a] text-slate-900 dark:text-[#f0f0f0] border-2 border-blue-500 rounded px-1 py-0.5 text-[11px] font-mono outline-hidden"
                          />
                        ) : (
                          <span className="hover:underline">
                            {char.rawText}
                          </span>
                        )}
                      </td>

                      <td 
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          setEditingCell({ charId: char.id, field: 'cleanNominal' });
                          setEditingValue(char.cleanNominal !== null ? String(char.cleanNominal) : '');
                        }}
                        className="py-1 px-2 border-r border-slate-200/50 dark:border-[#262626] text-right font-bold cursor-text"
                        title="Double-click to edit nominal value"
                      >
                        {editingCell?.charId === char.id && editingCell.field === 'cleanNominal' ? (
                          <input
                            type="text"
                            inputMode="decimal"
                            value={editingValue}
                            autoFocus
                            onFocus={(e) => e.target.select()}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => setEditingValue(e.target.value)}
                            onBlur={() => handleCellSave(char)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleCellSave(char);
                              else if (e.key === 'Escape') setEditingCell(null);
                            }}
                            className="w-16 bg-white dark:bg-[#1a1a1a] text-slate-900 dark:text-[#f0f0f0] border-2 border-blue-500 rounded px-1 py-0.5 text-[11px] font-mono outline-hidden text-right"
                          />
                        ) : (
                          <span className="hover:underline">
                            {char.cleanNominal !== null ? char.cleanNominal : '--'}
                          </span>
                        )}
                      </td>

                      <td className="py-1 px-2 border-r border-slate-200/50 dark:border-[#262626] text-center">
                        {char.units}
                      </td>

                      <td 
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          if (!char.forReference) {
                            setEditingCell({ charId: char.id, field: 'plusTol' });
                            setEditingValue(char.plusTol !== null ? String(char.plusTol) : '0');
                          }
                        }}
                        className={`py-1 px-2 border-r border-slate-200/50 dark:border-[#262626] text-right ${char.forReference ? '' : 'cursor-text'}`}
                        title={char.forReference ? 'Reference dimension (no tolerance)' : 'Double-click to edit +Tol'}
                      >
                        {editingCell?.charId === char.id && editingCell.field === 'plusTol' ? (
                          <input
                            type="text"
                            inputMode="decimal"
                            value={editingValue}
                            autoFocus
                            onFocus={(e) => e.target.select()}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => setEditingValue(e.target.value)}
                            onBlur={() => handleCellSave(char)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleCellSave(char);
                              else if (e.key === 'Escape') setEditingCell(null);
                            }}
                            className="w-16 bg-white dark:bg-[#1a1a1a] text-slate-900 dark:text-[#f0f0f0] border-2 border-blue-500 rounded px-1 py-0.5 text-[11px] font-mono outline-hidden text-right"
                          />
                        ) : (
                          <span className={char.forReference ? '' : 'hover:underline'}>
                            {char.forReference || char.plusTol === null
                              ? '--'
                              : char.plusTol > 0
                              ? `+${char.plusTol.toFixed(4).replace(/\.?0+$/, '') || '0'}`
                              : char.plusTol.toFixed(4).replace(/\.?0+$/, '') || '0'}
                          </span>
                        )}
                      </td>

                      <td 
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          if (!char.forReference) {
                            setEditingCell({ charId: char.id, field: 'minusTol' });
                            setEditingValue(char.minusTol !== null ? String(char.minusTol) : '0');
                          }
                        }}
                        className={`py-1 px-2 border-r border-slate-200/50 dark:border-[#262626] text-right ${char.forReference ? '' : 'cursor-text'}`}
                        title={char.forReference ? 'Reference dimension (no tolerance)' : 'Double-click to edit -Tol'}
                      >
                        {editingCell?.charId === char.id && editingCell.field === 'minusTol' ? (
                          <input
                            type="text"
                            inputMode="decimal"
                            value={editingValue}
                            autoFocus
                            onFocus={(e) => e.target.select()}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => setEditingValue(e.target.value)}
                            onBlur={() => handleCellSave(char)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleCellSave(char);
                              else if (e.key === 'Escape') setEditingCell(null);
                            }}
                            className="w-16 bg-white dark:bg-[#1a1a1a] text-slate-900 dark:text-[#f0f0f0] border-2 border-blue-500 rounded px-1 py-0.5 text-[11px] font-mono outline-hidden text-right"
                          />
                        ) : (
                          <span className={char.forReference ? '' : 'hover:underline'}>
                            {char.forReference || char.minusTol === null
                              ? '--'
                              : char.minusTol === 0
                              ? '0'
                              : char.minusTol.toFixed(4).replace(/\.?0+$/, '')}
                          </span>
                        )}
                      </td>

                      <td className="py-1 px-2 border-r border-slate-200/50 dark:border-[#262626] text-right font-bold">
                        {char.forReference || char.upperLimit === null ? '--' : char.upperLimit.toFixed(4)}
                      </td>

                      <td className="py-1 px-2 border-r border-slate-200/50 dark:border-[#262626] text-right font-bold">
                        {char.forReference || char.lowerLimit === null ? '--' : char.lowerLimit.toFixed(4)}
                      </td>

                      {/* Measured Actual Column - Instant Click or Double-Click to Edit */}
                      <td 
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectCharacteristic(char);
                          setEditingCell({ charId: char.id, field: 'measuredValue' });
                          setEditingValue(char.measuredValue !== null && char.measuredValue !== undefined ? String(char.measuredValue) : '');
                        }}
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          onSelectCharacteristic(char);
                          setEditingCell({ charId: char.id, field: 'measuredValue' });
                          setEditingValue(char.measuredValue !== null && char.measuredValue !== undefined ? String(char.measuredValue) : '');
                        }}
                        className={`py-1 px-2 border-r border-slate-200/50 dark:border-[#262626] text-right font-bold cursor-pointer transition-colors ${
                          editingCell?.charId === char.id && editingCell.field === 'measuredValue'
                            ? 'bg-blue-500/20 ring-1 ring-blue-500'
                            : 'hover:bg-blue-500/15'
                        }`}
                        title="Click to enter physical measurement"
                      >
                        {editingCell?.charId === char.id && editingCell.field === 'measuredValue' ? (
                          <input
                            type="text"
                            inputMode="decimal"
                            value={editingValue}
                            autoFocus
                            onFocus={(e) => e.target.select()}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => setEditingValue(e.target.value)}
                            onBlur={() => handleCellSave(char)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleCellSave(char);
                              else if (e.key === 'Escape') setEditingCell(null);
                            }}
                            placeholder="0.0000"
                            className="w-20 bg-white dark:bg-[#121212] text-slate-900 dark:text-[#f0f0f0] border-2 border-blue-500 rounded px-1.5 py-0.5 text-[11px] font-mono font-bold text-right outline-hidden shadow-xs"
                          />
                        ) : (
                          <div className="flex items-center justify-end gap-1 group/measured">
                            <span className="font-mono">
                              {char.measuredValue !== null && char.measuredValue !== undefined ? char.measuredValue.toFixed(4) : '--'}
                            </span>
                            <span className="opacity-40 group-hover/measured:opacity-100 text-[10px] text-blue-500 dark:text-blue-400 font-sans transition-opacity">
                              ✎
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Deviation Column */}
                      <td className="py-1 px-2 border-r border-slate-200/50 dark:border-[#262626] text-right font-mono text-[10px]">
                        {char.deviation !== null && char.deviation !== undefined ? (
                          <span className={char.deviation > 0 ? 'text-amber-700 dark:text-amber-400 font-semibold' : char.deviation < 0 ? 'text-blue-700 dark:text-blue-400 font-semibold' : 'text-slate-600 dark:text-slate-400'}>
                            {char.deviation > 0 ? `+${char.deviation.toFixed(4)}` : char.deviation.toFixed(4)}
                          </span>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-600">--</span>
                        )}
                      </td>

                      {/* Status Column */}
                      <td className="py-1 px-2 border-r border-slate-200/50 dark:border-[#262626] text-center">
                        {char.conformanceStatus === 'PASS' ? (
                          <span className="px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-bold text-[9px] border border-emerald-300 dark:border-emerald-800">
                            PASS
                          </span>
                        ) : char.conformanceStatus === 'MARGINAL' ? (
                          <span className="px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 font-bold text-[9px] border border-amber-300 dark:border-amber-800" title="Measurement within 10% of tolerance boundary">
                            MARGINAL
                          </span>
                        ) : char.conformanceStatus === 'FAIL' ? (
                          <span className="px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-950/60 text-red-800 dark:text-red-300 font-bold text-[9px] border border-red-300 dark:border-red-800 animate-pulse" title="Out of tolerance specification">
                            FAIL
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-[#202020] text-slate-400 dark:text-slate-500 font-medium text-[9px]">
                            PENDING
                          </span>
                        )}
                      </td>

                      <td className="py-1 px-2 border-r border-slate-200/50 dark:border-[#262626] font-sans truncate text-[10px]">
                        {char.sourceCaptureOrSheet || `Sheet ${char.sheetNumber}`}
                      </td>

                      <td className="py-0.5 px-2 border-r border-slate-200/50 dark:border-[#262626] font-sans truncate text-[10px]">
                        <select
                          value={char.inspectionMethod}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => {
                            e.stopPropagation();
                            onUpdateCharacteristic?.({
                              ...char,
                              inspectionMethod: e.target.value as InspectionMethod
                            });
                          }}
                          className={`bg-transparent border-0 text-[10px] font-sans cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 rounded px-1 py-0.5 outline-hidden ${
                            isSelected ? 'text-white' : 'text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          {INSPECTION_METHODS.map((m) => (
                            <option key={m} value={m} className="text-slate-900 bg-white dark:bg-[#1a1a1a] dark:text-slate-100">
                              {m}
                            </option>
                          ))}
                        </select>
                      </td>

                      <td className="py-0.5 px-2 border-r border-slate-200/50 dark:border-[#262626] text-center">
                        <select
                          value={char.classification}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => {
                            e.stopPropagation();
                            onUpdateCharacteristic?.({
                              ...char,
                              classification: e.target.value as 'Critical' | 'Major' | 'Minor'
                            });
                          }}
                          className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase font-sans border-0 cursor-pointer outline-hidden ${
                            char.classification === 'Critical'
                              ? isSelected ? 'bg-red-900 text-white' : 'bg-red-100 dark:bg-red-950/60 text-red-800 dark:text-red-300'
                              : char.classification === 'Major'
                              ? isSelected ? 'bg-amber-900 text-white' : 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'
                              : isSelected ? 'bg-[#282d35] text-white' : 'bg-slate-100 dark:bg-[#222222] text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          <option value="Minor" className="text-slate-900 bg-white dark:bg-[#1a1a1a] dark:text-slate-100">Minor</option>
                          <option value="Major" className="text-slate-900 bg-white dark:bg-[#1a1a1a] dark:text-slate-100">Major</option>
                          <option value="Critical" className="text-slate-900 bg-white dark:bg-[#1a1a1a] dark:text-slate-100">Critical</option>
                        </select>
                      </td>

                      <td className="py-1 px-2 text-center">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteCharacteristic?.(char.id);
                          }}
                          className={`p-1 rounded transition cursor-pointer ${
                            isSelected 
                              ? 'text-white/80 hover:text-white hover:bg-red-500/80' 
                              : 'text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40'
                          }`}
                          title={`Delete Balloon #${char.subNumber || char.itemNumber} (Cascade Renumber)`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {activeTab === 'specifications' && (
            <div className="p-3 text-slate-600 dark:text-slate-300">
              <h4 className="font-bold text-slate-800 dark:text-slate-100 text-xs mb-2">General Engineering Specifications (AS9102 Form 2)</h4>
              <ul className="space-y-1 font-mono text-[11px]">
                <li className="p-1.5 bg-slate-50 dark:bg-[#1e1e1e] border border-slate-200 dark:border-[#2d2d2d] rounded">1. INTERPRET DRAWING PER ASME Y14.5-2018 STANDARDS.</li>
                <li className="p-1.5 bg-slate-50 dark:bg-[#1e1e1e] border border-slate-200 dark:border-[#2d2d2d] rounded font-semibold text-blue-800 dark:text-blue-400">2. MATERIAL: TI-6AL-4V GRADE 5 TITANIUM PER AMS 4928.</li>
                <li className="p-1.5 bg-slate-50 dark:bg-[#1e1e1e] border border-slate-200 dark:border-[#2d2d2d] rounded">3. REMOVE ALL BURRS AND BREAK SHARP EDGES 0.015 MAX.</li>
                <li className="p-1.5 bg-slate-50 dark:bg-[#1e1e1e] border border-slate-200 dark:border-[#2d2d2d] rounded">4. SURFACE FINISH: 32 Ra MAX ALL MACHINED SURFACES.</li>
                <li className="p-1.5 bg-slate-50 dark:bg-[#1e1e1e] border border-slate-200 dark:border-[#2d2d2d] rounded font-semibold text-emerald-800 dark:text-emerald-400">5. 100% FIRST ARTICLE INSPECTION PER SAE AS9102 REV C REQUIRED.</li>
                <li className="p-1.5 bg-slate-50 dark:bg-[#1e1e1e] border border-slate-200 dark:border-[#2d2d2d] rounded font-semibold text-red-800 dark:text-red-400">6. ITAR CONTROLLED: EXPORT CONTROLLED DEFENSE DATA.</li>
              </ul>
            </div>
          )}

          {activeTab === 'bom' && (
            <div className="p-4 text-center text-slate-400 dark:text-slate-500">
              <Layers className="w-8 h-8 mx-auto mb-1 text-slate-300 dark:text-slate-600" />
              <p className="text-xs">No assembly components in this single monolithic part blueprint.</p>
            </div>
          )}
        </div>
      )}
    </footer>
  );
};
