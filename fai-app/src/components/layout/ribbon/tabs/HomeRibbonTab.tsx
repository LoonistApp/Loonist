import React from 'react';
import { 
  Sparkles, 
  SlidersHorizontal, 
  Circle, 
  Triangle, 
  Hexagon, 
  Square,
  CheckCircle2,
  ShieldAlert,
  AlertTriangle
} from 'lucide-react';
import { RibbonGroup } from '../RibbonGroup';
import { RibbonButton } from '../RibbonButton';
import type { BalloonAppearance, EngineeringCharacteristic } from '../../../../types/characteristics';

interface HomeRibbonTabProps {
  hasDrawing: boolean;
  onSmartExtract: () => void;
  isExtracting: boolean;
  characteristicsCount: number;
  characteristics?: EngineeringCharacteristic[];
  activeFilter?: 'all' | 'critical' | 'review';
  onSetTableFilter?: (filter: 'all' | 'critical' | 'review') => void;
  isDrawerOpen?: boolean;
  onToggleDrawer?: () => void;
  balloonAppearance: BalloonAppearance;
  onUpdateBalloonAppearance: (appearance: BalloonAppearance) => void;
}

const BALLOON_COLORS = [
  { name: 'blue', hex: '#2563eb', label: 'Blue' },
  { name: 'green', hex: '#059669', label: 'Green' },
  { name: 'amber', hex: '#d97706', label: 'Amber' },
  { name: 'red', hex: '#dc2626', label: 'Red' },
  { name: 'black', hex: '#0f172a', label: 'Black' }
];

