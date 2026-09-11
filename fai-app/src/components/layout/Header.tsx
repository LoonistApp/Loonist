import React from 'react';
import { 
  FolderOpen, 
  Sparkles, 
  ShieldCheck, 
  FileText, 
  Cpu,
  Layers
} from 'lucide-react';
import type { BlueprintDocument } from '../../types/blueprint';

interface HeaderProps {
  document: BlueprintDocument | null;
  onOpenBlueprint: () => void;
  onLoadSample: () => void;
  isLoading: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  document,
  onOpenBlueprint,
  onLoadSample,
  isLoading
}) => {
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <header className="h-14 border-b border-slate-800 bg-slate-900/90 backdrop-blur px-4 flex items-center justify-between select-none z-30">
      {/* Brand & Platform Identification */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
          <Layers className="w-5 h-5 text-white" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-100 tracking-wider text-sm">LOONIST</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800/60 font-mono font-semibold">
              v2.0 Desktop
            </span>
          </div>
          <span className="text-[11px] text-slate-400 block leading-tight">
            Aerospace First Article Inspection (SAE AS9102)
          </span>
        </div>
      </div>

      {/* Active Document Info Badge */}
      <div className="hidden md:flex items-center gap-2">
        {document ? (
          <div className="flex items-center gap-3 bg-slate-950/80 border border-slate-800 rounded-lg px-3 py-1 text-xs">
            <FileText className="w-4 h-4 text-cyan-400 shrink-0" />
            <div className="flex flex-col">
              <span className="font-medium text-slate-200 truncate max-w-[260px]">
                {document.name}
              </span>
              <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono">
                <span>{formatFileSize(document.fileSize)}</span>
                <span>•</span>
                <span title={`SHA-256: ${document.fileHash}`}>
                  SHA: {document.fileHash.slice(0, 8)}...{document.fileHash.slice(-6)}
                </span>
                <span>•</span>
                <span>{document.numSheets} {document.numSheets === 1 ? 'Sheet' : 'Sheets'}</span>
              </div>
            </div>
            <div className="flex items-center gap-1 text-[10px] bg-emerald-950/60 text-emerald-400 border border-emerald-800/50 px-2 py-0.5 rounded font-medium ml-2">
              <ShieldCheck className="w-3 h-3" />
              <span>ITAR Compliant (100% Local)</span>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-950/40 border border-slate-800/50 rounded-lg px-3 py-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>Air-Gapped Isolated Environment • Zero Cloud Uploads</span>
          </div>
        )}
      </div>

      {/* Action Controls */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onOpenBlueprint}
          disabled={isLoading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition disabled:opacity-50"
        >
          <FolderOpen className="w-3.5 h-3.5 text-cyan-400" />
          <span>Open Blueprint</span>
        </button>

        <button
          type="button"
          onClick={onLoadSample}
          disabled={isLoading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/70 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700/60 transition disabled:opacity-50"
          title="Load pre-bundled AS9102 turbine bracket schematic"
        >
          <FileText className="w-3.5 h-3.5 text-blue-400" />
          <span>Sample Drawing</span>
        </button>

        {/* Sprint 3 Auto Balloon Preview Trigger */}
        <button
          type="button"
          disabled={true}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-950/40 text-cyan-500/60 text-xs font-medium border border-cyan-900/40 cursor-not-allowed opacity-75"
          title="Sprint 3: Local ONNX AI Feature Extraction"
        >
          <Cpu className="w-3.5 h-3.5 text-cyan-500/60" />
          <Sparkles className="w-3 h-3" />
          <span>Auto Balloon (Sprint 3)</span>
        </button>
      </div>
    </header>
  );
};
