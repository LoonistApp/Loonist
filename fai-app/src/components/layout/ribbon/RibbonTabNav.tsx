import React from 'react';
import { 
  ChevronUp, 
  ChevronDown, 
  ShieldCheck, 
  Layers,
  FolderOpen
} from 'lucide-react';

export type RibbonTabId = 
  | 'home' 
  | 'drawing' 
  | 'balloons' 
  | 'inspection' 
  | 'reports' 
  | 'view' 
  | 'settings';

interface RibbonTabNavProps {
  activeTab: RibbonTabId;
  onSelectTab: (tab: RibbonTabId) => void;
  onOpenFileMenu: () => void;
  isRibbonCollapsed: boolean;
  onToggleCollapse: () => void;
  characteristicsCount?: number;
  hasDrawing?: boolean;
}

const TABS: Array<{ id: RibbonTabId; label: string }> = [
  { id: 'home', label: 'HOME' },
  { id: 'drawing', label: 'DRAWING' },
  { id: 'balloons', label: 'BALLOONS' },
  { id: 'inspection', label: 'INSPECTION' },
  { id: 'reports', label: 'REPORTS' },
  { id: 'view', label: 'VIEW' },
  { id: 'settings', label: 'SETTINGS' },
];

export const RibbonTabNav: React.FC<RibbonTabNavProps> = ({
  activeTab,
  onSelectTab,
  onOpenFileMenu,
  isRibbonCollapsed,
  onToggleCollapse,
  characteristicsCount = 0,
  hasDrawing = false
}) => {
  return (
    <div className="h-7 bg-slate-200/90 dark:bg-[#161b22] px-2 flex items-center justify-between border-b border-slate-300 dark:border-zinc-800 select-none">
      {/* Left: FILE button + Ribbon Workspace Tabs */}
      <div className="flex items-center h-full gap-0.5">
        {/* Engineering Desktop FILE Button (Backstage Access) */}
        <button
          type="button"
          onClick={onOpenFileMenu}
          className="h-6 px-3 mr-1 flex items-center gap-1.5 text-[11px] font-bold tracking-wider text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-xs shadow-2xs transition cursor-pointer"
          title="Project File Operations & Backstage Menu [Alt+F]"
        >
          <FolderOpen className="w-3.5 h-3.5" />
          <span>FILE</span>
        </button>

        {/* Ribbon Workspace Navigation Tabs */}
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id && !isRibbonCollapsed;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                onSelectTab(tab.id);
                if (isRibbonCollapsed) {
                  onToggleCollapse();
                }
              }}
              className={`relative h-6 px-3 flex items-center text-[11px] font-semibold tracking-wide transition cursor-pointer rounded-t-xs ${
                isActive
                  ? 'bg-white dark:bg-[#1c2128] text-blue-600 dark:text-blue-400 font-bold border-t-2 border-t-blue-600 dark:border-t-blue-500 border-x border-x-slate-300 dark:border-x-zinc-700/80 shadow-2xs'
                  : 'text-slate-700 hover:text-slate-900 hover:bg-slate-300/70 dark:text-zinc-400 dark:hover:text-zinc-200 dark:hover:bg-zinc-800/80 border-t-2 border-t-transparent'
              }`}
            >
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Right: Quick Indicators & Ribbon Collapse Button */}
      <div className="flex items-center gap-3 pr-1">
        {hasDrawing && (
          <div className="hidden sm:flex items-center gap-2 text-[10px] text-slate-500 dark:text-zinc-400 font-mono">
            <span className="flex items-center gap-1 bg-slate-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-zinc-700">
              <Layers className="w-3 h-3 text-blue-500" />
              <span>{characteristicsCount} Balloons</span>
            </span>
          </div>
        )}

        <div className="hidden md:flex items-center gap-1 text-[10px] text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-800 font-medium">
          <ShieldCheck className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
          <span>AS9102 Rev C</span>
        </div>

        {/* Minimize / Expand Ribbon Command Strip Toggle */}
        <button
          type="button"
          onClick={onToggleCollapse}
          className="p-1 rounded text-slate-500 hover:text-slate-800 hover:bg-slate-300/70 dark:text-zinc-400 dark:hover:text-white dark:hover:bg-zinc-800 transition cursor-pointer"
          title={isRibbonCollapsed ? 'Expand Ribbon Strip' : 'Minimize Ribbon Strip (Maximize Viewport Canvas)'}
        >
          {isRibbonCollapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
        </button>
      </div>
    </div>
  );
};
