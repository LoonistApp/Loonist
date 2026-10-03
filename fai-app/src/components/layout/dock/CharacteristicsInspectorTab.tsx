import React, { useState, useRef, useEffect } from 'react';
import type { 
  EngineeringCharacteristic, 
  InspectionMethod 
} from '../../../types/characteristics';
import { MultiplierParser } from '../../../services/ai/multiplierParser';
import { formatBalloonNumber } from '../../../utils/balloonFormat';
import { 
  CheckCircle2, 
  AlertTriangle, 
  Layers, 
  Split,
  Balloon,
  Trash2
} from 'lucide-react';

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

interface CharacteristicsInspectorTabProps {
  characteristics: EngineeringCharacteristic[];
  selectedChar: EngineeringCharacteristic | null;
  onSelectCharacteristic: (char: EngineeringCharacteristic) => void;
  onUpdateCharacteristic: (char: EngineeringCharacteristic) => void;
  onUpdateCharacteristics?: (chars: EngineeringCharacteristic[]) => void;
  onDeleteCharacteristic?: (charId: string) => void;
  hudCropDataUrl?: string | null;
  activeSheetNumber?: number;
  balloonPrefix?: string;
}

export const CharacteristicsInspectorTab: React.FC<CharacteristicsInspectorTabProps> = ({
  characteristics,
  selectedChar,
  onSelectCharacteristic,
  onUpdateCharacteristic,
  onUpdateCharacteristics,
  onDeleteCharacteristic,
  hudCropDataUrl,
  activeSheetNumber,
  balloonPrefix
}) => {
  const [filterNeedsReview, setFilterNeedsReview] = useState(false);
  const [sheetScope, setSheetScope] = useState<'current' | 'all'>('current');

  const totalCount = characteristics.length;
  const needsReviewCount = characteristics.filter(c => c.verificationStatus === 'needs_review').length;
  const verifiedCount = characteristics.filter(c => c.verificationStatus === 'verified' || c.verificationStatus === 'auto_accepted').length;

  const currentSheetNum = activeSheetNumber || (characteristics[0]?.sheetNumber ?? 1);
  const currentSheetItemsCount = characteristics.filter(c => c.sheetNumber === currentSheetNum).length;

  // Only consider selectedChar active if it belongs to the current sheet scope
  const isSelectedInScope = selectedChar && (sheetScope === 'all' || selectedChar.sheetNumber === currentSheetNum);
  const activeChar = isSelectedInScope ? selectedChar : null;
  const activeCropUrl = isSelectedInScope ? hudCropDataUrl : null;

  const filteredItems = characteristics.filter(c => {
    if (filterNeedsReview && c.verificationStatus !== 'needs_review') return false;
    if (sheetScope === 'current' && c.sheetNumber !== currentSheetNum) return false;
    return true;
  });

  const handleVerify = (char: EngineeringCharacteristic, e: React.MouseEvent) => {
    e.stopPropagation();
    onUpdateCharacteristic({
      ...char,
      verificationStatus: 'verified'
    });
  };

  const handleUpdateMethod = (char: EngineeringCharacteristic, method: InspectionMethod, e: React.ChangeEvent<HTMLSelectElement>) => {
    e.stopPropagation();
    onUpdateCharacteristic({
      ...char,
      inspectionMethod: method
    });
  };

  const handleExpandMultiplier = (char: EngineeringCharacteristic, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onUpdateCharacteristics) return;
    const subItems = MultiplierParser.expandCharacteristic(char);
    const index = characteristics.findIndex(c => c.id === char.id);
    if (index !== -1) {
      const newChars = [...characteristics];
      newChars.splice(index, 1, ...subItems);
      onUpdateCharacteristics(newChars);
    }
  };

  const listContainerRef = useRef<HTMLDivElement>(null);
  const selectedCardRef = useRef<HTMLDivElement>(null);

  // Automatically scroll the Inspections results list so the matching
  // inspected result card is brought directly to the top of the visible panel
  useEffect(() => {
    if (!activeChar?.id) return;

    const timer = setTimeout(() => {
      if (selectedCardRef.current && listContainerRef.current) {
        const container = listContainerRef.current;
        const card = selectedCardRef.current;
        const containerRect = container.getBoundingClientRect();
        const cardRect = card.getBoundingClientRect();
        const relativeTop = cardRect.top - containerRect.top;

        container.scrollTo({
          top: container.scrollTop + relativeTop - 4,
          behavior: 'smooth'
        });
      }
    }, 50);

    return () => clearTimeout(timer);
  }, [activeChar?.id]);

  return (
    <div className="flex flex-col h-full overflow-hidden select-none bg-slate-100">
      {/* Quality Telemetry & Filter Strip */}
      <div className="p-2.5 border-b border-slate-200 bg-white flex flex-col gap-2 shrink-0">
        <div className="flex items-center justify-between text-xs font-medium">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-bold border border-slate-200">
              {sheetScope === 'current' ? `${currentSheetItemsCount} of ${totalCount} Items` : `${totalCount} Items`}
            </span>
            <span className="flex items-center gap-1 text-slate-700 font-semibold text-[11px]">
              <CheckCircle2 className="w-3.5 h-3.5 text-slate-500" />
              <span>{verifiedCount} Accepted</span>
            </span>
            {needsReviewCount > 0 && (
              <span className="flex items-center gap-1 text-amber-700 font-semibold text-[11px]">
                <AlertTriangle className="w-3.5 h-3.5 animate-pulse" />
                <span>{needsReviewCount} Needs Review</span>
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => setFilterNeedsReview(!filterNeedsReview)}
            className={`px-2 py-0.5 rounded text-[10px] font-semibold border transition cursor-pointer ${
              filterNeedsReview 
                ? 'bg-amber-100 text-amber-800 border-amber-300' 
                : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
            }`}
          >
            {filterNeedsReview ? 'Showing Flagged Only' : 'Filter Needs Review'}
          </button>
        </div>

        {/* Scope Selector: Controlled by Bottom Drawing Viewport Sheet Navigation */}
        <div className="flex items-center justify-between text-[11px] text-slate-600 w-full pt-0.5">
          <span className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-500 select-none">
            <Layers className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <span>Scope:</span>
          </span>

          <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded border border-slate-200">
            <button
              type="button"
              onClick={() => setSheetScope('current')}
              className={`px-2.5 py-0.5 rounded text-[10px] transition cursor-pointer flex items-center gap-1 ${
                sheetScope === 'current'
                  ? 'bg-white text-slate-900 font-bold shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 font-medium'
              }`}
              title={`Inspect characteristics on active Sheet ${currentSheetNum} (controlled by bottom sheet tabs)`}
            >
              <span>Sheet {currentSheetNum}</span>
              <span className="text-[9px] opacity-75 font-mono">({currentSheetItemsCount})</span>
            </button>

            <button
              type="button"
              onClick={() => setSheetScope('all')}
              className={`px-2.5 py-0.5 rounded text-[10px] transition cursor-pointer flex items-center gap-1 ${
                sheetScope === 'all'
                  ? 'bg-white text-slate-900 font-bold shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 font-medium'
              }`}
              title="Inspect all characteristics across all sheets"
            >
              <span>All Sheets</span>
              <span className="text-[9px] opacity-75 font-mono">({totalCount})</span>
            </button>
          </div>
        </div>
      </div>

      {/* Magnified Blueprint Crop Display */}
      <div className="mx-2 mt-2 p-2 bg-white rounded-lg border border-slate-200 shadow-xs flex flex-col gap-1.5 shrink-0">
        <div className="flex items-center justify-between text-[10px] font-semibold text-slate-700">
          <div className="flex items-center gap-1.5">
            {activeChar ? (
              <>
                <span className="w-2 h-2 rounded-full bg-slate-500" />
                <span className="font-mono text-slate-900 font-bold text-xs">
                  #{formatBalloonNumber(activeChar.itemNumber, activeChar.subNumber, balloonPrefix)} ({activeChar.drawingZone || 'Sheet ' + activeChar.sheetNumber})
                </span>
              </>
            ) : (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                <span className="text-[10px] font-medium text-slate-500">Blueprint Crop Preview</span>
              </>
            )}
          </div>

          {activeChar && onDeleteCharacteristic && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDeleteCharacteristic(activeChar.id);
              }}
              className="p-1 rounded text-slate-500 hover:text-slate-900 hover:bg-slate-200 transition cursor-pointer"
              title={`Delete Balloon #${formatBalloonNumber(activeChar.itemNumber, activeChar.subNumber, balloonPrefix)}`}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="w-full h-20 bg-slate-50 rounded border border-slate-200 flex items-center justify-center overflow-hidden relative shadow-inner p-1">
          {activeCropUrl && activeChar ? (
            <img
              src={activeCropUrl}
              alt="Magnified Blueprint Crop"
              className="max-h-full max-w-full object-contain"
            />
          ) : activeChar ? (
            <div className="flex flex-col items-center justify-center text-center">
              <span className="font-mono text-xs font-bold text-amber-800 bg-amber-50 border border-amber-300 px-2 py-0.5 rounded">
                {activeChar.rawText}
              </span>
              <span className="text-[9px] text-slate-500 mt-0.5">Vector Marquee Region</span>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center text-center select-none py-1">
              <Balloon className="w-4 h-4 text-slate-400 mb-1 opacity-75" />
              <span className="text-slate-500 text-[11px] font-medium">
                Select a balloon to display
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Characteristic Cards Review List */}
      <div ref={listContainerRef} className="flex-1 overflow-y-auto p-2 flex flex-col gap-2">
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
            const isSelected = selectedChar?.id === char.id;

            return (
              <div
                key={char.id}
                ref={isSelected ? selectedCardRef : undefined}
                onClick={() => onSelectCharacteristic(char)}
                className={`p-2.5 rounded-lg border bg-white shadow-xs transition cursor-pointer ${
                  isSelected
                    ? 'border-slate-500 ring-2 ring-slate-400/30 bg-slate-100/60'
                    : isFlagged
                    ? 'border-amber-300 bg-amber-50/40 hover:border-amber-400'
                    : 'border-slate-200 hover:border-slate-400'
                }`}
              >
                {/* Top Row: Balloon #, Zone, Confidence */}
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="min-w-5 h-5 px-1.5 rounded bg-white text-slate-900 border border-slate-300 font-bold font-mono text-[11px] flex items-center justify-center shrink-0 shadow-2xs">
                      {formatBalloonNumber(char.itemNumber, char.subNumber, balloonPrefix)}
                    </span>
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                      {char.drawingZone} (Sheet {char.sheetNumber})
                    </span>
                    {isBasic && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">
                        [BASIC]
                      </span>
                    )}
                    {isRef && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                        (REF)
                      </span>
                    )}
                    {isLimit && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-orange-50 text-orange-700 border border-orange-200">
                        LIMIT
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    {isFlagged ? (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300">
                        Needs Review
                      </span>
                    ) : char.classification && char.classification !== 'Minor' ? (
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                        char.classification === 'Critical'
                          ? 'bg-red-50 text-red-700 border border-red-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}>
                        {char.classification}
                      </span>
                    ) : null}
                  </div>
                </div>

                {/* Main Callout & OCR Text */}
                <div className="mb-1.5">
                  <div className="font-mono text-xs font-bold text-slate-900 bg-slate-50 px-2 py-1 rounded border border-slate-200 flex items-center justify-between">
                    <span className="truncate">{char.rawText}</span>
                    {char.type && (char.type as string) !== 'DIMENSION' && char.type.toLowerCase() !== 'linear' && (
                      <span className="text-[9px] font-sans text-slate-400 uppercase shrink-0 ml-1">
                        {char.type}
                      </span>
                    )}
                  </div>
                </div>

                {/* Tolerance & Limits Grid */}
                <div className="grid grid-cols-3 gap-1 text-[10px] font-mono mb-1.5 bg-slate-50 p-1.5 rounded border border-slate-100">
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
                    <span className="text-slate-600 text-[9px]">
                      {char.minLimit ?? '—'} to {char.maxLimit ?? '—'}
                    </span>
                  </div>
                </div>

                {/* Tolerance Source Metadata */}
                <div className="text-[10px] text-slate-500 mb-1.5 flex items-center">
                  <span className="truncate">Source: <strong className="text-slate-700">{char.toleranceSource}</strong></span>
                </div>

                {/* Action Bar: Inspection Tooling & Verification */}
                <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-slate-400">Gage:</span>
                    <select
                      value={char.inspectionMethod}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => handleUpdateMethod(char, e.target.value as InspectionMethod, e)}
                      className="text-[11px] bg-white border border-slate-300 rounded px-1.5 py-0.5 text-slate-700 font-medium cursor-pointer"
                    >
                      {INSPECTION_METHODS.map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {/* Quantity Multiplier 1-Click Splitter */}
                    {char.quantity > 1 && !char.isExpandedMultiplier && onUpdateCharacteristics && (
                      <button
                        type="button"
                        onClick={(e) => handleExpandMultiplier(char, e)}
                        className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-slate-100 text-slate-700 border border-slate-300 hover:bg-slate-200 transition font-medium cursor-pointer"
                        title="Split into individual sub-characteristics for AS9102 Form 3"
                      >
                        <Split className="w-3 h-3" />
                        <span>Split {char.quantity}X</span>
                      </button>
                    )}

                    {isFlagged ? (
                      <button
                        type="button"
                        onClick={(e) => handleVerify(char, e)}
                        className="px-2 py-0.5 rounded text-[11px] bg-amber-600 hover:bg-amber-700 text-white font-semibold transition shadow-xs cursor-pointer"
                      >
                        Verify
                      </button>
                    ) : (
                      <span className="flex items-center gap-1 text-[10px] text-slate-600 font-medium px-1 py-0.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-slate-500" />
                        <span>Accepted</span>
                      </span>
                    )}

                    {onDeleteCharacteristic && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteCharacteristic(char.id);
                        }}
                        className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition cursor-pointer ml-0.5"
                        title={`Delete Balloon #${formatBalloonNumber(char.itemNumber, char.subNumber, balloonPrefix)}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
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
