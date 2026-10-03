import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  RotateCcw,
  Check,
  Ruler,
  FileCheck,
  Settings,
  Plus,
  Bookmark
} from 'lucide-react';
import type {
  ProjectSettings,
  DelimiterStyle,
  SecurityWatermark,
  TolerancePresetKey,
  ExportFormatTemplate
} from '../../types/settings';
import { DEFAULT_PROJECT_SETTINGS } from '../../types/settings';
import type { TitleBlockTolerancePreset } from '../../types/characteristics';
import { DEFAULT_AEROSPACE_TOLERANCES } from '../../types/characteristics';
import { ApplicationOptionsView, type ApplicationOptionsHandle } from './options/ApplicationOptionsView';
import { getPersistentSetting, setPersistentSetting } from '../../utils/persistentSettings';

export type SettingsTab = 'tolerances' | 'compliance' | 'options';

interface ProjectSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: ProjectSettings;
  onUpdateSettings: (settings: ProjectSettings) => void;
  initialTab?: SettingsTab;
}

const LOCAL_STORAGE_KEY = 'loonist_project_settings_default';
const CUSTOM_PRESETS_KEY = 'loonist_custom_tolerance_presets';

// Named, reusable tolerance presets a user saves for a specific customer or contract
// (e.g. "Boeing D6-51991"), persisted across projects and sessions.
interface CustomTolerancePreset {
  id: string;
  name: string;
  units: 'in' | 'mm';
  tolerances: TitleBlockTolerancePreset;
}

