import React, { useRef, useEffect } from 'react';
import {
  Layers,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight
} from 'lucide-react';
import type { SheetMetadata } from '../../types/blueprint';

interface SheetTabsProps {
  sheets: SheetMetadata[];
  activeSheetIndex: number;
  onSelectSheet: (index: number) => void;
  onExtractSheet?: (sheetNumber: number) => void;
  isExtracting?: boolean;
}

export const SheetTabs: React.FC<SheetTabsProps> = ({
  sheets,
  activeSheetIndex,
  onSelectSheet,
  onExtractSheet: _onExtractSheet,
  isExtracting: _isExtracting = false
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const activeTabRef = useRef<HTMLButtonElement>(null);

  // Auto-scroll active card into view whenever activeSheetIndex changes
  useEffect(() => {
    if (activeTabRef.current) {
      activeTabRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center'
      });
    }
  }, [activeSheetIndex]);

  if (!sheets || sheets.length <= 1) {
    return null;
  }

  const canGoPrev = activeSheetIndex > 0;
  const canGoNext = activeSheetIndex < sheets.length - 1;

  const handlePrevSheet = () => {
    if (canGoPrev) onSelectSheet(activeSheetIndex - 1);
  };

  const handleNextSheet = () => {
    if (canGoNext) onSelectSheet(activeSheetIndex + 1);
  };

  const handleFirstSheet = () => {
    if (canGoPrev) onSelectSheet(0);
  };

  const handleLastSheet = () => {
    if (canGoNext) onSelectSheet(sheets.length - 1);
  };

  // Convert vertical mouse wheel into horizontal scroll along sheet cards
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (scrollContainerRef.current && e.deltaY !== 0) {
      scrollContainerRef.current.scrollLeft += e.deltaY;
    }
  };

  return (
    <nav
      aria-label="Blueprint Sheet Navigation"
      className="h-11 shrink-0 bg-white border-t border-slate-200 px-3 flex items-center gap-2 select-none z-20"
    >
      {/* 1. Header & Stepper Navigation Controls */}
      <div className="flex items-center gap-1 shrink-0">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mr-1 flex items-center gap-1.5 shrink-0">
          <Layers className="w-3.5 h-3.5 text-slate-500" />
          <span>Sheets</span>
        </span>

        {/* First Sheet */}
        <button
          type="button"
          onClick={handleFirstSheet}
          disabled={!canGoPrev}
          title="First Sheet (Home)"
          className="p-1 rounded hover:bg-slate-100 text-slate-500 hover:text-slate-900 disabled:opacity-30 disabled:pointer-events-none transition cursor-pointer"
        >
          <ChevronsLeft className="w-3.5 h-3.5" />
        </button>

        {/* Previous Sheet */}
        <button
          type="button"
          onClick={handlePrevSheet}
          disabled={!canGoPrev}
          title="Previous Sheet (Page Up)"
          className="p-1 rounded hover:bg-slate-100 text-slate-600 hover:text-slate-900 disabled:opacity-30 disabled:pointer-events-none transition cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {/* Quick Stepper Counter */}
        <span className="text-xs font-mono font-medium text-slate-700 px-2 py-0.5 rounded bg-slate-100 border border-slate-200 shrink-0 whitespace-nowrap">
          {activeSheetIndex + 1} / {sheets.length}
        </span>

        {/* Next Sheet */}
        <button
          type="button"
          onClick={handleNextSheet}
          disabled={!canGoNext}
          title="Next Sheet (Page Down)"
          className="p-1 rounded hover:bg-slate-100 text-slate-600 hover:text-slate-900 disabled:opacity-30 disabled:pointer-events-none transition cursor-pointer"
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        {/* Last Sheet */}
        <button
          type="button"
          onClick={handleLastSheet}
          disabled={!canGoNext}
          title="Last Sheet (End)"
          className="p-1 rounded hover:bg-slate-100 text-slate-500 hover:text-slate-900 disabled:opacity-30 disabled:pointer-events-none transition cursor-pointer"
        >
          <ChevronsRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Vertical separator */}
      <div className="h-5 w-[1px] bg-slate-200 shrink-0" />

      {/* 2. Scrollable Sheet Cards */}
      <div className="relative flex-1 flex items-center min-w-0 h-full">
        {/* Scrollable Sheet Cards Container with sleek scrollbar */}
        <div
          ref={scrollContainerRef}
          onWheel={handleWheel}
          className="h-full flex-1 flex items-center gap-1.5 overflow-x-auto py-1 sheet-tabs-scroll"
        >
          {sheets.map((sheet, index) => {
            const isActive = index === activeSheetIndex;
            return (
              <button
                key={sheet.pageNumber}
                ref={isActive ? activeTabRef : undefined}
                type="button"
                onClick={() => onSelectSheet(index)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition cursor-pointer shrink-0 leading-none ${
                  isActive
                    ? 'bg-slate-200 text-slate-900 border border-slate-400 shadow-xs'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200'
                }`}
              >
                {isActive && <CheckCircle2 className="w-3.5 h-3.5 text-slate-700 shrink-0" />}
                <span className="inline-flex items-center leading-none whitespace-nowrap">{sheet.label}</span>
                <span className="text-[10px] text-slate-400 font-mono inline-flex items-center leading-none whitespace-nowrap">
                  ({Math.round(sheet.width)}×{Math.round(sheet.height)} pt)
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
};

