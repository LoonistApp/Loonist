import React, { useState } from 'react';
import { 
  Keyboard, 
  Info,
  X,
  FileCheck2,
  Cpu,
  Play,
  Crosshair,
  FileSpreadsheet,
  Activity,
  FileCheck
} from 'lucide-react';
import { RibbonGroup } from '../RibbonGroup';
import { RibbonButton } from '../RibbonButton';
import { QuickStartModal } from '../../../modals/QuickStartModal';
import { GdtReferenceModal } from '../../../modals/GdtReferenceModal';
import { As9102GuideModal } from '../../../modals/As9102GuideModal';
import { SystemDiagnosticsModal } from '../../../modals/SystemDiagnosticsModal';

interface HelpRibbonTabProps {
  onLoadSample?: () => void;
  characteristicsCount?: number;
  hasDrawing?: boolean;
}

const SHORTCUTS = [
  { keys: 'Double-Click Canvas', action: 'Activate Pan Mode & Drag Freely' },
  { keys: 'Ctrl + O', action: 'Open Blueprint Drawing (PDF/TIFF)' },
  { keys: 'Ctrl + S', action: 'Save Project Archive (.loonist)' },
  { keys: 'Alt + F', action: 'Open Project Backstage Menu' },
  { keys: 'Space + Drag', action: 'Pan Viewport Canvas' },
  { keys: 'Ctrl + 0', action: 'Fit Page to Viewport' },
  { keys: 'Ctrl + Plus', action: 'Zoom In' },
  { keys: 'Ctrl + Minus', action: 'Zoom Out' },
  { keys: 'R', action: 'Rotate Drawing 90° Clockwise' },
  { keys: 'ESC', action: 'Deselect / Close Active Modal' },
  { keys: 'Del', action: 'Delete Selected Characteristic' },
  { keys: 'Tab', action: 'Advance to Next Characteristic Cell' }
];

