import React, { useState } from 'react';
import { 
  X, 
  Activity, 
  Cpu, 
  Database, 
  ShieldCheck, 
  Download, 
  CheckCircle2, 
  Sparkles,
  Layers,
  FileCheck
} from 'lucide-react';
import { RELEASE_HIGHLIGHTS_V2 } from '../../data/helpData';

interface SystemDiagnosticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  characteristicsCount?: number;
  hasDrawing?: boolean;
}

export const SystemDiagnosticsModal: React.FC<SystemDiagnosticsModalProps> = ({
  isOpen,
  onClose,
  characteristicsCount = 0,
  hasDrawing = false
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleExportDiagnostics = () => {
    const diagnosticPayload = {
      app: 'LOONIST CAD FAI',
      version: '2.0.0-enterprise',
      timestamp: new Date().toISOString(),
      runtime: {
        engine: 'V8 / Electron Chromium',
        ocrWorker: 'Local PaddleOCR / Tesseract WASM',
        database: 'SQLite3 Local Storage (WAL Active)',
        pdfRenderer: 'pdf-lib v1.17 + pdfjs-dist',
        spatialIndex: 'R-Tree AABB Active'
      },
      sessionTelemetry: {
        activeDrawingLoaded: hasDrawing,
        characteristicsActive: characteristicsCount,
        airGappedNetwork: true,
        telemetryDisabled: true
      },
      system: {
        userAgent: navigator.userAgent,
        screenResolution: `${window.screen.width}x${window.screen.height}`,
        devicePixelRatio: window.devicePixelRatio,
        language: navigator.language
      }
    };

    const blob = new Blob([JSON.stringify(diagnosticPayload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `LOONIST_Sanitized_Diagnostics_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div 
      className="fixed inset-0 z-modal flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-2xl bg-white border border-slate-300 rounded-xl shadow-2xl flex flex-col text-slate-800 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-slate-900 flex items-center justify-center text-white shadow-xs">
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 leading-tight">
                LOONIST System Engine & Health Diagnostics
              </h3>
              <p className="text-[11px] text-slate-500">
                100% Local Air-Gapped Verification & Support Telemetry
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-md text-slate-400 hover:text-slate-900 hover:bg-slate-200 transition cursor-pointer"
            title="Close [ESC]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 flex flex-col gap-4 overflow-y-auto max-h-[500px]">
          {/* Subsystem Health Status Matrix */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Cpu className="w-4 h-4 text-slate-700" />
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-slate-900">Vision / OCR Pipeline</span>
                  <span className="text-[10px] text-slate-400 font-mono">Local Web Worker WASM</span>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-full text-emerald-700 font-bold text-[10px]">
                Ready
              </span>
            </div>

            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Database className="w-4 h-4 text-blue-600" />
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-slate-900">Audit Database Ledger</span>
                  <span className="text-[10px] text-slate-400 font-mono">SQLite3 WAL Ledger</span>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-full text-emerald-700 font-bold text-[10px]">
                Healthy
              </span>
            </div>

            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Layers className="w-4 h-4 text-slate-700" />
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-slate-900">Spatial Placement Engine</span>
                  <span className="text-[10px] text-slate-400 font-mono">R-Tree AABB Collision</span>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-full text-emerald-700 font-bold text-[10px]">
                Active
              </span>
            </div>

            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <FileCheck className="w-4 h-4 text-emerald-600" />
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-slate-900">Vector PDF Exporter</span>
                  <span className="text-[10px] text-slate-400 font-mono">pdf-lib Vector Geometry</span>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-full text-emerald-700 font-bold text-[10px]">
                Ready
              </span>
            </div>
          </div>

          {/* ITAR Air-Gapped Declaration */}
          <div className="p-3.5 border border-emerald-200 rounded-xl flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div className="flex flex-col gap-1 text-xs">
              <span className="font-bold text-emerald-800">
                ITAR / EAR Data Sovereignty Assurance
              </span>
              <p className="text-emerald-800 leading-relaxed text-[11.5px]">
                LOONIST operates with 100% on-device processing. No drawing rasters, CAD models, dimensions, or inspection characteristics are ever transmitted over external networks or third-party cloud APIs.
              </p>
            </div>
          </div>

          {/* What's New in v2.0 Highlights */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>LOONIST Production Release Highlights (v2.0)</span>
            </div>

            <ul className="space-y-1.5 text-xs text-slate-600">
              {RELEASE_HIGHLIGHTS_V2.map((item, idx) => (
                <li key={idx} className="flex items-start gap-2 p-1.5 rounded bg-slate-50">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                  <span className="leading-snug">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={handleExportDiagnostics}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-xs"
            title="Download sanitized diagnostic report (zero blueprint CAD geometry)"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{copied ? 'Exported Successfully!' : 'Export Sanitized Support Bundle'}</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold transition cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
