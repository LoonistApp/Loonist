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
    <nav aria-label="Blueprint Sheet Navigation" className="h-10 bg-slate-900 border-t border-slate-800 px-4 flex items-center justify-between select-none z-20">
      <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-1">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mr-2 flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5 text-cyan-400" />
          <span>Sheets</span>
        </span>

        {sheets.map((sheet, index) => {
          const isActive = index === activeSheetIndex;
          return (
            <button
              key={sheet.pageNumber}
              type="button"
              onClick={() => onSelectSheet(index)}
              className={`flex items-center gap-2 px-3 py-1 rounded-md text-xs font-medium transition-all ${
                isActive
                  ? 'bg-cyan-950 text-cyan-300 border border-cyan-700 shadow-sm shadow-cyan-950/50'
                  : 'bg-slate-800/60 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-transparent'
              }`}
            >
              {isActive && <CheckCircle2 className="w-3 h-3 text-cyan-400" />}
              <span>{sheet.label}</span>
              <span className="text-[10px] opacity-60 font-mono">
                ({Math.round(sheet.width)}×{Math.round(sheet.height)} pt)
              </span>
            </button>
          );
        })}
      </div>

      <div className="hidden lg:flex items-center gap-3 text-[11px] text-slate-400 font-mono">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
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
