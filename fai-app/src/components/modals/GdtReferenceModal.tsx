import React, { useState, useMemo } from 'react';
import { 
  X, 
  Search, 
  BookOpen, 
  Crosshair, 
  Ruler, 
  Info 
} from 'lucide-react';
import { ASME_Y14_5_SYMBOLS, type GdtSymbolInfo } from '../../data/helpData';

interface GdtReferenceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GdtReferenceModal: React.FC<GdtReferenceModalProps> = ({
  isOpen,
  onClose
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [activeSymbol, setActiveSymbol] = useState<GdtSymbolInfo>(ASME_Y14_5_SYMBOLS[7]); // Default Position

  const categories = ['All', 'Form', 'Orientation', 'Location', 'Profile', 'Runout'];

  const filteredSymbols = useMemo(() => {
    return ASME_Y14_5_SYMBOLS.filter((s) => {
      const matchesCat = selectedCategory === 'All' || s.category === selectedCategory;
      const matchesSearch = 
        s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.definition.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.asmeReference.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesCat && matchesSearch;
    });
  }, [selectedCategory, searchTerm]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-modal flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-4xl h-[620px] bg-white dark:bg-[#1c2128] border border-slate-300 dark:border-zinc-700 rounded-xl shadow-2xl flex flex-col text-slate-800 dark:text-slate-100 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-[#161b22] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-slate-800 dark:bg-zinc-200 flex items-center justify-center text-white dark:text-zinc-900 shadow-xs">
              <Crosshair className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
                ASME Y14.5-2018 GD&T Symbol Library
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                Geometric Dimensioning & Tolerancing Standards & Inspection Gage Guide
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-zinc-800 transition cursor-pointer"
            title="Close [ESC]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Filter Toolbar */}
        <div className="px-6 py-3 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between gap-4 bg-white dark:bg-[#1c2128] shrink-0">
          {/* Search Box */}
          <div className="relative flex-1 max-w-xs">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search symbol, name, or rule..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1 bg-slate-100 dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 rounded-lg text-xs text-slate-800 dark:text-zinc-200 outline-none focus:border-slate-700 dark:focus:border-zinc-300"
            />
          </div>

          {/* Category Tabs */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-zinc-800 p-0.5 rounded-lg border border-slate-200 dark:border-zinc-700 text-xs">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-slate-800 dark:bg-zinc-200 text-white dark:text-zinc-900 shadow-xs'
                    : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Master-Detail Split Grid */}
        <div className="flex-1 min-h-0 flex overflow-hidden">
          {/* Left: Symbol Cards List */}
          <div className="w-80 border-r border-slate-200 dark:border-zinc-800 overflow-y-auto p-3 flex flex-col gap-1.5 shrink-0 bg-slate-50/50 dark:bg-[#161b22]/50">
            {filteredSymbols.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400 dark:text-zinc-500">
                No matching GD&T symbols found.
              </div>
            ) : (
              filteredSymbols.map((item) => {
                const isSelected = activeSymbol.name === item.name;
                return (
                  <button
                    key={item.name}
                    type="button"
                    onClick={() => setActiveSymbol(item)}
                    className={`flex items-center justify-between p-2.5 rounded-lg border transition text-left cursor-pointer ${
                      isSelected
                        ? 'bg-slate-200 dark:bg-zinc-700 border-slate-400 dark:border-zinc-500 text-slate-900 dark:text-white shadow-xs'
                        : 'bg-white dark:bg-zinc-800/80 border-slate-200 dark:border-zinc-700/80 text-slate-700 dark:text-zinc-300 hover:border-slate-300 dark:hover:border-zinc-600'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-8 h-8 rounded bg-slate-100 dark:bg-zinc-700 border border-slate-300 dark:border-zinc-600 flex items-center justify-center font-mono font-bold text-lg text-slate-900 dark:text-white shadow-xs">
                        {item.symbol}
                      </span>
                      <div className="flex flex-col">
                        <span className="text-xs font-bold leading-tight">
                          {item.name}
                        </span>
                        <span className="text-[10px] text-slate-400 dark:text-zinc-400 font-mono">
                          {item.category}
                        </span>
                      </div>
                    </div>

                    <span className={`text-[9.5px] px-1.5 py-0.5 rounded font-mono ${
                      item.datumRequired
                        ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'
                        : 'bg-slate-100 dark:bg-zinc-700 text-slate-600 dark:text-zinc-400'
                    }`}>
                      {item.datumRequired ? 'Datum Req' : 'No Datum'}
                    </span>
                  </button>
                );
              })
            )}
          </div>

          {/* Right: Selected Symbol Detailed Specification */}
          <div className="flex-1 min-h-0 overflow-y-auto p-6 flex flex-col gap-5 bg-white dark:bg-[#1c2128]">
            <div className="flex items-start justify-between border-b border-slate-200 dark:border-zinc-800 pb-4">
              <div className="flex items-center gap-4">
                <span className="w-14 h-14 rounded-xl bg-slate-800 dark:bg-zinc-700 flex items-center justify-center font-mono font-bold text-3xl text-white shadow-md">
                  {activeSymbol.symbol}
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                      {activeSymbol.name}
                    </h2>
                    <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 font-bold text-[10px] uppercase">
                      {activeSymbol.category}
                    </span>
                  </div>
                  <span className="text-xs text-slate-500 dark:text-zinc-400 font-mono">
                    {activeSymbol.asmeReference}
                  </span>
                </div>
              </div>

              <div className="flex flex-col items-end">
                <span className="text-[10px] font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">
                  Datum Dependency
                </span>
                <span className={`text-xs font-bold ${activeSymbol.datumRequired ? 'text-amber-600 dark:text-amber-400' : 'text-slate-600 dark:text-zinc-300'}`}>
                  {activeSymbol.datumRequired ? 'Requires Primary Datum' : 'Independent of Datums'}
                </span>
              </div>
            </div>

            {/* Definition Box */}
            <div className="flex flex-col gap-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-slate-700 dark:text-zinc-300" />
                <span>ASME Y14.5 Standard Definition</span>
              </h4>
              <p className="text-xs text-slate-700 dark:text-zinc-200 p-3 bg-slate-50 dark:bg-zinc-800/60 border border-slate-200 dark:border-zinc-700 rounded-lg leading-relaxed font-sans">
                {activeSymbol.definition}
              </p>
            </div>

            {/* Recommended Inspection Tools */}
            <div className="flex flex-col gap-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 flex items-center gap-1.5">
                <Ruler className="w-3.5 h-3.5 text-slate-700 dark:text-zinc-300" />
                <span>Recommended Inspection Methods & Tooling</span>
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {activeSymbol.recommendedInspection.map((method) => (
                  <div 
                    key={method}
                    className="p-2.5 rounded-lg bg-slate-50 dark:bg-zinc-800/40 border border-slate-200 dark:border-zinc-700 text-xs text-slate-700 dark:text-zinc-200 flex items-center gap-2"
                  >
                    <span className="w-2 h-2 rounded-full bg-slate-700 dark:bg-zinc-300" />
                    <span className="font-semibold">{method}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Quality Note */}
            <div className="p-3 bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-lg text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2 mt-auto">
              <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>
                <strong>First Article Rule:</strong> When ballooning GD&T feature control frames with LOONIST, 
                all datum references (e.g. <code>[A|B|C]</code>) and material modifiers (<code>Ⓜ</code>, <code>Ⓛ</code>) 
                are automatically captured into AS9102 Form 3 Field 4.
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 dark:bg-[#161b22] border-t border-slate-200 dark:border-zinc-800 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-white rounded-lg text-xs font-bold transition cursor-pointer"
          >
            Close Reference
          </button>
        </div>
      </div>
    </div>
  );
};