function parseCustomPresets(raw: string | null): CustomTolerancePreset[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function loadCustomPresets(): Promise<CustomTolerancePreset[]> {
  const raw = await getPersistentSetting(CUSTOM_PRESETS_KEY);
  return parseCustomPresets(raw);
}

function saveCustomPresets(presets: CustomTolerancePreset[]) {
  setPersistentSetting(CUSTOM_PRESETS_KEY, JSON.stringify(presets));
}

function tolerancesMatch(a: TitleBlockTolerancePreset, b: TitleBlockTolerancePreset): boolean {
  if (a.iso2768Class || b.iso2768Class) {
    return a.iso2768Class === b.iso2768Class && a.angular === b.angular;
  }
  return a.oneDecimal === b.oneDecimal &&
    a.twoDecimals === b.twoDecimals &&
    a.threeDecimals === b.threeDecimals &&
    a.fourDecimals === b.fourDecimals &&
    a.angular === b.angular;
}

const ISO_2768_REFERENCE: Record<'f' | 'm' | 'c' | 'v', Array<[string, string]>> = {
  f: [['0.5–3', '±0.05'], ['>3–6', '±0.05'], ['>6–30', '±0.1'], ['>30–120', '±0.15'], ['>120–400', '±0.2'], ['>400–1000', '±0.3']],
  m: [['0.5–3', '±0.1'], ['>3–6', '±0.1'], ['>6–30', '±0.2'], ['>30–120', '±0.3'], ['>120–400', '±0.5'], ['>400–1000', '±0.8']],
  c: [['0.5–3', '±0.2'], ['>3–6', '±0.3'], ['>6–30', '±0.5'], ['>30–120', '±0.8'], ['>120–400', '±1.2'], ['>400–1000', '±2']],
  v: [['>3–6', '±0.5'], ['>6–30', '±1'], ['>30–120', '±1.5'], ['>120–400', '±2.5'], ['>400–1000', '±4']]
};

// Predefined industry-standard tolerance matrices
const TOLERANCE_PRESETS: Record<TolerancePresetKey, TitleBlockTolerancePreset> = {
  'asme-precision': {
    oneDecimal: 0.030,
    twoDecimals: 0.010,
    threeDecimals: 0.005,
    fourDecimals: 0.0005,
    angular: 0.5,
    unit: 'in'
  },
  'asme-commercial': {
    oneDecimal: 0.050,
    twoDecimals: 0.020,
    threeDecimals: 0.010,
    fourDecimals: 0.0020,
    angular: 1.0,
    unit: 'in'
  },
  'sheet-metal-inch': {
    oneDecimal: 0.060,
    twoDecimals: 0.030,
    threeDecimals: 0.015,
    fourDecimals: 0.0050,
    angular: 1.0,
    unit: 'in'
  },
  'iso-medium': {
    // Linear tolerances are resolved by size bracket (ToleranceEngine.resolveMetricIso2768Tolerance)
    // per iso2768Class below, not by these decimal-place fields - kept only as a fallback shape.
    oneDecimal: 0.20,
    twoDecimals: 0.10,
    threeDecimals: 0.05,
    fourDecimals: 0.01,
    angular: 0.5,
    unit: 'mm',
    iso2768Class: 'm'
  },
  'iso-fine': {
    oneDecimal: 0.10,
    twoDecimals: 0.05,
    threeDecimals: 0.01,
    fourDecimals: 0.002,
    angular: 0.5,
    unit: 'mm',
    iso2768Class: 'f'
  },
  'sheet-metal-metric': {
    oneDecimal: 0.50,
    twoDecimals: 0.25,
    threeDecimals: 0.10,
    fourDecimals: 0.02,
    angular: 1.0,
    unit: 'mm'
  },
  'custom': {
    ...DEFAULT_AEROSPACE_TOLERANCES
  }
};

export const ProjectSettingsModal: React.FC<ProjectSettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  initialTab = 'tolerances'
}) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);
  const [draft, setDraft] = useState<ProjectSettings>(() => ({
    ...DEFAULT_PROJECT_SETTINGS,
    ...settings
  }));
  const [saveAsDefault, setSaveAsDefault] = useState(false);
  const optionsRef = useRef<ApplicationOptionsHandle>(null);
  const [customPresets, setCustomPresets] = useState<CustomTolerancePreset[]>([]);
  const [isSavingPreset, setIsSavingPreset] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');

  // Load saved custom presets from the durable (file-backed) store once on mount
  useEffect(() => {
    let cancelled = false;
    loadCustomPresets().then((presets) => {
      if (!cancelled) setCustomPresets(presets);
    });
    return () => { cancelled = true; };
  }, []);

  // Sync draft whenever modal opens or external settings update
  useEffect(() => {
    if (isOpen) {
      setDraft({
        ...DEFAULT_PROJECT_SETTINGS,
        ...settings
      });
      setSaveAsDefault(false);
      if (initialTab) {
        setActiveTab(initialTab);
      }
    }
  }, [isOpen, settings, initialTab]);

  // Keyboard shortcut: Escape to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Same as Cancel: undo live-previewed workspace changes
        optionsRef.current?.cancel();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Handle switching units with smart tolerance conversion
  const handleUnitChange = (newUnit: 'in' | 'mm') => {
    if (newUnit === draft.units) return;

    if (newUnit === 'mm') {
      const preset = TOLERANCE_PRESETS['iso-medium'];
      setDraft({
        ...draft,
        units: 'mm',
        tolerancePreset: 'iso-medium',
        tolerances: { ...preset }
      });
    } else {
      const preset = TOLERANCE_PRESETS['asme-precision'];
      setDraft({
        ...draft,
        units: 'in',
        tolerancePreset: 'asme-precision',
        tolerances: { ...preset }
      });
    }
  };

  // Handle selecting a tolerance preset
  const handlePresetSelect = (presetKey: TolerancePresetKey) => {
    if (presetKey === 'custom') {
      setDraft({ ...draft, tolerancePreset: 'custom' });
      return;
    }
    const preset = TOLERANCE_PRESETS[presetKey];
    setDraft({
      ...draft,
      tolerancePreset: presetKey,
      units: preset.unit,
      tolerances: { ...preset }
    });
  };

  // Handle manual input in any tolerance box
  const handleToleranceInput = (field: keyof TitleBlockTolerancePreset, val: number) => {
    setDraft({
      ...draft,
      tolerancePreset: 'custom',
      tolerances: {
        ...draft.tolerances,
        [field]: val
      }
    });
  };

  // Apply a saved, named custom tolerance preset (per-customer/contract table)
  const handleApplyCustomPreset = (preset: CustomTolerancePreset) => {
    setDraft({
      ...draft,
      tolerancePreset: 'custom',
      units: preset.units,
      tolerances: { ...preset.tolerances }
    });
  };

  const handleSaveCustomPreset = () => {
    const name = newPresetName.trim();
    if (!name) return;
    const preset: CustomTolerancePreset = {
      id: `custom-${Date.now()}`,
      name,
      units: draft.units,
      tolerances: { ...draft.tolerances }
    };
    const updated = [...customPresets, preset];
    setCustomPresets(updated);
    saveCustomPresets(updated);
    setNewPresetName('');
    setIsSavingPreset(false);
  };

  const handleDeleteCustomPreset = (id: string) => {
    const updated = customPresets.filter(p => p.id !== id);
    setCustomPresets(updated);
    saveCustomPresets(updated);
  };

  // Cancel, the X button, Esc and clicking outside all discard unsaved changes
  const handleCancel = () => {
    optionsRef.current?.cancel();
    onClose();
  };

  const handleSave = () => {
    if (saveAsDefault) {
      setPersistentSetting(LOCAL_STORAGE_KEY, JSON.stringify(draft));
    }
    // One Save for the whole dialog: project settings and application options together
    optionsRef.current?.save();
    onUpdateSettings(draft);
    onClose();
  };

  // Reset Defaults applies to the tab being viewed
  const handleResetDefaults = () => {
    if (activeTab === 'options') {
      optionsRef.current?.reset();
    } else {
      setDraft({ ...DEFAULT_PROJECT_SETTINGS });
    }
  };

  const modalContent = (
    <div
      className="fixed inset-0 z-modal flex items-center justify-center bg-slate-950/75 backdrop-blur-xs select-none p-3 p-4 overflow-y-auto"
      style={{ zIndex: 99999 }}
      onClick={handleCancel}
    >
      <div
        className="relative bg-white border border-slate-300 shadow-2xl flex flex-col overflow-hidden text-slate-800 rounded-lg"
        // One fixed size for every tab so the dialog and its tab bar never move
        style={{
          width: 'min(940px, calc(100vw - 32px))',
          height: 'min(660px, calc(100vh - 36px))',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="h-11 bg-slate-100 border-b border-slate-200 px-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-1 rounded bg-slate-200 text-slate-700">
              <Settings className="w-3.5 h-3.5" />
            </div>
            <div>
              <h2 className="text-xs font-bold text-slate-900 tracking-wide uppercase">
                Settings
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={handleCancel}
            className="p-1 rounded hover:bg-slate-200 text-slate-500 hover:text-slate-900 transition cursor-pointer"
            title="Close [Esc]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 3-Tab Horizontal Switcher */}
        <div className="h-9 bg-slate-50 border-b border-slate-200 px-4 flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('tolerances')}
            className={`flex items-center gap-1.5 h-full px-3 text-xs font-semibold border-b-2 transition cursor-pointer ${activeTab === 'tolerances'
                ? 'border-slate-800 text-slate-900 '
                : 'border-transparent text-slate-500 hover:text-slate-900 '
              }`}
          >
            <Ruler className="w-3.5 h-3.5" />
            <span>Blueprint & Tolerances</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('compliance')}
            className={`flex items-center gap-1.5 h-full px-3 text-xs font-semibold border-b-2 transition cursor-pointer ${activeTab === 'compliance'
                ? 'border-slate-800 text-slate-900 '
                : 'border-transparent text-slate-500 hover:text-slate-900 '
              }`}
          >
            <FileCheck className="w-3.5 h-3.5" />
            <span>Numbering & Compliance</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('options')}
            className={`flex items-center gap-1.5 h-full px-3 text-xs font-semibold border-b-2 transition cursor-pointer ${activeTab === 'options'
                ? 'border-blue-600 text-blue-700 '
                : 'border-transparent text-slate-500 hover:text-slate-900 '
              }`}
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Options</span>
          </button>
        </div>

        {/* Options stays mounted while hidden so unsaved edits survive tab switches */}
        <div
          className="flex flex-col flex-1 min-h-0"
          style={{ display: activeTab === 'options' ? 'flex' : 'none' }}
        >
          <ApplicationOptionsView ref={optionsRef} hideFooter />
        </div>

        {activeTab !== 'options' && (
            /* Tab Content Container */
            <div className="p-5 overflow-y-auto flex-1 flex flex-col gap-5 min-h-[360px]">
              {activeTab === 'tolerances' && (
                <>
                  {/* Section 1: Title Block Tolerances */}
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                          Title Block Tolerances
                        </h3>
                        <p className="text-[11px] text-slate-500">
                          General tolerances applied when drawing dimensions lack explicit ± limits.
                        </p>
                      </div>

                      {/* Units Toggle */}
                      <div className="inline-flex rounded border border-slate-300 p-0.5 bg-slate-100">
                        <button
                          type="button"
                          onClick={() => handleUnitChange('in')}
                          className={`px-2.5 py-0.5 rounded text-[11px] font-semibold transition cursor-pointer ${draft.units === 'in'
                              ? 'bg-white text-slate-900 shadow-2xs'
                              : 'text-slate-500 hover:text-slate-900 '
                            }`}
                        >
                          Inches (in)
                        </button>
                        <button
                          type="button"
                          onClick={() => handleUnitChange('mm')}
                          className={`px-2.5 py-0.5 rounded text-[11px] font-semibold transition cursor-pointer ${draft.units === 'mm'
                              ? 'bg-white text-slate-900 shadow-2xs'
                              : 'text-slate-500 hover:text-slate-900 '
                            }`}
                        >
                          Millimeters (mm)
                        </button>
                      </div>
                    </div>

                    {/* Preset Selector with 1-Tap Buttons & Dropdown */}
                    <div className="flex flex-row items-center justify-between gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[11px] font-semibold text-slate-600 whitespace-nowrap mr-1">
                          Industry Presets:
                        </span>
                        {draft.units === 'in' ? (
                          <>
                            <button
                              type="button"
                              onClick={() => handlePresetSelect('asme-precision')}
                              className={`px-2.5 py-1 rounded text-[10.5px] font-semibold transition cursor-pointer select-none border ${
                                draft.tolerancePreset === 'asme-precision'
                                  ? 'bg-slate-800 text-white border-slate-800 shadow-2xs font-bold'
                                  : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'
                              }`}
                            >
                              Aerospace Precision (Shop Standard)
                            </button>
                            <button
                              type="button"
                              onClick={() => handlePresetSelect('asme-commercial')}
                              className={`px-2.5 py-1 rounded text-[10.5px] font-semibold transition cursor-pointer select-none border ${
                                draft.tolerancePreset === 'asme-commercial'
                                  ? 'bg-slate-800 text-white border-slate-800 shadow-2xs font-bold'
                                  : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'
                              }`}
                            >
                              Commercial
                            </button>
                            <button
                              type="button"
                              onClick={() => handlePresetSelect('sheet-metal-inch')}
                              className={`px-2.5 py-1 rounded text-[10.5px] font-semibold transition cursor-pointer select-none border ${
                                draft.tolerancePreset === 'sheet-metal-inch'
                                  ? 'bg-slate-800 text-white border-slate-800 shadow-2xs font-bold'
                                  : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'
                              }`}
                            >
                              Sheet Metal
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => handlePresetSelect('iso-medium')}
                              className={`px-2.5 py-1 rounded text-[10.5px] font-semibold transition cursor-pointer select-none border ${
                                draft.tolerancePreset === 'iso-medium'
                                  ? 'bg-slate-800 text-white border-slate-800 shadow-2xs font-bold'
                                  : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'
                              }`}
                            >
                              ISO 2768-m
                            </button>
                            <button
                              type="button"
                              onClick={() => handlePresetSelect('iso-fine')}
                              className={`px-2.5 py-1 rounded text-[10.5px] font-semibold transition cursor-pointer select-none border ${
                                draft.tolerancePreset === 'iso-fine'
                                  ? 'bg-slate-800 text-white border-slate-800 shadow-2xs font-bold'
                                  : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'
                              }`}
                            >
                              ISO 2768-f
                            </button>
                            <button
                              type="button"
                              onClick={() => handlePresetSelect('sheet-metal-metric')}
                              className={`px-2.5 py-1 rounded text-[10.5px] font-semibold transition cursor-pointer select-none border ${
                                draft.tolerancePreset === 'sheet-metal-metric'
                                  ? 'bg-slate-800 text-white border-slate-800 shadow-2xs font-bold'
                                  : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'
                              }`}
                            >
                              Sheet Metal
                            </button>
                          </>
                        )}

                        {/* Saved, named custom presets (e.g. per customer/contract) for the active unit system */}
                        {customPresets.filter(p => p.units === draft.units).map((p) => {
                          const isActive = tolerancesMatch(p.tolerances, draft.tolerances);
                          return (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => handleApplyCustomPreset(p)}
                              className={`flex items-center gap-1 px-2.5 py-1 rounded text-[10.5px] font-semibold transition cursor-pointer select-none border ${
                                isActive
                                  ? 'bg-blue-700 text-white border-blue-700 shadow-2xs font-bold'
                                  : 'bg-white text-blue-700 border-blue-300 hover:bg-blue-50'
                              }`}
                              title={`Saved custom preset: ${p.name}`}
                            >
                              <Bookmark className="w-3 h-3" />
                              {p.name}
                            </button>
                          );
                        })}
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {(() => {
                          const activeCustomPreset = customPresets.find(
                            p => p.units === draft.units && tolerancesMatch(p.tolerances, draft.tolerances)
                          );
                          if (activeCustomPreset) {
                            return (
                              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded text-[10.5px] font-bold bg-blue-100 text-blue-800 border border-blue-300">
                                {activeCustomPreset.name}
                                <button
                                  type="button"
                                  onClick={() => handleDeleteCustomPreset(activeCustomPreset.id)}
                                  title="Delete this saved preset"
                                  className="hover:text-red-600 cursor-pointer"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </span>
                            );
                          }
                          if (draft.tolerancePreset === 'custom') {
                            return (
                              <span
                                className="px-2.5 py-1 rounded text-[10.5px] font-bold bg-amber-100 text-amber-800 border border-amber-300"
                                title="One or more tolerance values below were edited manually and no longer match a preset"
                              >
                                Custom Specification
                              </span>
                            );
                          }
                          return null;
                        })()}

                        {isSavingPreset ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="text"
                              autoFocus
                              value={newPresetName}
                              onChange={(e) => setNewPresetName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveCustomPreset();
                                if (e.key === 'Escape') { setIsSavingPreset(false); setNewPresetName(''); }
                              }}
                              placeholder="e.g. Boeing D6-51991"
                              className="bg-white border border-slate-300 rounded px-2 py-1 text-[11px] text-slate-800 w-[150px] outline-none focus:border-slate-500"
                            />
                            <button
                              type="button"
                              onClick={handleSaveCustomPreset}
                              disabled={!newPresetName.trim()}
                              className="p-1 rounded bg-slate-800 text-white disabled:opacity-40 disabled:cursor-default cursor-pointer"
                              title="Save preset"
                            >
                              <Check className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => { setIsSavingPreset(false); setNewPresetName(''); }}
                              className="p-1 rounded text-slate-500 hover:bg-slate-200 cursor-pointer"
                              title="Cancel"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setIsSavingPreset(true)}
                            className="flex items-center gap-1 px-2 py-1 rounded text-[10.5px] font-semibold text-slate-600 border border-dashed border-slate-300 hover:border-slate-400 hover:bg-white cursor-pointer"
                            title="Save the current tolerance values as a named, reusable preset (e.g. per customer or contract)"
                          >
                            <Plus className="w-3 h-3" />
                            Save Preset
                          </button>
                        )}
                      </div>
                    </div>

                    {draft.tolerances.iso2768Class ? (
                      /* ISO 2768-1 is resolved by dimension SIZE bracket, not decimal places -
                         these values aren't user-editable numbers, they're the fixed standard table. */
                      <div className="flex gap-2.5 items-stretch">
                        <div className="flex-1 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                          <div className="text-[10px] font-semibold text-slate-500 mb-1.5">
                            ISO 2768-{draft.tolerances.iso2768Class} Linear Tolerance by Size Bracket (mm)
                          </div>
                          <div className="grid grid-cols-6 gap-x-3 gap-y-0.5 text-[10px] font-mono">
                            {ISO_2768_REFERENCE[draft.tolerances.iso2768Class].map(([bracket, tol]) => (
                              <div key={bracket} className="flex flex-col">
                                <span className="text-slate-400">{bracket}</span>
                                <span className="font-bold text-slate-800">{tol}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="w-28 shrink-0 bg-slate-50 p-2 rounded-lg border border-slate-200">
                          <label className="text-[10px] font-semibold text-slate-500 block mb-1">
                            ± Angles (°)
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            value={draft.tolerances.angular}
                            onChange={(e) => handleToleranceInput('angular', parseFloat(e.target.value) || 0)}
                            className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs font-mono font-bold text-slate-900"
                          />
                        </div>
                      </div>
                    ) : (
                      /* 5-Column Decimal Tolerance Grid */
                      <div className="grid grid-cols-5 gap-2.5">
                        <div className="bg-slate-50 p-2 rounded-lg border border-slate-200">
                          <label className="text-[10px] font-semibold text-slate-500 block mb-1">
                            ± .X (1 Place)
                          </label>
                          <input
                            type="number"
                            step={draft.units === 'mm' ? '0.1' : '0.01'}
                            value={draft.tolerances.oneDecimal}
                            onChange={(e) => handleToleranceInput('oneDecimal', parseFloat(e.target.value) || 0)}
                            className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs font-mono font-bold text-slate-900"
                          />
                        </div>

                        <div className="bg-slate-50 p-2 rounded-lg border border-slate-200">
                          <label className="text-[10px] font-semibold text-slate-500 block mb-1">
                            ± .XX (2 Places)
                          </label>
                          <input
                            type="number"
                            step={draft.units === 'mm' ? '0.05' : '0.005'}
                            value={draft.tolerances.twoDecimals}
                            onChange={(e) => handleToleranceInput('twoDecimals', parseFloat(e.target.value) || 0)}
                            className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs font-mono font-bold text-slate-900"
                          />
                        </div>

                        <div className="bg-slate-50 p-2 rounded-lg border border-slate-200">
                          <label className="text-[10px] font-semibold text-slate-500 block mb-1">
                            ± .XXX (3 Places)
                          </label>
                          <input
                            type="number"
                            step={draft.units === 'mm' ? '0.01' : '0.001'}
                            value={draft.tolerances.threeDecimals}
                            onChange={(e) => handleToleranceInput('threeDecimals', parseFloat(e.target.value) || 0)}
                            className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs font-mono font-bold text-slate-900"
                          />
                        </div>

                        <div className="bg-slate-50 p-2 rounded-lg border border-slate-200">
                          <label className="text-[10px] font-semibold text-slate-500 block mb-1">
                            ± .XXXX (4 Places)
                          </label>
                          <input
                            type="number"
                            step={draft.units === 'mm' ? '0.002' : '0.0001'}
                            value={draft.tolerances.fourDecimals}
                            onChange={(e) => handleToleranceInput('fourDecimals', parseFloat(e.target.value) || 0)}
                            className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs font-mono font-bold text-slate-900"
                          />
                        </div>

                        <div className="bg-slate-50 p-2 rounded-lg border border-slate-200">
                          <label className="text-[10px] font-semibold text-slate-500 block mb-1">
                            ± Angles (°)
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            value={draft.tolerances.angular}
                            onChange={(e) => handleToleranceInput('angular', parseFloat(e.target.value) || 0)}
                            className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs font-mono font-bold text-slate-900"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="h-px bg-slate-200" />

                  {/* Section 2: Extraction & Ballooning Behavior */}
                  <div className="flex flex-col gap-3">
                    <div>
                      <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                        Extraction & Ballooning Behavior
                      </h3>
                      <p className="text-[11px] text-slate-500">
                        Rules for auto-detecting dimensions, drawing notes, and quantity patterns.
                      </p>
                    </div>

                    {/* Multiplier Behavior Segment */}
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 flex flex-col gap-2">
                      <span className="text-[11px] font-semibold text-slate-700">
                        Quantity Multipliers (e.g., 4X ⌀.250 Holes):
                      </span>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setDraft({ ...draft, multiplierBehavior: 'single_balloon' })}
                          className={`flex flex-col p-2 rounded border text-left transition cursor-pointer ${draft.multiplierBehavior === 'single_balloon'
                              ? 'border-slate-800 bg-white shadow-2xs'
                              : 'border-slate-200 hover:border-slate-300 '
                            }`}
                        >
                          <span className="text-xs font-bold text-slate-900">
                            1 Balloon (Qty = 4)
                          </span>
                          <span className="text-[10px] text-slate-500">
                            Single row in Form 3 with quantity count.
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setDraft({ ...draft, multiplierBehavior: 'split_sub_balloons' })}
                          className={`flex flex-col p-2 rounded border text-left transition cursor-pointer ${draft.multiplierBehavior === 'split_sub_balloons'
                              ? 'border-slate-800 bg-white shadow-2xs'
                              : 'border-slate-200 hover:border-slate-300 '
                            }`}
                        >
                          <span className="text-xs font-bold text-slate-900">
                            Split into Sub-Balloons
                          </span>
                          <span className="text-[10px] text-slate-500">
                            Creates 1.1, 1.2, 1.3, 1.4 for individual measurement.
                          </span>
                        </button>
                      </div>
                    </div>

                    {/* Practical Checkbox Rules */}
                    <div className="flex flex-col gap-2">
                      <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700">
                        <input
                          type="checkbox"
                          checked={draft.autoBalloonNotes}
                          onChange={(e) => setDraft({ ...draft, autoBalloonNotes: e.target.checked })}
                          className="rounded border-slate-300 accent-slate-800 w-3.5 h-3.5 cursor-pointer"
                        />
                        <span>Auto-balloon Drawing Notes (as AS9102 Form 3 General Characteristics)</span>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700">
                        <input
                          type="checkbox"
                          checked={draft.autoDetectZones}
                          onChange={(e) => setDraft({ ...draft, autoDetectZones: e.target.checked })}
                          className="rounded border-slate-300 accent-slate-800 w-3.5 h-3.5 cursor-pointer"
                        />
                        <span>Auto-detect Sheet Zone Coordinates (e.g. Sheet 1, Zone B-4)</span>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700">
                        <input
                          type="checkbox"
                          checked={draft.skipReferenceDimensions}
                          onChange={(e) => setDraft({ ...draft, skipReferenceDimensions: e.target.checked })}
                          className="rounded border-slate-300 accent-slate-800 w-3.5 h-3.5 cursor-pointer"
                        />
                        <span>Exclude Reference Dimensions (dimensions enclosed in parentheses)</span>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700">
                        <input
                          type="checkbox"
                          checked={draft.skipBasicDimensions}
                          onChange={(e) => setDraft({ ...draft, skipBasicDimensions: e.target.checked })}
                          className="rounded border-slate-300 accent-slate-800 w-3.5 h-3.5 cursor-pointer"
                        />
                        <span>Exclude Basic Dimensions (dimensions enclosed in a box, e.g. [1.500])</span>
                      </label>
                    </div>

                    {/* OCR Review Confidence Floor */}
                    <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                      <div>
                        <span className="text-[11px] font-semibold text-slate-700 block">
                          OCR Review Confidence Floor
                        </span>
                        <span className="text-[10px] text-slate-500">
                          Characteristics extracted below this confidence are flagged for mandatory inspection review instead of auto-accepted.
                        </span>
                      </div>
                      <select
                        value={draft.ocrConfidenceThreshold}
                        onChange={(e) => setDraft({ ...draft, ocrConfidenceThreshold: parseFloat(e.target.value) })}
                        className="bg-white border border-slate-300 rounded px-2.5 py-1.5 text-xs text-slate-800 font-medium cursor-pointer shrink-0"
                      >
                        <option value={0.75}>75% (Lenient)</option>
                        <option value={0.80}>80% (Standard)</option>
                        <option value={0.85}>85% (Aerospace Default)</option>
                        <option value={0.90}>90% (Strict)</option>
                      </select>
                    </div>
                  </div>
                </>
              )}

              {activeTab === 'compliance' && (
                <>
                  {/* Section 1: Balloon Numbering Sequence */}
                  <div className="flex flex-col gap-3">
                    <div>
                      <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                        Balloon Numbering Sequence
                      </h3>
                      <p className="text-[11px] text-slate-500">
                        Format and indexing rules for balloon callouts on drawing sheets.
                      </p>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                        <label className="text-[10px] font-semibold text-slate-500 block mb-1">
                          Starting Number
                        </label>
                        <input
                          type="number"
                          min={1}
                          value={draft.startingNumber}
                          onChange={(e) => setDraft({ ...draft, startingNumber: Math.max(1, parseInt(e.target.value) || 1) })}
                          className="w-full bg-white border border-slate-300 rounded px-2.5 py-1 text-xs font-bold text-slate-900"
                        />
                      </div>

                      <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                        <label className="text-[10px] font-semibold text-slate-500 block mb-1">
                          Increment Step
                        </label>
                        <div className="flex rounded border border-slate-300 p-0.5 bg-white">
                          {[1, 5, 10].map((step) => (
                            <button
                              key={step}
                              type="button"
                              onClick={() => setDraft({ ...draft, incrementStep: step })}
                              className={`flex-1 py-0.5 rounded text-xs font-semibold transition cursor-pointer ${draft.incrementStep === step
                                  ? 'bg-slate-800 text-white '
                                  : 'text-slate-600 hover:text-slate-900 '
                                }`}
                            >
                              +{step}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                        <label className="text-[10px] font-semibold text-slate-500 block mb-1">
                          Prefix (Optional)
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. D- or S1-"
                          value={draft.balloonPrefix || ''}
                          onChange={(e) => setDraft({ ...draft, balloonPrefix: e.target.value })}
                          className="w-full bg-white border border-slate-300 rounded px-2.5 py-1 text-xs font-mono text-slate-900"
                        />
                      </div>
                    </div>

                    {/* Sub-Delimiter */}
                    <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                      <span className="text-[11px] font-semibold text-slate-600">
                        Sub-Characteristic Delimiter:
                      </span>
                      <div className="inline-flex rounded border border-slate-300 p-0.5 bg-white">
                        {(['.', '-', '/'] as DelimiterStyle[]).map((delim) => (
                          <button
                            key={delim}
                            type="button"
                            onClick={() => setDraft({ ...draft, subDelimiter: delim })}
                            className={`px-3 py-0.5 rounded text-xs font-mono font-bold transition cursor-pointer ${draft.subDelimiter === delim
                                ? 'bg-slate-800 text-white '
                                : 'text-slate-600 hover:text-slate-900 '
                              }`}
                          >
                            1{delim}1
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="h-px bg-slate-200" />

                  {/* Section 2: AS9102 Compliance & Export */}
                  <div className="flex flex-col gap-3">
                    <div>
                      <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                        AS9102 Quality Report & Export
                      </h3>
                      <p className="text-[11px] text-slate-500">
                        Configure standard compliance headers, export watermarking, and target formats.
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] font-semibold text-slate-500 block mb-1">
                          Aerospace Standard Revision
                        </label>
                        <div
                          className="w-full bg-slate-100 border border-slate-300 rounded px-2.5 py-1.5 text-xs text-slate-700 font-medium"
                          title="The generated Form 1/2/3 layout is not yet differentiated by revision - this reflects what's actually produced, not a selectable option"
                        >
                          SAE AS9102 Rev C (fixed form layout)
                        </div>
                      </div>

                      <div>
                        <label className="text-[10px] font-semibold text-slate-500 block mb-1">
                          Drawing Security Watermark
                        </label>
                        <select
                          value={draft.watermark}
                          onChange={(e) => setDraft({ ...draft, watermark: e.target.value as SecurityWatermark })}
                          className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-xs text-slate-800 font-medium cursor-pointer"
                        >
                          <option value="NONE">None (Clean Drawing)</option>
                          <option value="ITAR RESTRICTED">ITAR RESTRICTED — Defense Article</option>
                          <option value="COMPANY CONFIDENTIAL">COMPANY CONFIDENTIAL</option>
                          <option value="PRELIMINARY FAIR">PRELIMINARY FAIR — In Process</option>
                          <option value="CUSTOMER APPROVED">CUSTOMER APPROVED — Final Release</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-semibold text-slate-500 block mb-1">
                        Primary Export Format Template
                      </label>
                      <select
                        value={draft.exportFormat || 'AS9102'}
                        onChange={(e) => setDraft({ ...draft, exportFormat: e.target.value as ExportFormatTemplate })}
                        className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-xs text-slate-800 font-medium cursor-pointer"
                      >
                        <option value="AS9102">AS9102 Excel Forms 1, 2, 3 (.xlsx)</option>
                        <option value="NET_INSPECT">Characteristics CSV - generic, for Net-Inspect import (.csv)</option>
                      </select>
                      <p className="text-[10px] text-slate-500 mt-1">
                        Sets which format is pre-selected when you open Export. The CSV is a generic Form 3
                        characteristics export - column mapping to your specific Net-Inspect portal isn't verified.
                      </p>
                    </div>
                  </div>
                </>
              )}
            </div>
        )}

            {/* Footer Actions (shared by all tabs) */}
            <div className="h-12 bg-slate-100 border-t border-slate-200 px-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleResetDefaults}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-200 transition cursor-pointer"
                  title="Reset the settings on this tab to their defaults"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset Defaults</span>
                </button>

                <label className="flex items-center gap-1.5 cursor-pointer text-xs text-slate-600 select-none">
                  <input
                    type="checkbox"
                    checked={saveAsDefault}
                    onChange={(e) => setSaveAsDefault(e.target.checked)}
                    className="rounded border-slate-300 accent-slate-800 w-3.5 h-3.5 cursor-pointer"
                  />
                  <span>Save as default for future projects</span>
                </label>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="px-3.5 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 hover:bg-slate-200 rounded-md transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  className="btn-primary-action flex items-center gap-1.5 px-4 py-1.5 rounded-md text-xs font-semibold shadow-xs transition cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Save</span>
                </button>
              </div>
            </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
