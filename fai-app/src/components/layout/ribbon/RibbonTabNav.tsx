import React from 'react';
import { 
  ChevronUp, 
  ChevronDown, 
  FolderOpen
} from 'lucide-react';

export type RibbonTabId =
  | 'home';

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
    <div className="h-7 bg-slate-200 px-2 flex items-center justify-between select-none">
      {/* Ribbon Workspace Navigation Tabs */}
      <div className="flex items-center h-full gap-0.5">
        {/* FILE Tab (In front of HOME) */}
        <button
          type="button"
          onClick={onOpenFileMenu}
          className={`relative h-6 px-3 flex items-center gap-1.5 text-[11px] tracking-wide transition cursor-pointer rounded-t-xs ${
            isFileMenuOpen
              ? 'bg-white font-bold border-t-2 border-t-slate-800 border-l border-l-slate-300 shadow-2xs'
              : 'text-slate-700 hover:text-slate-900 hover:bg-slate-300/70 border-t-2 border-t-transparent'
          }`}
          title="File Operations & Backstage Menu [Alt+F]"
        >
          <FolderOpen className="w-3.5 h-3.5 text-slate-700 shrink-0" />
          <span className={isFileMenuOpen ? 'font-bold text-slate-900' : 'font-semibold text-slate-700'}>
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
                  ? 'bg-white font-bold border-t-2 border-t-slate-800 border-l border-l-slate-300 shadow-2xs'
                  : 'text-slate-700 hover:text-slate-900 hover:bg-slate-300/70 border-t-2 border-t-transparent'
              }`}
            >
              <span className={isActive ? 'font-bold text-slate-900' : 'font-semibold text-slate-700'}>
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
          className="p-1 rounded text-slate-500 hover:text-slate-800 hover:bg-slate-300/70 transition cursor-pointer"
          title={isRibbonCollapsed ? 'Expand Ribbon Strip' : 'Minimize Ribbon Strip (Maximize Viewport Canvas)'}
        >
          {isRibbonCollapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
        </button>
      </div>
    </div>
  );
};
