import React, { useState } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Trash2,
  ExternalLink,
  X,
  Split,
  Palette,
  Edit3,
  Wrench,
  Check,
  Layers,
  Circle,
  Square,
  Triangle,
  Hexagon,
  Balloon,
  Gauge
} from 'lucide-react';
import type {
  EngineeringCharacteristic,
  BalloonShape,
  InspectionMethod
} from '../../types/characteristics';
import { INSPECTION_METHODS } from '../../types/characteristics';
import { MeasurementEngine } from '../../services/compliance/measurementEngine';
import { MultiplierParser } from '../../services/ai/multiplierParser';

interface BalloonActionPopoverProps {
  characteristic: EngineeringCharacteristic;
  allCharacteristics: EngineeringCharacteristic[];
  balloonX: number;
  balloonY: number;
  badgeSize: number;
  sheetWidth?: number;
  sheetHeight?: number;
  defaultShape: BalloonShape;
  defaultColor: string;
  onUpdateCharacteristic: (char: EngineeringCharacteristic) => void;
  onUpdateCharacteristics?: (chars: EngineeringCharacteristic[]) => void;
  onDeleteCharacteristic?: (charId: string) => void;
  onOpenInspector?: () => void;
  onClose: () => void;
}

const BALLOON_SHAPES: Array<{
  id: BalloonShape;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'balloon', label: 'Balloon', Icon: Balloon },
  { id: 'circle', label: 'Circle', Icon: Circle },
  { id: 'triangle', label: 'Flag Note', Icon: Triangle },
  { id: 'hexagon', label: 'GD&T', Icon: Hexagon },
  { id: 'square', label: 'Basic', Icon: Square }
];

const BALLOON_COLORS = [
  { name: 'blue', hex: '#2563eb', label: 'Blue' },
  { name: 'green', hex: '#059669', label: 'Green' },
  { name: 'amber', hex: '#d97706', label: 'Amber' },
  { name: 'red', hex: '#dc2626', label: 'Red' },
  { name: 'black', hex: '#0f172a', label: 'Black' }
];

