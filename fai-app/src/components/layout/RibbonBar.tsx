import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { BalloonAppearance, EngineeringCharacteristic, ProjectProperties } from '../../types/characteristics';
import type { ViewportTool, BlueprintDocument } from '../../types/blueprint';
import {
  PanelLeft,
  PanelBottom,
  Sun,
  Moon,
  X,
  Settings,
  HelpCircle,
  FilePlus,
  Save,
  Undo2,
  Redo2
} from 'lucide-react';
import { RibbonTabNav, type RibbonTabId } from './ribbon/RibbonTabNav';
import { FileBackstageModal } from './ribbon/FileBackstageModal';
import { HomeRibbonTab } from './ribbon/tabs/HomeRibbonTab';
import { ProjectSettingsModal, type SettingsTab } from '../modals/ProjectSettingsModal';
import { QuickStartModal } from '../modals/QuickStartModal';
import { DEFAULT_PROJECT_SETTINGS } from '../../types/settings';

export interface ProjectFileTab {
  id: string;
  name: string;
  type: 'pdf' | 'dwg' | 'catpart';
  filePath?: string;
}

export interface RibbonBarProps {
  // Document actions
  onSmartExtract: (scope?: 'active' | 'all') => void;
  isExtracting: boolean;
  extractScope?: 'active' | 'all';
  onSetExtractScope?: (scope: 'active' | 'all') => void;
  onAddFile: () => void;
  onSaveProject?: () => void;
  onOpenProject?: () => void;
  onExportExcel?: () => void;
  onExportPdf?: () => void;
  onRenumberAll?: () => void;
  onRepositionBalloons?: () => void;
  onLoadSample?: () => void;
  onNewProject?: () => void;

  // Quick Access Undo / Redo
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;

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

  // Top Action: Run Inspection
  onRunInspection?: () => void;
  isInspecting?: boolean;
  hasInspectionResults?: boolean;

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
  onUpdateProjectProps?: (props: ProjectProperties) => void;
  onSelectFormTab?: (form: 'form1' | 'form2' | 'form3') => void;
  tableFilter?: 'all' | 'critical' | 'review';
  onSetTableFilter?: (filter: 'all' | 'critical' | 'review') => void;

  // Project Settings Subsystem
  settings?: import('../../types/settings').ProjectSettings;
  onUpdateSettings?: (settings: import('../../types/settings').ProjectSettings) => void;

  // CAD Dark Mode Theme
  isDarkMode?: boolean;
  onToggleDarkMode?: () => void;

  // In-App Help Tab (LOONIST is fully offline)
  onOpenHelp?: () => void;
}

