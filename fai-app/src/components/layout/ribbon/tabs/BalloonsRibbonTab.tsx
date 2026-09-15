import React from 'react';
import { 
  Sparkles, 
  Crop, 
  SlidersHorizontal, 
  Circle, 
  Triangle, 
  Hexagon, 
  Square, 
  ListOrdered, 
  RefreshCw, 
  Lock, 
  Unlock, 
  Trash2, 
  Tag
} from 'lucide-react';
import { RibbonGroup } from '../RibbonGroup';
import { RibbonButton } from '../RibbonButton';
import type { ViewportTool } from '../../../../types/blueprint';
import type { BalloonAppearance, EngineeringCharacteristic } from '../../../../types/characteristics';

interface BalloonsRibbonTabProps {
  hasDrawing: boolean;
  onSmartExtract: () => void;
  isExtracting: boolean;
  activeTool: ViewportTool;
  onToolChange: (tool: ViewportTool) => void;
  characteristicsCount: number;
  isDrawerOpen?: boolean;
  onToggleDrawer?: () => void;
  balloonAppearance: BalloonAppearance;
  onUpdateBalloonAppearance: (appearance: BalloonAppearance) => void;
  balloonsLocked: boolean;
  onToggleLockBalloons: () => void;
  onRenumberAll?: () => void;
  onRepositionBalloons?: () => void;
  selectedCharId: string | null;
  selectedChar: EngineeringCharacteristic | null;
  onDeleteCharacteristic?: (id: string) => void;
}

const BALLOON_COLORS = [
  { name: 'blue', hex: '#2563eb', label: 'Blue' },
  { name: 'green', hex: '#059669', label: 'Green' },
  { name: 'amber', hex: '#d97706', label: 'Amber' },
  { name: 'red', hex: '#dc2626', label: 'Red' },
  { name: 'black', hex: '#0f172a', label: 'Black' }
];

