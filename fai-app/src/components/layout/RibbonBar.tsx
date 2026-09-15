import React, { useState } from 'react';
import type { BalloonAppearance, EngineeringCharacteristic, ProjectProperties } from '../../types/characteristics';
import type { ViewportTool, BlueprintDocument } from '../../types/blueprint';
import { 
  PanelLeft, 
  PanelBottom, 
  Maximize2, 
  Sun, 
  Moon, 
  Save, 
  FolderOpen, 
  FileText, 
  X
} from 'lucide-react';
import { RibbonTabNav, type RibbonTabId } from './ribbon/RibbonTabNav';
import { FileBackstageModal } from './ribbon/FileBackstageModal';
import { HomeRibbonTab } from './ribbon/tabs/HomeRibbonTab';
import { DrawingRibbonTab } from './ribbon/tabs/DrawingRibbonTab';
import { BalloonsRibbonTab } from './ribbon/tabs/BalloonsRibbonTab';
import { InspectionRibbonTab } from './ribbon/tabs/InspectionRibbonTab';
import { ReportsRibbonTab } from './ribbon/tabs/ReportsRibbonTab';
import { ViewRibbonTab } from './ribbon/tabs/ViewRibbonTab';
import { SettingsRibbonTab } from './ribbon/tabs/SettingsRibbonTab';

export interface ProjectFileTab {
  id: string;
  name: string;
  type: 'pdf' | 'dwg' | 'catpart';
  filePath?: string;
}

export interface RibbonBarProps {
  // Document actions
  onSmartExtract: () => void;
  isExtracting: boolean;
  onAddFile: () => void;
  onSaveProject?: () => void;
  onOpenProject?: () => void;
  onExportExcel?: () => void;
  onExportPdf?: () => void;
  onRenumberAll?: () => void;
  onRepositionBalloons?: () => void;
  onLoadSample?: () => void;
  onNewProject?: () => void;

  // Viewport actions
  activeTool: ViewportTool;
  onToolChange: (tool: ViewportTool) => void;
  onFitPage: () => void;
  onFitWidth: () => void;
  onRotateClockwise: () => void;
  onRotateCounterClockwise?: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;

  // Balloon appearance & locking
  balloonAppearance: BalloonAppearance;
  onUpdateBalloonAppearance: (appearance: BalloonAppearance) => void;
  balloonsLocked: boolean;
  onToggleLockBalloons: () => void;

  // Multi-Document Tabs
  projectFiles: ProjectFileTab[];
  activeFileId: string;
  onSelectFile: (id: string) => void;
  onCloseFile?: (id: string) => void;

  // Panel Controls
  isLeftPanelOpen?: boolean;
  isBottomPanelOpen?: boolean;
  onToggleLeftPanel?: () => void;
  onToggleBottomPanel?: () => void;
  onToggleFullDrawing?: () => void;
  onToggleMaximizeLeft?: () => void;
  onToggleMaximizeBottom?: () => void;
  onResetLayout?: () => void;

  // Characteristics Review Drawer & Active Feature
  characteristicsCount?: number;
  characteristics?: EngineeringCharacteristic[];
  isDrawerOpen?: boolean;
  onToggleDrawer?: () => void;
  selectedCharId?: string | null;
  selectedChar?: EngineeringCharacteristic | null;
  onDeleteCharacteristic?: (id: string) => void;

  // Document Model & Sheets
  blueprintDoc?: BlueprintDocument | null;
  activeSheetIndex?: number;
  onSelectSheet?: (index: number) => void;

  // Project properties & AS9102 Navigation
  projectProps?: ProjectProperties;
  onSelectFormTab?: (form: 'form1' | 'form2' | 'form3') => void;
  tableFilter?: 'all' | 'critical' | 'review';
  onSetTableFilter?: (filter: 'all' | 'critical' | 'review') => void;

  // CAD Dark Mode Theme
  isDarkMode?: boolean;
  onToggleDarkMode?: () => void;
}

