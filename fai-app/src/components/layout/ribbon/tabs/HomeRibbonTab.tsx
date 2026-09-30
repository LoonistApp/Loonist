import React from 'react';
import {
  Sparkles,
  Search,
  Circle,
  Triangle,
  Hexagon,
  Square,
  Balloon,
  RotateCw,
  RotateCcw,
  ListOrdered,
  RefreshCw,
  Lock,
  Unlock
} from 'lucide-react';
import { RibbonGroup } from '../RibbonGroup';
import { RibbonButton } from '../RibbonButton';
import type { BalloonAppearance, BalloonShape, EngineeringCharacteristic } from '../../../../types/characteristics';

interface HomeRibbonTabProps {
  hasDrawing: boolean;
  onSmartExtract: (scope?: 'active' | 'all') => void;
  isExtracting: boolean;
  extractScope?: 'active' | 'all';
  onSetExtractScope?: (scope: 'active' | 'all') => void;
  activeSheetIndex?: number;
  totalSheetsCount?: number;
  onRunInspection?: () => void;
  isInspecting?: boolean;
  hasInspectionResults?: boolean;
  characteristicsCount: number;
  characteristics?: EngineeringCharacteristic[];
  activeFilter?: 'all' | 'critical' | 'review';
  onSetTableFilter?: (filter: 'all' | 'critical' | 'review') => void;
  isDrawerOpen?: boolean;
  onToggleDrawer?: () => void;
  balloonAppearance: BalloonAppearance;
  onUpdateBalloonAppearance: (appearance: BalloonAppearance) => void;
  onRotateClockwise?: () => void;
  onRotateCounterClockwise?: () => void;
  onRenumberAll?: () => void;
  onRepositionBalloons?: () => void;
  balloonsLocked?: boolean;
  onToggleLockBalloons?: () => void;
}

const BALLOON_COLORS = [
  { name: 'blue', hex: '#2563eb', label: 'Blue' },
  { name: 'green', hex: '#059669', label: 'Green' },
  { name: 'amber', hex: '#d97706', label: 'Amber' },
  { name: 'red', hex: '#dc2626', label: 'Red' },
  { name: 'black', hex: '#0f172a', label: 'Black' }
];

const BALLOON_SHAPES: Array<{
  id: BalloonShape;
  label: string;
  Icon: React.ComponentType<{
    className?: string;
    fill?: string;
    fillOpacity?: number;
    stroke?: string;
    style?: React.CSSProperties;
  }>;
}> = [
    { id: 'balloon', label: 'Balloon (Inspection Marker)', Icon: Balloon },
    { id: 'circle', label: 'Circle (Standard Dimensions)', Icon: Circle },
    { id: 'triangle', label: 'Triangle (Flag Note)', Icon: Triangle },
    { id: 'hexagon', label: 'Hexagon (Critical GD&T)', Icon: Hexagon },
    { id: 'square', label: 'Square (Basic Dimension)', Icon: Square }
  ];

