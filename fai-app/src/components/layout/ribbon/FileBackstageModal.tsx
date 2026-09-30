import React, { useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Save,
  FilePlus2,
  FileText,
  LogOut,
  ArrowLeft
} from 'lucide-react';
import type { BlueprintDocument } from '../../../types/blueprint';
import type { ProjectProperties } from '../../../types/characteristics';

import { validateForm1Record } from '../../../services/validation/form1ValidationService';

interface FileBackstageModalProps {
  isOpen: boolean;
  onClose: () => void;
  document: BlueprintDocument | null;
  projectProps: ProjectProperties;
  characteristicsCount: number;
  onUpdateProjectProps?: (props: ProjectProperties) => void;
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
  onUpdateProjectProps,
  onNewProject,
  onAddFile,
  onCloseFile
}) => {
  // Local draft state for enterprise desktop save/cancel workflow
  const [syncedProps, setSyncedProps] = useState<ProjectProperties>(projectProps);
  const [draftProps, setDraftProps] = useState<ProjectProperties>(projectProps);

  // Sync draft whenever projectProps changes from parent
  if (projectProps !== syncedProps) {
    setSyncedProps(projectProps);
    setDraftProps(projectProps);
  }

  // Full-form record validation: runs whenever any field changes
  const validation = useMemo(() => validateForm1Record(draftProps), [draftProps]);
  const { isValid: isRecordValid, invalidFields } = validation;

  const handleUpdateField = <K extends keyof ProjectProperties>(field: K, value: ProjectProperties[K] | string) => {
    setDraftProps(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Save changes and close modal: re-runs full validation and never persists incomplete records
  const handleSaveAndClose = () => {
    const finalValidation = validateForm1Record(draftProps);
    if (!finalValidation.isValid || !finalValidation.validatedRecord) {
      return; // Never allow a blank required field or incomplete/deleted record to be persisted!
    }
    if (onUpdateProjectProps) {
      onUpdateProjectProps(finalValidation.validatedRecord);
    }
    onClose();
  };

  // ESC key to close, Ctrl+W to exit active drawing
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'w') {
        e.preventDefault();
        if (onCloseFile && document) {
          onCloseFile(document.id || document.name);
        }
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, onCloseFile, document]);

  if (!isOpen) return null;

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const modalContent = (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-950/75 backdrop-blur-xs select-none p-4">
      <div
        className="relative bg-white border border-slate-300 shadow-2xl flex flex-col overflow-hidden text-slate-800 rounded-none"
        style={{ width: '840px', maxWidth: '95vw', maxHeight: '90vh' }}
      >

        {/* 1. TOP HEADER BAR: Back at left, DRAWING SPECIFICATION centered, Save & Close at right (no cross icon) */}
        <div className="h-9 bg-slate-100 text-slate-800 px-3 flex items-center justify-between border-b border-slate-200 shrink-0 select-none">
          {/* Left: Back Button (Fixed width container for mathematical center balance) */}
          <div className="w-[140px] flex items-center justify-start">
            <button
              type="button"
              onClick={onClose}
              className="flex items-center gap-1.5 px-2 py-0.5 rounded-none border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 transition cursor-pointer text-xs font-medium"
              title="Back [ESC]"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </button>
          </div>

          {/* Center: DRAWING SPECIFICATION mathematically centered, no collision */}
          <div className="flex-1 text-center px-2">
            <h1 className="text-xs font-bold text-slate-900 tracking-wider uppercase truncate">
              DRAWING SPECIFICATION
            </h1>
          </div>

          {/* Right: Save & Close Button (Disabled when specification record is invalid) */}
          <div className="w-[140px] flex items-center justify-end">
            <button
              type="button"
              disabled={!isRecordValid}
              onClick={handleSaveAndClose}
              className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-none text-xs font-semibold tracking-wide transition ${
                isRecordValid
                  ? 'bg-slate-800 hover:bg-slate-900 border border-slate-700 text-white cursor-pointer shadow-2xs'
                  : 'bg-slate-200 border border-slate-300 text-slate-400 cursor-not-allowed opacity-60 shadow-none'
              }`}
              title={isRecordValid ? "Save Changes & Close" : "Required fields are missing"}
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save & Close</span>
            </button>
          </div>
        </div>

        {/* 2. MAIN TWO-COLUMN BODY */}
        <div className="flex overflow-hidden">

          {/* Left Navigation Rail (Sharp & Clean - 140px) */}
          <div
            className="bg-slate-50 border-r border-slate-200 flex flex-col justify-between shrink-0 select-none rounded-none"
            style={{ width: '140px', padding: '12px 8px' }}
          >
            <div className="flex flex-col gap-3">
              {/* Workspace Actions */}
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1.5 block mb-1">
                  Workspace
                </span>
                <div className="flex flex-col gap-0.5">
                  {(onNewProject || onAddFile) && (
                    <button
                      type="button"
                      onClick={() => {
                        if (onNewProject) {
                          onNewProject();
                        } else if (onAddFile) {
                          onAddFile();
                        }
                        onClose();
                      }}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded-none text-left text-xs font-medium text-slate-700 hover:bg-slate-200 transition cursor-pointer border border-transparent hover:border-slate-300"
                    >
                      <FilePlus2 className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span className="truncate">New Project</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Bottom Rail Actions: Exit Drawing */}
            <div className="pt-2 border-t border-slate-200 flex flex-col gap-1">

              <button
                type="button"
                disabled={!document}
                onClick={() => {
                  if (onCloseFile && document) {
                    onCloseFile(document.id || document.name);
                  }
                  onClose();
                }}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-none text-left text-xs font-medium transition border border-transparent ${
                  document
                    ? 'text-slate-700 hover:bg-slate-200 hover:text-red-600 cursor-pointer '
                    : 'text-slate-400 cursor-not-allowed opacity-50'
                }`}
                title={document ? 'Exit Active Drawing (Ctrl+W)' : 'No drawing is currently open'}
              >
                <LogOut className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                <span className="truncate">Exit Drawing</span>
              </button>
            </div>
          </div>

          {/* Right Main Content Area (Restrained Professional Aerospace Grid, Zero Horizontal Scroll) */}
          <div 
            className="flex-1 bg-white overflow-y-auto overflow-x-hidden flex flex-col gap-3 min-w-0"
            style={{ padding: '18px 24px' }}
          >

            {/* SECTION 1: PART & INSPECTION IDENTIFICATION */}
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] font-bold text-slate-500 tracking-wider uppercase whitespace-nowrap">
                  PART & INSPECTION IDENTIFICATION
                </span>
                {!isRecordValid && (
                  <span className="text-[10px] font-semibold text-red-600 tracking-tight whitespace-nowrap">
                    • Required fields are missing
                  </span>
                )}
                <div className="flex-1 h-px bg-slate-200" />
              </div>

              {/* Precise Field Grid (Fields 1-9 only, No nested box container bloat) */}
              <div className="flex flex-col gap-2.5 min-w-0">
                
                {/* Row 1: 5 Identification Columns (Part No, Part Rev, CAGE, Drawing No, Drawing Rev) */}
                <div 
                  className="min-w-0" 
                  style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 0.95fr) minmax(0, 1fr) minmax(0, 1.4fr) minmax(0, 0.95fr)', 
                    gap: '0.45rem' 
                  }}
                >
                  <div className="min-w-0">
                    <label htmlFor="field-part-number" className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block mb-1 whitespace-nowrap">
                      1. Part Number
                    </label>
                    <input
                      id="field-part-number"
                      type="text"
                      value={draftProps.partNumber || ''}
                      onChange={(e) => handleUpdateField('partNumber', e.target.value)}
                      placeholder="e.g. AS9102-001"
                      className={`w-full min-w-0 h-7 bg-white border ${
                        invalidFields.partNumber
                          ? 'border-red-500 focus:border-red-500'
                          : 'border-slate-300 hover:border-slate-400 focus:border-slate-800 '
                      } rounded-none px-2 text-xs font-mono font-medium text-slate-900 outline-none transition`}
                    />
                  </div>

                  <div className="min-w-0">
                    <label htmlFor="field-part-rev" className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block mb-1 whitespace-nowrap">
                      2. Part Rev
                    </label>
                    <input
                      id="field-part-rev"
                      type="text"
                      value={draftProps.partRevision || ''}
                      onChange={(e) => handleUpdateField('partRevision', e.target.value)}
                      placeholder="e.g. A"
                      className={`w-full min-w-0 h-7 bg-white border ${
                        invalidFields.partRevision
                          ? 'border-red-500 focus:border-red-500'
                          : 'border-slate-300 hover:border-slate-400 focus:border-slate-800 '
                      } rounded-none px-2 text-xs font-mono font-bold text-slate-800 outline-none transition`}
                    />
                  </div>

                  <div className="min-w-0">
                    <label htmlFor="field-cage-code" className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block mb-1 whitespace-nowrap">
                      3. CAGE Code
                    </label>
                    <input
                      id="field-cage-code"
                      type="text"
                      value={draftProps.cageCode || ''}
                      onChange={(e) => handleUpdateField('cageCode', e.target.value)}
                      placeholder="e.g. 1A2B3"
                      className={`w-full min-w-0 h-7 bg-white border ${
                        invalidFields.cageCode
                          ? 'border-red-500 focus:border-red-500'
                          : 'border-slate-300 hover:border-slate-400 focus:border-slate-800 '
                      } rounded-none px-2 text-xs font-mono font-medium text-slate-800 outline-none transition`}
                    />
                  </div>

                  <div className="min-w-0">
                    <label htmlFor="field-drawing-number" className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block mb-1 whitespace-nowrap">
                      4. Drawing Number
                    </label>
                    <input
                      id="field-drawing-number"
                      type="text"
                      value={draftProps.drawingNumber || ''}
                      onChange={(e) => handleUpdateField('drawingNumber', e.target.value)}
                      placeholder="e.g. DWG-001"
                      className={`w-full min-w-0 h-7 bg-white border ${
                        invalidFields.drawingNumber
                          ? 'border-red-500 focus:border-red-500'
                          : 'border-slate-300 hover:border-slate-400 focus:border-slate-800 '
                      } rounded-none px-2 text-xs font-mono font-medium text-slate-800 outline-none transition`}
                    />
                  </div>

                  <div className="min-w-0">
                    <label htmlFor="field-drawing-rev" className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block mb-1 whitespace-nowrap">
                      5. Drawing Rev
                    </label>
                    <input
                      id="field-drawing-rev"
                      type="text"
                      value={draftProps.drawingRevision || ''}
                      onChange={(e) => handleUpdateField('drawingRevision', e.target.value)}
                      placeholder="e.g. A"
                      className={`w-full min-w-0 h-7 bg-white border ${
                        invalidFields.drawingRevision
                          ? 'border-red-500 focus:border-red-500'
                          : 'border-slate-300 hover:border-slate-400 focus:border-slate-800 '
                      } rounded-none px-2 text-xs font-mono font-bold text-slate-800 outline-none transition`}
                    />
                  </div>
                </div>

                {/* Row 2: Part Name / Nomenclature (Full Width) */}
                <div className="min-w-0">
                  <label htmlFor="field-part-name" className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block mb-1 whitespace-nowrap">
                    6. Part Name / Nomenclature
                  </label>
                  <input
                    id="field-part-name"
                    type="text"
                    value={draftProps.partName || ''}
                    onChange={(e) => handleUpdateField('partName', e.target.value)}
                    placeholder="e.g. Turbine Mount Bracket"
                    className={`w-full min-w-0 h-7 bg-white border ${
                      invalidFields.partName
                        ? 'border-red-500 focus:border-red-500'
                        : 'border-slate-300 hover:border-slate-400 focus:border-slate-800 '
                    } rounded-none px-2 text-xs font-mono font-medium text-slate-900 outline-none transition`}
                  />
                </div>

                {/* Row 3: Inspection Sampling & Lot Details (3 Columns: Lot Size, Sampling Plan, AQL) */}
                <div 
                  className="min-w-0"
                  style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', 
                    gap: '0.45rem' 
                  }}
                >
                  <div className="min-w-0">
                    <label htmlFor="field-lot-size" className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block mb-1 whitespace-nowrap">
                      7. Production Lot Size
                    </label>
                    <div className={`flex items-center min-w-0 h-7 bg-white border ${
                      invalidFields.lotSize
                        ? 'border-red-500 focus-within:border-red-500'
                        : 'border-slate-300 hover:border-slate-400 focus-within:border-slate-800 '
                    } rounded-none transition`}>
                      <span className="pl-2 pr-1.5 text-[10px] text-slate-400 font-mono select-none shrink-0 pointer-events-none">
                        pcs
                      </span>
                      <input
                        id="field-lot-size"
                        type="number"
                        min={1}
                        value={draftProps.lotSize ?? ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          handleUpdateField('lotSize', val === '' ? ('' as unknown as number) : Number(val));
                        }}
                        style={{ border: 'none', background: 'transparent', outline: 'none' }}
                        className="flex-1 min-w-0 h-full bg-transparent border-0 px-1 text-xs font-mono font-medium text-slate-800 outline-none"
                      />
                    </div>
                  </div>

                  <div className="min-w-0">
                    <label htmlFor="field-sampling-level" className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block mb-1 whitespace-nowrap">
                      8. Sampling Plan
                    </label>
                    <div className="flex items-center gap-1.5 min-w-0">
                      <select
                        id="field-sampling-level"
                        value={draftProps.samplingLevel || ''}
                        onChange={(e) => handleUpdateField('samplingLevel', e.target.value)}
                        className={`flex-1 min-w-0 h-7 bg-white border ${
                          invalidFields.samplingLevel
                            ? 'border-red-500 focus:border-red-500'
                            : 'border-slate-300 hover:border-slate-400 focus:border-slate-800 '
                        } rounded-none px-2 text-xs font-mono font-medium text-slate-800 outline-none transition cursor-pointer`}
                      >
                        <option value="I">Level I</option>
                        <option value="II">Level II</option>
                        <option value="III">Level III</option>
                        <option value="S-1">S-1</option>
                        <option value="S-2">S-2</option>
                        <option value="S-3">S-3</option>
                        <option value="S-4">S-4</option>
                      </select>

                      <select
                        id="field-sampling-type"
                        aria-label="Sampling Inspection Type"
                        value={draftProps.samplingType || ''}
                        onChange={(e) => handleUpdateField('samplingType', e.target.value)}
                        className={`flex-1 min-w-0 h-7 bg-white border ${
                          invalidFields.samplingType
                            ? 'border-red-500 focus:border-red-500'
                            : 'border-slate-300 hover:border-slate-400 focus:border-slate-800 '
                        } rounded-none px-2 text-xs font-mono font-medium text-slate-800 outline-none transition cursor-pointer`}
                      >
                        <option value="NORMAL">Normal</option>
                        <option value="TIGHTENED">Tightened</option>
                        <option value="REDUCED">Reduced</option>
                        <option value="100% FAI">100% FAI</option>
                      </select>
                    </div>
                  </div>

                  <div className="min-w-0">
                    <label htmlFor="field-aql" className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block mb-1 whitespace-nowrap">
                      9. AQL Threshold
                    </label>
                    <div className={`flex items-center min-w-0 h-7 bg-white border ${
                      invalidFields.aql
                        ? 'border-red-500 focus-within:border-red-500'
                        : 'border-slate-300 hover:border-slate-400 focus-within:border-slate-800 '
                    } rounded-none transition`}>
                      <input
                        id="field-aql"
                        type="text"
                        value={draftProps.aql || ''}
                        onChange={(e) => handleUpdateField('aql', e.target.value)}
                        placeholder="1.0"
                        style={{ border: 'none', background: 'transparent', outline: 'none' }}
                        className="flex-1 min-w-0 h-full bg-transparent border-0 px-2 text-xs font-mono font-medium text-slate-800 outline-none"
                      />
                      <span className="px-2 text-[10px] text-slate-400 font-mono select-none shrink-0 pointer-events-none">
                        %
                      </span>
                    </div>
                  </div>
                </div>

              </div>
            </div>

            {/* SECTION 2: ACTIVE DRAWING METADATA (Includes Scope / Characteristic Count) */}
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-[10px] font-bold text-slate-500 tracking-wider uppercase whitespace-nowrap">
                  ACTIVE DRAWING
                </span>
                <div className="flex-1 h-px bg-slate-200" />
              </div>

              <div className="border border-slate-200 rounded-none bg-slate-50 px-2.5 py-1.5 flex flex-wrap items-center justify-between gap-3 text-xs min-w-0">
                {/* Left: Document Name & Format Badge */}
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <FileText className="w-4 h-4 text-slate-700 shrink-0" />
                  <div className="min-w-0">
                    <span className="font-semibold text-slate-900 truncate block text-xs">
                      {document ? document.name : 'No Blueprint Loaded'}
                    </span>
                    <span className="text-[10px] text-slate-400 block truncate">
                      {document?.filePath || 'Vector PDF Engineering Specification'}
                    </span>
                  </div>
                </div>

                {/* Right: Inline Metadata Metrics Strip including Characteristics Count */}
                <div className="flex items-center gap-3 text-slate-600 font-mono text-[11px] shrink-0">
                  {document && (
                    <>
                      <div className="flex items-center gap-1">
                        <span className="text-slate-400 uppercase text-[9px]">Sheets</span>
                        <span className="font-semibold text-slate-800">
                          {document.numSheets}
                        </span>
                      </div>

                      <span className="text-slate-300">|</span>

                      <div className="flex items-center gap-1">
                        <span className="text-slate-400 uppercase text-[9px]">Size</span>
                        <span className="font-semibold text-slate-800">
                          {formatBytes(document.fileSize)}
                        </span>
                      </div>

                      <span className="text-slate-300">|</span>
                    </>
                  )}

                  {/* Characteristic Scope / Count Indicator */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-400 uppercase text-[9px]">Scope</span>
                    <span className="font-bold text-slate-800">
                      {characteristicsCount} Characteristics
                    </span>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );

  return createPortal(modalContent, window.document.body);
};