export const HomeRibbonTab: React.FC<HomeRibbonTabProps> = ({
  hasDrawing,
  onSmartExtract,
  isExtracting,
  characteristicsCount,
  characteristics = [],
  activeFilter = 'all',
  onSetTableFilter,
  isDrawerOpen = false,
  onToggleDrawer,
  balloonAppearance,
  onUpdateBalloonAppearance
}) => {
  const criticalCount = characteristics.filter(
    (c) => c.classification === 'Critical' || c.subType === 'GDT' || c.isCritical
  ).length;

  const needsReviewCount = characteristics.filter(
    (c) => c.verificationStatus === 'needs_review'
  ).length;

  return (
    <div className="flex items-center h-full overflow-x-auto select-none no-scrollbar">
      {/* 1. AI EXTRACTION */}
      <RibbonGroup title="AI EXTRACTION">
        <RibbonButton
          variant="large"
          accent="blue"
          icon={
            <Sparkles className={`w-5 h-5 text-amber-500 dark:text-amber-400 ${isExtracting ? 'animate-spin' : ''}`} />
          }
          label={isExtracting ? 'Extracting...' : 'Smart Extract'}
          subLabel="ASME Y14.5 AI"
          disabled={!hasDrawing || isExtracting}
          title="Automatically detect and balloon all dimensions, GD&T, and notes on this drawing"
          onClick={onSmartExtract}
        />

        {onToggleDrawer && (
          <RibbonButton
            variant="large"
            accent="blue"
            icon={<SlidersHorizontal className="w-5 h-5 text-blue-600 dark:text-blue-400" />}
            label="Inspector"
            subLabel="HITL Review"
            badge={characteristicsCount > 0 ? characteristicsCount : undefined}
            active={isDrawerOpen}
            disabled={characteristicsCount === 0}
            title="Open HITL AI Characteristics Review Drawer (Magnified 300 DPI Crop Box)"
            onClick={onToggleDrawer}
          />
        )}
      </RibbonGroup>

      {/* 2. QUALITY TRIAGE */}
      <RibbonGroup title="QUALITY TRIAGE">
        <div className="flex flex-col gap-1 justify-center">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onSetTableFilter?.('all')}
              disabled={characteristicsCount === 0}
              className={`h-6 px-2.5 rounded flex items-center gap-1.5 transition cursor-pointer text-xs font-semibold ${
                activeFilter === 'all'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-700 border border-slate-200 dark:border-zinc-700'
              } disabled:opacity-40`}
              title="Show All Inspection Characteristics"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>All</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                activeFilter === 'all' ? 'bg-blue-700 text-white' : 'bg-slate-200 dark:bg-zinc-700 text-slate-700 dark:text-zinc-300'
              }`}>
                {characteristicsCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => onSetTableFilter?.('critical')}
              disabled={characteristicsCount === 0}
              className={`h-6 px-2.5 rounded flex items-center gap-1.5 transition cursor-pointer text-xs font-semibold ${
                activeFilter === 'critical'
                  ? 'bg-red-600 text-white shadow-2xs'
                  : 'bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-700 border border-slate-200 dark:border-zinc-700'
              } disabled:opacity-40`}
              title="Filter by Key Characteristics / Critical GD&T (AS9102 Section 5.3)"
            >
              <ShieldAlert className="w-3.5 h-3.5 text-red-400" />
              <span>Critical GD&T</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                activeFilter === 'critical' ? 'bg-red-700 text-white' : 'bg-red-100 dark:bg-red-950/80 text-red-700 dark:text-red-300'
              }`}>
                {criticalCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => onSetTableFilter?.('review')}
              disabled={characteristicsCount === 0}
              className={`h-6 px-2.5 rounded flex items-center gap-1.5 transition cursor-pointer text-xs font-semibold ${
                activeFilter === 'review'
                  ? 'bg-amber-600 text-white shadow-2xs'
                  : 'bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-700 border border-slate-200 dark:border-zinc-700'
              } disabled:opacity-40`}
              title="Filter by Low-Confidence OCR / Flagged Items Needing Human Verification"
            >
              <AlertTriangle className={`w-3.5 h-3.5 ${needsReviewCount > 0 ? 'text-amber-400 animate-pulse' : 'text-slate-400'}`} />
              <span>Needs Review</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                activeFilter === 'review' 
                  ? 'bg-amber-700 text-white' 
                  : needsReviewCount > 0 
                  ? 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300' 
                  : 'bg-slate-200 dark:bg-zinc-700 text-slate-700 dark:text-zinc-300'
              }`}>
                {needsReviewCount}
              </span>
            </button>
          </div>
        </div>
      </RibbonGroup>

      {/* 3. BALLOON MARKUP */}
      <RibbonGroup title="BALLOON MARKUP" noSeparator>
        <div className="flex flex-col gap-1 justify-center">
          {/* Shape & Colors */}
          <div className="flex items-center gap-1.5">
            {/* Shapes */}
            <div className="flex items-center bg-slate-100 dark:bg-zinc-800 p-0.5 rounded border border-slate-200 dark:border-zinc-700">
              <button
                type="button"
                onClick={() => onUpdateBalloonAppearance({ ...balloonAppearance, shape: 'circle' })}
                title="Circle (Standard Dimensions)"
                className={`p-1 rounded cursor-pointer transition ${
                  balloonAppearance.shape === 'circle'
                    ? 'bg-white dark:bg-zinc-700 shadow-2xs text-blue-600 dark:text-blue-400'
                    : 'text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white'
                }`}
              >
                <Circle className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onUpdateBalloonAppearance({ ...balloonAppearance, shape: 'triangle' })}
                title="Triangle (Flag Note)"
                className={`p-1 rounded cursor-pointer transition ${
                  balloonAppearance.shape === 'triangle'
                    ? 'bg-white dark:bg-zinc-700 shadow-2xs text-amber-600 dark:text-amber-400'
                    : 'text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white'
                }`}
              >
                <Triangle className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onUpdateBalloonAppearance({ ...balloonAppearance, shape: 'hexagon' })}
                title="Hexagon (Critical GD&T)"
                className={`p-1 rounded cursor-pointer transition ${
                  balloonAppearance.shape === 'hexagon'
                    ? 'bg-white dark:bg-zinc-700 shadow-2xs text-red-600 dark:text-red-400'
                    : 'text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white'
                }`}
              >
                <Hexagon className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onUpdateBalloonAppearance({ ...balloonAppearance, shape: 'square' })}
                title="Square (Basic Dimension)"
                className={`p-1 rounded cursor-pointer transition ${
                  balloonAppearance.shape === 'square'
                    ? 'bg-white dark:bg-zinc-700 shadow-2xs text-purple-600 dark:text-purple-400'
                    : 'text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white'
                }`}
              >
                <Square className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Colors */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-zinc-800 p-1 rounded border border-slate-200 dark:border-zinc-700">
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
          </div>

          {/* Fit & Leader Line */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 text-[10px]">
              <span className="text-slate-400 dark:text-zinc-400 font-semibold">Fit:</span>
              <select
                value={balloonAppearance.fit}
                onChange={(e) => onUpdateBalloonAppearance({ ...balloonAppearance, fit: Number(e.target.value) })}
                className="text-[10px] bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded px-1.5 py-0.5 text-slate-700 dark:text-slate-200 cursor-pointer"
              >
                <option value={1}>Tight</option>
                <option value={2}>Standard</option>
                <option value={3}>Relaxed</option>
              </select>
            </div>

            <label className="flex items-center gap-1 cursor-pointer text-[10px] text-slate-600 dark:text-zinc-300 select-none">
              <input
                type="checkbox"
                checked={balloonAppearance.showLeaderLine}
                onChange={(e) => onUpdateBalloonAppearance({ ...balloonAppearance, showLeaderLine: e.target.checked })}
                className="rounded border-slate-300 text-blue-600 w-3 h-3 cursor-pointer"
              />
              <span>Leader Line</span>
            </label>
          </div>
        </div>
      </RibbonGroup>
    </div>
  );
};
