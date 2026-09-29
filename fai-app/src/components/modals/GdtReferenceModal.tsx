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
      className="fixed inset-0 z-modal flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-4xl h-[620px] bg-white border border-slate-300 rounded-xl shadow-2xl flex flex-col text-slate-800 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-slate-800 flex items-center justify-center text-white shadow-xs">
              <Crosshair className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 leading-tight">
                ASME Y14.5-2018 GD&T Symbol Library
              </h3>
              <p className="text-[11px] text-slate-500">
                Geometric Dimensioning & Tolerancing Standards & Inspection Gage Guide
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

        {/* Filter Toolbar */}
        <div className="px-6 py-3 border-b border-slate-200 flex items-center justify-between gap-4 bg-white shrink-0">
          {/* Search Box */}
          <div className="relative flex-1 max-w-xs">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search symbol, name, or rule..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1 bg-slate-100 border border-slate-300 rounded-lg text-xs text-slate-800 outline-none focus:border-blue-600"
            />
          </div>

          {/* Category Tabs */}
          <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-slate-800 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 '
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
          <div className="w-80 border-r border-slate-200 overflow-y-auto p-3 flex flex-col gap-1.5 shrink-0 bg-slate-50">
            {filteredSymbols.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">
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
                        ? 'bg-slate-200 border-slate-400 text-slate-900 shadow-xs'
                        : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 '
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-8 h-8 rounded bg-slate-100 border border-slate-300 flex items-center justify-center font-mono font-bold text-lg text-slate-900 shadow-xs">
                        {item.symbol}
                      </span>
                      <div className="flex flex-col">
                        <span className="text-xs font-bold leading-tight">
                          {item.name}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {item.category}
                        </span>
                      </div>
                    </div>

                    <span className={`text-[9.5px] px-1.5 py-0.5 rounded font-mono ${
                      item.datumRequired
                        ? 'bg-amber-100 text-amber-800 '
                        : 'bg-slate-100 text-slate-600 '
                    }`}>
                      {item.datumRequired ? 'Datum Req' : 'No Datum'}
                    </span>
                  </button>
                );
              })
            )}
          </div>

          {/* Right: Selected Symbol Detailed Specification */}
          <div className="flex-1 min-h-0 overflow-y-auto p-6 flex flex-col gap-5 bg-white">
            <div className="flex items-start justify-between border-b border-slate-200 pb-4">
              <div className="flex items-center gap-4">
                <span className="w-14 h-14 rounded-xl bg-slate-800 flex items-center justify-center font-mono font-bold text-3xl text-white shadow-md">
                  {activeSymbol.symbol}
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-slate-900">
                      {activeSymbol.name}
                    </h2>
                    <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-bold text-[10px] uppercase">
                      {activeSymbol.category}
                    </span>
                  </div>
                  <span className="text-xs text-slate-500 font-mono">
                    {activeSymbol.asmeReference}
                  </span>
                </div>
              </div>

              <div className="flex flex-col items-end">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                  Datum Dependency
                </span>
                <span className={`text-xs font-bold ${activeSymbol.datumRequired ? 'text-amber-600 ' : 'text-slate-600 '}`}>
                  {activeSymbol.datumRequired ? 'Requires Primary Datum' : 'Independent of Datums'}
                </span>
              </div>
            </div>

            {/* Definition Box */}
            <div className="flex flex-col gap-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-slate-700" />
                <span>ASME Y14.5 Standard Definition</span>
              </h4>
              <p className="text-xs text-slate-700 p-3 bg-slate-50 border border-slate-200 rounded-lg leading-relaxed font-sans">
                {activeSymbol.definition}
              </p>
            </div>

            {/* Recommended Inspection Tools */}
            <div className="flex flex-col gap-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Ruler className="w-3.5 h-3.5 text-slate-700" />
                <span>Recommended Inspection Methods & Tooling</span>
              </h4>
              <div className="grid grid-cols-2 gap-2">
                {activeSymbol.recommendedInspection.map((method) => (
                  <div 
                    key={method}
                    className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700 flex items-center gap-2"
                  >
                    <span className="w-2 h-2 rounded-full bg-slate-700" />
                    <span className="font-semibold">{method}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Quality Note */}
            <div className="p-3 bg-amber-50/70 border border-amber-400/50 rounded-lg text-xs text-amber-900 flex items-start gap-2 mt-auto">
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
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold transition cursor-pointer"
          >
            Close Reference
          </button>
        </div>
      </div>
    </div>
  );
};
