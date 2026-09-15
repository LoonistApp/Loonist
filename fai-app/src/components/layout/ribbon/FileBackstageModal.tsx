import React, { useEffect } from 'react';
import { 
  FolderOpen, 
  Save, 
  FilePlus2, 
  FileText, 
  FileSpreadsheet, 
  FileDown, 
  ShieldCheck, 
  X, 
  FileCode, 
  Info, 
  ArrowLeft,
  Layers
} from 'lucide-react';
import type { BlueprintDocument } from '../../../types/blueprint';
import type { ProjectProperties } from '../../../types/characteristics';

interface FileBackstageModalProps {
  isOpen: boolean;
  onClose: () => void;
  document: BlueprintDocument | null;
  projectProps: ProjectProperties;
  characteristicsCount: number;
  onNewProject?: () => void;
  onOpenProject?: () => void;
  onSaveProject?: () => void;
  onAddFile?: () => void;
  onLoadSample?: () => void;
  onExportExcel?: () => void;
  onExportPdf?: () => void;
  onCloseFile?: (fileId: string) => void;
}

export const FileBackstageModal: React.FC<FileBackstageModalProps> = ({
  isOpen,
  onClose,
  document,
  projectProps,
  characteristicsCount,
  onNewProject,
  onOpenProject,
  onSaveProject,
  onAddFile,
  onLoadSample,
  onExportExcel,
  onExportPdf,
  onCloseFile
}) => {
  // ESC key to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs select-none">
      <div className="relative w-[860px] max-w-[95vw] max-h-[90vh] bg-white dark:bg-[#1c2128] border border-slate-300 dark:border-zinc-700 rounded-md shadow-2xl flex flex-col overflow-hidden text-slate-800 dark:text-slate-100">
        {/* Backstage Header */}
        <div className="h-12 bg-[#161616] text-white px-5 flex items-center justify-between border-b border-[#2d2d2d]">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded hover:bg-[#282828] text-slate-400 hover:text-white transition cursor-pointer"
              title="Return to Inspection Canvas [ESC]"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded bg-blue-600 flex items-center justify-center text-xs font-mono font-bold">L</span>
              <span className="font-bold tracking-tight text-sm">LOONIST</span>
              <span className="text-slate-500 font-normal text-xs">| File & Project Operations</span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded hover:bg-[#282828] text-slate-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Backstage Body: Two-Column CAD Architecture */}
        <div className="flex-1 flex overflow-hidden min-h-[460px]">
          {/* Left Column: Actions & Commands */}
          <div className="w-[280px] bg-slate-50 dark:bg-[#161b22] border-r border-slate-200 dark:border-zinc-800 p-3 flex flex-col gap-1 overflow-y-auto">
            <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider px-2 py-1">
              Project Actions
            </span>

            {onNewProject && (
              <button
                type="button"
                onClick={() => {
                  onNewProject();
                  onClose();
                }}
                className="flex items-center gap-3 px-3 py-2 rounded text-left text-xs font-medium hover:bg-slate-200/70 dark:hover:bg-zinc-800 transition text-slate-700 dark:text-slate-200 cursor-pointer"
              >
                <FilePlus2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <div>
                  <div className="font-semibold leading-tight">New Project</div>
                  <div className="text-[10px] text-slate-400 dark:text-zinc-400">Initialize empty AS9102 inspection</div>
                </div>
              </button>
            )}

            {onOpenProject && (
              <button
                type="button"
                onClick={() => {
                  onOpenProject();
                  onClose();
                }}
                className="flex items-center gap-3 px-3 py-2 rounded text-left text-xs font-medium hover:bg-slate-200/70 dark:hover:bg-zinc-800 transition text-slate-700 dark:text-slate-200 cursor-pointer"
              >
                <FolderOpen className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <div>
                  <div className="font-semibold leading-tight">Open Project (.loonist)</div>
                  <div className="text-[10px] text-slate-400 dark:text-zinc-400">Load package with embedded drawings [Ctrl+O]</div>
                </div>
              </button>
            )}

            {onSaveProject && (
              <button
                type="button"
                onClick={() => {
                  onSaveProject();
                  onClose();
                }}
                className="flex items-center gap-3 px-3 py-2 rounded text-left text-xs font-medium hover:bg-slate-200/70 dark:hover:bg-zinc-800 transition text-slate-700 dark:text-slate-200 cursor-pointer"
              >
                <Save className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <div>
                  <div className="font-semibold leading-tight">Save Project (.loonist)</div>
                  <div className="text-[10px] text-slate-400 dark:text-zinc-400">Archive self-contained inspection bundle [Ctrl+S]</div>
                </div>
              </button>
            )}

            <div className="h-px bg-slate-200 dark:bg-zinc-800 my-1" />

            <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider px-2 py-1">
              Drawing & Blueprints
            </span>

            {onAddFile && (
              <button
                type="button"
                onClick={() => {
                  onAddFile();
                  onClose();
                }}
                className="flex items-center gap-3 px-3 py-2 rounded text-left text-xs font-medium hover:bg-slate-200/70 dark:hover:bg-zinc-800 transition text-slate-700 dark:text-slate-200 cursor-pointer"
              >
                <FileCode className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <div>
                  <div className="font-semibold leading-tight">Import Blueprint (.pdf)</div>
                  <div className="text-[10px] text-slate-400 dark:text-zinc-400">Ingest ASME Y14.5 engineering drawing</div>
                </div>
              </button>
            )}

            {onLoadSample && (
              <button
                type="button"
                onClick={() => {
                  onLoadSample();
                  onClose();
                }}
                className="flex items-center gap-3 px-3 py-2 rounded text-left text-xs font-medium hover:bg-slate-200/70 dark:hover:bg-zinc-800 transition text-slate-700 dark:text-slate-200 cursor-pointer"
              >
                <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <div>
                  <div className="font-semibold leading-tight">Load Sample Blueprint</div>
                  <div className="text-[10px] text-slate-400 dark:text-zinc-400">Turbine Mount Bracket (AS9102 Rev C)</div>
                </div>
              </button>
            )}

            {document && onCloseFile && (
              <button
                type="button"
                onClick={() => {
                  onCloseFile(document.id || document.name);
                  onClose();
                }}
                className="flex items-center gap-3 px-3 py-2 rounded text-left text-xs font-medium hover:bg-red-50 dark:hover:bg-red-950/40 text-red-600 dark:text-red-400 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
                <div>
                  <div className="font-semibold leading-tight">Close Active Drawing</div>
                  <div className="text-[10px] opacity-75">Unload {document.name}</div>
                </div>
              </button>
            )}

            <div className="h-px bg-slate-200 dark:bg-zinc-800 my-1" />

            <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider px-2 py-1">
              Export Deliverables
            </span>

            {onExportExcel && (
              <button
                type="button"
                onClick={() => {
                  onExportExcel();
                  onClose();
                }}
                disabled={characteristicsCount === 0}
                className="flex items-center gap-3 px-3 py-2 rounded text-left text-xs font-medium hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-slate-700 dark:text-slate-200 transition disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <div>
                  <div className="font-semibold leading-tight">Export AS9102 Excel</div>
                  <div className="text-[10px] text-slate-400 dark:text-zinc-400">Forms 1, 2, and 3 Certified Multi-Sheet</div>
                </div>
              </button>
            )}

            {onExportPdf && (
              <button
                type="button"
                onClick={() => {
                  onExportPdf();
                  onClose();
                }}
                disabled={characteristicsCount === 0 || !document}
                className="flex items-center gap-3 px-3 py-2 rounded text-left text-xs font-medium hover:bg-red-50 dark:hover:bg-red-950/40 text-slate-700 dark:text-slate-200 transition disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
              >
                <FileDown className="w-4 h-4 text-red-600 dark:text-red-400" />
                <div>
                  <div className="font-semibold leading-tight">Export Marked PDF</div>
                  <div className="text-[10px] text-slate-400 dark:text-zinc-400">Marked drawing with vector balloons</div>
                </div>
              </button>
            )}
          </div>

          {/* Right Column: Project Information & Security Audit */}
          <div className="flex-1 p-5 overflow-y-auto flex flex-col gap-4">
            {/* Active Drawing Card */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500 mb-2 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-blue-500" />
                <span>Active Drawing Properties</span>
              </h3>

              {document ? (
                <div className="bg-slate-50 dark:bg-[#161b22] border border-slate-200 dark:border-zinc-800 rounded p-3 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-slate-900 dark:text-white truncate max-w-[400px]">
                      {document.name}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-mono font-semibold">
                      {document.numSheets} {document.numSheets === 1 ? 'Sheet' : 'Sheets'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs pt-1 border-t border-slate-200 dark:border-zinc-800">
                    <div>
                      <span className="text-slate-400 dark:text-zinc-500 block text-[10px]">File Size:</span>
                      <span className="font-mono text-slate-700 dark:text-slate-200">{formatBytes(document.fileSize)}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 dark:text-zinc-500 block text-[10px]">Balloons Extracted:</span>
                      <span className="font-mono font-bold text-blue-600 dark:text-blue-400">{characteristicsCount} Characteristics</span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-slate-400 dark:text-zinc-500 block text-[10px]">Cryptographic SHA-256 Hash:</span>
                      <span className="font-mono text-[10px] text-slate-600 dark:text-zinc-400 break-all select-all">
                        {document.fileHash}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-slate-50 dark:bg-[#161b22] border border-dashed border-slate-300 dark:border-zinc-800 rounded p-4 text-center text-xs text-slate-500">
                  No active engineering blueprint loaded. Click &quot;Import Blueprint&quot; or &quot;Load Sample&quot; to begin.
                </div>
              )}
            </div>

            {/* AS9102 Project Properties Form */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500 mb-2 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-blue-500" />
                <span>AS9102 Form 1 Inspection Header</span>
              </h3>

              <div className="grid grid-cols-2 gap-3 bg-slate-50 dark:bg-[#161b22] border border-slate-200 dark:border-zinc-800 rounded p-3 text-xs">
                <div>
                  <span className="text-slate-400 dark:text-zinc-500 block text-[10px]">Part Number:</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-100">{projectProps.partNumber || '—'}</span>
                </div>
                <div>
                  <span className="text-slate-400 dark:text-zinc-500 block text-[10px]">Part Revision:</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-100">Rev {projectProps.partRevision || '—'}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-slate-400 dark:text-zinc-500 block text-[10px]">Part Name:</span>
                  <span className="font-medium text-slate-800 dark:text-slate-200">{projectProps.partName || '—'}</span>
                </div>
                <div>
                  <span className="text-slate-400 dark:text-zinc-500 block text-[10px]">CAGE Code:</span>
                  <span className="font-mono text-slate-700 dark:text-slate-300">{projectProps.cageCode || '—'}</span>
                </div>
                <div>
                  <span className="text-slate-400 dark:text-zinc-500 block text-[10px]">Lot Size / AQL:</span>
                  <span className="font-mono text-slate-700 dark:text-slate-300">
                    {projectProps.lotSize} pcs • AQL {projectProps.aql} ({projectProps.samplingLevel})
                  </span>
                </div>
              </div>
            </div>

            {/* Compliance & Security Banner */}
            <div className="mt-auto bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 rounded p-3 flex items-start gap-3">
              <div className="p-1 rounded bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 mt-0.5">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div className="text-xs">
                <div className="font-bold text-emerald-900 dark:text-emerald-200 flex items-center gap-1.5">
                  <span>100% Air-Gapped Local Environment</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                </div>
                <p className="text-[11px] text-emerald-800 dark:text-emerald-300 leading-relaxed mt-0.5">
                  LOONIST complies with aerospace defense data protection standards (ITAR / EAR). Zero blueprint pixels or inspection characteristics are transmitted outside your local machine.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="h-10 bg-slate-100 dark:bg-[#161b22] px-4 flex items-center justify-between border-t border-slate-200 dark:border-zinc-800 text-xs">
          <span className="text-[11px] text-slate-500 dark:text-zinc-400 font-mono">
            LOONIST v2.0 • InspectionXpert Enterprise Engine
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1 bg-slate-200 hover:bg-slate-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-slate-200 font-medium rounded text-xs transition cursor-pointer"
          >
            Close Backstage
          </button>
        </div>
      </div>
    </div>
  );
};