export const HomeRibbonTab: React.FC<HomeRibbonTabProps> = ({
  hasDrawing,
  onSmartExtract,
  isExtracting,
  extractScope = 'active',
  activeSheetIndex: _activeSheetIndex = 0,
  totalSheetsCount: _totalSheetsCount = 1,
  onRunInspection,
  isInspecting = false,
  hasInspectionResults = false,
  characteristicsCount = 0,
  balloonAppearance,
  onUpdateBalloonAppearance,
  onRotateClockwise,
  onRotateCounterClockwise,
  onRenumberAll,
  onRepositionBalloons,
  balloonsLocked = false,
  onToggleLockBalloons
}) => {
  const activeColorObj = BALLOON_COLORS.find((c) => c.name === balloonAppearance.color) || BALLOON_COLORS[0];
  const isBlack = balloonAppearance.color === 'black';
  const activeColorHex = activeColorObj.hex;

  return (
    <div className="flex items-center h-full overflow-x-auto select-none no-scrollbar">
      {/* 1. DRAWING ANALYSIS */}
      <RibbonGroup title="DRAWING ANALYSIS">
        <RibbonButton
          variant="large"
          icon={
            <Sparkles className="w-5 h-5 text-slate-700" />
          }
          label={isExtracting ? 'Extracting...' : 'Auto Extract'}
          disabled={!hasDrawing || isExtracting}
          title="Auto Extract: automatically detect and balloon all dimensions, GD&T, and notes as per ASME standards"
          onClick={() => onSmartExtract(extractScope)}
          style={{ width: '84px', minWidth: '84px' }}
        />

        {onRunInspection && (
          <div className="ribbon-divider" />
        )}

        {onRunInspection && (
          <RibbonButton
            variant="large"
            icon={
              <Search className="w-5 h-5 text-slate-700" />
            }
            label={isInspecting ? 'Inspecting...' : 'Inspect'}
            disabled={!hasDrawing || isInspecting}
            title={
              hasInspectionResults
                ? "Refresh inspection analysis and update existing results"
                : "Run drawing inspection analysis and generate results"
            }
            onClick={onRunInspection}
            style={{ width: '92px', minWidth: '92px' }}
          />
        )}
      </RibbonGroup>

      {/* 2. BALLOON MARKUP */}
      <RibbonGroup title="BALLOON MARKUP">
        <div className="flex flex-col gap-1 justify-center">
          {/* Shape & Colors */}
          <div className="flex items-center gap-1.5">
            {/* Shapes */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded border border-slate-200">
              {BALLOON_SHAPES.map((s) => {
                const isSelected = balloonAppearance.shape === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => onUpdateBalloonAppearance({ ...balloonAppearance, shape: s.id })}
                    title={s.label}
                    className={`p-1 rounded cursor-pointer transition flex items-center justify-center ${isSelected
                        ? 'bg-white shadow-2xs'
                        : 'hover:bg-slate-200/60'
                      }`}
                  >
                    <s.Icon
                      className={`w-3.5 h-3.5 transition-all ${isSelected
                          ? `scale-105 ${isBlack ? 'text-slate-900' : ''}`
                          : 'text-slate-600 opacity-80 hover:opacity-100'
                        }`}
                      fill={isSelected ? (isBlack ? 'currentColor' : activeColorHex) : 'none'}
                      fillOpacity={isSelected ? 0.25 : 0}
                      stroke={isSelected ? (isBlack ? 'currentColor' : activeColorHex) : 'currentColor'}
                      style={
                        isSelected && !isBlack
                          ? {
                            color: activeColorHex,
                            stroke: activeColorHex
                          }
                          : undefined
                      }
                    />
                  </button>
                );
              })}
            </div>

            {/* Colors */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded border border-slate-200">
              {BALLOON_COLORS.map((c) => (
                <button
                  key={c.name}
                  type="button"
                  onClick={() => onUpdateBalloonAppearance({ ...balloonAppearance, color: c.name })}
                  title={c.label}
                  style={{ backgroundColor: c.hex }}
                  className={`w-3.5 h-3.5 rounded-full transition-transform cursor-pointer border ${c.name === 'black'
                      ? 'border-slate-400 shadow-2xs'
                      : 'border-black/15'
                    } ${balloonAppearance.color === c.name
                      ? 'ring-2 ring-offset-1 ring-slate-700 scale-110'
                      : 'opacity-90 hover:opacity-100 hover:scale-105'
                    }`}
                />
              ))}
            </div>
          </div>

          {/* Fit & Leader Line */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 text-[10px]">
              <span className="text-slate-400 font-semibold">Fit:</span>
              <select
                value={balloonAppearance.fit}
                onChange={(e) => onUpdateBalloonAppearance({ ...balloonAppearance, fit: Number(e.target.value) })}
                className="text-[10px] bg-white border border-slate-200 rounded px-1.5 py-0.5 text-slate-700 cursor-pointer"
              >
                <option value={1}>Tight</option>
                <option value={2}>Standard</option>
                <option value={3}>Relaxed</option>
              </select>
            </div>

            <label className="flex items-center gap-1 cursor-pointer text-[10px] text-slate-600 select-none">
              <input
                type="checkbox"
                checked={balloonAppearance.showLeaderLine}
                onChange={(e) => onUpdateBalloonAppearance({ ...balloonAppearance, showLeaderLine: e.target.checked })}
                className="rounded border-slate-300 accent-slate-700 text-slate-700 w-3 h-3 cursor-pointer"
              />
              <span>Leader Line</span>
            </label>
          </div>
        </div>
      </RibbonGroup>

      {/* 3. ORIENTATION */}
      <RibbonGroup title="ORIENTATION">
        <div className="flex flex-col gap-0.5 justify-center">
          <RibbonButton
            variant="small"
            icon={<RotateCw className="w-3.5 h-3.5 text-slate-700" />}
            label="Rotate 90° CW"
            hotkey="R"
            disabled={!hasDrawing}
            title="Rotate Drawing 90° Clockwise"
            onClick={onRotateClockwise}
          />
          {onRotateCounterClockwise && (
            <RibbonButton
              variant="small"
              icon={<RotateCcw className="w-3.5 h-3.5 text-slate-700" />}
              label="Rotate 90° CCW"
              disabled={!hasDrawing}
              title="Rotate Drawing 90° Counter-Clockwise"
              onClick={onRotateCounterClockwise}
            />
          )}
        </div>
      </RibbonGroup>

      {/* 4. PLACEMENT & ORDER */}
      <RibbonGroup title="PLACEMENT & ORDER" noSeparator>
        {onRenumberAll && (
          <RibbonButton
            variant="large"
            icon={<ListOrdered className="w-5 h-5 text-slate-700" />}
            label="Renumber"
            subLabel="Sequential"
            disabled={characteristicsCount === 0}
            title="Renumber all drawing balloons sequentially (1, 2, 3...)"
            onClick={onRenumberAll}
            style={{ width: '80px', minWidth: '80px' }}
          />
        )}

        <div className="ribbon-divider" />

        <div className="flex flex-col gap-0.5 justify-center">
          {onRepositionBalloons && (
            <RibbonButton
              variant="small"
              icon={<RefreshCw className="w-3.5 h-3.5 text-slate-500" />}
              label="Auto Reposition"
              disabled={characteristicsCount === 0}
              title="Recalculate balloon coordinates avoiding callouts"
              onClick={onRepositionBalloons}
            />
          )}

          {onToggleLockBalloons && (
            <RibbonButton
              variant="small"
              icon={balloonsLocked ? <Lock className="w-3.5 h-3.5 text-amber-500" /> : <Unlock className="w-3.5 h-3.5 text-slate-500" />}
              label={balloonsLocked ? 'Locked' : 'Lock Drag'}
              active={balloonsLocked}
              accent="amber"
              disabled={characteristicsCount === 0}
              title="Lock balloon positions to prevent accidental mouse dragging"
              onClick={onToggleLockBalloons}
            />
          )}
        </div>
      </RibbonGroup>
    </div>
  );
};
