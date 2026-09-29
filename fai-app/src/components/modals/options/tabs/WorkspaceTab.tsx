import React, { useState } from 'react';
import type { WorkspaceSettings, TableColumnConfig } from '../../../../types/applicationOptions';
import { 
  Eye, 
  EyeOff, 
  ArrowUp, 
  ArrowDown, 
  Search,
  Check
} from 'lucide-react';

interface WorkspaceTabProps {
  settings: WorkspaceSettings;
  onChange: (patch: Partial<WorkspaceSettings>) => void;
  onApplyPreset: (preset: 'as9102-standard' | 'shop-floor' | 'gdt-focus') => void;
}

export const WorkspaceTab: React.FC<WorkspaceTabProps> = ({
  settings,
  onChange,
  onApplyPreset
}) => {
  const [columnSearch, setColumnSearch] = useState('');

  const filteredColumns = settings.tableColumns.filter((c: TableColumnConfig) => 
    c.label.toLowerCase().includes(columnSearch.toLowerCase()) ||
    c.id.toLowerCase().includes(columnSearch.toLowerCase())
  );

  const toggleColumnVisibility = (id: string) => {
    const updated = settings.tableColumns.map((c: TableColumnConfig) => {
      if (c.id === id && !c.isLocked) {
        return { ...c, visible: !c.visible };
      }
      return c;
    });
    onChange({ tableColumns: updated, tablePresetView: 'custom' });
  };

  const moveColumn = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= settings.tableColumns.length) return;

    const list = [...settings.tableColumns];
    const temp = list[index];
    list[index] = list[targetIndex];
    list[targetIndex] = temp;

    onChange({ tableColumns: list, tablePresetView: 'custom' });
  };

  return (
    <div className="flex flex-col gap-6 text-xs text-slate-800 dark:text-zinc-200">
      
      {/* 1. MOUSE & VIEWPORT NAVIGATION */}
      <div className="bg-slate-50 dark:bg-zinc-900/60 p-4 rounded-lg border border-slate-200 dark:border-zinc-800">
        <div className="flex items-center gap-2 mb-3">
          <h3 className="font-semibold text-xs text-slate-900 dark:text-white uppercase tracking-wider">
            Viewport Navigation & Mouse Controls
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="flex items-start gap-2.5 p-2 rounded hover:bg-slate-100 dark:hover:bg-zinc-800/60 transition cursor-pointer">
            <input
              type="checkbox"
              checked={settings.invertWheelZoom}
              onChange={(e) => onChange({ invertWheelZoom: e.target.checked })}
              className="mt-0.5 w-4 h-4 rounded text-sky-600 focus:ring-sky-500 border-slate-300 dark:border-zinc-700"
            />
            <div>
              <span className="font-medium text-slate-800 dark:text-zinc-200">Reverse Mouse Wheel Zoom</span>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
                Invert the scroll wheel zoom direction.
              </p>
            </div>
          </label>

          <label className="flex items-start gap-2.5 p-2 rounded hover:bg-slate-100 dark:hover:bg-zinc-800/60 transition cursor-pointer">
            <input
              type="checkbox"
              checked={settings.panWithMiddleClick}
              onChange={(e) => onChange({ panWithMiddleClick: e.target.checked })}
              className="mt-0.5 w-4 h-4 rounded text-sky-600 focus:ring-sky-500 border-slate-300 dark:border-zinc-700"
            />
            <div>
              <span className="font-medium text-slate-800 dark:text-zinc-200">Middle Mouse Button Pan</span>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
                Click and drag with the scroll wheel to pan the drawing canvas.
              </p>
            </div>
          </label>
        </div>

        {/* Canvas Background & Decimal Separator */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3 pt-3 border-t border-slate-200 dark:border-zinc-800">
          <div>
            <label className="block text-[11px] font-medium text-slate-600 dark:text-zinc-400 mb-1.5">
              Canvas Contrast Mode:
            </label>
            <div className="flex items-center gap-2">
              {[
                { id: 'white', label: 'Crisp White', color: '#ffffff', border: '#cbd5e1' },
                { id: 'charcoal', label: 'Dark Slate', color: '#1e2024', border: '#334155' },
                { id: 'blueprint', label: 'Blueprint Dark', color: '#0b132b', border: '#1e3a8a' },
              ].map(mode => {
                const isSelected = settings.canvasBackground === mode.id;
                return (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => onChange({ canvasBackground: mode.id as any })}
                    className={`flex items-center gap-2 px-2.5 py-1.5 rounded border text-[11px] transition cursor-pointer ${
                      isSelected
                        ? 'border-sky-500 bg-sky-50 dark:bg-sky-950/40 text-sky-800 dark:text-sky-200 font-semibold ring-1 ring-sky-500 shadow-xs'
                        : 'border-slate-300 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800'
                    }`}
                  >
                    <span 
                      className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ${isSelected ? 'ring-1 ring-sky-500' : ''}`} 
                      style={{ backgroundColor: mode.color, borderColor: mode.border }}
                    >
                      {isSelected && (
                        <span 
                          className="w-1.5 h-1.5 rounded-full" 
                          style={{ backgroundColor: mode.id === 'white' ? '#0f172a' : '#ffffff' }} 
                        />
                      )}
                    </span>
                    {mode.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-600 dark:text-zinc-400 mb-1.5">
              Decimal Separator Format:
            </label>
            <select
              value={settings.decimalSeparator}
              onChange={(e) => onChange({ decimalSeparator: e.target.value as any })}
              className="bg-white dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 rounded px-2.5 py-1 text-xs text-slate-800 dark:text-zinc-200 outline-none focus:border-sky-500 w-full max-w-[220px]"
            >
              <option value=".">Period (.) — US / Aerospace Default (1.250)</option>
              <option value=",">Comma (,) — European ISO (1,250)</option>
              <option value="system">System Locale Default</option>
            </select>
          </div>
        </div>
      </div>

      {/* 2. CHARACTERISTICS TABLE COLUMN CHOOSER & REORDERER */}
      <div className="bg-slate-50 dark:bg-zinc-900/60 p-4 rounded-lg border border-slate-200 dark:border-zinc-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-xs text-slate-900 dark:text-white uppercase tracking-wider">
              Characteristics Table Column Customizer
            </h3>
          </div>

          {/* Quick Presets */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-slate-500 dark:text-zinc-400 font-semibold">Presets:</span>
            <button
              type="button"
              onClick={() => onApplyPreset('as9102-standard')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded text-[10.5px] font-semibold border transition cursor-pointer select-none ${
                settings.tablePresetView === 'as9102-standard'
                  ? 'font-bold shadow-xs'
                  : 'hover:bg-slate-100 dark:hover:bg-zinc-800'
              }`}
              style={
                settings.tablePresetView === 'as9102-standard'
                  ? { backgroundColor: 'rgba(255, 255, 255, 0.14)', color: '#ffffff', borderColor: '#e4e4e7' }
                  : { backgroundColor: 'transparent', color: '#a1a1aa', borderColor: '#3f3f46' }
              }
              title="Full AS9102 Table View (all standard columns)"
            >
              {settings.tablePresetView === 'as9102-standard' && <Check className="w-3 h-3 text-white shrink-0" />}
              <span>AS9102 Full</span>
            </button>
            <button
              type="button"
              onClick={() => onApplyPreset('shop-floor')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded text-[10.5px] font-semibold border transition cursor-pointer select-none ${
                settings.tablePresetView === 'shop-floor'
                  ? 'font-bold shadow-xs'
                  : 'hover:bg-slate-100 dark:hover:bg-zinc-800'
              }`}
              style={
                settings.tablePresetView === 'shop-floor'
                  ? { backgroundColor: 'rgba(255, 255, 255, 0.14)', color: '#ffffff', borderColor: '#e4e4e7' }
                  : { backgroundColor: 'transparent', color: '#a1a1aa', borderColor: '#3f3f46' }
              }
              title="Shop Floor Quick View (lean measuring layout)"
            >
              {settings.tablePresetView === 'shop-floor' && <Check className="w-3 h-3 text-white shrink-0" />}
              <span>Shop Floor Quick</span>
            </button>
            <button
              type="button"
              onClick={() => onApplyPreset('gdt-focus')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded text-[10.5px] font-semibold border transition cursor-pointer select-none ${
                settings.tablePresetView === 'gdt-focus'
                  ? 'font-bold shadow-xs'
                  : 'hover:bg-slate-100 dark:hover:bg-zinc-800'
              }`}
              style={
                settings.tablePresetView === 'gdt-focus'
                  ? { backgroundColor: 'rgba(255, 255, 255, 0.14)', color: '#ffffff', borderColor: '#e4e4e7' }
                  : { backgroundColor: 'transparent', color: '#a1a1aa', borderColor: '#3f3f46' }
              }
              title="GD&T Focus View (symbols, datums, and tolerances)"
            >
              {settings.tablePresetView === 'gdt-focus' && <Check className="w-3 h-3 text-white shrink-0" />}
              <span>GD&T Focus</span>
            </button>
          </div>
        </div>

        {/* Filter Input */}
        <div className="relative mb-3 flex items-center">
          <Search 
            className="w-3.5 h-3.5 text-slate-400 pointer-events-none" 
            style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} 
          />
          <input
            type="text"
            placeholder="Search columns..."
            value={columnSearch}
            onChange={(e) => setColumnSearch(e.target.value)}
            className="w-full bg-white dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 rounded-md pr-3 py-1.5 text-xs text-slate-800 dark:text-zinc-200 outline-none focus:border-sky-500"
            style={{ paddingLeft: '32px' }}
          />
        </div>

        {/* Column List Grid */}
        <div className="border border-slate-200 dark:border-zinc-800 rounded bg-white dark:bg-zinc-950 overflow-hidden max-h-[300px] overflow-y-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-100 dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-800 sticky top-0">
              <tr>
                <th className="py-1.5 px-3 w-10 text-center">Show</th>
                <th className="py-1.5 px-3 font-semibold text-[11px] text-slate-600 dark:text-zinc-400">Column Name</th>
                <th className="py-1.5 px-3 font-semibold text-[11px] text-slate-600 dark:text-zinc-400">Internal ID</th>
                <th className="py-1.5 px-3 w-24 text-center font-semibold text-[11px] text-slate-600 dark:text-zinc-400">Reorder</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60">
              {filteredColumns.map((col: TableColumnConfig) => {
                const actualIndex = settings.tableColumns.findIndex((c: TableColumnConfig) => c.id === col.id);
                return (
                  <tr 
                    key={col.id}
                    className={`hover:bg-slate-50 dark:hover:bg-zinc-900/50 transition ${
                      col.visible ? '' : 'opacity-50 bg-slate-50/50 dark:bg-zinc-900/20'
                    }`}
                  >
                    <td className="py-1.5 px-3 text-center">
                      <button
                        type="button"
                        disabled={col.isLocked}
                        onClick={() => toggleColumnVisibility(col.id)}
                        className={`p-1 rounded transition cursor-pointer ${
                          col.isLocked 
                            ? 'opacity-40 cursor-not-allowed'
                            : col.visible 
                            ? 'text-slate-900 dark:text-zinc-100 hover:bg-slate-200 dark:hover:bg-zinc-700' 
                            : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-800'
                        }`}
                        title={col.isLocked ? 'Column is required' : col.visible ? 'Hide column' : 'Show column'}
                      >
                        {col.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                      </button>
                    </td>
                    <td className="py-1.5 px-3 font-medium text-slate-900 dark:text-zinc-100">
                      {col.label}
                      {col.isLocked && (
                        <span className="ml-2 text-[9px] font-mono bg-slate-200 dark:bg-zinc-800 px-1 py-0.5 rounded text-slate-600 dark:text-zinc-400">
                          Primary
                        </span>
                      )}
                    </td>
                    <td className="py-1.5 px-3 font-mono text-[10px] text-slate-500 dark:text-zinc-400">
                      {col.id}
                    </td>
                    <td className="py-1.5 px-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          disabled={actualIndex === 0}
                          onClick={() => moveColumn(actualIndex, 'up')}
                          className="p-1 rounded hover:bg-slate-200 dark:hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed text-slate-600 dark:text-zinc-300"
                          title="Move column up (left in table)"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={actualIndex === settings.tableColumns.length - 1}
                          onClick={() => moveColumn(actualIndex, 'down')}
                          className="p-1 rounded hover:bg-slate-200 dark:hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed text-slate-600 dark:text-zinc-300"
                          title="Move column down (right in table)"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
