import React from 'react';
import { RibbonGroup } from '../RibbonGroup';
import type { 
  ProjectSettings, 
  As9102StandardRevision, 
  AqlLevel, 
  InspectionLevel, 
  SecurityWatermark, 
  DelimiterStyle 
} from '../../../../types/settings';
import { DEFAULT_AEROSPACE_TOLERANCES } from '../../../../types/characteristics';
import { DEFAULT_METRIC_ISO_TOLERANCES } from '../../../../services/ai/toleranceEngine';

import { Settings } from 'lucide-react';
import type { SettingsTab } from '../../../modals/ProjectSettingsModal';

interface SettingsRibbonTabProps {
  settings: ProjectSettings;
  onUpdateSettings: (newSettings: ProjectSettings) => void;
  onOpenSettingsModal?: (tab?: SettingsTab) => void;
}

export const SettingsRibbonTab: React.FC<SettingsRibbonTabProps> = ({
  settings,
  onUpdateSettings,
  onOpenSettingsModal
}) => {
  const update = (patch: Partial<ProjectSettings>) => {
    onUpdateSettings({
      ...settings,
      ...patch
    });
  };

  const handleUnitToggle = (newUnit: 'in' | 'mm') => {
    if (newUnit === settings.units) return;
    const defaultTols = newUnit === 'mm' ? { ...DEFAULT_METRIC_ISO_TOLERANCES } : { ...DEFAULT_AEROSPACE_TOLERANCES };
    onUpdateSettings({
      ...settings,
      units: newUnit,
      tolerances: defaultTols
    });
  };

  const handleToleranceChange = (field: keyof typeof settings.tolerances, val: number) => {
    onUpdateSettings({
      ...settings,
      tolerances: {
        ...settings.tolerances,
        [field]: val
      }
    });
  };

  return (
    <div className="flex items-center h-full overflow-x-auto select-none no-scrollbar px-1">
      
      {/* 1. TOLERANCING & UNITS */}
      <RibbonGroup title="TOLERANCING & UNITS">
        <div className="flex flex-col gap-1.5 justify-center py-0.5">
          {/* Unit Toggle & Standard Badge */}
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-slate-200/80 p-0.5 rounded border border-slate-300 text-[10px]">
              <button
                type="button"
                onClick={() => handleUnitToggle('in')}
                className={`px-2 py-0.5 rounded font-mono font-bold cursor-pointer transition ${
                  settings.units === 'in'
                    ? 'bg-slate-800 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Imperial Units (Inches) - ASME Y14.5 Aerospace Default"
              >
                INCH
              </button>
              <button
                type="button"
                onClick={() => handleUnitToggle('mm')}
                className={`px-2 py-0.5 rounded font-mono font-bold cursor-pointer transition ${
                  settings.units === 'mm'
                    ? 'bg-slate-800 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Metric Units (Millimeters) - ISO 2768-m Standard"
              >
                MM
              </button>
            </div>

            <span className="px-1.5 py-0.5 rounded bg-slate-200/60 border border-slate-300 text-[9.5px] text-slate-600 font-mono font-medium">
              {settings.units === 'in' ? 'ASME Y14.5' : 'ISO 2768'}
            </span>
          </div>

          {/* Precision Step Matrix Inputs */}
          <div className="flex items-center gap-2 text-[10px]">
            <span className="text-slate-400 font-mono font-bold">±</span>
            
            <label className="flex items-center gap-1 text-slate-600 font-mono" title=".X One-Decimal Tolerance">
              <span>.X:</span>
              <input
                type="number"
                step="0.001"
                value={settings.tolerances.oneDecimal}
                onChange={(e) => handleToleranceChange('oneDecimal', parseFloat(e.target.value) || 0)}
                style={{ width: '42px', textAlign: 'center' }}
                className="bg-white border border-slate-300 rounded px-1 py-0.5 text-[10px] font-mono font-bold text-slate-800 outline-none focus:border-slate-500"
              />
            </label>

            <label className="flex items-center gap-1 text-slate-600 font-mono" title=".XX Two-Decimal Tolerance">
              <span>.XX:</span>
              <input
                type="number"
                step="0.001"
                value={settings.tolerances.twoDecimals}
                onChange={(e) => handleToleranceChange('twoDecimals', parseFloat(e.target.value) || 0)}
                style={{ width: '46px', textAlign: 'center' }}
                className="bg-white border border-slate-300 rounded px-1 py-0.5 text-[10px] font-mono font-bold text-slate-800 outline-none focus:border-slate-500"
              />
            </label>

            <label className="flex items-center gap-1 text-slate-600 font-mono" title=".XXX Three-Decimal Tolerance">
              <span>.XXX:</span>
              <input
                type="number"
                step="0.001"
                value={settings.tolerances.threeDecimals}
                onChange={(e) => handleToleranceChange('threeDecimals', parseFloat(e.target.value) || 0)}
                style={{ width: '48px', textAlign: 'center' }}
                className="bg-white border border-slate-300 rounded px-1 py-0.5 text-[10px] font-mono font-bold text-slate-800 outline-none focus:border-slate-500"
              />
            </label>
          </div>
        </div>
      </RibbonGroup>

      {/* 2. DRAWING EXTRACTION FILTERS */}
      <RibbonGroup title="DRAWING EXTRACTION">
        <div className="flex flex-col gap-1.5 justify-center py-0.5">
          {/* Skip Reference and Basic Dimension Checkboxes */}
          <div className="flex items-center gap-2.5 text-[10.5px]">
            <label 
              className="flex items-center gap-1 cursor-pointer text-slate-700 hover:text-slate-900 select-none"
              title="Do not balloon ASME Y14.5 parenthetical reference dimensions (1.500) into AS9102 Form 3"
            >
              <input
                type="checkbox"
                checked={settings.skipReferenceDimensions}
                onChange={(e) => update({ skipReferenceDimensions: e.target.checked })}
                className="w-3 h-3 accent-slate-700 text-slate-700 rounded cursor-pointer"
              />
              <span>Skip (Ref) Dims</span>
            </label>

            <label 
              className="flex items-center gap-1 cursor-pointer text-slate-700 hover:text-slate-900 select-none"
              title="Do not balloon boxed basic dimensions [1.500] (governed by GD&T feature control frames)"
            >
              <input
                type="checkbox"
                checked={settings.skipBasicDimensions}
                onChange={(e) => update({ skipBasicDimensions: e.target.checked })}
                className="w-3 h-3 accent-slate-700 text-slate-700 rounded cursor-pointer"
              />
              <span>Skip [Basic] Dims</span>
            </label>
          </div>

          {/* OCR Match Review Floor */}
          <div className="flex items-center gap-1.5 text-[10px]">
            <span className="text-slate-500">OCR Review Floor:</span>
            <select
              value={settings.ocrConfidenceThreshold}
              onChange={(e) => update({ ocrConfidenceThreshold: parseFloat(e.target.value) })}
              style={{ width: '135px' }}
              className="bg-white border border-slate-300 rounded px-1.5 py-0.5 text-[10px] font-mono text-slate-800 cursor-pointer outline-none focus:border-slate-500"
              title="Characteristics extracted via PaddleOCR with match rate below this threshold will be flagged for mandatory inspection review"
            >
              <option value={0.75}>75% (Lenient)</option>
              <option value={0.80}>80% (Standard)</option>
              <option value={0.85}>85% (Aerospace Default)</option>
              <option value={0.90}>90% (Strict)</option>
            </select>
          </div>
        </div>
      </RibbonGroup>

      {/* 3. NUMBERING SCHEMA */}
      <RibbonGroup title="NUMBERING SCHEMA">
        <div className="flex flex-col gap-1.5 justify-center py-0.5">
          {/* Starting Number & Delimiter */}
          <div className="flex items-center gap-2.5 text-[10.5px]">
            <label className="flex items-center gap-1 text-slate-600">
              <span className="text-[10px]">Start:</span>
              <input
                type="number"
                min="1"
                step="1"
                value={settings.startingNumber}
                onChange={(e) => update({ startingNumber: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                style={{ width: '44px', textAlign: 'center' }}
                className="bg-white border border-slate-300 rounded px-1 py-0.5 text-[10px] font-mono font-bold text-slate-800 outline-none focus:border-slate-500"
                title="First characteristic balloon index (e.g. 1 for main drawings, 100 or 1000 for sub-assemblies)"
              />
            </label>

            <label className="flex items-center gap-1 text-slate-600">
              <span className="text-[10px]">Sub-delim:</span>
              <select
                value={settings.subDelimiter}
                onChange={(e) => update({ subDelimiter: e.target.value as DelimiterStyle })}
                style={{ width: '100px' }}
                className="bg-white border border-slate-300 rounded px-1.5 py-0.5 text-[10px] font-mono text-slate-800 cursor-pointer outline-none focus:border-slate-500"
                title="Format style for sub-divided characteristic multiples (e.g. 4X hole callouts)"
              >
                <option value=".">. (1.1, 1.2)</option>
                <option value="-">- (1-1, 1-2)</option>
                <option value="/">/ (1/1, 1/2)</option>
              </select>
            </label>
          </div>

          {/* Increment Step */}
          <div className="flex items-center gap-1.5 text-[10px]">
            <span className="text-slate-500">Step:</span>
            <div className="flex items-center bg-slate-200/80 p-0.5 rounded border border-slate-300">
              {[1, 5, 10].map((stepVal) => (
                <button
                  key={stepVal}
                  type="button"
                  onClick={() => update({ incrementStep: stepVal })}
                  className={`px-2 py-0.5 rounded font-mono font-bold cursor-pointer transition ${
                    settings.incrementStep === stepVal
                      ? 'bg-slate-800 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title={`Increment balloon numbers by +${stepVal}`}
                >
                  +{stepVal}
                </button>
              ))}
            </div>
          </div>
        </div>
      </RibbonGroup>

      {/* 4. COMPLIANCE & SAMPLING */}
      <RibbonGroup title="COMPLIANCE & SAMPLING">
        <div className="flex flex-col gap-1.5 justify-center py-0.5">
          {/* AS9102 Standard Revision */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-500">Standard:</span>
            <div className="flex items-center bg-slate-200/80 p-0.5 rounded border border-slate-300 text-[10px]">
              {(['Rev B', 'Rev C'] as As9102StandardRevision[]).map((rev) => (
                <button
                  key={rev}
                  type="button"
                  onClick={() => update({ as9102Revision: rev })}
                  className={`px-2 py-0.5 rounded font-sans font-bold cursor-pointer transition ${
                    settings.as9102Revision === rev
                      ? 'bg-slate-800 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title={`SAE AS9102 Aerospace First Article Inspection ${rev}`}
                >
                  {rev}
                </button>
              ))}
            </div>
          </div>

          {/* Sampling Plan AQL & Level */}
          <div className="flex items-center gap-1.5 text-[10px]">
            <span className="text-slate-500">AQL:</span>
            <select
              value={settings.aqlLevel}
              onChange={(e) => update({ aqlLevel: e.target.value as AqlLevel })}
              style={{ width: '135px' }}
              className="bg-white border border-slate-300 rounded px-1.5 py-0.5 text-[10px] font-mono text-slate-800 cursor-pointer outline-none focus:border-slate-500"
              title="ANSI/ASQ Z1.4 / ISO 2859-1 Sampling Plan Acceptance Quality Limit"
            >
              <option value="0.65">0.65 (Tightened)</option>
              <option value="1.0">1.0 (Aerospace Normal)</option>
              <option value="2.5">2.5 (Commercial)</option>
              <option value="4.0">4.0 (Reduced)</option>
            </select>

            <select
              value={settings.inspectionLevel}
              onChange={(e) => update({ inspectionLevel: e.target.value as InspectionLevel })}
              style={{ width: '75px' }}
              className="bg-white border border-slate-300 rounded px-1 py-0.5 text-[10px] text-slate-800 cursor-pointer outline-none focus:border-slate-500"
            >
              <option value="Level I">Level I</option>
              <option value="Level II">Level II</option>
              <option value="Level III">Level III</option>
            </select>
          </div>
        </div>
      </RibbonGroup>

      {/* 5. SECURITY & EXPORT */}
      <RibbonGroup title="SECURITY & EXPORT">
        <div className="flex flex-col gap-1.5 justify-center py-0.5">
          {/* Security Watermark Dropdown */}
          <div className="flex items-center gap-1.5 text-[10px]">
            <span className="text-slate-500">Watermark:</span>
            <select
              value={settings.watermark}
              onChange={(e) => update({ watermark: e.target.value as SecurityWatermark })}
              style={{ width: '145px' }}
              className="bg-white border border-slate-300 rounded px-1.5 py-0.5 text-[10px] font-semibold text-slate-800 cursor-pointer outline-none focus:border-slate-500"
              title="Burns diagonal compliance / export-control watermark across all marked PDF pages"
            >
              <option value="NONE">None</option>
              <option value="ITAR RESTRICTED">ITAR Restricted</option>
              <option value="COMPANY CONFIDENTIAL">Company Confidential</option>
              <option value="PRELIMINARY FAIR">Preliminary FAIR</option>
              <option value="CUSTOMER APPROVED">Customer Approved</option>
            </select>
          </div>

          {/* High-Resolution Print Export Toggle */}
          <div className="flex items-center text-[10.5px]">
            <label 
              className="flex items-center gap-1.5 cursor-pointer text-slate-700 hover:text-slate-900 select-none"
              title="Produce 300 DPI high-definition engineering print when exporting marked PDF"
            >
              <input
                type="checkbox"
                checked={settings.highResPdfExport}
                onChange={(e) => update({ highResPdfExport: e.target.checked })}
                className="w-3 h-3 accent-slate-700 text-slate-700 rounded cursor-pointer"
              />
              <span>300 DPI High-Res Print</span>
            </label>
          </div>
        </div>
      </RibbonGroup>

      {/* 6. APPLICATION OPTIONS (BENCHMARK PREFERENCES) */}
      <RibbonGroup title="APPLICATION PREFERENCES" noSeparator>
        <div className="flex flex-col gap-1 items-center justify-center py-0.5 px-1">
          <button
            type="button"
            onClick={() => onOpenSettingsModal?.('options')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold text-[11px] shadow-xs transition cursor-pointer"
            title="Configure Blueprint Tolerances, Numbering, Workspace, Net-Inspect, and Cloudflare licensing (Ctrl+,)"
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Options ⚙️</span>
          </button>
          <span className="text-[9px] text-slate-400 font-mono tracking-tight">Ctrl + ,</span>
        </div>
      </RibbonGroup>

    </div>
  );
};
