import React from 'react';
import { Layers, CheckCircle2 } from 'lucide-react';
import type { SheetMetadata } from '../../types/blueprint';

interface SheetTabsProps {
  sheets: SheetMetadata[];
  activeSheetIndex: number;
  onSelectSheet: (index: number) => void;
}

export const SheetTabs: React.FC<SheetTabsProps> = ({
  sheets,
  activeSheetIndex,
  onSelectSheet
}) => {
  if (!sheets || sheets.length <= 1) {
    return null;
  }

  return (
    <nav aria-label="Blueprint Sheet Navigation" className="h-9 bg-white border-t border-slate-200 px-4 flex items-center justify-between select-none z-20">
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mr-2 flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5 text-slate-500" />
          <span>Sheets</span>
        </span>

        {sheets.map((sheet, index) => {
          const isActive = index === activeSheetIndex;
          return (
            <button
              key={sheet.pageNumber}
              type="button"
              onClick={() => onSelectSheet(index)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition ${
                isActive
                  ? 'bg-blue-50 text-blue-700 border border-blue-200 shadow-xs'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200'
              }`}
            >
              {isActive && <CheckCircle2 className="w-3 h-3 text-blue-600" />}
              <span>{sheet.label}</span>
              <span className="text-[10px] text-slate-400 font-mono">
                ({Math.round(sheet.width)}×{Math.round(sheet.height)} pt)
              </span>
            </button>
          );
        })}
      </div>

      <div className="hidden lg:flex items-center gap-3 text-[11px] text-slate-500 font-mono">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
          <span>Active Sheet In-Memory</span>
        </span>
        <span>•</span>
        <span className="text-slate-400">
          Inactive Pages Offloaded (&lt;1.5GB Target)
        </span>
      </div>
    </nav>
  );
};
