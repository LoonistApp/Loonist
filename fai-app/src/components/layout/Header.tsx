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
    <header className="h-12 border-b border-slate-200 bg-white px-4 flex items-center justify-between select-none z-30 shadow-xs">
      {/* Brand & Platform Identification */}
      <div className="flex items-center gap-3">
        <div className="w-7 h-7 rounded bg-blue-600 flex items-center justify-center text-white shadow-xs">
          <Layers className="w-4 h-4" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-900 tracking-tight text-sm">LOONIST</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 border border-slate-200 font-mono font-semibold">
              v2.0
            </span>
          </div>
          <span className="text-[11px] text-slate-500 block leading-none">
            InspectionXpert FAI Platform (SAE AS9102)
          </span>
        </div>
      </div>

      {/* Active Document Info Badge */}
      <div className="hidden md:flex items-center gap-2">
        {document ? (
          <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded px-2.5 py-1 text-xs">
            <FileText className="w-4 h-4 text-blue-600 shrink-0" />
            <div className="flex flex-col">
              <span className="font-medium text-slate-800 truncate max-w-[260px]">
                {document.name}
              </span>
              <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono">
                <span>{formatFileSize(document.fileSize)}</span>
                <span>•</span>
                <span title={`SHA-256: ${document.fileHash}`}>
                  SHA: {document.fileHash.slice(0, 8)}...{document.fileHash.slice(-6)}
                </span>
                <span>•</span>
                <span>{document.numSheets} {document.numSheets === 1 ? 'Sheet' : 'Sheets'}</span>
              </div>
            </div>
            <div className="flex items-center gap-1 text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded font-medium ml-2">
              <ShieldCheck className="w-3 h-3 text-emerald-600" />
              <span>ITAR Compliant (100% Local)</span>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded px-3 py-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Air-Gapped Quality Inspection • Zero Cloud Uploads</span>
          </div>
        )}
      </div>

      {/* Action Controls */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onOpenBlueprint}
          disabled={isLoading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium border border-blue-700 shadow-xs transition disabled:opacity-50"
        >
          <FolderOpen className="w-3.5 h-3.5" />
          <span>Open Blueprint</span>
        </button>

        <button
          type="button"
          onClick={onLoadSample}
          disabled={isLoading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium border border-slate-300 shadow-xs transition disabled:opacity-50"
          title="Load pre-bundled AS9102 turbine bracket schematic"
        >
          <FileText className="w-3.5 h-3.5 text-slate-500" />
          <span>Sample Drawing</span>
        </button>

        {/* Sprint 3 Auto Balloon Preview Trigger */}
        <button
          type="button"
          disabled={true}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-slate-100 text-slate-400 text-xs font-medium border border-slate-200 cursor-not-allowed"
          title="Sprint 3: Local ONNX AI Feature Extraction"
        >
          <Cpu className="w-3.5 h-3.5 text-slate-400" />
          <Sparkles className="w-3 h-3" />
          <span>Auto Balloon (Sprint 3)</span>
        </button>
      </div>
    </header>
  );
};