export const BalloonsRibbonTab: React.FC<BalloonsRibbonTabProps> = ({
  hasDrawing,
  onSmartExtract,
  isExtracting,
  activeTool,
  onToolChange,
  characteristicsCount,
  isDrawerOpen = false,
  onToggleDrawer,
  balloonAppearance,
  onUpdateBalloonAppearance,
  balloonsLocked,
  onToggleLockBalloons,
  onRenumberAll,
  onRepositionBalloons,
  selectedChar,
  onDeleteCharacteristic
}) => {
  return (
    <div className="flex items-center h-full overflow-x-auto select-none no-scrollbar">
      {/* 1. EXTRACTION & CAPTURE */}
      <RibbonGroup title="DETECTION & OCR">
        <RibbonButton
          variant="large"
          accent="blue"
          icon={
            <Sparkles className={`w-5 h-5 text-amber-500 dark:text-amber-400 ${isExtracting ? 'animate-spin' : ''}`} />
          }
          label={isExtracting ? 'Extracting...' : 'Smart Extract'}
          subLabel="Local AI"
          disabled={!hasDrawing || isExtracting}
          title="Run Local AI Vision: detect and balloon all dimensions, GD&T, and notes"
          onClick={onSmartExtract}
        />

        <div className="flex flex-col gap-0.5 justify-center">
          <RibbonButton
            variant="small"
            icon={<Crop className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />}
            label="Marquee OCR"
            active={activeTool === 'box-capture'}
            disabled={!hasDrawing}
            title="Drag marquee box to OCR balloon a single feature"
            onClick={() => onToolChange('box-capture')}
          />
          {onToggleDrawer && (
            <RibbonButton
              variant="small"
              icon={<SlidersHorizontal className="w-3.5 h-3.5 text-blue-600" />}
              label={`Review (${characteristicsCount})`}
              active={isDrawerOpen}
              disabled={characteristicsCount === 0}
              title="Open Review Drawer"
              onClick={onToggleDrawer}
            />
          )}
        </div>
      </RibbonGroup>

      {/* 2. BALLOON SHAPES */}
      <RibbonGroup title="SHAPES">
        <div className="grid grid-cols-2 gap-1 p-0.5 justify-center">
          <button
            type="button"
            onClick={() => onUpdateBalloonAppearance({ ...balloonAppearance, shape: 'circle' })}
            title="Circle: Standard Dimensions"
            className={`flex items-center gap-1.5 px-2 py-1 rounded text-left transition cursor-pointer text-xs ${
              balloonAppearance.shape === 'circle'
                ? 'bg-blue-50 dark:bg-zinc-700 text-blue-700 dark:text-blue-300 font-bold border border-blue-300 dark:border-zinc-600 shadow-2xs'
                : 'text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800'
            }`}
          >
            <Circle className="w-3.5 h-3.5 text-blue-600" />
            <span className="text-[10px]">Circle</span>
          </button>

          <button
            type="button"
            onClick={() => onUpdateBalloonAppearance({ ...balloonAppearance, shape: 'triangle' })}
            title="Triangle: Flag Note / Special Requirement"
            className={`flex items-center gap-1.5 px-2 py-1 rounded text-left transition cursor-pointer text-xs ${
              balloonAppearance.shape === 'triangle'
                ? 'bg-amber-50 dark:bg-zinc-700 text-amber-700 dark:text-amber-300 font-bold border border-amber-300 dark:border-zinc-600 shadow-2xs'
                : 'text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800'
            }`}
          >
            <Triangle className="w-3.5 h-3.5 text-amber-600" />
            <span className="text-[10px]">Triangle</span>
          </button>

          <button
            type="button"
            onClick={() => onUpdateBalloonAppearance({ ...balloonAppearance, shape: 'hexagon' })}
            title="Hexagon: Critical GD&T Feature Control Frame"
            className={`flex items-center gap-1.5 px-2 py-1 rounded text-left transition cursor-pointer text-xs ${
              balloonAppearance.shape === 'hexagon'
                ? 'bg-red-50 dark:bg-zinc-700 text-red-700 dark:text-red-300 font-bold border border-red-300 dark:border-zinc-600 shadow-2xs'
                : 'text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800'
            }`}
          >
            <Hexagon className="w-3.5 h-3.5 text-red-600" />
            <span className="text-[10px]">Hexagon</span>
          </button>

          <button
            type="button"
            onClick={() => onUpdateBalloonAppearance({ ...balloonAppearance, shape: 'square' })}
            title="Square: Basic Dimension (Theoretically Exact)"
            className={`flex items-center gap-1.5 px-2 py-1 rounded text-left transition cursor-pointer text-xs ${
              balloonAppearance.shape === 'square'
                ? 'bg-purple-50 dark:bg-zinc-700 text-purple-700 dark:text-purple-300 font-bold border border-purple-300 dark:border-zinc-600 shadow-2xs'
                : 'text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800'
            }`}
          >
            <Square className="w-3.5 h-3.5 text-purple-600" />
            <span className="text-[10px]">Square</span>
          </button>
        </div>
      </RibbonGroup>

      {/* 3. COLOR & FIT */}
      <RibbonGroup title="COLOR & FIT">
        <div className="flex flex-col gap-1 justify-center">
          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-zinc-800 p-1 rounded border border-slate-200 dark:border-zinc-700">
            {BALLOON_COLORS.map((c) => (
              <button
                key={c.name}
                type="button"
                onClick={() => onUpdateBalloonAppearance({ ...balloonAppearance, color: c.name })}
                title={c.label}
                style={{ backgroundColor: c.hex }}
                className={`w-3.5 h-3.5 rounded-full transition-transform cursor-pointer ${
                  balloonAppearance.color === c.name
                    ? 'ring-2 ring-offset-1 ring-slate-700 dark:ring-white scale-110'
                    : 'opacity-70 hover:opacity-100 hover:scale-105'
                }`}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            <select
              value={balloonAppearance.fit}
              onChange={(e) => onUpdateBalloonAppearance({ ...balloonAppearance, fit: Number(e.target.value) })}
              className="text-[10px] bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded px-1.5 py-0.5 text-slate-700 dark:text-slate-200 cursor-pointer"
            >
              <option value={1}>Tight Fit</option>
              <option value={2}>Standard Fit</option>
              <option value={3}>Relaxed Fit</option>
            </select>

            <label className="flex items-center gap-1 cursor-pointer text-[10px] text-slate-600 dark:text-zinc-300 select-none">
              <input
                type="checkbox"
                checked={balloonAppearance.showLeaderLine}
                onChange={(e) => onUpdateBalloonAppearance({ ...balloonAppearance, showLeaderLine: e.target.checked })}
                className="rounded border-slate-300 text-blue-600 w-3 h-3 cursor-pointer"
              />
              <span>Leader</span>
            </label>
          </div>
        </div>
      </RibbonGroup>

      {/* 4. PLACEMENT & ORDER */}
      <RibbonGroup title="PLACEMENT & ORDER">
        <div className="flex flex-col gap-0.5 justify-center">
          <RibbonButton
            variant="small"
            icon={<ListOrdered className="w-3.5 h-3.5 text-blue-600" />}
            label="Renumber All"
            disabled={characteristicsCount === 0}
            title="Renumber all drawing balloons sequentially (1, 2, 3...)"
            onClick={onRenumberAll}
          />
          {onRepositionBalloons && (
            <RibbonButton
              variant="small"
              icon={<RefreshCw className="w-3.5 h-3.5 text-emerald-600" />}
              label="Auto-Reposition"
              disabled={characteristicsCount === 0}
              title="Recalculate balloon coordinates avoiding callouts"
              onClick={onRepositionBalloons}
            />
          )}
        </div>

        <div className="flex flex-col justify-center">
          <RibbonButton
            variant="small"
            icon={balloonsLocked ? <Lock className="w-3.5 h-3.5 text-amber-500" /> : <Unlock className="w-3.5 h-3.5 text-slate-500" />}
            label={balloonsLocked ? 'Locked' : 'Lock Drag'}
            active={balloonsLocked}
            disabled={characteristicsCount === 0}
            title="Lock balloon positions to prevent accidental mouse dragging"
            onClick={onToggleLockBalloons}
          />
        </div>
      </RibbonGroup>

      {/* 5. SELECTED FEATURE (Context-Aware) */}
      <RibbonGroup title="SELECTED FEATURE" noSeparator>
        {selectedChar ? (
          <div className="flex items-center gap-2">
            <div className="flex flex-col justify-center bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded px-2 py-1">
              <div className="flex items-center gap-1.5 text-[10px] font-mono">
                <span className="font-bold text-blue-600 dark:text-blue-400">#{selectedChar.itemNumber}</span>
                <span className="text-slate-400">|</span>
                <span className="font-semibold text-slate-700 dark:text-slate-200 truncate max-w-[120px]" title={selectedChar.rawText}>
                  {selectedChar.cleanNominal !== null ? selectedChar.cleanNominal : selectedChar.rawText}
                </span>
              </div>
              <div className="flex items-center gap-1 text-[9px] text-slate-400 mt-0.5">
                <Tag className="w-2.5 h-2.5" />
                <span>Zone {selectedChar.drawingZone || '—'}</span>
                <span>•</span>
                <span>{selectedChar.classification}</span>
              </div>
            </div>

            {onDeleteCharacteristic && (
              <RibbonButton
                variant="small"
                icon={<Trash2 className="w-3.5 h-3.5 text-red-600" />}
                label="Delete"
                title={`Delete Characteristic #${selectedChar.itemNumber} with automatic cascade renumbering`}
                onClick={() => onDeleteCharacteristic(selectedChar.id)}
              />
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center px-3 py-2 text-[10px] text-slate-400 dark:text-zinc-500 italic">
            Click any balloon to inspect
          </div>
        )}
      </RibbonGroup>
    </div>
  );
};
