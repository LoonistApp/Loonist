import React, { useState } from 'react';
import type { 
  EngineeringCharacteristic, 
  InspectionMethod 
} from '../../types/characteristics';
import { MultiplierParser } from '../../services/ai/multiplierParser';
import { 
  X, 
  CheckCircle2, 
  AlertTriangle, 
  Sparkles, 
  Split, 
  Layers
} from 'lucide-react';

interface ExtractionReviewDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  characteristics: EngineeringCharacteristic[];
  onUpdateCharacteristics: (updated: EngineeringCharacteristic[]) => void;
  onSelectCharacteristic?: (char: EngineeringCharacteristic) => void;
  selectedCharId?: string | null;
  cropUrl?: string | null;
}

const INSPECTION_METHODS: InspectionMethod[] = [
  'Caliper',
  'Micrometer',
  'Height Gage',
  'CMM',
  'Optical Comparator',
  'Thread Gage',
  'Pin Gage',
  'Bore Gage',
  'Surface Plate',
  'Visual / Visual Inspection'
];

export const ExtractionReviewDrawer: React.FC<ExtractionReviewDrawerProps> = ({
  isOpen,
  onClose,
  characteristics,
  onUpdateCharacteristics,
  onSelectCharacteristic,
  selectedCharId,
  cropUrl
}) => {
  const [filterNeedsReview, setFilterNeedsReview] = useState(false);
  const [sheetFilter, setSheetFilter] = useState<number | 'all'>('all');

  if (!isOpen) return null;

  const totalCount = characteristics.length;
  const needsReviewCount = characteristics.filter(c => c.verificationStatus === 'needs_review').length;
  const verifiedCount = characteristics.filter(c => c.verificationStatus === 'verified' || c.verificationStatus === 'auto_accepted').length;
  const selectedChar = characteristics.find(c => c.id === selectedCharId) || null;

  const filteredItems = characteristics.filter(c => {
    if (filterNeedsReview && c.verificationStatus !== 'needs_review') return false;
    if (sheetFilter !== 'all' && c.sheetNumber !== sheetFilter) return false;
    return true;
  });

  const handleVerify = (id: string) => {
    const updated = characteristics.map(c => 
      c.id === id ? { ...c, verificationStatus: 'verified' as const } : c
    );
    onUpdateCharacteristics(updated);
  };

  const handleUpdateMethod = (id: string, method: InspectionMethod) => {
    const updated = characteristics.map(c => 
      c.id === id ? { ...c, inspectionMethod: method } : c
    );
    onUpdateCharacteristics(updated);
  };

  const handleExpandMultiplier = (char: EngineeringCharacteristic) => {
    const subItems = MultiplierParser.expandCharacteristic(char);
    const index = characteristics.findIndex(c => c.id === char.id);
    if (index !== -1) {
      const newChars = [...characteristics];
      newChars.splice(index, 1, ...subItems);
      onUpdateCharacteristics(newChars);
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 w-[480px] bg-white border-l border-slate-300 shadow-2xl z-40 flex flex-col select-none text-slate-800">
      {/* Header Bar */}
      <div className="h-12 border-b border-slate-200 px-4 flex items-center justify-between bg-slate-50">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-blue-600" />
          <h3 className="font-bold text-slate-900 text-sm">AI Characteristics Inspector</h3>
          <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-semibold">
            {totalCount} Items
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition"
          title="Close Inspector"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Quality Telemetry & Filter Strip */}
      <div className="p-3 border-b border-slate-200 bg-white flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs font-medium">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 text-emerald-700">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{verifiedCount} Accepted</span>
            </span>
            {needsReviewCount > 0 && (
              <span className="flex items-center gap-1 text-amber-700">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>{needsReviewCount} Needs Review</span>
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => setFilterNeedsReview(!filterNeedsReview)}
            className={`px-2 py-1 rounded text-[11px] font-medium border transition ${
              filterNeedsReview 
                ? 'bg-amber-100 text-amber-800 border-amber-300' 
                : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
            }`}
          >
            {filterNeedsReview ? 'Showing Flagged Only' : 'Filter Needs Review'}
          </button>
        </div>

        {/* Sheet Filter Pill Selector */}
        <div className="flex items-center gap-1 text-[11px] text-slate-600">
          <span className="mr-1 flex items-center gap-1">
            <Layers className="w-3 h-3 text-slate-400" />
            <span>Sheet:</span>
          </span>
          <button
            type="button"
            onClick={() => setSheetFilter('all')}
            className={`px-2 py-0.5 rounded ${sheetFilter === 'all' ? 'bg-blue-600 text-white font-semibold' : 'bg-slate-100 hover:bg-slate-200'}`}
          >
            All Sheets
          </button>
          <button
            type="button"
            onClick={() => setSheetFilter(1)}
            className={`px-2 py-0.5 rounded ${sheetFilter === 1 ? 'bg-blue-600 text-white font-semibold' : 'bg-slate-100 hover:bg-slate-200'}`}
          >
            Sheet 1
          </button>
          <button
            type="button"
            onClick={() => setSheetFilter(2)}
            className={`px-2 py-0.5 rounded ${sheetFilter === 2 ? 'bg-blue-600 text-white font-semibold' : 'bg-slate-100 hover:bg-slate-200'}`}
          >
            Sheet 2
          </button>
        </div>
      </div>

      {/* Magnified 300 DPI Crop Box for Rapid HITL Verification */}
      <div className="mx-3 mt-2.5 p-2 bg-slate-900 rounded-lg border border-slate-700 shadow-md flex flex-col gap-1.5 shrink-0">
        <div className="flex items-center justify-between text-[10px] font-semibold text-slate-300">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="uppercase tracking-wider font-mono">300 DPI Vector Crop (HITL Inspector)</span>
          </div>
          <span className="font-mono text-blue-400 text-[10px]">
            {selectedChar ? `#${selectedChar.subNumber || selectedChar.itemNumber} (${selectedChar.drawingZone})` : 'Select a callout'}
          </span>
        </div>
        <div className="w-full h-20 bg-slate-950 rounded border border-slate-800 flex items-center justify-center overflow-hidden relative shadow-inner p-1">
          {cropUrl ? (
            <img
              src={cropUrl}
              alt="Magnified Blueprint Crop"
              className="max-h-full max-w-full object-contain filter invert brightness-150 contrast-125"
            />
          ) : selectedChar ? (
            <div className="flex flex-col items-center justify-center text-center">
              <span className="font-mono text-xs font-bold text-amber-300 bg-amber-950/80 border border-amber-500/40 px-2 py-0.5 rounded">
                {selectedChar.rawText}
              </span>
              <span className="text-[9px] text-slate-500 mt-0.5">Vector Marquee Region</span>
            </div>
          ) : (
            <span className="text-slate-500 text-[11px] font-mono">Click any characteristic to view magnified crop</span>
          )}
        </div>
      </div>

      {/* Characteristic Cards List */}
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2.5 bg-slate-100">
        {filteredItems.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs">
            No characteristics match your current filter.
          </div>
        ) : (
          filteredItems.map((char) => {
            const isFlagged = char.verificationStatus === 'needs_review';
            const isBasic = char.enclosure === 'basic';
            const isRef = char.enclosure === 'reference';
            const isLimit = char.enclosure === 'limit';
            const isSelected = char.id === selectedCharId;

            return (
              <div
                key={char.id}
                onClick={() => onSelectCharacteristic?.(char)}
                className={`p-3 rounded-lg border bg-white shadow-xs transition cursor-pointer ${
                  isSelected
                    ? 'border-blue-600 ring-2 ring-blue-500/30 bg-blue-50/30'
                    : isFlagged
                    ? 'border-amber-300 bg-amber-50/40 hover:border-amber-400'
                    : 'border-slate-200 hover:border-blue-400'
                }`}
              >
                {/* Top Row: Balloon #, Zone, Confidence */}
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold font-mono text-xs flex items-center justify-center shadow-xs">
                      {char.subNumber || char.itemNumber}
                    </span>
                    <span className="text-[11px] font-medium px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                      {char.drawingZone} (Sheet {char.sheetNumber})
                    </span>
                    {isBasic && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">
                        [BASIC]
                      </span>
                    )}
                    {isRef && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                        (REF)
                      </span>
                    )}
                    {isLimit && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-orange-50 text-orange-700 border border-orange-200">
                        LIMIT
                      </span>
                    )}
                    {char.gdtFrame?.compositeLowerTier && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                        COMPOSITE FCF
                      </span>
                    )}
                    {char.holeCallout && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-cyan-50 text-cyan-700 border border-cyan-200">
                        {char.holeCallout.holeType.toUpperCase()}
                      </span>
                    )}
                    {char.fractionStr && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                        {char.fractionStr}
                      </span>
                    )}
                    {char.isUnilateral && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                        UNILATERAL
                      </span>
                    )}
                    {char.isMaxOrMin && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">
                        {char.isMaxOrMin}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    <span
                      className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-medium ${
                        char.confidenceScore >= 0.90
                          ? 'text-emerald-700 bg-emerald-50 border border-emerald-200'
                          : 'text-amber-800 bg-amber-100 border border-amber-300 font-bold'
                      }`}
                    >
                      {Math.round(char.confidenceScore * 100)}% Conf
                    </span>
                  </div>
                </div>

                {/* Main Callout & OCR Text */}
                <div className="mb-2">
                  <div className="font-mono text-sm font-bold text-slate-900 bg-slate-50 px-2 py-1 rounded border border-slate-200 flex items-center justify-between">
                    <span>{char.rawText}</span>
                    <span className="text-[10px] font-sans text-slate-400 uppercase">
                      {char.type}
                    </span>
                  </div>
                </div>

                {/* Tolerance & Limits Grid */}
                <div className="grid grid-cols-3 gap-1 text-[11px] font-mono mb-2 bg-slate-50 p-2 rounded border border-slate-100">
                  <div>
                    <span className="text-slate-400 block text-[9px] uppercase font-sans">Nominal</span>
                    <span className="font-semibold text-slate-800">
                      {char.cleanNominal !== null ? char.cleanNominal : '—'} {char.units}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[9px] uppercase font-sans">Tolerance</span>
                    <span className="text-slate-700">
                      {char.upperTol === 0 && char.lowerTol === 0 ? (
                        '0.000'
                      ) : (
                        `+${char.upperTol} / -${char.lowerTol}`
                      )}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[9px] uppercase font-sans">Limits</span>
                    <span className="text-slate-600 text-[10px]">
                      {char.minLimit ?? '—'} to {char.maxLimit ?? '—'}
                    </span>
                  </div>
                </div>

                {/* Extended Hole Callout Specs if present */}
                {char.holeCallout && (
                  <div className="text-[10px] font-mono bg-cyan-50/60 border border-cyan-100 px-2 py-1 rounded mb-2 text-cyan-900 flex items-center justify-between">
                    <span>
                      <strong>Hole Spec:</strong> {char.holeCallout.holeType.toUpperCase()}
                      {char.holeCallout.counterboreDia ? ` | C'Bore: Ø${char.holeCallout.counterboreDia}` : ''}
                      {char.holeCallout.counterboreDepth ? ` ↧${char.holeCallout.counterboreDepth}` : ''}
                      {char.holeCallout.depth ? ` | Depth: ↧${char.holeCallout.depth}` : ''}
                      {char.holeCallout.countersinkAngle ? ` | C'Sink: ${char.holeCallout.countersinkAngle}°` : ''}
                    </span>
                  </div>
                )}

                {/* Composite GD&T Lower Tier (FRTZF) if present */}
                {char.gdtFrame?.compositeLowerTier && (
                  <div className="text-[10px] font-mono bg-indigo-50/60 border border-indigo-100 px-2 py-1 rounded mb-2 text-indigo-900">
                    <strong>Lower Tier (FRTZF):</strong> {char.gdtFrame.compositeLowerTier.symbol || char.gdtFrame.symbol} {char.gdtFrame.compositeLowerTier.toleranceValue}
                    {char.gdtFrame.compositeLowerTier.primaryDatum ? ` | ${char.gdtFrame.compositeLowerTier.primaryDatum.datum}` : ''}
                    {char.gdtFrame.compositeLowerTier.secondaryDatum ? ` | ${char.gdtFrame.compositeLowerTier.secondaryDatum.datum}` : ''}
                  </div>
                )}

                {/* Tolerance Source Metadata */}
                <div className="text-[10px] text-slate-500 mb-2 flex items-center justify-between">
                  <span>Source: <strong className="text-slate-700">{char.toleranceSource}</strong></span>
                  {char.isToleranceInherited && (
                    <span className="text-blue-600 font-medium">Auto-Inherited</span>
                  )}
                </div>

                {/* Action Bar: Inspection Tooling & Verification */}
                <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-slate-400">Gage:</span>
                    <select
                      value={char.inspectionMethod}
                      onChange={(e) => handleUpdateMethod(char.id, e.target.value as InspectionMethod)}
                      className="text-xs bg-white border border-slate-300 rounded px-1.5 py-0.5 text-slate-700 font-medium cursor-pointer"
                    >
                      {INSPECTION_METHODS.map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {/* Quantity Multiplier 1-Click Splitter */}
                    {char.quantity > 1 && !char.isExpandedMultiplier && (
                      <button
                        type="button"
                        onClick={() => handleExpandMultiplier(char)}
                        className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition font-medium"
                        title="Split into individual 1.1 - 1.4 sub-characteristics for AS9102 Form 3"
                      >
                        <Split className="w-3 h-3" />
                        <span>Split {char.quantity}X</span>
                      </button>
                    )}

                    {isFlagged ? (
                      <button
                        type="button"
                        onClick={() => handleVerify(char.id)}
                        className="px-2.5 py-1 rounded text-xs bg-amber-600 hover:bg-amber-700 text-white font-medium transition shadow-xs"
                      >
                        Verify
                      </button>
                    ) : (
                      <span className="flex items-center gap-1 text-[11px] text-emerald-700 font-medium px-1.5 py-0.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Accepted</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
