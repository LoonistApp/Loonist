import { ShieldCheck } from 'lucide-react';
import { RibbonGroup } from '../RibbonGroup';
import { DEFAULT_AEROSPACE_TOLERANCES } from '../../../../types/characteristics';
import type { ProjectProperties } from '../../../../types/characteristics';

interface SettingsRibbonTabProps {
  projectProps?: ProjectProperties;
}

export const SettingsRibbonTab: React.FC<SettingsRibbonTabProps> = ({
  projectProps
}) => {
  return (
    <div className="flex items-center h-full overflow-x-auto select-none no-scrollbar">
      {/* 1. ASME Y14.5 GENERAL TOLERANCES */}
      <RibbonGroup title="ASME Y14.5 TOLERANCES">
        <div className="flex flex-col justify-center px-1">
          <div className="flex items-center gap-2 text-[10px] font-mono">
            <span className="bg-slate-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-zinc-700">
              .X: ±{DEFAULT_AEROSPACE_TOLERANCES.oneDecimal}&quot;
            </span>
            <span className="bg-slate-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-zinc-700">
              .XX: ±{DEFAULT_AEROSPACE_TOLERANCES.twoDecimals}&quot;
            </span>
            <span className="bg-slate-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-zinc-700">
              .XXX: ±{DEFAULT_AEROSPACE_TOLERANCES.threeDecimals}&quot;
            </span>
            <span className="bg-slate-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-zinc-700">
              ∠: ±{DEFAULT_AEROSPACE_TOLERANCES.angular}°
            </span>
          </div>
          <span className="text-[9px] text-slate-400 dark:text-zinc-500 mt-1">
            Aerospace Title Block Defaults (Inherited when no tolerance is specified)
          </span>
        </div>
      </RibbonGroup>

      {/* 2. AS9102 SAMPLING STANDARDS */}
      <RibbonGroup title="SAMPLING & STANDARDS">
        <div className="flex flex-col justify-center px-1 text-xs">
          <div className="flex items-center gap-2 text-[10px] font-mono">
            <span className="text-blue-600 dark:text-blue-400 font-bold">SAE AS9102 Rev C</span>
            <span className="text-slate-300 dark:text-zinc-700">|</span>
            <span>ANSI/ASQ Z1.4 Level {projectProps?.samplingLevel || 'II'}</span>
            <span className="text-slate-300 dark:text-zinc-700">|</span>
            <span>AQL {projectProps?.aql || '1.0'}</span>
          </div>
          <span className="text-[9px] text-slate-400 dark:text-zinc-500 mt-1">
            First Article & Production Acceptance Criteria
          </span>
        </div>
      </RibbonGroup>

      {/* 3. SECURITY & AIR-GAP */}
      <RibbonGroup title="SECURITY & PRIVACY">
        <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/80 px-2.5 py-1 rounded text-xs">
          <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <div>
            <div className="font-bold text-[10px] leading-tight">ITAR / EAR Compliant</div>
            <div className="text-[9px] text-emerald-700 dark:text-emerald-400">100% Offline • Zero Cloud Telemetry</div>
          </div>
        </div>
      </RibbonGroup>

      {/* 4. ABOUT LOONIST */}
      <RibbonGroup title="ABOUT" noSeparator>
        <div className="flex items-center gap-2 px-1 text-xs">
          <div className="w-6 h-6 rounded bg-blue-600 flex items-center justify-center text-white font-mono font-bold text-[10px]">
            L
          </div>
          <div>
            <div className="font-bold text-[10px] text-slate-800 dark:text-white leading-tight">LOONIST Aerospace FAI</div>
            <div className="text-[9px] text-slate-400 dark:text-zinc-400 font-mono">v2.0 • Local SQLite Engine</div>
          </div>
        </div>
      </RibbonGroup>
    </div>
  );
};
