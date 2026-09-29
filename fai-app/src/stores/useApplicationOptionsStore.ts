/**
 * LOONIST — Aerospace First Article Inspection Platform
 * Application Options Persistent Reactive Store
 */

import { useState, useEffect } from 'react';
import type { 
  ApplicationOptions, 
  WorkspaceSettings, 
  MasterDataSettings, 
  TemplatesSettings, 
  NetInspectSettings, 
  LicensingSettings, 
  ItarPrivacySettings,
  TableColumnConfig
} from '../types/applicationOptions';
import { DEFAULT_APPLICATION_OPTIONS, DEFAULT_TABLE_COLUMNS } from '../types/applicationOptions';

const STORAGE_KEY = 'loonist_app_options_v1';

// In-memory singleton state so all components stay 100% in sync without full reloads
let globalState: ApplicationOptions = (() => {
  if (typeof window === 'undefined') return DEFAULT_APPLICATION_OPTIONS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_APPLICATION_OPTIONS;
    const parsed = JSON.parse(raw);
    // Deep merge defaults to guarantee new fields are always present
    return {
      workspace: { ...DEFAULT_APPLICATION_OPTIONS.workspace, ...(parsed.workspace || {}) },
      masterData: { ...DEFAULT_APPLICATION_OPTIONS.masterData, ...(parsed.masterData || {}) },
      templates: { ...DEFAULT_APPLICATION_OPTIONS.templates, ...(parsed.templates || {}) },
      netInspect: { ...DEFAULT_APPLICATION_OPTIONS.netInspect, ...(parsed.netInspect || {}) },
      licensing: { ...DEFAULT_APPLICATION_OPTIONS.licensing, ...(parsed.licensing || {}) },
      itarPrivacy: { ...DEFAULT_APPLICATION_OPTIONS.itarPrivacy, ...(parsed.itarPrivacy || {}) },
    };
  } catch {
    return DEFAULT_APPLICATION_OPTIONS;
  }
})();

const listeners = new Set<() => void>();

function notify() {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(globalState));
    } catch (e) {
      console.warn('Failed to save LOONIST options to localStorage', e);
    }
  }
  listeners.forEach(listener => listener());
}

export const applicationOptionsActions = {
  get: (): ApplicationOptions => globalState,

  updateWorkspace: (patch: Partial<WorkspaceSettings>) => {
    globalState = {
      ...globalState,
      workspace: { ...globalState.workspace, ...patch }
    };
    notify();
  },

  updateMasterData: (patch: Partial<MasterDataSettings>) => {
    globalState = {
      ...globalState,
      masterData: { ...globalState.masterData, ...patch }
    };
    notify();
  },

  updateTemplates: (patch: Partial<TemplatesSettings>) => {
    globalState = {
      ...globalState,
      templates: { ...globalState.templates, ...patch }
    };
    notify();
  },

  updateNetInspect: (patch: Partial<NetInspectSettings>) => {
    globalState = {
      ...globalState,
      netInspect: { ...globalState.netInspect, ...patch }
    };
    notify();
  },

  updateLicensing: (patch: Partial<LicensingSettings>) => {
    globalState = {
      ...globalState,
      licensing: { ...globalState.licensing, ...patch }
    };
    notify();
  },

  updateItarPrivacy: (patch: Partial<ItarPrivacySettings>) => {
    globalState = {
      ...globalState,
      itarPrivacy: { ...globalState.itarPrivacy, ...patch }
    };
    notify();
  },

  setTableColumns: (columns: TableColumnConfig[]) => {
    globalState = {
      ...globalState,
      workspace: {
        ...globalState.workspace,
        tableColumns: columns,
        tablePresetView: 'custom'
      }
    };
    notify();
  },

  applyTablePreset: (preset: 'as9102-standard' | 'shop-floor' | 'gdt-focus') => {
    let newCols = DEFAULT_TABLE_COLUMNS.map(c => ({ ...c }));
    if (preset === 'shop-floor') {
      newCols = newCols.map(c => ({
        ...c,
        visible: ['balloonNumber', 'rawText', 'cleanNominal', 'measuredValue', 'status', 'method'].includes(c.id)
      }));
    } else if (preset === 'gdt-focus') {
      newCols = newCols.map(c => ({
        ...c,
        visible: ['balloonNumber', 'rawText', 'type', 'cleanNominal', 'gdtCharacteristic', 'datumReference', 'plusTol', 'minusTol', 'measuredValue', 'status'].includes(c.id)
      }));
    }
    globalState = {
      ...globalState,
      workspace: {
        ...globalState.workspace,
        tableColumns: newCols,
        tablePresetView: preset
      }
    };
    notify();
  },

  resetToDefaults: () => {
    globalState = JSON.parse(JSON.stringify(DEFAULT_APPLICATION_OPTIONS));
    notify();
  },

  exportProfileJson: () => {
    const exportData = {
      software: 'LOONIST FAI',
      version: '2026.9',
      exportedAt: new Date().toISOString(),
      options: globalState
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `LOONIST_Enterprise_Config_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  importProfileJson: (jsonString: string): boolean => {
    try {
      const parsed = JSON.parse(jsonString);
      const opts = parsed.options || parsed;
      if (!opts || !opts.workspace || !opts.masterData) {
        return false;
      }
      globalState = {
        workspace: { ...DEFAULT_APPLICATION_OPTIONS.workspace, ...(opts.workspace || {}) },
        masterData: { ...DEFAULT_APPLICATION_OPTIONS.masterData, ...(opts.masterData || {}) },
        templates: { ...DEFAULT_APPLICATION_OPTIONS.templates, ...(opts.templates || {}) },
        netInspect: { ...DEFAULT_APPLICATION_OPTIONS.netInspect, ...(opts.netInspect || {}) },
        licensing: { ...DEFAULT_APPLICATION_OPTIONS.licensing, ...(opts.licensing || {}) },
        itarPrivacy: { ...DEFAULT_APPLICATION_OPTIONS.itarPrivacy, ...(opts.itarPrivacy || {}) },
      };
      notify();
      return true;
    } catch {
      return false;
    }
  }
};

/**
 * React hook for consuming Application Options reactively
 */
export function useApplicationOptions(): [ApplicationOptions, typeof applicationOptionsActions] {
  const [state, setState] = useState<ApplicationOptions>(globalState);

  useEffect(() => {
    const handler = () => setState(globalState);
    listeners.add(handler);
    return () => {
      listeners.delete(handler);
    };
  }, []);

  return [state, applicationOptionsActions];
}