export const BalloonActionPopover: React.FC<BalloonActionPopoverProps> = ({
  characteristic,
  allCharacteristics,
  balloonX,
  balloonY,
  badgeSize,
  sheetWidth,
  sheetHeight,
  defaultShape,
  defaultColor,
  onUpdateCharacteristic,
  onUpdateCharacteristics,
  onDeleteCharacteristic,
  onOpenInspector,
  onClose
}) => {
  const [activeTab, setActiveTab] = useState<'measure' | 'edit' | 'appearance' | 'split' | 'method'>('measure');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const balloonNum = characteristic.subNumber || characteristic.itemNumber;
  const activeShape = characteristic.customBalloonShape || defaultShape;
  const activeColor = characteristic.customBalloonColor || defaultColor;

  // Handle in-place measurement entry
  const handleMeasuredChange = (valStr: string) => {
    const val = valStr.trim();
    const num = val === '' ? null : parseFloat(val);
    if (val === '' || !isNaN(num as number)) {
      const evalRes = MeasurementEngine.evaluateMeasurement(characteristic, num);
      onUpdateCharacteristic({
        ...characteristic,
        measuredValue: num,
        conformanceStatus: evalRes.status,
        deviation: evalRes.deviation,
        measuredAt: new Date().toISOString()
      });
    }
  };

  // Handle 1-click multiplier expand
  const handleSplitMultiplier = () => {
    if (!onUpdateCharacteristics) return;
    const subItems = MultiplierParser.expandCharacteristic(characteristic);
    const index = allCharacteristics.findIndex((c) => c.id === characteristic.id);
    if (index !== -1) {
      const newChars = [...allCharacteristics];
      newChars.splice(index, 1, ...subItems);
      onUpdateCharacteristics(newChars);
      onClose();
    }
  };

  // Handle merge sub-balloons back to parent
  const handleMergeSubBalloons = () => {
    if (!onUpdateCharacteristics || !characteristic.parentCharacteristicId) return;
    const parentId = characteristic.parentCharacteristicId;
    const subItems = allCharacteristics.filter((c) => c.parentCharacteristicId === parentId);
    if (subItems.length === 0) return;

    const firstSub = subItems[0];
    const restoredParent: EngineeringCharacteristic = {
      ...firstSub,
      id: parentId,
      subNumber: undefined,
      isExpandedMultiplier: false,
      parentCharacteristicId: undefined,
      rawText: firstSub.rawText.replace(/\s*\[Part \d+ of \d+\]/, '')
    };

    const newChars = allCharacteristics.filter((c) => c.parentCharacteristicId !== parentId);
    newChars.push(restoredParent);
    // Sort by item number
    newChars.sort((a, b) => a.itemNumber - b.itemNumber);
    onUpdateCharacteristics(newChars);
    onClose();
  };

  // Compute popover placement (anchored offset from badge, flips to left if tight on right)
  const popoverWidth = 320;
  const shouldFlipLeft = sheetWidth ? (balloonX + badgeSize + 12 + popoverWidth > sheetWidth) : false;
  const popoverLeft = shouldFlipLeft
    ? Math.max(8, balloonX - popoverWidth - 12)
    : balloonX + badgeSize + 12;
  const popoverTop = sheetHeight
    ? Math.max(8, Math.min(balloonY - 20, sheetHeight - 400))
    : Math.max(8, balloonY - 20);

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      style={{
        position: 'absolute',
        left: `${popoverLeft}px`,
        top: `${popoverTop}px`,
        zIndex: 50
      }}
      className="w-80 bg-white rounded-lg shadow-2xl border border-slate-200 text-slate-800 flex flex-col overflow-hidden select-none pointer-events-auto cursor-default"
    >
      {/* 1. HEADER BAR: Title, Zone, Fast Action Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border-b border-slate-200">
        <div className="flex items-center gap-2">
          {/* Balloon Identity Pill */}
          <span className="flex items-center gap-1 font-mono font-bold text-xs px-2 py-0.5 rounded bg-slate-200 text-slate-900 border border-slate-300">
            <span>#{balloonNum}</span>
          </span>

          <span className="text-[10px] font-mono text-slate-500 font-semibold">
            {characteristic.drawingZone || 'Zone --'}
          </span>

          {characteristic.sheetNumber > 1 && (
            <span className="text-[10px] font-mono text-slate-400">
              Sh.{characteristic.sheetNumber}
            </span>
          )}
        </div>

        {/* Quick Action Icons */}
        <div className="flex items-center gap-1">
          {/* Verification Status Toggle */}
          {(() => {
            const isVerified = characteristic.verificationStatus === 'verified' || characteristic.verificationStatus === 'auto_accepted';
            return (
              <button
                type="button"
                onClick={() => {
                  onUpdateCharacteristic({
                    ...characteristic,
                    verificationStatus: isVerified ? 'needs_review' : 'verified'
                  });
                }}
                title={isVerified ? 'Verified / Accepted (Click to Flag for Review)' : 'Needs Review (Click to Accept Item)'}
                className={`p-1 rounded transition cursor-pointer ${
                  isVerified
                    ? 'text-emerald-600 hover:bg-emerald-50'
                    : 'text-amber-500 hover:bg-amber-50 animate-pulse'
                }`}
              >
                {isVerified ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : (
                  <AlertTriangle className="w-4 h-4" />
                )}
              </button>
            );
          })()}

          {/* Reset Custom Position (if moved) */}
          {characteristic.customBalloonPosition && (
            <button
              type="button"
              onClick={() => {
                onUpdateCharacteristic({
                  ...characteristic,
                  customBalloonPosition: undefined
                });
              }}
              title="Reset to default position"
              className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Expand into Full Inspector Dock */}
          {onOpenInspector && (
            <button
              type="button"
              onClick={() => {
                onOpenInspector();
              }}
              title="Open full inspector dock"
              className="p-1 rounded text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Delete Characteristic */}
          {onDeleteCharacteristic && (
            confirmDelete ? (
              <button
                type="button"
                onClick={() => {
                  onDeleteCharacteristic(characteristic.id);
                  onClose();
                }}
                title="Confirm delete"
                className="px-1.5 py-0.5 rounded bg-red-600 text-white font-bold text-[10px] hover:bg-red-700 transition cursor-pointer"
              >
                Delete?
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                title="Delete balloon"
                className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )
          )}

          {/* Close Popover */}
          <button
            type="button"
            onClick={onClose}
            title="Close (Esc)"
            className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer ml-1"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 2. AS9102 FORM 3 IN-PLACE MEASUREMENT BAR */}
      <div className="p-3 bg-white border-b border-slate-100 flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-slate-600">
            Actual Measurement
          </span>

          {/* Conformance Status Badge */}
          {characteristic.conformanceStatus === 'PASS' && (
            <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold text-[10px] border border-emerald-200 flex items-center gap-1">
              <Check className="w-3 h-3" /> PASS
            </span>
          )}
          {characteristic.conformanceStatus === 'MARGINAL' && (
            <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-bold text-[10px] border border-amber-300 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> MARGINAL
            </span>
          )}
          {characteristic.conformanceStatus === 'FAIL' && (
            <span className="px-2 py-0.5 rounded bg-red-100 text-red-800 font-bold text-[10px] border border-red-300 animate-pulse flex items-center gap-1">
              <X className="w-3 h-3" /> FAIL
            </span>
          )}
          {(!characteristic.conformanceStatus || characteristic.conformanceStatus === 'UNMEASURED') && (
            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-500 font-medium text-[10px]">
              UNMEASURED
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Quick Measured Input */}
          <div className="relative flex-1">
            <input
              type="number"
              step="0.0001"
              placeholder={`Nom: ${characteristic.cleanNominal ?? '--'}`}
              value={characteristic.measuredValue !== null && characteristic.measuredValue !== undefined ? characteristic.measuredValue : ''}
              onChange={(e) => handleMeasuredChange(e.target.value)}
              className="w-full pl-2.5 pr-8 py-1.5 bg-slate-50 border-2 border-slate-300 focus:border-slate-800 rounded text-sm font-mono font-bold text-slate-900 focus:outline-hidden"
              autoFocus
            />
            {characteristic.measuredValue !== null && characteristic.measuredValue !== undefined && (
              <button
                type="button"
                onClick={() => handleMeasuredChange('')}
                title="Clear measurement"
                className="absolute right-2 top-2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Deviation Output */}
          <div className="w-24 px-2 py-1.5 bg-slate-100 rounded border border-slate-200 flex flex-col justify-center">
            <span className="text-[9px] text-slate-400 font-semibold uppercase">Deviation</span>
            <span className="text-xs font-mono font-bold truncate">
              {characteristic.deviation !== null && characteristic.deviation !== undefined ? (
                <span className={characteristic.deviation > 0 ? 'text-amber-600' : characteristic.deviation < 0 ? 'text-slate-700' : 'text-slate-600'}>
                  {characteristic.deviation > 0 ? `+${characteristic.deviation.toFixed(4)}` : characteristic.deviation.toFixed(4)}
                </span>
              ) : (
                <span className="text-slate-400">--</span>
              )}
            </span>
          </div>
        </div>

        {/* Specification Limits Reference */}
        <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 px-1 pt-0.5">
          <span>Min: <b className="text-slate-700">{characteristic.minLimit?.toFixed(4) ?? '--'}</b></span>
          <span>Nom: <b className="text-slate-700">{characteristic.cleanNominal?.toFixed(4) ?? '--'}</b></span>
          <span>Max: <b className="text-slate-700">{characteristic.maxLimit?.toFixed(4) ?? '--'}</b></span>
        </div>
      </div>

      {/* 3. COMPACT TAB NAVIGATOR */}
      <div className="flex items-center justify-around border-b border-slate-200 bg-slate-50 text-xs px-1">
        <button
          type="button"
          onClick={() => setActiveTab('measure')}
          className={`py-1.5 px-2 font-medium transition flex items-center gap-1 cursor-pointer border-b-2 text-[11px] ${
            activeTab === 'measure'
              ? 'border-slate-900 text-slate-900 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Gauge className="w-3 h-3" />
          <span>Quick</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('edit')}
          className={`py-1.5 px-2 font-medium transition flex items-center gap-1 cursor-pointer border-b-2 text-[11px] ${
            activeTab === 'edit'
              ? 'border-slate-900 text-slate-900 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Edit3 className="w-3 h-3" />
          <span>Tolerance</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('appearance')}
          className={`py-1.5 px-2 font-medium transition flex items-center gap-1 cursor-pointer border-b-2 text-[11px] ${
            activeTab === 'appearance'
              ? 'border-slate-900 text-slate-900 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Palette className="w-3 h-3" />
          <span>Style</span>
        </button>

        {(characteristic.quantity > 1 || characteristic.isExpandedMultiplier) && (
          <button
            type="button"
            onClick={() => setActiveTab('split')}
            className={`py-1.5 px-2 font-medium transition flex items-center gap-1 cursor-pointer border-b-2 text-[11px] ${
              activeTab === 'split'
                ? 'border-slate-900 text-slate-900 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Split className="w-3 h-3" />
            <span>Multi-Hole</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => setActiveTab('method')}
          className={`py-1.5 px-2 font-medium transition flex items-center gap-1 cursor-pointer border-b-2 text-[11px] ${
            activeTab === 'method'
              ? 'border-slate-900 text-slate-900 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Wrench className="w-3 h-3" />
          <span>Method</span>
        </button>
      </div>

      {/* 4. TAB CONTENTS */}
      <div className="p-3 max-h-56 overflow-y-auto text-xs flex flex-col gap-2.5">
        {/* TAB: QUICK SUMMARY */}
        {activeTab === 'measure' && (
          <div className="flex flex-col gap-2">
            <div>
              <span className="text-[10px] text-slate-400 font-semibold block mb-0.5">
                Requirement / Callout Text
              </span>
              <div className="p-2 rounded bg-slate-50 font-mono text-xs border border-slate-200 text-slate-800">
                {characteristic.rawText}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div>
                <span className="text-[10px] text-slate-400 font-semibold block">Type</span>
                <span className="font-semibold text-slate-700">{characteristic.subType || characteristic.type}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-semibold block">Inspection Method</span>
                <span className="font-semibold text-slate-700">{characteristic.inspectionMethod}</span>
              </div>
            </div>

            {/* Quick Inspector Initials */}
            <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
              <span className="text-[10px] text-slate-400 font-semibold">Inspector:</span>
              <input
                type="text"
                maxLength={6}
                placeholder="e.g. QC-1"
                value={characteristic.inspectorInitials || ''}
                onChange={(e) => onUpdateCharacteristic({
                  ...characteristic,
                  inspectorInitials: e.target.value.toUpperCase()
                })}
                className="w-20 px-2 py-0.5 bg-slate-50 border border-slate-300 rounded font-mono text-xs uppercase"
              />
            </div>
          </div>
        )}

        {/* TAB: TOLERANCE & LIMITS EDIT */}
        {activeTab === 'edit' && (
          <div className="flex flex-col gap-2">
            <div>
              <label className="text-[10px] text-slate-400 font-semibold block mb-0.5">Callout String</label>
              <input
                type="text"
                value={characteristic.rawText}
                onChange={(e) => onUpdateCharacteristic({ ...characteristic, rawText: e.target.value })}
                className="w-full px-2 py-1 bg-slate-50 border border-slate-300 rounded font-mono text-xs"
              />
            </div>

            <div className="grid grid-cols-3 gap-1.5">
              <div>
                <label className="text-[10px] text-slate-400 font-semibold block mb-0.5">Nominal</label>
                <input
                  type="number"
                  step="0.001"
                  value={characteristic.cleanNominal ?? ''}
                  onChange={(e) => {
                    const nom = parseFloat(e.target.value) || 0;
                    const up = characteristic.upperTol || 0;
                    const low = characteristic.lowerTol || 0;
                    onUpdateCharacteristic({
                      ...characteristic,
                      cleanNominal: nom,
                      minLimit: nom - low,
                      maxLimit: nom + up,
                      lowerLimit: nom - low,
                      upperLimit: nom + up
                    });
                  }}
                  className="w-full px-1.5 py-1 bg-slate-50 border border-slate-300 rounded font-mono text-xs font-bold"
                />
              </div>

              <div>
                <label className="text-[10px] text-slate-400 font-semibold block mb-0.5">+Tol</label>
                <input
                  type="number"
                  step="0.001"
                  value={characteristic.upperTol ?? ''}
                  onChange={(e) => {
                    const up = parseFloat(e.target.value) || 0;
                    const nom = characteristic.cleanNominal || 0;
                    onUpdateCharacteristic({
                      ...characteristic,
                      upperTol: up,
                      plusTol: up,
                      maxLimit: nom + up,
                      upperLimit: nom + up
                    });
                  }}
                  className="w-full px-1.5 py-1 bg-slate-50 border border-slate-300 rounded font-mono text-xs"
                />
              </div>

              <div>
                <label className="text-[10px] text-slate-400 font-semibold block mb-0.5">-Tol</label>
                <input
                  type="number"
                  step="0.001"
                  value={characteristic.lowerTol ?? ''}
                  onChange={(e) => {
                    const low = Math.abs(parseFloat(e.target.value) || 0);
                    const nom = characteristic.cleanNominal || 0;
                    onUpdateCharacteristic({
                      ...characteristic,
                      lowerTol: low,
                      minusTol: -low,
                      minLimit: nom - low,
                      lowerLimit: nom - low
                    });
                  }}
                  className="w-full px-1.5 py-1 bg-slate-50 border border-slate-300 rounded font-mono text-xs"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 pt-1 text-[11px]">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={characteristic.isBasic}
                  onChange={(e) => onUpdateCharacteristic({ ...characteristic, isBasic: e.target.checked })}
                  className="rounded border-slate-300 accent-slate-700 text-slate-700"
                />
                <span>Basic [0 Tol]</span>
              </label>

              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={characteristic.forReference}
                  onChange={(e) => onUpdateCharacteristic({ ...characteristic, forReference: e.target.checked })}
                  className="rounded border-slate-300 accent-slate-700 text-slate-700"
                />
                <span>Reference</span>
              </label>

              <div className="ml-auto">
                <select
                  value={characteristic.classification}
                  onChange={(e) => onUpdateCharacteristic({ ...characteristic, classification: e.target.value as any })}
                  className="text-[10px] font-semibold bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5"
                >
                  <option value="Critical">Critical</option>
                  <option value="Major">Major</option>
                  <option value="Minor">Minor</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* TAB: APPEARANCE OVERRIDES */}
        {activeTab === 'appearance' && (
          <div className="flex flex-col gap-2.5">
            <div>
              <span className="text-[10px] text-slate-400 font-semibold block mb-1">
                Balloon Shape for #{balloonNum}
              </span>
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded border border-slate-200">
                {BALLOON_SHAPES.map((s) => {
                  const isSelected = activeShape === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => onUpdateCharacteristic({
                        ...characteristic,
                        customBalloonShape: s.id
                      })}
                      title={s.label}
                      className={`flex-1 py-1 flex items-center justify-center rounded cursor-pointer transition ${
                        isSelected
                          ? 'bg-white shadow-2xs font-bold text-slate-900'
                          : 'text-slate-500 hover:bg-slate-200/60'
                      }`}
                    >
                      <s.Icon className="w-3.5 h-3.5" />
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <span className="text-[10px] text-slate-400 font-semibold block mb-1">
                Balloon Color for #{balloonNum}
              </span>
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded border border-slate-200">
                {BALLOON_COLORS.map((c) => {
                  const isSelected = activeColor === c.name;
                  return (
                    <button
                      key={c.name}
                      type="button"
                      onClick={() => onUpdateCharacteristic({
                        ...characteristic,
                        customBalloonColor: c.name
                      })}
                      title={c.label}
                      style={{ backgroundColor: c.hex }}
                      className={`flex-1 h-5 rounded transition-transform cursor-pointer flex items-center justify-center border ${
                        c.name === 'black'
                          ? 'border-slate-400'
                          : 'border-black/15'
                      } ${
                        isSelected
                          ? 'ring-2 ring-offset-1 ring-slate-700 scale-105'
                          : 'opacity-90 hover:opacity-100 hover:scale-105'
                      }`}
                    >
                      {isSelected && <Check className="w-3 h-3 text-white stroke-[3]" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Reset Appearance to Global Project Settings */}
            {(characteristic.customBalloonShape || characteristic.customBalloonColor) && (
              <button
                type="button"
                onClick={() => onUpdateCharacteristic({
                  ...characteristic,
                  customBalloonShape: undefined,
                  customBalloonColor: undefined
                })}
                className="text-[10px] text-slate-500 hover:text-slate-800 text-center py-1 underline cursor-pointer"
              >
                Reset shape & color to project default
              </button>
            )}
          </div>
        )}

        {/* TAB: MULTI-HOLE SPLIT / SUB-BALLOONS */}
        {activeTab === 'split' && (
          <div className="flex flex-col gap-2">
            {characteristic.quantity > 1 && !characteristic.isExpandedMultiplier && (
              <div className="flex flex-col gap-2 p-2 bg-slate-100 rounded border border-slate-200">
                <span className="font-semibold text-slate-900">
                  Multiplier Callout Detected ({characteristic.quantity}X)
                </span>
                <p className="text-[11px] text-slate-600">
                  Splits this {characteristic.quantity}X callout into individual sub-balloons ({balloonNum}.1, {balloonNum}.2...) so each physical feature can be measured independently.
                </p>
                <button
                  type="button"
                  onClick={handleSplitMultiplier}
                  className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-2xs transition cursor-pointer"
                >
                  <Split className="w-3.5 h-3.5" />
                  <span>Split into {characteristic.quantity} Sub-Balloons</span>
                </button>
              </div>
            )}

            {characteristic.isExpandedMultiplier && (
              <div className="flex flex-col gap-2 p-2 bg-slate-50 rounded border border-slate-200">
                <span className="font-semibold text-slate-700">
                  Sub-Balloon Feature ({balloonNum})
                </span>
                <p className="text-[11px] text-slate-500">
                  This balloon is part of an expanded multi-hole set. You can merge all sub-items back into a single parent characteristic.
                </p>
                <button
                  type="button"
                  onClick={handleMergeSubBalloons}
                  className="px-3 py-1.5 rounded bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Merge All Sub-Balloons</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* TAB: INSPECTION METHOD & GAGE */}
        {activeTab === 'method' && (
          <div className="flex flex-col gap-2">
            <div>
              <label className="text-[10px] text-slate-400 font-semibold block mb-0.5">Inspection Method / Tool</label>
              <select
                value={characteristic.inspectionMethod}
                onChange={(e) => onUpdateCharacteristic({
                  ...characteristic,
                  inspectionMethod: e.target.value as InspectionMethod
                })}
                className="w-full px-2 py-1 bg-slate-50 border border-slate-300 rounded text-xs"
              >
                {INSPECTION_METHODS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] text-slate-400 font-semibold block mb-0.5">Comments / Remark</label>
              <textarea
                rows={2}
                value={characteristic.comments || ''}
                onChange={(e) => onUpdateCharacteristic({
                  ...characteristic,
                  comments: e.target.value
                })}
                placeholder="AS9102 Form 3 remark or gage serial..."
                className="w-full px-2 py-1 bg-slate-50 border border-slate-300 rounded text-xs resize-none"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