export const RibbonBar: React.FC<RibbonBarProps> = ({
  onSmartExtract,
  isExtracting,
  onAddFile,
  onSaveProject,
  onOpenProject,
  onExportExcel,
  onExportPdf,
  onRenumberAll,
  onRepositionBalloons,
  onLoadSample,
  onNewProject,
  activeTool,
  onToolChange,
  onFitPage,
  onFitWidth,
  onRotateClockwise,
  onRotateCounterClockwise,
  onZoomIn,
  onZoomOut,
  balloonAppearance,
  onUpdateBalloonAppearance,
  balloonsLocked,
  onToggleLockBalloons,
  projectFiles,
  activeFileId,
  onSelectFile,
  onCloseFile,
  isLeftPanelOpen = true,
  isBottomPanelOpen = true,
  onToggleLeftPanel,
  onToggleBottomPanel,
  onToggleFullDrawing,
  onToggleMaximizeLeft,
  onToggleMaximizeBottom,
  onResetLayout,
  characteristicsCount = 0,
  characteristics = [],
  isDrawerOpen = false,
  onToggleDrawer,
  selectedCharId = null,
  selectedChar = null,
  onDeleteCharacteristic,
  blueprintDoc = null,
  activeSheetIndex = 0,
  onSelectSheet,
  projectProps = {
    partName: 'TURBINE MOUNT BRACKET',
    partNumber: 'AS9102-TMB-001',
    partRevision: 'C',
    drawingName: 'Turbine Mount Bracket',
    drawingNumber: 'AS9102-TMB-001',
    drawingRevision: 'C',
    cageCode: '1A2B3',
    lotSize: 200,
    samplingLevel: 'II',
    samplingType: 'NORMAL',
    aql: '1.0'
  },
  onSelectFormTab,
  tableFilter = 'all',
  onSetTableFilter,
  isDarkMode = false,
  onToggleDarkMode
}) => {
  const [activeTab, setActiveTab] = useState<RibbonTabId>('home');
  const [isRibbonCollapsed, setIsRibbonCollapsed] = useState(false);
  const [showBackstage, setShowBackstage] = useState(false);

  const hasDrawing = Boolean(blueprintDoc);
  const effectiveCharCount = characteristicsCount || characteristics.length;

  return (
    <header className="flex flex-col w-full bg-slate-100 dark:bg-[#121212] border-b border-slate-300 dark:border-zinc-800 select-none text-slate-800 dark:text-slate-200 text-xs shadow-xs z-30">
      {/* 1. TOP APPLICATION BAR WITH QUICK ACCESS TOOLBAR & TITLE (Height: 30px) */}
      <div className="h-7 bg-[#14181f] dark:bg-[#0d1117] text-slate-200 px-3 flex items-center justify-between border-b border-[#212733] dark:border-[#21262d]">
        {/* Left: Branding & Quick Access Toolbar */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 font-bold tracking-wider text-white">
            <span className="w-4 h-4 rounded-xs bg-blue-600 flex items-center justify-center text-[10px] text-white font-mono font-black shadow-xs">
              L
            </span>
            <span className="text-xs tracking-tight font-black">LOONIST</span>
          </div>

          <span className="text-[#333d4e] dark:text-[#282e39]">|</span>

          {/* Quick Access Toolbar (QAT) */}
          <div className="flex items-center gap-1">
            {onAddFile && (
              <button
                type="button"
                onClick={onAddFile}
                className="p-1 rounded text-slate-400 hover:text-white hover:bg-[#252c38] transition cursor-pointer"
                title="Open Blueprint Drawing (PDF) [Ctrl+O]"
              >
                <FolderOpen className="w-3.5 h-3.5 text-amber-400" />
              </button>
            )}
            {onSaveProject && (
              <button
                type="button"
                onClick={onSaveProject}
                disabled={!hasDrawing && effectiveCharCount === 0}
                className="p-1 rounded text-slate-400 hover:text-white hover:bg-[#252c38] disabled:opacity-30 transition cursor-pointer"
                title="Save Project Package (.loonist) [Ctrl+S]"
              >
                <Save className="w-3.5 h-3.5" />
              </button>
            )}
            {onLoadSample && (
              <button
                type="button"
                onClick={onLoadSample}
                className="p-1 rounded text-slate-400 hover:text-white hover:bg-[#252c38] transition cursor-pointer"
                title="Load Sample Aerospace Blueprint"
              >
                <FileText className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <span className="hidden lg:inline-block text-[#333d4e] dark:text-[#282e39]">|</span>

          {/* Active Blueprint & Inspection Title */}
          <div className="hidden lg:flex items-center gap-2 text-[11px] text-slate-400 font-sans">
            {blueprintDoc ? (
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-slate-200 truncate max-w-[280px]">
                  {blueprintDoc.name}
                </span>
                <span className="text-slate-500">•</span>
                <span className="text-slate-400 font-mono">
                  Rev {projectProps.partRevision || 'A'}
                </span>
                <span className="text-slate-500">•</span>
                <span className="text-slate-400 font-mono">
                  {blueprintDoc.numSheets} {blueprintDoc.numSheets === 1 ? 'Sheet' : 'Sheets'}
                </span>
              </div>
            ) : (
              <span>SAE AS9102 Rev B/C & ASME Y14.5 Inspection Platform</span>
            )}
          </div>
        </div>

        {/* Right: Security Badge & Window Controls */}
        <div className="flex items-center gap-3">
          {/* ITAR Air-Gapped Status Badge */}
          <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-sans">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="hidden sm:inline">Air-Gapped Local</span>
          </div>

          <span className="h-3 w-px bg-[#2f3747] dark:bg-[#282e39]" />

          {/* Panel Layout Controls */}
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={onToggleLeftPanel}
              className={`p-1 rounded transition cursor-pointer ${
                isLeftPanelOpen
                  ? 'text-blue-400 bg-[#252c38] dark:bg-zinc-800'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[#252c38]'
              }`}
              title={isLeftPanelOpen ? 'Collapse Left Side Panel' : 'Expand Left Side Panel'}
            >
              <PanelLeft className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={onToggleBottomPanel}
              className={`p-1 rounded transition cursor-pointer ${
                isBottomPanelOpen
                  ? 'text-blue-400 bg-[#252c38] dark:bg-zinc-800'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[#252c38]'
              }`}
              title={isBottomPanelOpen ? 'Collapse Bottom Table' : 'Expand Bottom Table'}
            >
              <PanelBottom className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={onToggleFullDrawing}
              className={`p-1 rounded transition cursor-pointer ${
                !isLeftPanelOpen && !isBottomPanelOpen
                  ? 'text-emerald-400 bg-[#252c38] dark:bg-zinc-800'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[#252c38]'
              }`}
              title="Full Drawing View"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>

          <span className="h-3 w-px bg-[#2f3747] dark:bg-[#282e39]" />

          {/* CAD Dark / Light Mode Toggle */}
          <button
            type="button"
            onClick={onToggleDarkMode}
            className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-[#252c38] dark:hover:bg-zinc-800 transition cursor-pointer"
            title={isDarkMode ? 'Switch to CAD Light Mode' : 'Switch to CAD Dark Charcoal Mode'}
          >
            {isDarkMode ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* 2. COMPACT APPLICATION NAVIGATION TABS (Height: 28px) */}
      <RibbonTabNav
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onOpenFileMenu={() => setShowBackstage(true)}
        isRibbonCollapsed={isRibbonCollapsed}
        onToggleCollapse={() => setIsRibbonCollapsed((prev) => !prev)}
        characteristicsCount={effectiveCharCount}
        hasDrawing={hasDrawing}
      />

      {/* 3. CONTEXTUAL COMMAND STRIP (Height: 70px) - Hidden when ribbon is collapsed */}
      {!isRibbonCollapsed && (
        <div className="h-[70px] bg-white dark:bg-[#1c2128] px-2 flex items-center border-b border-slate-300 dark:border-zinc-800 overflow-x-auto select-none shadow-2xs">
          {activeTab === 'home' && (
            <HomeRibbonTab
              hasDrawing={hasDrawing}
              onSmartExtract={onSmartExtract}
              isExtracting={isExtracting}
              characteristicsCount={effectiveCharCount}
              characteristics={characteristics}
              activeFilter={tableFilter}
              onSetTableFilter={onSetTableFilter}
              isDrawerOpen={isDrawerOpen}
              onToggleDrawer={onToggleDrawer}
              balloonAppearance={balloonAppearance}
              onUpdateBalloonAppearance={onUpdateBalloonAppearance}
            />
          )}

          {activeTab === 'drawing' && (
            <DrawingRibbonTab
              hasDrawing={hasDrawing}
              document={blueprintDoc}
              activeSheetIndex={activeSheetIndex}
              onSelectSheet={onSelectSheet}
              activeTool={activeTool}
              onToolChange={onToolChange}
              onFitPage={onFitPage}
              onFitWidth={onFitWidth}
              onZoomIn={onZoomIn}
              onZoomOut={onZoomOut}
              onRotateClockwise={onRotateClockwise}
              onRotateCounterClockwise={onRotateCounterClockwise}
              onAddFile={onAddFile}
              onLoadSample={onLoadSample}
            />
          )}

          {activeTab === 'balloons' && (
            <BalloonsRibbonTab
              hasDrawing={hasDrawing}
              onSmartExtract={onSmartExtract}
              isExtracting={isExtracting}
              activeTool={activeTool}
              onToolChange={onToolChange}
              characteristicsCount={effectiveCharCount}
              isDrawerOpen={isDrawerOpen}
              onToggleDrawer={onToggleDrawer}
              balloonAppearance={balloonAppearance}
              onUpdateBalloonAppearance={onUpdateBalloonAppearance}
              balloonsLocked={balloonsLocked}
              onToggleLockBalloons={onToggleLockBalloons}
              onRenumberAll={onRenumberAll}
              onRepositionBalloons={onRepositionBalloons}
              selectedCharId={selectedCharId}
              selectedChar={selectedChar}
              onDeleteCharacteristic={onDeleteCharacteristic}
            />
          )}

          {activeTab === 'inspection' && (
            <InspectionRibbonTab
              characteristics={characteristics}
              isDrawerOpen={isDrawerOpen}
              onToggleDrawer={onToggleDrawer}
              onSelectFormTab={onSelectFormTab}
              onSetTableFilter={onSetTableFilter}
            />
          )}

          {activeTab === 'reports' && (
            <ReportsRibbonTab
              hasDrawing={hasDrawing}
              characteristicsCount={effectiveCharCount}
              onExportExcel={onExportExcel}
              onExportPdf={onExportPdf}
              onSaveProject={onSaveProject}
              onOpenProject={onOpenProject}
              onToggleDrawer={onToggleDrawer}
            />
          )}

          {activeTab === 'view' && (
            <ViewRibbonTab
              isLeftPanelOpen={isLeftPanelOpen}
              isBottomPanelOpen={isBottomPanelOpen}
              onToggleLeftPanel={onToggleLeftPanel}
              onToggleBottomPanel={onToggleBottomPanel}
              onToggleFullDrawing={onToggleFullDrawing}
              onToggleMaximizeLeft={onToggleMaximizeLeft}
              onToggleMaximizeBottom={onToggleMaximizeBottom}
              onResetLayout={onResetLayout}
              isDarkMode={isDarkMode}
              onToggleDarkMode={onToggleDarkMode}
              onFitPage={onFitPage}
              onFitWidth={onFitWidth}
              onZoomIn={onZoomIn}
              onZoomOut={onZoomOut}
              hasDrawing={hasDrawing}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsRibbonTab
              projectProps={projectProps}
            />
          )}
        </div>
      )}

      {/* 4. MULTI-DOCUMENT PROJECT TABS BAR (Height: 26px) */}
      <div className="h-6 bg-slate-200/80 dark:bg-[#14181f] px-2 flex items-center gap-1 border-b border-slate-300 dark:border-zinc-800 overflow-x-auto select-none no-scrollbar">
        {projectFiles.map((file) => {
          const isActive = file.id === activeFileId;
          return (
            <div
              key={file.id}
              role="tab"
              aria-selected={isActive}
              tabIndex={0}
              onClick={() => onSelectFile(file.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelectFile(file.id);
                }
              }}
              className={`group relative h-5 px-2.5 flex items-center gap-1.5 text-[11px] rounded-t font-mono cursor-pointer transition select-none shrink-0 ${
                isActive
                  ? 'bg-white dark:bg-[#1c2128] text-slate-900 dark:text-white font-bold shadow-2xs border-t border-x border-slate-300 dark:border-zinc-700'
                  : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-300/80 dark:hover:bg-zinc-800 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isActive ? 'bg-blue-600 dark:bg-blue-400' : 'bg-slate-400 dark:bg-zinc-600'}`} />
              <span className="truncate max-w-[200px]" title={file.name}>{file.name}</span>
              {onCloseFile && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCloseFile(file.id);
                  }}
                  className="ml-1 p-0.5 rounded hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-400 hover:text-red-600 transition shrink-0 cursor-pointer"
                  title={`Close ${file.name}`}
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          );
        })}

        <button
          type="button"
          onClick={onAddFile}
          className="h-4 px-1.5 flex items-center gap-1 text-[10px] font-bold rounded bg-slate-300/80 hover:bg-slate-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-slate-300 ml-1 transition shrink-0 cursor-pointer"
          title="Add another drawing to this AS9102 inspection report"
        >
          <span>+ Add Drawing</span>
        </button>
      </div>

      {/* 5. BACKSTAGE MODAL (Opens on FILE click or Alt+F) */}
      <FileBackstageModal
        isOpen={showBackstage}
        onClose={() => setShowBackstage(false)}
        document={blueprintDoc}
        projectProps={projectProps}
        characteristicsCount={effectiveCharCount}
        onNewProject={onNewProject}
        onOpenProject={onOpenProject}
        onSaveProject={onSaveProject}
        onAddFile={onAddFile}
        onLoadSample={onLoadSample}
        onExportExcel={onExportExcel}
        onExportPdf={onExportPdf}
        onCloseFile={onCloseFile}
      />
    </header>
  );
};
