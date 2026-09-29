import React from 'react';
import { 
  ChevronUp, 
  ChevronDown, 
  FolderOpen
} from 'lucide-react';

export type RibbonTabId = 
  | 'home'
  | 'settings';

interface RibbonTabNavProps {
  activeTab: RibbonTabId;
  onSelectTab: (tab: RibbonTabId) => void;
  onOpenFileMenu?: () => void;
  isFileMenuOpen?: boolean;
  isRibbonCollapsed: boolean;
  onToggleCollapse: () => void;
  characteristicsCount?: number;
  hasDrawing?: boolean;
}

const TABS: Array<{ id: RibbonTabId; label: string }> = [
  { id: 'home', label: 'HOME' },
  { id: 'settings', label: 'SETTINGS' },
];

export const RibbonTabNav: React.FC<RibbonTabNavProps> = ({
  activeTab,
  onSelectTab,
  onOpenFileMenu,
  isFileMenuOpen = false,
  isRibbonCollapsed,
  onToggleCollapse
}) => {
  return (
    <div className="h-7 bg-slate-200/90 dark:bg-[#161b22] px-2 flex items-center justify-between border-b border-slate-300 dark:border-zinc-800 select-none">
      {/* Ribbon Workspace Navigation Tabs */}
      <div className="flex items-center h-full gap-0.5">
        {/* FILE Tab (In front of HOME) */}
        <button
          type="button"
          onClick={onOpenFileMenu}
          className={`relative h-6 px-3 flex items-center gap-1.5 text-[11px] tracking-wide transition cursor-pointer rounded-t-xs ${
            isFileMenuOpen
              ? 'bg-white dark:bg-[#1c2128] font-bold border-t-2 border-t-slate-800 dark:border-t-zinc-200 border-x border-x-slate-300 dark:border-x-zinc-700/80 shadow-2xs'
              : 'text-slate-700 hover:text-slate-900 hover:bg-slate-300/70 dark:text-zinc-400 dark:hover:text-zinc-200 dark:hover:bg-zinc-800/80 border-t-2 border-t-transparent'
          }`}
          title="File Operations & Backstage Menu [Alt+F]"
        >
          <FolderOpen className="w-3.5 h-3.5 text-slate-700 dark:text-zinc-300 shrink-0" />
          <span className={isFileMenuOpen ? 'font-bold text-slate-900 dark:text-zinc-100' : 'font-semibold text-slate-700 dark:text-zinc-400'}>
            FILE
          </span>
        </button>

        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
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
              className={`relative h-6 px-3 flex items-center text-[11px] tracking-wide transition cursor-pointer rounded-t-xs ${
                isActive
                  ? 'bg-white dark:bg-[#1c2128] font-bold border-t-2 border-t-slate-800 dark:border-t-zinc-200 border-x border-x-slate-300 dark:border-x-zinc-700/80 shadow-2xs'
                  : 'text-slate-700 hover:text-slate-900 hover:bg-slate-300/70 dark:text-zinc-400 dark:hover:text-zinc-200 dark:hover:bg-zinc-800/80 border-t-2 border-t-transparent'
              }`}
            >
              <span className={isActive ? 'font-bold text-slate-900 dark:text-zinc-100' : 'font-semibold text-slate-700 dark:text-zinc-400'}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Right: Ribbon Collapse Button */}
      <div className="flex items-center gap-1 pr-1">
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
