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
import { DEFAULT_APPLICATION_OPTIONS, DEFAULT_TABLE_COLUMNS, BUILT_IN_TEMPLATE_ID } from '../types/applicationOptions';

const STORAGE_KEY = 'loonist_app_options_v1';

// Placeholder signature shipped as a demo default before Sprint 8
const DEMO_LICENSE_SIGNATURE = '7f9a8b1c4d2e3f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a';

/**
 * Drops the plain-text device private key stored by earlier versions (the key now lives
 * encrypted in the main process) and clears the fake demo license.
 */
export function sanitizeLicensing(licensing: LicensingSettings & { devicePrivateKeyHex?: string }): LicensingSettings {
  const { devicePrivateKeyHex: _discarded, ...rest } = licensing;
  if (rest.signature === DEMO_LICENSE_SIGNATURE) {
    return { ...DEFAULT_APPLICATION_OPTIONS.licensing, apiUrl: rest.apiUrl || DEFAULT_APPLICATION_OPTIONS.licensing.apiUrl };
  }
  // Licenses saved before Sprint 8 kept only the individual fields; rebuild the signed payload
  // in the Worker's field order so offline verification can report on it
  if (!rest.licensePayload && rest.licenseId && rest.deviceId && rest.expiresAt) {
    return {
      ...rest,
      licensePayload: {
        licenseId: rest.licenseId,
        deviceId: rest.deviceId,
        tenantId: rest.tenantId,
        expiresAt: rest.expiresAt,
        features: rest.features
      }
    };
  }
  return rest;
}

/**
 * Keeps only the built-in template plus templates the user actually uploaded
 * (earlier versions stored placeholder rows with no file behind them).
 */
function sanitizeTemplates(templates: TemplatesSettings): TemplatesSettings {
  const builtIns = DEFAULT_APPLICATION_OPTIONS.templates.templates;
  const uploaded = (templates.templates || []).filter(t => t.isCustom && t.id.startsWith('tmpl-'));
  const list = [...builtIns, ...uploaded];
  const activeTemplateId = list.some(t => t.id === templates.activeTemplateId)
    ? templates.activeTemplateId
    : BUILT_IN_TEMPLATE_ID;
  return {
    ...templates,
    activeTemplateId,
    templates: list.map(t => ({ ...t, isDefault: t.id === activeTemplateId }))
  };
}

// In-memory singleton state so all components stay 100% in sync without full reloads
let globalState: ApplicationOptions = (() => {
  if (typeof window === 'undefined') return DEFAULT_APPLICATION_OPTIONS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_APPLICATION_OPTIONS;
    const parsed = JSON.parse(raw);
    // Deep merge defaults to guarantee new fields are always present
    const loaded: ApplicationOptions = {
      workspace: { ...DEFAULT_APPLICATION_OPTIONS.workspace, ...(parsed.workspace || {}) },
      masterData: { ...DEFAULT_APPLICATION_OPTIONS.masterData, ...(parsed.masterData || {}) },
      templates: sanitizeTemplates({ ...DEFAULT_APPLICATION_OPTIONS.templates, ...(parsed.templates || {}) }),
      netInspect: { ...DEFAULT_APPLICATION_OPTIONS.netInspect, ...(parsed.netInspect || {}) },
      licensing: sanitizeLicensing({ ...DEFAULT_APPLICATION_OPTIONS.licensing, ...(parsed.licensing || {}) }),
      itarPrivacy: { ...DEFAULT_APPLICATION_OPTIONS.itarPrivacy, ...(parsed.itarPrivacy || {}) },
    };
    // Rewrite immediately so a plain-text private key from an older version does not linger on disk
    if (parsed.licensing && 'devicePrivateKeyHex' in parsed.licensing) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(loaded));
    }
    return loaded;
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
    // Never reset the workstation's license binding
    globalState = { ...JSON.parse(JSON.stringify(DEFAULT_APPLICATION_OPTIONS)), licensing: globalState.licensing };
    notify();
  },

  exportProfileJson: () => {
    const exportData = {
      software: 'LOONIST FAI',
      version: '2026.9',
      exportedAt: new Date().toISOString(),
      // License bindings are per workstation, so only the server URL is shared
      options: { ...globalState, licensing: { apiUrl: globalState.licensing.apiUrl } }
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
        templates: sanitizeTemplates({ ...DEFAULT_APPLICATION_OPTIONS.templates, ...(opts.templates || {}) }),
        netInspect: { ...DEFAULT_APPLICATION_OPTIONS.netInspect, ...(opts.netInspect || {}) },
        // Keep this workstation's own license; only adopt the server URL from the profile
        licensing: {
          ...globalState.licensing,
          apiUrl: typeof opts.licensing?.apiUrl === 'string' ? opts.licensing.apiUrl : globalState.licensing.apiUrl
        },
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
