import React, { useState, useCallback, useMemo } from 'react';
import type { EngineeringCharacteristic, InspectionMethod } from '../../types/characteristics';
import { MeasurementEngine } from '../../services/compliance/measurementEngine';
import { useApplicationOptions } from '../../stores/useApplicationOptionsStore';
import { 
  ChevronUp, 
  Filter, 
  Layers, 
  Trash2, 
  Maximize2, 
  Minimize2, 
  X,
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
  filterType?: 'all' | 'critical' | 'review';
  onFilterChange?: (filter: 'all' | 'critical' | 'review') => void;
  activeSheetNumber?: number;
  totalSheets?: number;
}

export const TableManager: React.FC<TableManagerProps> = ({
  characteristics,
  selectedCharId,
  onSelectCharacteristic,
  onUpdateCharacteristic,
  onExportExcel: _onExportExcel,
  onDeleteCharacteristic,
  onRenumberAll: _onRenumberAll,
  onRepositionBalloons: _onRepositionBalloons,
  isOpen = true,
  onToggleOpen,
  panelHeight = 220,
  onHeightChange,
  isMaximized = false,
  onToggleMaximize,
  filterType: externalFilterType,
  onFilterChange,
  activeSheetNumber: _activeSheetNumber = 1,
  totalSheets: _totalSheets = 1
}) => {
  const [activeTab, setActiveTab] = useState<'characteristics' | 'bom' | 'specifications'>('characteristics');
  const [internalFilterType, setInternalFilterType] = useState<'all' | 'critical' | 'review'>('all');
  const activeFilter = externalFilterType !== undefined ? externalFilterType : internalFilterType;
  const setFilterType = useCallback((f: 'all' | 'critical' | 'review') => {
    setInternalFilterType(f);
    onFilterChange?.(f);
  }, [onFilterChange]);
  const [editingCell, setEditingCell] = useState<{
    charId: string;
    field: 'rawText' | 'cleanNominal' | 'plusTol' | 'minusTol' | 'measuredValue';
  } | null>(null);
  const [editingValue, setEditingValue] = useState<string>('');
  const stats = useMemo(() => MeasurementEngine.calculateLotStatistics(characteristics), [characteristics]);

  const [appOptions] = useApplicationOptions();
  const columnConfigs = appOptions?.workspace?.tableColumns;

  const isColVisible = useCallback((colId: string) => {
    if (!columnConfigs || columnConfigs.length === 0) return true;
    const col = columnConfigs.find(c => c.id === colId);
    return col ? col.visible !== false : true;
  }, [columnConfigs]);

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
      if (activeFilter === 'critical') return c.classification === 'Critical' || c.subType === 'GDT' || c.isCritical;
      if (activeFilter === 'review') return c.verificationStatus === 'needs_review';
      return true;
    });
  }, [characteristics, activeFilter]);

  return (
    <footer
      className="w-full bg-slate-100 flex flex-col select-none text-slate-800 text-xs shadow-md z-30 relative shrink-0"
      style={{ height: isCollapsed ? '28px' : `${panelHeight}px` }}
    >
      {/* Table Manager Header Bar with Tabs & Filter Controls */}
      <div className="h-7 bg-slate-200 px-3 flex items-center justify-between border-b border-slate-300 shrink-0 overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-1 shrink-0 whitespace-nowrap">
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
                ? 'bg-white text-blue-700 font-bold border-t border-x border-slate-300 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-300/80'
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
                ? 'bg-white text-blue-700 font-bold border-t border-x border-slate-300 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-300/80'
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
                ? 'bg-white text-blue-700 font-bold border-t border-x border-slate-300 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-300/80'
            }`}
          >
            Bill of Material
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/* Quick Filter Pill */}
          <div className="flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded border border-slate-300 text-[10px]">
            <Filter className="w-3 h-3 text-slate-500" />
            <span className="font-semibold text-slate-500">Filter:</span>
            <button
              type="button"
              onClick={() => setFilterType('all')}
              className={`px-1.5 py-0.5 rounded text-[10px] transition cursor-pointer ${
                activeFilter === 'all' 
                  ? 'bg-slate-800 text-white font-bold' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setFilterType('critical')}
              className={`px-1 rounded transition cursor-pointer ${
                activeFilter === 'critical' 
                  ? 'bg-red-600 text-white font-bold' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Critical
            </button>
            <button
              type="button"
              onClick={() => setFilterType('review')}
              className={`px-1 rounded transition cursor-pointer ${
                activeFilter === 'review' 
                  ? 'bg-amber-500 text-white font-bold' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Review
            </button>
          </div>

          {/* Live Lot Inspection Conformance Telemetry */}
          <div className="flex items-center gap-1.5 bg-white px-2 py-0.5 rounded border border-slate-300 text-[10px] font-mono shadow-2xs">
            <span className="text-slate-500 font-sans font-semibold">Lot FAI:</span>
            <span className="font-bold text-slate-700">{stats.measuredCount}/{stats.total} Measured</span>
            <span className="text-slate-300">|</span>
            {stats.measuredCount === 0 ? (
              <span className="font-semibold text-slate-400">
                --% Pass (Pending)
              </span>
            ) : (
              <span className={`font-bold ${stats.failCount > 0 ? 'text-red-600' : stats.passCount > 0 ? 'text-emerald-600' : 'text-slate-500'}`}>
                {stats.conformanceRatePercent}% Pass
              </span>
            )}
            {stats.failCount > 0 && (
              <span className="flex items-center gap-0.5 px-1 rounded bg-red-100 text-red-700 font-bold text-[9px]">
                <AlertCircle className="w-2.5 h-2.5" />
                {stats.failCount} FAIL
              </span>
            )}
          </div>

          {/* Antigravity IDE Window Controls (Maximize & Close) */}
          <div className="flex items-center gap-0.5 pl-1.5 border-l border-slate-300 ml-1">
            <button
              type="button"
              onClick={handleToggleMaximize}
              className="p-1 rounded hover:bg-slate-300 text-slate-600 hover:text-slate-900 transition cursor-pointer"
              title={isMaximized ? 'Restore Terminal Size' : 'Maximize Terminal Panel'}
            >
              {isMaximized ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>

            <button
              type="button"
              onClick={handleToggleCollapse}
              className="p-1 rounded hover:bg-slate-300 text-slate-600 hover:text-red-600 transition cursor-pointer"
              title={isCollapsed ? 'Expand Terminal' : 'Close Terminal (View Full Drawing)'}
            >
              {isCollapsed ? <ChevronUp className="w-3.5 h-3.5 text-blue-600" /> : <X className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Table Body */}
      {!isCollapsed && (
        <div className="flex-1 min-h-0 w-full overflow-auto bg-white border-t border-slate-200 relative">
          {activeTab === 'characteristics' && filteredCharacteristics.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-1 h-full py-10 text-center px-4">
              <span className="text-xs font-semibold text-slate-500">
                {characteristics.length === 0 ? 'No characteristics yet' : 'No characteristics match this filter'}
              </span>
              <span className="text-[11px] text-slate-400">
                {characteristics.length === 0
                  ? 'Run Auto Extract from the HOME tab to detect dimensions automatically.'
                  : 'Try a different filter above.'}
              </span>
            </div>
          )}

          {activeTab === 'characteristics' && filteredCharacteristics.length > 0 && (
            <table className="min-w-full w-max border-separate border-spacing-0 text-left font-sans">
              <thead className="sticky top-0 z-20 bg-slate-100 shadow-2xs">
                <tr>
                  {/* Industry Standard Frozen Column: #ID (locked on left during horizontal scroll) */}
                  <th 
                    style={{ position: 'sticky', left: 0, zIndex: 30 }}
                    className="sticky top-0 left-0 z-30 sticky-left-0 bg-slate-100 py-1.5 px-2 border-r border-b border-slate-300 w-10 min-w-[40px] max-w-[40px] text-center text-[10px] font-bold text-slate-600 uppercase tracking-wider"
                  >
                    #ID
                  </th>
                  {/* Industry Standard Frozen Column: #Cha (locked on left during horizontal scroll) */}
                  <th 
                    style={{ position: 'sticky', left: '40px', zIndex: 30 }}
                    className="sticky top-0 left-[40px] z-30 sticky-left-cha bg-slate-100 py-1.5 px-2 border-r-2 border-b border-slate-300 w-12 min-w-[48px] max-w-[48px] text-center text-[10px] font-bold text-slate-600 uppercase tracking-wider shadow-[2px_0_4px_-1px_rgba(0,0,0,0.08)]"
                  >
                    #Cha
                  </th>
                  {isColVisible('type') && <th className="sticky top-0 z-20 bg-slate-100 py-1.5 px-2 border-r border-b border-slate-300 w-28 text-[10px] font-bold text-slate-600 uppercase tracking-wider">Type</th>}
                  {isColVisible('type') && <th className="sticky top-0 z-20 bg-slate-100 py-1.5 px-2 border-r border-b border-slate-300 w-32 text-[10px] font-bold text-slate-600 uppercase tracking-wider">SubType</th>}
                  {isColVisible('rawText') && <th className="sticky top-0 z-20 bg-slate-100 py-1.5 px-2 border-r border-b border-slate-300 min-w-[180px] text-[10px] font-bold text-slate-600 uppercase tracking-wider">Value / Requirement</th>}
                  {isColVisible('cleanNominal') && <th className="sticky top-0 z-20 bg-slate-100 py-1.5 px-2 border-r border-b border-slate-300 w-16 text-right text-[10px] font-bold text-slate-600 uppercase tracking-wider">Nominal</th>}
                  {isColVisible('cleanNominal') && <th className="sticky top-0 z-20 bg-slate-100 py-1.5 px-2 border-r border-b border-slate-300 w-10 text-center text-[10px] font-bold text-slate-600 uppercase tracking-wider">Unit</th>}
                  {isColVisible('plusTol') && <th className="sticky top-0 z-20 bg-slate-100 py-1.5 px-2 border-r border-b border-slate-300 w-14 text-right text-[10px] font-bold text-slate-600 uppercase tracking-wider">+Tol</th>}
                  {isColVisible('minusTol') && <th className="sticky top-0 z-20 bg-slate-100 py-1.5 px-2 border-r border-b border-slate-300 w-14 text-right text-[10px] font-bold text-slate-600 uppercase tracking-wider">-Tol</th>}
                  {isColVisible('upperLimit') && <th className="sticky top-0 z-20 bg-slate-100 py-1.5 px-2 border-r border-b border-slate-300 w-16 text-right text-[10px] font-bold text-slate-600 uppercase tracking-wider">Upper Limit</th>}
                  {isColVisible('lowerLimit') && <th className="sticky top-0 z-20 bg-slate-100 py-1.5 px-2 border-r border-b border-slate-300 w-16 text-right text-[10px] font-bold text-slate-600 uppercase tracking-wider">Lower Limit</th>}
                  {isColVisible('measuredValue') && <th className="sticky top-0 z-20 bg-blue-50/70 py-1.5 px-2 border-r border-b border-slate-300 w-18 text-right text-[10px] font-bold text-slate-600 uppercase tracking-wider">Measured</th>}
                  {isColVisible('deviation') && <th className="sticky top-0 z-20 bg-slate-100 py-1.5 px-2 border-r border-b border-slate-300 w-16 text-right text-[10px] font-bold text-slate-600 uppercase tracking-wider">Deviation</th>}
                  {isColVisible('status') && <th className="sticky top-0 z-20 bg-slate-100 py-1.5 px-2 border-r border-b border-slate-300 w-20 text-center text-[10px] font-bold text-slate-600 uppercase tracking-wider">Status</th>}
                  {isColVisible('source') && <th className="sticky top-0 z-20 bg-slate-100 py-1.5 px-2 border-r border-b border-slate-300 w-24 text-[10px] font-bold text-slate-600 uppercase tracking-wider">Sheet / View</th>}
                  {isColVisible('method') && <th className="sticky top-0 z-20 bg-slate-100 py-1.5 px-2 border-r border-b border-slate-300 w-28 text-[10px] font-bold text-slate-600 uppercase tracking-wider">Method</th>}
                  {isColVisible('classification') && <th className="sticky top-0 z-20 bg-slate-100 py-1.5 px-2 border-r border-b border-slate-300 w-20 text-center text-[10px] font-bold text-slate-600 uppercase tracking-wider">Class</th>}
                  <th className="sticky top-0 z-20 bg-slate-100 py-1.5 px-2 border-b border-slate-300 w-12 text-center text-[10px] font-bold text-slate-600 uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                {filteredCharacteristics.map((char) => {
                  const isSelected = selectedCharId === char.id;
                  const isNeedsReview = char.verificationStatus === 'needs_review';

                  const stickyBg = isSelected
                    ? 'bg-blue-600 text-white'
                    : isNeedsReview
                    ? 'bg-amber-50 text-slate-800'
                    : 'bg-white text-slate-700';

                  return (
                    <tr
                      key={char.id}
                      onClick={() => onSelectCharacteristic(char)}
                      className={`cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-blue-600 text-white font-semibold'
                          : isNeedsReview
                          ? 'bg-amber-50/70 hover:bg-amber-100/80 text-slate-800'
                          : 'bg-white hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      {/* Frozen Column 1: #ID */}
                      <td 
                        style={{ position: 'sticky', left: 0, zIndex: 10 }}
                        className={`py-1 px-2 border-r border-slate-200/50 text-center font-bold sticky-left-0 ${stickyBg}`}
                      >
                        {char.itemNumber}
                      </td>

                      {/* Frozen Column 2: #Cha */}
                      <td 
                        style={{ position: 'sticky', left: '40px', zIndex: 10 }}
                        className={`py-1 px-2 border-r-2 border-slate-300 text-center font-bold shadow-[2px_0_4px_-1px_rgba(0,0,0,0.08)] sticky-left-cha ${stickyBg}`}
                      >
                        {char.subNumber || char.itemNumber}
                      </td>

                      {isColVisible('type') && (
                        <td className="py-1 px-2 border-r border-slate-200/50 font-sans truncate">
                          {char.displayType}
                        </td>
                      )}

                      {isColVisible('type') && (
                        <td className="py-1 px-2 border-r border-slate-200/50 font-sans truncate">
                          {char.subType}
                        </td>
                      )}

                      {isColVisible('rawText') && (
                        <td 
                          onDoubleClick={(e) => {
                            e.stopPropagation();
                            setEditingCell({ charId: char.id, field: 'rawText' });
                            setEditingValue(char.rawText);
                          }}
                          className="py-1 px-2 border-r border-slate-200/50 font-mono truncate font-medium cursor-text"
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
                              className="w-full bg-white text-slate-900 border-2 border-blue-500 rounded px-1 py-0.5 text-[11px] font-mono outline-hidden"
                            />
                          ) : (
                            <span className="hover:underline">
                              {char.rawText}
                            </span>
                          )}
                        </td>
                      )}

                      {isColVisible('cleanNominal') && (
                        <td 
                          onDoubleClick={(e) => {
                            e.stopPropagation();
                            setEditingCell({ charId: char.id, field: 'cleanNominal' });
                            setEditingValue(char.cleanNominal !== null ? String(char.cleanNominal) : '');
                          }}
                          className="py-1 px-2 border-r border-slate-200/50 text-right font-bold cursor-text"
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
                              className="w-16 bg-white text-slate-900 border-2 border-blue-500 rounded px-1 py-0.5 text-[11px] font-mono outline-hidden text-right"
                            />
                          ) : (
                            <span className="hover:underline">
                              {char.cleanNominal !== null ? char.cleanNominal : '--'}
                            </span>
                          )}
                        </td>
                      )}

                      {isColVisible('cleanNominal') && (
                        <td className="py-1 px-2 border-r border-slate-200/50 text-center">
                          {char.units}
                        </td>
                      )}

                      {isColVisible('plusTol') && (
                        <td 
                          onDoubleClick={(e) => {
                            e.stopPropagation();
                            if (!char.forReference) {
                              setEditingCell({ charId: char.id, field: 'plusTol' });
                              setEditingValue(char.plusTol !== null ? String(char.plusTol) : '0');
                            }
                          }}
                          className={`py-1 px-2 border-r border-slate-200/50 text-right ${char.forReference ? '' : 'cursor-text'}`}
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
                              className="w-16 bg-white text-slate-900 border-2 border-blue-500 rounded px-1 py-0.5 text-[11px] font-mono outline-hidden text-right"
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
                      )}

                      {isColVisible('minusTol') && (
                        <td 
                          onDoubleClick={(e) => {
                            e.stopPropagation();
                            if (!char.forReference) {
                              setEditingCell({ charId: char.id, field: 'minusTol' });
                              setEditingValue(char.minusTol !== null ? String(char.minusTol) : '0');
                            }
                          }}
                          className={`py-1 px-2 border-r border-slate-200/50 text-right ${char.forReference ? '' : 'cursor-text'}`}
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
                              className="w-16 bg-white text-slate-900 border-2 border-blue-500 rounded px-1 py-0.5 text-[11px] font-mono outline-hidden text-right"
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
                      )}

                      {isColVisible('upperLimit') && (
                        <td className="py-1 px-2 border-r border-slate-200/50 text-right font-bold">
                          {char.forReference || char.upperLimit === null ? '--' : char.upperLimit.toFixed(4)}
                        </td>
                      )}

                      {isColVisible('lowerLimit') && (
                        <td className="py-1 px-2 border-r border-slate-200/50 text-right font-bold">
                          {char.forReference || char.lowerLimit === null ? '--' : char.lowerLimit.toFixed(4)}
                        </td>
                      )}

                      {/* Measured Actual Column - Instant Click or Double-Click to Edit */}
                      {isColVisible('measuredValue') && (
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
                          className={`py-1 px-2 border-r border-slate-200/50 text-right font-bold cursor-pointer transition-colors ${
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
                              className="w-20 bg-white text-slate-900 border-2 border-blue-500 rounded px-1.5 py-0.5 text-[11px] font-mono font-bold text-right outline-hidden shadow-xs"
                            />
                          ) : (
                            <div className="flex items-center justify-end gap-1 group/measured">
                              <span className="font-mono">
                                {char.measuredValue !== null && char.measuredValue !== undefined ? char.measuredValue.toFixed(4) : '--'}
                              </span>
                              <span className="opacity-40 group-hover/measured:opacity-100 text-[10px] text-blue-500 font-sans transition-opacity">
                                ✎
                              </span>
                            </div>
                          )}
                        </td>
                      )}

                      {/* Deviation Column */}
                      {isColVisible('deviation') && (
                        <td className="py-1 px-2 border-r border-slate-200/50 text-right font-mono text-[10px]">
                          {char.deviation !== null && char.deviation !== undefined ? (
                            <span className={char.deviation > 0 ? 'text-amber-700 font-semibold' : char.deviation < 0 ? 'text-blue-700 font-semibold' : 'text-slate-600'}>
                              {char.deviation > 0 ? `+${char.deviation.toFixed(4)}` : char.deviation.toFixed(4)}
                            </span>
                          ) : (
                            <span className="text-slate-400">--</span>
                          )}
                        </td>
                      )}

                      {/* Status Column */}
                      {isColVisible('status') && (
                        <td className="py-1 px-2 border-r border-slate-200/50 text-center">
                          {char.conformanceStatus === 'PASS' ? (
                            <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[9px] border border-emerald-300">
                              PASS
                            </span>
                          ) : char.conformanceStatus === 'MARGINAL' ? (
                            <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-bold text-[9px] border border-amber-300" title="Measurement within 10% of tolerance boundary">
                              MARGINAL
                            </span>
                          ) : char.conformanceStatus === 'FAIL' ? (
                            <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-800 font-bold text-[9px] border border-red-300 animate-pulse" title="Out of tolerance specification">
                              FAIL
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-400 font-medium text-[9px]">
                              PENDING
                            </span>
                          )}
                        </td>
                      )}

                      {isColVisible('source') && (
                        <td className="py-1 px-2 border-r border-slate-200/50 font-sans truncate text-[10px]">
                          {char.sourceCaptureOrSheet || `Sheet ${char.sheetNumber}`}
                        </td>
                      )}

                      {isColVisible('method') && (
                        <td className="py-0.5 px-2 border-r border-slate-200/50 font-sans truncate text-[10px]">
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
                            className={`bg-transparent border-0 text-[10px] font-sans cursor-pointer hover:bg-black/5 rounded px-1 py-0.5 outline-hidden ${
                              isSelected ? 'text-white' : 'text-slate-700'
                            }`}
                          >
                            {INSPECTION_METHODS.map((m) => (
                              <option key={m} value={m} className="text-slate-900 bg-white">
                                {m}
                              </option>
                            ))}
                          </select>
                        </td>
                      )}

                      {isColVisible('classification') && (
                        <td className="py-0.5 px-2 border-r border-slate-200/50 text-center">
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
                                ? isSelected ? 'bg-red-900 text-white' : 'bg-red-100 text-red-800'
                                : char.classification === 'Major'
                                ? isSelected ? 'bg-amber-900 text-white' : 'bg-amber-100 text-amber-800'
                                : isSelected ? 'bg-[#282d35] text-white' : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            <option value="Minor" className="text-slate-900 bg-white">Minor</option>
                            <option value="Major" className="text-slate-900 bg-white">Major</option>
                            <option value="Critical" className="text-slate-900 bg-white">Critical</option>
                          </select>
                        </td>
                      )}

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
                              : 'text-slate-400 hover:text-red-600 hover:bg-red-50'
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
            <div className="p-3 text-slate-600">
              <h4 className="font-bold text-slate-800 text-xs mb-2">General Engineering Specifications (AS9102 Form 2)</h4>
              <ul className="space-y-1 font-mono text-[11px]">
                <li className="p-1.5 bg-slate-50 border border-slate-200 rounded">1. INTERPRET DRAWING PER ASME Y14.5-2018 STANDARDS.</li>
                <li className="p-1.5 bg-slate-50 border border-slate-200 rounded font-semibold text-blue-800">2. MATERIAL: TI-6AL-4V GRADE 5 TITANIUM PER AMS 4928.</li>
                <li className="p-1.5 bg-slate-50 border border-slate-200 rounded">3. REMOVE ALL BURRS AND BREAK SHARP EDGES 0.015 MAX.</li>
                <li className="p-1.5 bg-slate-50 border border-slate-200 rounded">4. SURFACE FINISH: 32 Ra MAX ALL MACHINED SURFACES.</li>
                <li className="p-1.5 bg-slate-50 border border-slate-200 rounded font-semibold text-emerald-800">5. 100% FIRST ARTICLE INSPECTION PER SAE AS9102 REV C REQUIRED.</li>
                <li className="p-1.5 bg-slate-50 border border-slate-200 rounded font-semibold text-red-800">6. ITAR CONTROLLED: EXPORT CONTROLLED DEFENSE DATA.</li>
              </ul>
            </div>
          )}

          {activeTab === 'bom' && (
            <div className="p-4 text-center text-slate-400">
              <Layers className="w-8 h-8 mx-auto mb-1 text-slate-300" />
              <p className="text-xs">No assembly components in this single monolithic part blueprint.</p>
            </div>
          )}
        </div>
      )}
    </footer>
  );
};