export const RibbonBar: React.FC<RibbonBarProps> = ({
  onSmartExtract,
  isExtracting,
  extractScope = 'active',
  onSetExtractScope,
  onRunInspection,
  isInspecting = false,
  hasInspectionResults = false,
  onAddFile,
  onSaveProject,
  onOpenProject,
  onExportExcel,
  onExportPdf,
  onRenumberAll,
  onRepositionBalloons,
  onLoadSample,
  onNewProject,
  onOpenHelp,
  onRotateClockwise,
  onRotateCounterClockwise,
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
  characteristicsCount = 0,
  characteristics = [],
  activeSheetIndex = 0,
  isDrawerOpen = false,
  onToggleDrawer,
  blueprintDoc = null,
  projectProps = {
    partName: '',
    partNumber: '',
    partRevision: '',
    drawingName: '',
    drawingNumber: '',
    drawingRevision: '',
    cageCode: '',
    lotSize: 1,
    samplingLevel: 'II',
    samplingType: 'NORMAL',
    aql: '1.0'
  },
  onUpdateProjectProps,
  tableFilter = 'all',
  onSetTableFilter,
  settings,
  onUpdateSettings,
  isDarkMode = false,
  onToggleDarkMode,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false
}) => {
  const [activeTab, setActiveTab] = useState<RibbonTabId>('home');
  const [isRibbonCollapsed, setIsRibbonCollapsed] = useState(false);
  const [showBackstage, setShowBackstage] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [settingsModalInitialTab, setSettingsModalInitialTab] = useState<SettingsTab>('tolerances');

  const handleOpenSettingsModal = useCallback((tab: SettingsTab = 'tolerances') => {
    setSettingsModalInitialTab(tab);
    setIsSettingsModalOpen(true);
  }, []);

  // Global Shortcut: Ctrl+, or Cmd+, opens Settings (first tab: Blueprint & Tolerances)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === ',') {
        e.preventDefault();
        handleOpenSettingsModal('tolerances');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleOpenSettingsModal]);
  
  // Windows System Menu & Window Controls State
  const [isLogoMenuOpen, setIsLogoMenuOpen] = useState(false);
  const [isWindowMaximized, setIsWindowMaximized] = useState(false);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
  const logoMenuRef = useRef<HTMLDivElement>(null);

  // Opens the in-app Help modal (LOONIST is fully offline; no external site is used)
  const handleOpenHelp = useCallback(() => {
    if (onOpenHelp) {
      onOpenHelp();
      return;
    }
    setIsHelpModalOpen(true);
  }, [onOpenHelp]);

  // Close Logo System Menu on outside click
  useEffect(() => {
    if (!isLogoMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (logoMenuRef.current && !logoMenuRef.current.contains(e.target as Node)) {
        setIsLogoMenuOpen(false);
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, [isLogoMenuOpen]);

  // Query initial window maximized state & subscribe to resize
  useEffect(() => {
    const checkMaximized = async () => {
      if (window.api?.isWindowMaximized) {
        try {
          const res = await window.api.isWindowMaximized();
          setIsWindowMaximized(Boolean(res?.isMaximized));
          return;
        } catch {
          // fallback
        }
      }
      const isMax = Boolean(document.fullscreenElement) ||
        (window.outerWidth >= screen.availWidth - 10 && window.outerHeight >= screen.availHeight - 20);
      setIsWindowMaximized(isMax);
    };

    void checkMaximized();
    window.addEventListener('resize', checkMaximized);
    return () => window.removeEventListener('resize', checkMaximized);
  }, []);

  // Global hotkeys (F1 to open Help website, Esc to close system menu)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F1') {
        e.preventDefault();
        handleOpenHelp();
      } else if (e.key === 'Escape') {
        setIsLogoMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleOpenHelp]);

  // Windows System Menu actions (IPC with browser fallback)
  const handleRestoreWindow = async () => {
    setIsLogoMenuOpen(false);
    if (window.api?.restoreWindow) {
      try {
        await window.api.restoreWindow();
        setIsWindowMaximized(false);
        return;
      } catch (e) {
        console.warn('Failed to restore window via IPC:', e);
      }
    }
    if (document.fullscreenElement) {
      try {
        await document.exitFullscreen();
      } catch {}
    }
    setIsWindowMaximized(false);
  };

  const handleMinimizeWindow = async () => {
    setIsLogoMenuOpen(false);
    if (window.api?.minimizeWindow) {
      try {
        await window.api.minimizeWindow();
        return;
      } catch (e) {
        console.warn('Failed to minimize window via IPC:', e);
      }
    }
  };

  const handleMaximizeWindow = async () => {
    setIsLogoMenuOpen(false);
    if (window.api?.maximizeWindow) {
      try {
        const res = await window.api.maximizeWindow();
        setIsWindowMaximized(Boolean(res?.isMaximized));
        return;
      } catch (e) {
        console.warn('Failed to maximize window via IPC:', e);
      }
    }
    if (!document.fullscreenElement) {
      try {
        await document.documentElement.requestFullscreen();
      } catch {}
    }
    setIsWindowMaximized(true);
  };

  const handleCloseWindow = async () => {
    setIsLogoMenuOpen(false);
    if (window.api?.closeWindow) {
      try {
        await window.api.closeWindow();
        return;
      } catch (e) {
        console.warn('Failed to close window via IPC:', e);
      }
    }
    window.close();
  };

  const handleLogoDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsLogoMenuOpen(false);
    void handleCloseWindow();
  };

  const hasDrawing = Boolean(blueprintDoc);
  const effectiveCharCount = characteristicsCount || characteristics.length;

  return (
    <header className="flex flex-col w-full bg-slate-100 border-b border-slate-300 select-none text-slate-800 text-xs shadow-xs z-30">
      {/* 1. TOP APPLICATION BAR WITH QUICK ACCESS TOOLBAR & TITLE (Height: 30px) */}
      <div className="h-7 bg-slate-100 text-slate-700 px-2 flex items-center justify-between border-b border-slate-200">
        {/* Left: System Menu Logo & Quick Access Toolbar */}
        <div className="flex items-center gap-1.5">
          {/* Logo Button & System Menu Dropdown */}
          <div className="relative" ref={logoMenuRef}>
            <button
              type="button"
              onClick={() => setIsLogoMenuOpen((prev) => !prev)}
              onDoubleClick={handleLogoDoubleClick}
              title="LOONIST System Menu (Click to open, double-click to close)"
              className="flex items-center justify-center w-5 h-5 rounded-[3px] transition cursor-pointer shadow-xs"
              style={{ backgroundColor: '#008ba3', color: '#ffffff' }}
            >
              {/* Cyan Hexagon with CAD Glyphs matching user specification */}
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2l8.5 5v10L12 22l-8.5-5V7L12 2zm0 2.4L5.5 8.2v7.6L12 19.6l6.5-3.8V8.2L12 4.4z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </button>

            {/* Native Windows CAD System Menu Dropdown */}
            {isLogoMenuOpen && (
              <div
                className="absolute top-full left-0 mt-1 bg-white border border-slate-300 shadow-xl rounded-[2px] py-1 text-[12px] font-normal z-50 select-none animate-in fade-in zoom-in-95 duration-75"
                style={{ width: '190px', minWidth: '190px', fontFamily: 'Segoe UI, -apple-system, BlinkMacSystemFont, Roboto, sans-serif' }}
              >
                {/* 1. Restore */}
                <button
                  type="button"
                  disabled={!isWindowMaximized}
                  onClick={handleRestoreWindow}
                  className={`w-full px-3 py-1 flex items-center gap-2.5 text-left transition-colors ${
                    isWindowMaximized
                      ? 'text-slate-900 hover:bg-[#0078d4] hover:text-white cursor-pointer'
                      : 'text-slate-400 cursor-default'
                  }`}
                >
                  <span className="w-4 h-4 flex items-center justify-center shrink-0">
                    <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M4.5 4.5V2.5h8v8h-2m-6 3h8v-8h-8v8z" />
                    </svg>
                  </span>
                  <span>Restore</span>
                </button>

                {/* 2. Move (Disabled) */}
                <div className="w-full px-3 py-1 flex items-center gap-2.5 text-left text-slate-400 cursor-default">
                  <span className="w-4 h-4 shrink-0" />
                  <span>Move</span>
                </div>

                {/* 3. Size (Disabled) */}
                <div className="w-full px-3 py-1 flex items-center gap-2.5 text-left text-slate-400 cursor-default">
                  <span className="w-4 h-4 shrink-0" />
                  <span>Size</span>
                </div>

                {/* 4. Minimize */}
                <button
                  type="button"
                  onClick={handleMinimizeWindow}
                  className="w-full px-3 py-1 flex items-center gap-2.5 text-left text-slate-900 hover:bg-[#0078d4] hover:text-white transition-colors cursor-pointer"
                >
                  <span className="w-4 h-4 flex items-center justify-center shrink-0">
                    <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
                      <rect x="3" y="7.5" width="10" height="1.5" />
                    </svg>
                  </span>
                  <span>Minimize</span>
                </button>

                {/* 5. Maximize */}
                <button
                  type="button"
                  disabled={isWindowMaximized}
                  onClick={handleMaximizeWindow}
                  className={`w-full px-3 py-1 flex items-center gap-2.5 text-left transition-colors ${
                    !isWindowMaximized
                      ? 'text-slate-900 hover:bg-[#0078d4] hover:text-white cursor-pointer'
                      : 'text-slate-400 cursor-default'
                  }`}
                >
                  <span className="w-4 h-4 flex items-center justify-center shrink-0">
                    <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <rect x="2.5" y="2.5" width="11" height="11" />
                    </svg>
                  </span>
                  <span>Maximize</span>
                </button>

                {/* Separator line */}
                <div className="my-1 border-t border-slate-200" />

                {/* 6. Close */}
                <button
                  type="button"
                  onClick={handleCloseWindow}
                  className="w-full px-3 py-1 flex items-center justify-between text-left text-slate-900 hover:bg-[#0078d4] hover:text-white transition-colors cursor-pointer group"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="w-4 h-4 flex items-center justify-center shrink-0">
                      <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                        <path d="M4 4l8 8M12 4l-8 8" />
                      </svg>
                    </span>
                    <span className="font-bold">Close</span>
                  </div>
                  <span className="font-bold text-[11px] ml-auto pl-4">Alt+F4</span>
                </button>
              </div>
            )}
          </div>

          {/* Quick Access Toolbar */}
          <div className="flex items-center gap-0.5 ml-0.5">
            {/* New Project */}
            <button
              type="button"
              onClick={onNewProject}
              className="p-1 rounded text-slate-600 hover:text-slate-900 hover:bg-slate-200 transition cursor-pointer"
              title="New Project (Ctrl+N)"
            >
              <FilePlus className="w-3.5 h-3.5 text-blue-600" />
            </button>

            {/* Save Project */}
            <button
              type="button"
              onClick={onSaveProject}
              className="p-1 rounded text-slate-600 hover:text-slate-900 hover:bg-slate-200 transition cursor-pointer"
              title="Save Project (Ctrl+S)"
            >
              <Save className="w-3.5 h-3.5 text-slate-700" />
            </button>

            {/* Undo */}
            <button
              type="button"
              disabled={!canUndo}
              onClick={onUndo}
              className={`p-1 rounded transition ${
                canUndo
                  ? 'text-blue-600 hover:bg-slate-200 cursor-pointer'
                  : 'text-slate-400 cursor-default opacity-40'
              }`}
              title="Undo (Ctrl+Z)"
            >
              <Undo2 className="w-3.5 h-3.5" />
            </button>

            {/* Redo */}
            <button
              type="button"
              disabled={!canRedo}
              onClick={onRedo}
              className={`p-1 rounded transition ${
                canRedo
                  ? 'text-blue-600 hover:bg-slate-200 cursor-pointer'
                  : 'text-slate-400 cursor-default opacity-40'
              }`}
              title="Redo (Ctrl+Y)"
            >
              <Redo2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Right: Window Controls */}
        <div className="flex items-center gap-3">
          {/* Panel Layout Controls & Dark Mode Switch */}
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={onToggleLeftPanel}
              className={`p-1 rounded transition cursor-pointer ${isLeftPanelOpen
                  ? 'text-slate-900 bg-slate-200'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200'
                }`}
              title={isLeftPanelOpen ? 'Collapse Left Side Panel' : 'Expand Left Side Panel'}
            >
              <PanelLeft className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={onToggleBottomPanel}
              className={`p-1 rounded transition cursor-pointer ${isBottomPanelOpen
                  ? 'text-slate-900 bg-slate-200'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200'
                }`}
              title={isBottomPanelOpen ? 'Collapse Bottom Table' : 'Expand Bottom Table'}
            >
              <PanelBottom className="w-3.5 h-3.5" />
            </button>

            {/* Dark Mode Switch in place of third icon */}
            <button
              type="button"
              onClick={onToggleDarkMode}
              className="p-1 rounded text-slate-500 hover:text-slate-800 hover:bg-slate-200 transition cursor-pointer"
              title={isDarkMode ? 'Switch to CAD Light Mode' : 'Switch to CAD Dark Charcoal Mode'}
            >
              {isDarkMode ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5" />}
            </button>

            {/* Settings Dialog Toggle */}
            <button
              type="button"
              onClick={() => handleOpenSettingsModal('tolerances')}
              className="p-1 rounded text-slate-500 hover:text-slate-800 hover:bg-slate-200 transition cursor-pointer"
              title="Project Settings & Tolerances (Ctrl+,)"
            >
              <Settings className="w-3.5 h-3.5" />
            </button>

            {/* Help / Documentation Website Button */}
            <button
              type="button"
              onClick={handleOpenHelp}
              className="p-1 rounded text-slate-500 hover:text-slate-800 hover:bg-slate-200 transition cursor-pointer"
              title="Help & Documentation [F1]"
            >
              <HelpCircle className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* 2. COMPACT APPLICATION NAVIGATION TABS (Height: 28px) */}
      <RibbonTabNav
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onOpenFileMenu={() => setShowBackstage(true)}
        isFileMenuOpen={showBackstage}
        isRibbonCollapsed={isRibbonCollapsed}
        onToggleCollapse={() => setIsRibbonCollapsed((prev) => !prev)}
      />

      {/* 3. CONTEXTUAL COMMAND STRIP (Height: 70px) - Hidden when ribbon is collapsed */}
      {!isRibbonCollapsed && (
        <div className="h-[70px] bg-white px-2 flex items-center border-b border-slate-300 overflow-x-auto select-none shadow-2xs">
          {activeTab === 'home' && (
            <HomeRibbonTab
              hasDrawing={hasDrawing}
              onSmartExtract={onSmartExtract}
              isExtracting={isExtracting}
              extractScope={extractScope}
              onSetExtractScope={onSetExtractScope}
              activeSheetIndex={activeSheetIndex}
              totalSheetsCount={blueprintDoc?.sheets.length || 1}
              onRunInspection={onRunInspection}
              isInspecting={isInspecting}
              hasInspectionResults={hasInspectionResults}
              characteristicsCount={effectiveCharCount}
              characteristics={characteristics}
              activeFilter={tableFilter}
              onSetTableFilter={onSetTableFilter}
              isDrawerOpen={isDrawerOpen}
              onToggleDrawer={onToggleDrawer}
              balloonAppearance={balloonAppearance}
              onUpdateBalloonAppearance={onUpdateBalloonAppearance}
              onRotateClockwise={onRotateClockwise}
              onRotateCounterClockwise={onRotateCounterClockwise}
              onRenumberAll={onRenumberAll}
              onRepositionBalloons={onRepositionBalloons}
              balloonsLocked={balloonsLocked}
              onToggleLockBalloons={onToggleLockBalloons}
            />
          )}
        </div>
      )}

      {/* 4. MULTI-DOCUMENT PROJECT TABS BAR (Height: 24px) - Rendered when files are loaded */}
      {projectFiles.length > 0 && (
        <div className="h-6 bg-slate-200/80 px-2 flex items-center gap-1 border-b border-slate-300 overflow-x-auto select-none no-scrollbar">
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
                className={`group relative h-5 px-2.5 flex items-center gap-1.5 text-[11px] rounded-t font-mono cursor-pointer transition select-none shrink-0 ${isActive
                    ? 'bg-white text-slate-900 font-bold shadow-2xs border-t border-x border-slate-300'
                    : 'text-slate-600 hover:bg-slate-300/80 hover:text-slate-900'
                  }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isActive ? 'bg-slate-900' : 'bg-slate-400'}`} />
                <span className="truncate max-w-[200px]" title={file.name}>{file.name}</span>
                {onCloseFile && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onCloseFile(file.id);
                    }}
                    className="ml-1 p-0.5 rounded hover:bg-slate-200 text-slate-400 hover:text-red-600 transition shrink-0 cursor-pointer"
                    title={`Close ${file.name}`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 5. BACKSTAGE MODAL (Opens on FILE click or Alt+F) */}
      <FileBackstageModal
        isOpen={showBackstage}
        onClose={() => setShowBackstage(false)}
        document={blueprintDoc}
        projectProps={projectProps}
        onUpdateProjectProps={onUpdateProjectProps}
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

      {/* 6. PROJECT SETTINGS & OPTIONS MODAL */}
      <ProjectSettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        settings={settings || DEFAULT_PROJECT_SETTINGS}
        onUpdateSettings={onUpdateSettings || (() => {})}
        initialTab={settingsModalInitialTab}
      />

      {/* 7. QUICK START / HELP MODAL */}
      <QuickStartModal
        isOpen={isHelpModalOpen}
        onClose={() => setIsHelpModalOpen(false)}
        onLoadSample={onLoadSample}
      />
    </header>
  );
};
