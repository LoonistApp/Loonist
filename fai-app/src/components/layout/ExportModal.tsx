import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  FileText, 
  FileSpreadsheet, 
  FileDown, 
  X, 
  ChevronDown, 
  Check 
} from 'lucide-react';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExportExcel: (format?: 'xlsx' | 'csv') => void;
  onExportPdf?: () => void;
  characteristicsCount: number;
  hasDrawing: boolean;
  selectedTemplate: string;
  onSelectTemplate: (template: string) => void;
  defaultFormat?: 'xlsx' | 'csv';
}

const TEMPLATE_OPTIONS = [
  { value: 'AS9102C.xlt', label: 'SAE AS9102 Rev C' },
  { value: 'AS9102B.xlt', label: 'SAE AS9102 Rev B' },
  { value: 'DEFAULT.xlt', label: 'Loonist Compact Industrial' }
];

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  onExportExcel,
  onExportPdf,
  characteristicsCount,
  hasDrawing,
  selectedTemplate,
  onSelectTemplate,
  defaultFormat = 'xlsx'
}) => {
  const [isTemplateOpen, setIsTemplateOpen] = useState(false);
  // Selection state for deliverables: none selected by default
  const [selectedWorkbook, setSelectedWorkbook] = useState<'xlsx' | 'csv' | null>(null);
  const [isPdfSelected, setIsPdfSelected] = useState(false);

  const templateRef = useRef<HTMLDivElement>(null);
  const wasOpenRef = useRef(false);

  // Cleanly reset selections when modal transitions from closed to open
  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      // Pre-select the workbook format per the project's configured default
      // (Settings > Numbering & Compliance > Primary Export Format Template)
      setSelectedWorkbook(defaultFormat);
      setIsPdfSelected(false);
      setIsTemplateOpen(false);
    }
    wasOpenRef.current = isOpen;
  }, [isOpen, defaultFormat]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isTemplateOpen) {
          setIsTemplateOpen(false);
          e.stopPropagation();
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isTemplateOpen, onClose]);

  useEffect(() => {
    if (!isTemplateOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (templateRef.current && !templateRef.current.contains(e.target as Node)) {
        setIsTemplateOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isTemplateOpen]);

  if (!isOpen) return null;

  const currentTemplate = TEMPLATE_OPTIONS.find(
    (opt) => opt.value === (selectedTemplate || 'AS9102C.xlt')
  ) || TEMPLATE_OPTIONS[0];

  const hasSelection = selectedWorkbook !== null || isPdfSelected;

  const handleExport = () => {
    if (!hasSelection) return;

    if (selectedWorkbook) {
      onExportExcel(selectedWorkbook);
    }
    if (isPdfSelected && onExportPdf) {
      onExportPdf();
    }
    onClose();
  };

  const modalContent = (
    <div 
      className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 backdrop-blur-xs select-none p-4"
      onClick={() => {
        if (isTemplateOpen) {
          setIsTemplateOpen(false);
        } else {
          onClose();
        }
      }}
    >
      <div 
        className="relative bg-white border border-slate-300 shadow-2xl flex flex-col overflow-hidden text-slate-800 rounded-lg"
        style={{ width: '500px', maxWidth: '95vw' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 1. TOP HEADER BAR */}
        <div className="h-10 bg-slate-100 text-slate-800 px-4 flex items-center justify-between border-b border-slate-200 shrink-0 select-none">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-slate-700" />
            <h2 className="text-xs font-bold text-slate-900 tracking-wider uppercase">
              Export Inspection Deliverables
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md hover:bg-slate-200 text-slate-500 hover:text-slate-900 transition cursor-pointer"
            title="Close [ESC]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 2. BODY CONTENT */}
        <div className="p-5 flex flex-col gap-4 bg-white">
          
          {/* SECTION 1: INSPECTION WORKBOOK */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                INSPECTION WORKBOOK
              </span>
            </div>

            {/* Template Selector Dropdown */}
            <div className="relative" ref={templateRef}>
              <button
                type="button"
                onClick={() => setIsTemplateOpen(!isTemplateOpen)}
                className="w-full h-9 flex items-center justify-between px-3 text-xs border rounded-lg transition cursor-pointer export-card-unselected"
              >
                <div className="flex items-center gap-2.5">
                  <FileSpreadsheet className="w-4 h-4 text-slate-500" />
                  <span className="font-medium text-slate-900">{currentTemplate.label}</span>
                </div>
                <ChevronDown 
                  className={`w-4 h-4 text-slate-500 transition-transform ${isTemplateOpen ? 'rotate-180' : ''}`} 
                />
              </button>

              {isTemplateOpen && (
                <div className="absolute top-[calc(100%+2px)] left-0 right-0 bg-white border border-slate-300 shadow-xl py-1 rounded-lg overflow-hidden z-50">
                  {TEMPLATE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        onSelectTemplate(opt.value);
                        setIsTemplateOpen(false);
                      }}
                      className={`w-full px-3 py-2 flex items-center justify-between text-xs text-left cursor-pointer transition ${
                        currentTemplate.value === opt.value
                          ? 'export-card-selected font-semibold'
                          : 'text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <span>{opt.label}</span>
                      {currentTemplate.value === opt.value && (
                        <Check className="w-3.5 h-3.5" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Workbook Selectable Format Buttons (XLSX & CSV) */}
            <div className="flex gap-2.5 w-full pt-0.5">
              <button
                type="button"
                onClick={() => {
                  if (characteristicsCount > 0) {
                    setSelectedWorkbook(selectedWorkbook === 'xlsx' ? null : 'xlsx');
                  }
                }}
                disabled={characteristicsCount === 0}
                className={`flex-1 h-9 flex items-center justify-center gap-2 px-3 text-xs font-semibold rounded-lg border transition ${
                  characteristicsCount === 0
                    ? 'opacity-40 cursor-not-allowed bg-slate-100 border-slate-200 text-slate-400'
                    : selectedWorkbook === 'xlsx'
                      ? 'export-card-selected cursor-pointer shadow-2xs'
                      : 'export-card-unselected cursor-pointer'
                }`}
                title={characteristicsCount === 0 ? 'No characteristics to export' : 'Select AS9102 Excel Workbook (.xlsx)'}
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Export Workbook (.xlsx)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (characteristicsCount > 0) {
                    setSelectedWorkbook(selectedWorkbook === 'csv' ? null : 'csv');
                  }
                }}
                disabled={characteristicsCount === 0}
                className={`flex-1 h-9 flex items-center justify-center gap-2 px-3 text-xs font-semibold rounded-lg border transition ${
                  characteristicsCount === 0
                    ? 'opacity-40 cursor-not-allowed bg-slate-100 border-slate-200 text-slate-400'
                    : selectedWorkbook === 'csv'
                      ? 'export-card-selected cursor-pointer shadow-2xs'
                      : 'export-card-unselected cursor-pointer'
                }`}
                title={characteristicsCount === 0 ? 'No characteristics to export' : 'Select CSV format'}
              >
                <FileText className="w-4 h-4" />
                <span>CSV</span>
              </button>
            </div>
          </div>

          {/* SECTION 2: BALLOONED DRAWING */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                BALLOONED DRAWING
              </span>
            </div>

            {onExportPdf && (
              <button
                type="button"
                onClick={() => {
                  if (hasDrawing && characteristicsCount > 0) {
                    setIsPdfSelected(!isPdfSelected);
                  }
                }}
                disabled={!hasDrawing || characteristicsCount === 0}
                className={`w-full h-9 flex items-center justify-center gap-2 px-3 text-xs font-semibold rounded-lg border transition ${
                  (!hasDrawing || characteristicsCount === 0)
                    ? 'opacity-40 cursor-not-allowed bg-slate-100 border-slate-200 text-slate-400'
                    : isPdfSelected
                      ? 'export-card-selected cursor-pointer shadow-2xs'
                      : 'export-card-unselected cursor-pointer'
                }`}
                title={!hasDrawing ? 'No active blueprint drawing' : 'Select Marked Vector Blueprint PDF (.pdf)'}
              >
                <FileDown className="w-4 h-4" />
                <span>Export Ballooned PDF</span>
              </button>
            )}
          </div>

          {/* 3. FOOTER: CANCEL AND EXPORT ACTIONS */}
          <div className="flex justify-end items-center gap-2 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="h-8 px-4 inline-flex items-center justify-center text-xs font-medium rounded-md border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 hover:text-slate-900 transition cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleExport}
              disabled={!hasSelection}
              className={`h-8 px-5 inline-flex items-center justify-center text-xs font-semibold tracking-wide rounded-md transition ${
                hasSelection
                  ? 'bg-slate-800 hover:bg-slate-900 border border-slate-700 text-white cursor-pointer shadow-2xs'
                  : 'bg-slate-200 border border-slate-300 text-slate-400 cursor-not-allowed opacity-60 shadow-none'
              }`}
            >
              Export
            </button>
          </div>

        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, window.document.body);
};