export const HelpRibbonTab: React.FC<HelpRibbonTabProps> = ({
  onLoadSample,
  characteristicsCount = 0,
  hasDrawing = false
}) => {
  const [showQuickStart, setShowQuickStart] = useState(false);
  const [showGdt, setShowGdt] = useState(false);
  const [showAs9102, setShowAs9102] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showAbout, setShowAbout] = useState(false);

  return (
    <div className="flex items-center h-full overflow-x-auto select-none no-scrollbar px-1">
      
      {/* 1. GETTING STARTED */}
      <RibbonGroup title="GETTING STARTED">
        <div className="flex items-center gap-1.5 h-full py-0.5">
          <RibbonButton
            variant="large"
            icon={<Play className="w-5 h-5 text-slate-700 fill-slate-700/20" />}
            label="Quick Start"
            subLabel="4-Step Tour"
            title="Interactive 4-step guide to First Article Inspection workflow"
            onClick={() => setShowQuickStart(true)}
            style={{ width: '80px', minWidth: '80px' }}
          />

          {onLoadSample && (
            <RibbonButton
              variant="large"
              icon={<FileCheck className="w-5 h-5 text-emerald-600" />}
              label="Sample Part"
              subLabel="Turbine DWG"
              title="Instant load certified aerospace sample blueprint"
              onClick={onLoadSample}
              style={{ width: '80px', minWidth: '80px' }}
            />
          )}
        </div>
      </RibbonGroup>

      {/* 2. STANDARDS & GD&T REFERENCE */}
      <RibbonGroup title="STANDARDS & GD&T">
        <div className="flex items-center gap-1.5 h-full py-0.5">
          <RibbonButton
            variant="large"
            icon={<Crosshair className="w-5 h-5 text-slate-700" />}
            label="GD&T Library"
            subLabel="ASME Y14.5"
            title="Searchable 14-symbol ASME Y14.5 GD&T directory & measurement tool guide"
            onClick={() => setShowGdt(true)}
            style={{ width: '82px', minWidth: '82px' }}
          />

          <RibbonButton
            variant="large"
            icon={<FileSpreadsheet className="w-5 h-5 text-emerald-600" />}
            label="AS9102 Guide"
            subLabel="Forms 1, 2, 3"
            title="Field-by-field reference guide for SAE AS9102 Rev B/C Forms"
            onClick={() => setShowAs9102(true)}
            style={{ width: '82px', minWidth: '82px' }}
          />
        </div>
      </RibbonGroup>

      {/* 3. KEYBOARD & INPUT MAP */}
      <RibbonGroup title="KEYBOARD & INPUT">
        <div className="flex items-center gap-2 h-full py-0.5">
          <RibbonButton
            variant="large"
            icon={<Keyboard className="w-5 h-5 text-slate-700" />}
            label="Hotkeys"
            subLabel="Cheat Sheet"
            title="View complete keyboard shortcut table"
            onClick={() => setShowShortcuts(true)}
            style={{ width: '80px', minWidth: '80px' }}
          />

          <div className="flex flex-col gap-1 justify-center px-1 text-[10px] font-mono text-slate-600">
            <div className="flex items-center gap-1.5">
              <kbd className="bg-slate-200/80 px-1 py-0.2 rounded border border-slate-300 font-bold text-slate-800">Space</kbd>
              <span>Pan Canvas</span>
            </div>
            <div className="flex items-center gap-1.5">
              <kbd className="bg-slate-200/80 px-1 py-0.2 rounded border border-slate-300 font-bold text-slate-800">R</kbd>
              <span>Rotate 90°</span>
            </div>
          </div>
        </div>
      </RibbonGroup>

      {/* 4. SYSTEM DIAGNOSTICS & LOGS */}
      <RibbonGroup title="DIAGNOSTICS & LOGS">
        <div className="flex items-center gap-2 h-full py-0.5">
          <RibbonButton
            variant="large"
            icon={<Activity className="w-5 h-5 text-purple-600" />}
            label="Diagnostics"
            subLabel="Health Check"
            title="Inspect local PaddleOCR, SQLite ledger, and memory health"
            onClick={() => setShowDiagnostics(true)}
            style={{ width: '80px', minWidth: '80px' }}
          />

          <div className="flex flex-col gap-1 justify-center">
            <div className="flex items-center gap-1.5 text-[10px] text-emerald-700 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Air-Gapped Active</span>
            </div>
            <span className="text-[9px] text-slate-400 font-mono">
              0% Cloud Telemetry
            </span>
          </div>
        </div>
      </RibbonGroup>

      {/* 5. ABOUT & COMPLIANCE */}
      <RibbonGroup title="SYSTEM INFO" noSeparator>
        <div className="flex items-center gap-1.5 h-full py-0.5">
          <RibbonButton
            variant="large"
            icon={<Info className="w-5 h-5 text-slate-700" />}
            label="About"
            subLabel="LOONIST v2.0"
            title="View system & build version info"
            onClick={() => setShowAbout(true)}
            style={{ width: '80px', minWidth: '80px' }}
          />
        </div>
      </RibbonGroup>

      {/* 1. QUICK START MODAL */}
      <QuickStartModal
        isOpen={showQuickStart}
        onClose={() => setShowQuickStart(false)}
        onLoadSample={onLoadSample}
      />

      {/* 2. GD&T REFERENCE MODAL */}
      <GdtReferenceModal
        isOpen={showGdt}
        onClose={() => setShowGdt(false)}
      />

      {/* 3. AS9102 GUIDE MODAL */}
      <As9102GuideModal
        isOpen={showAs9102}
        onClose={() => setShowAs9102(false)}
      />

      {/* 4. SYSTEM DIAGNOSTICS MODAL */}
      <SystemDiagnosticsModal
        isOpen={showDiagnostics}
        onClose={() => setShowDiagnostics(false)}
        characteristicsCount={characteristicsCount}
        hasDrawing={hasDrawing}
      />

      {/* 5. SHORTCUTS MODAL */}
      {showShortcuts && (
        <div 
          className="fixed inset-0 z-modal flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150"
          onClick={() => setShowShortcuts(false)}
        >
          <div 
            className="w-full max-w-lg bg-white border border-slate-300 rounded-xl shadow-2xl p-5 flex flex-col gap-4 text-slate-800"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <Keyboard className="w-4 h-4 text-slate-700" />
                <span className="text-sm font-bold">CAD & Inspection Keyboard Shortcuts</span>
              </div>
              <button 
                type="button" 
                onClick={() => setShowShortcuts(false)}
                className="p-1 rounded text-slate-400 hover:text-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-col gap-1.5 max-h-[360px] overflow-y-auto pr-1">
              {SHORTCUTS.map((s) => (
                <div key={s.keys} className="flex items-center justify-between text-xs py-1.5 px-2 rounded hover:bg-slate-50">
                  <span className="text-slate-600">{s.action}</span>
                  <kbd className="px-2 py-0.5 rounded font-mono text-[11px] font-bold bg-slate-100 border border-slate-200 text-slate-800">
                    {s.keys}
                  </kbd>
                </div>
              ))}
            </div>

            <div className="pt-2 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setShowShortcuts(false)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold transition cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. ABOUT MODAL */}
      {showAbout && (
        <div 
          className="fixed inset-0 z-modal flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150"
          onClick={() => setShowAbout(false)}
        >
          <div 
            className="w-full max-w-md bg-white border border-slate-300 rounded-xl shadow-2xl p-5 flex flex-col gap-4 text-slate-800"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-xs bg-slate-900 flex items-center justify-center text-[10px] font-mono font-black text-white">L</span>
                <span className="text-sm font-bold">About LOONIST FAI CAD</span>
              </div>
              <button 
                type="button" 
                onClick={() => setShowAbout(false)}
                className="p-1 rounded text-slate-400 hover:text-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-col gap-3 text-xs leading-relaxed">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-center gap-3">
                <Cpu className="w-6 h-6 text-slate-700 shrink-0" />
                <div>
                  <div className="font-bold text-slate-900">LOONIST Desktop Engine v2.0</div>
                  <div className="text-[11px] text-slate-400 font-mono">SQLite Local DB • Electron • React 19</div>
                </div>
              </div>

              <div className="text-slate-600">
                Built specifically for aerospace quality inspection teams complying with SAE AS9102 Rev B/C and ASME Y14.5 dimensioning standards.
              </div>

              <div className="flex items-center gap-2 text-emerald-700 font-medium text-[11px]">
                <FileCheck2 className="w-4 h-4 text-emerald-600" />
                <span>Zero telemetry • Air-gapped defense verified</span>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setShowAbout(false)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold transition cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
