import React from 'react';
import { 
  PanelLeft, 
  PanelBottom, 
  Maximize2, 
  RotateCcw, 
  Sun, 
  Moon, 
  ZoomIn, 
  ZoomOut
} from 'lucide-react';
import { RibbonGroup } from '../RibbonGroup';
import { RibbonButton } from '../RibbonButton';

interface ViewRibbonTabProps {
  isLeftPanelOpen?: boolean;
  isBottomPanelOpen?: boolean;
  onToggleLeftPanel?: () => void;
  onToggleBottomPanel?: () => void;
  onToggleFullDrawing?: () => void;
  onToggleMaximizeLeft?: () => void;
  onToggleMaximizeBottom?: () => void;
  onResetLayout?: () => void;
  isDarkMode?: boolean;
  onToggleDarkMode?: () => void;
  onFitPage?: () => void;
  onFitWidth?: () => void;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  hasDrawing?: boolean;
}

export const ViewRibbonTab: React.FC<ViewRibbonTabProps> = ({
  isLeftPanelOpen = true,
  isBottomPanelOpen = true,
  onToggleLeftPanel,
  onToggleBottomPanel,
  onToggleFullDrawing,
  onToggleMaximizeLeft,
  onToggleMaximizeBottom,
  onResetLayout,
  isDarkMode = false,
  onToggleDarkMode,
  onFitPage,
  onFitWidth,
  onZoomIn,
  onZoomOut,
  hasDrawing = false
}) => {
  const isFullDrawing = !isLeftPanelOpen && !isBottomPanelOpen;

  return (
    <div className="flex items-center h-full overflow-x-auto select-none no-scrollbar">
      {/* 1. DOCKABLE PANELS */}
      <RibbonGroup title="PANELS">
        <RibbonButton
          variant="large"
          accent="blue"
          icon={<Maximize2 className="w-5 h-5" />}
          label="Full Drawing"
          subLabel="Canvas Mode"
          active={isFullDrawing}
          title="Toggle Full Drawing View (Collapse all side and bottom panels)"
          onClick={onToggleFullDrawing}
        />

        <div className="flex flex-col gap-0.5 justify-center">
          <RibbonButton
            variant="small"
            icon={<PanelLeft className="w-3.5 h-3.5" />}
            label="Left Properties Dock"
            active={isLeftPanelOpen}
            title={isLeftPanelOpen ? 'Hide Left Properties Dock' : 'Show Left Properties Dock'}
            onClick={onToggleLeftPanel}
          />
          <RibbonButton
            variant="small"
            icon={<PanelBottom className="w-3.5 h-3.5" />}
            label="Bottom Table Manager"
            active={isBottomPanelOpen}
            title={isBottomPanelOpen ? 'Hide Bottom Data Table' : 'Show Bottom Data Table'}
            onClick={onToggleBottomPanel}
          />
        </div>
      </RibbonGroup>

      {/* 2. PANEL SIZING */}
      <RibbonGroup title="LAYOUT & SIZING">
        <div className="flex flex-col gap-0.5 justify-center">
          {onToggleMaximizeLeft && (
            <RibbonButton
              variant="small"
              icon={<PanelLeft className="w-3.5 h-3.5 text-blue-600" />}
              label="Maximize Left Dock"
              disabled={!isLeftPanelOpen}
              title="Expand Left Properties Dock to inspect details"
              onClick={onToggleMaximizeLeft}
            />
          )}
          {onToggleMaximizeBottom && (
            <RibbonButton
              variant="small"
              icon={<PanelBottom className="w-3.5 h-3.5 text-blue-600" />}
              label="Maximize Table"
              disabled={!isBottomPanelOpen}
              title="Expand Bottom Characteristics Table across canvas"
              onClick={onToggleMaximizeBottom}
            />
          )}
        </div>

        {onResetLayout && (
          <div className="flex flex-col justify-center">
            <RibbonButton
              variant="small"
              icon={<RotateCcw className="w-3.5 h-3.5 text-slate-500" />}
              label="Reset Layout"
              title="Restore standard layout dimensions (320px left, 220px bottom)"
              onClick={onResetLayout}
            />
          </div>
        )}
      </RibbonGroup>

      {/* 3. ZOOM CONTROLS */}
      <RibbonGroup title="ZOOM">
        <div className="flex flex-col gap-0.5 justify-center">
          {onFitPage && (
            <RibbonButton
              variant="small"
              icon={<Maximize2 className="w-3.5 h-3.5 text-blue-600" />}
              label="Fit Page"
              disabled={!hasDrawing}
              title="Fit entire drawing page"
              onClick={onFitPage}
            />
          )}
          {onFitWidth && (
            <RibbonButton
              variant="small"
              icon={<Maximize2 className="w-3.5 h-3.5 rotate-90 text-slate-600" />}
              label="Fit Width"
              disabled={!hasDrawing}
              title="Fit drawing width"
              onClick={onFitWidth}
            />
          )}
        </div>

        <div className="flex items-center gap-1">
          {onZoomIn && (
            <RibbonButton
              variant="icon-only"
              icon={<ZoomIn className="w-3.5 h-3.5" />}
              disabled={!hasDrawing}
              title="Zoom In (Ctrl++)"
              onClick={onZoomIn}
            />
          )}
          {onZoomOut && (
            <RibbonButton
              variant="icon-only"
              icon={<ZoomOut className="w-3.5 h-3.5" />}
              disabled={!hasDrawing}
              title="Zoom Out (Ctrl+-)"
              onClick={onZoomOut}
            />
          )}
        </div>
      </RibbonGroup>

      {/* 4. CAD THEME */}
      <RibbonGroup title="CAD THEME" noSeparator>
        <RibbonButton
          variant="large"
          icon={isDarkMode ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5 text-slate-700" />}
          label={isDarkMode ? 'Light Mode' : 'Dark Mode'}
          subLabel={isDarkMode ? 'Standard CAD' : 'Charcoal CAD'}
          title={isDarkMode ? 'Switch to CAD Light Mode' : 'Switch to CAD Dark Charcoal Mode'}
          onClick={onToggleDarkMode}
        />
      </RibbonGroup>
    </div>
  );
};
