import React, { useState, useRef } from 'react';
import {
  Search,
  RotateCcw,
  Download,
  Upload,
  Check,
  Sliders,
  Wrench,
  Folder,
  Cloud,
  ShieldCheck,
  Lock,
  ChevronRight
} from 'lucide-react';
import { useApplicationOptions } from '../../../stores/useApplicationOptionsStore';
import type { ApplicationOptions } from '../../../types/applicationOptions';
import { WorkspaceTab } from './tabs/WorkspaceTab';
import { MasterDataTab } from './tabs/MasterDataTab';
import { TemplatesTab } from './tabs/TemplatesTab';
import { NetInspectTab } from './tabs/NetInspectTab';
import { LicensingTab } from './tabs/LicensingTab';
import { ItarPrivacyTab } from './tabs/ItarPrivacyTab';
import { templateFileStore } from '../../../services/export/templateFileStore';

export type OptionsSectionId =
  | 'workspace'
  | 'masterData'
  | 'templates'
  | 'netInspect'
  | 'licensing'
  | 'itarPrivacy';

export interface ApplicationOptionsViewProps {
  onSave?: () => void;
  onClose?: () => void;
  initialSection?: OptionsSectionId;
  hideFooter?: boolean;
}

export const ApplicationOptionsView: React.FC<ApplicationOptionsViewProps> = ({
  onSave,
  onClose,
  initialSection = 'workspace',
  hideFooter = false
}) => {
  const [globalOptions, actions] = useApplicationOptions();
  const [draftOptions, setDraftOptions] = useState<ApplicationOptions>(() =>
    JSON.parse(JSON.stringify(globalOptions))
  );
  const [activeSection, setActiveSection] = useState<OptionsSectionId>(initialSection);
  const [navSearch, setNavSearch] = useState('');
  const importInputRef = useRef<HTMLInputElement>(null);

  const handleSave = () => {
    actions.updateWorkspace(draftOptions.workspace);
    actions.updateMasterData(draftOptions.masterData);
    actions.updateTemplates(draftOptions.templates);
    actions.updateNetInspect(draftOptions.netInspect);
    actions.updateLicensing(draftOptions.licensing);
    actions.updateItarPrivacy(draftOptions.itarPrivacy);
    // Remove stored template files for templates deleted in this session
    templateFileStore.prune(draftOptions.templates.templates.map(t => t.id)).catch(err =>
      console.warn('Failed to clean up template files', err)
    );
    onSave?.();
  };

  const handleReset = () => {
    if (confirm('Reset all application options to factory aerospace defaults?')) {
      actions.resetToDefaults();
      setDraftOptions(JSON.parse(JSON.stringify(actions.get())));
    }
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const success = actions.importProfileJson(content);
      if (success) {
        setDraftOptions(JSON.parse(JSON.stringify(actions.get())));
        alert('Configuration profile imported successfully.');
      } else {
        alert('Failed to parse configuration profile.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const navItems: Array<{ id: OptionsSectionId; label: string; icon: React.ReactNode; group: string; desc: string }> = [
    { id: 'workspace', label: 'Workspace & Ergonomics', icon: <Sliders className="w-4 h-4" />, group: 'Application Options', desc: 'CAD mouse zoom polarity, canvas background, table column customizer' },
    { id: 'masterData', label: 'Factory Master Data', icon: <Wrench className="w-4 h-4" />, group: 'Application Options', desc: 'Inspection tools, manufacturing operations, severity classifications' },
    { id: 'templates', label: 'Templates', icon: <Folder className="w-4 h-4" />, group: 'Application Options', desc: 'AS9102 Form 1/2/3 and custom Excel export templates' },
    { id: 'netInspect', label: 'Net-Inspect Gateway', icon: <Cloud className="w-4 h-4" />, group: 'Application Options', desc: 'Aerospace upload limits, basic/ref flags, custom field mapping' },
    { id: 'licensing', label: 'Licensing', icon: <ShieldCheck className="w-4 h-4" />, group: 'Application Options', desc: 'Activate, refresh or release this workstation license; offline license file' },
    { id: 'itarPrivacy', label: 'Privacy & About', icon: <Lock className="w-4 h-4" />, group: 'Security & System', desc: 'How LOONIST handles your data, version and system information' },
  ];

  const filteredNavItems = navItems.filter(item =>
    item.label.toLowerCase().includes(navSearch.toLowerCase()) ||
    item.desc.toLowerCase().includes(navSearch.toLowerCase())
  );

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-white text-slate-900 overflow-hidden">
      {/* 2-COLUMN MAIN BODY */}
      <div className="flex-1 flex overflow-hidden min-h-0">

        {/* LEFT NAV PANEL */}
        <div className="w-64 border-r border-slate-200 bg-slate-50 flex flex-col p-3 gap-3 shrink-0 min-h-0">

          {/* Quick Search */}
          <div className="relative flex items-center">
            <Search
              className="w-3.5 h-3.5 text-slate-400 pointer-events-none"
              style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }}
            />
            <input
              type="text"
              placeholder="Search preferences..."
              value={navSearch}
              onChange={(e) => setNavSearch(e.target.value)}
              className="w-full pr-2.5 py-1.5 bg-white border border-slate-300 rounded text-xs text-slate-800 outline-none focus:border-blue-600"
              style={{ paddingLeft: '32px' }}
            />
          </div>

          {/* Section Items */}
          <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-1 pr-1">
            {filteredNavItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveSection(item.id)}
                className={`flex items-center justify-between px-3 py-2 rounded text-xs transition cursor-pointer text-left ${activeSection === item.id
                    ? 'bg-blue-600 text-white font-semibold shadow-xs'
                    : 'text-slate-600 hover:bg-slate-200 hover:text-slate-900 '
                  }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className={activeSection === item.id ? 'text-white' : 'text-slate-500'}>
                    {item.icon}
                  </span>
                  <span className="truncate">{item.label}</span>
                </div>
                {activeSection === item.id && (
                  <ChevronRight className="w-3.5 h-3.5 text-white shrink-0" />
                )}
              </button>
            ))}
          </div>

          {/* Profile Import / Export */}
          <div className="pt-2.5 border-t border-slate-200 flex flex-col gap-1.5">
            <input
              type="file"
              ref={importInputRef}
              onChange={handleImportFile}
              accept=".json"
              className="hidden"
            />
            <button
              type="button"
              onClick={() => importInputRef.current?.click()}
              className="w-full flex items-center justify-center gap-1.5 px-2 py-1 text-[11px] rounded bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 transition cursor-pointer font-medium"
              title="Import company configuration profile (.json)"
            >
              <Upload className="w-3 h-3" /> Import Profile
            </button>
            <button
              type="button"
              onClick={actions.exportProfileJson}
              className="w-full flex items-center justify-center gap-1.5 px-2 py-1 text-[11px] rounded bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 transition cursor-pointer font-medium"
              title="Export configuration profile (.json) to deploy across shop floor PCs"
            >
              <Download className="w-3 h-3" /> Export Profile
            </button>
          </div>
        </div>

        {/* RIGHT MAIN CONTENT AREA */}
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden bg-white min-w-0">
          {/* Scrollable Tab Content View */}
          <div className="flex-1 min-h-0 overflow-y-auto p-5">
            {activeSection === 'workspace' && (
              <WorkspaceTab
                settings={draftOptions.workspace}
                onChange={(patch) => {
                  if (patch.tableColumns) {
                    actions.setTableColumns(patch.tableColumns);
                  } else {
                    actions.updateWorkspace(patch);
                  }
                  setDraftOptions(prev => ({
                    ...prev,
                    workspace: { ...prev.workspace, ...patch }
                  }));
                }}
                onApplyPreset={(preset) => {
                  actions.applyTablePreset(preset);
                  setDraftOptions(prev => ({
                    ...prev,
                    workspace: { ...prev.workspace, tableColumns: actions.get().workspace.tableColumns, tablePresetView: preset }
                  }));
                }}
              />
            )}

            {activeSection === 'masterData' && (
              <MasterDataTab
                settings={draftOptions.masterData}
                onChange={(patch) => setDraftOptions(prev => ({
                  ...prev,
                  masterData: { ...prev.masterData, ...patch }
                }))}
              />
            )}

            {activeSection === 'templates' && (
              <TemplatesTab
                settings={draftOptions.templates}
                onChange={(patch) => setDraftOptions(prev => ({
                  ...prev,
                  templates: { ...prev.templates, ...patch }
                }))}
              />
            )}

            {activeSection === 'netInspect' && (
              <NetInspectTab
                settings={draftOptions.netInspect}
                onChange={(patch) => setDraftOptions(prev => ({
                  ...prev,
                  netInspect: { ...prev.netInspect, ...patch }
                }))}
              />
            )}

            {activeSection === 'licensing' && (
              <LicensingTab
                settings={draftOptions.licensing}
                onChange={(patch) => setDraftOptions(prev => ({
                  ...prev,
                  licensing: { ...prev.licensing, ...patch }
                }))}
              />
            )}

            {activeSection === 'itarPrivacy' && (
              <ItarPrivacyTab
                settings={draftOptions.itarPrivacy}
                onChange={(patch) => setDraftOptions(prev => ({
                  ...prev,
                  itarPrivacy: { ...prev.itarPrivacy, ...patch }
                }))}
              />
            )}
          </div>
        </div>

      </div>

      {/* BOTTOM ACTION BAR (Optional when rendered inside parent modal with its own action bar) */}
      {!hideFooter && (
        <div className="px-5 py-2.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between select-none shrink-0">
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-600 hover:text-red-600 hover:bg-slate-200 rounded border border-transparent transition cursor-pointer"
            title="Reset options to original factory settings"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset Defaults
          </button>

          <div className="flex items-center gap-2">
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 hover:bg-slate-200 rounded-md transition cursor-pointer"
              >
                Cancel
              </button>
            )}
            <button
              type="button"
              onClick={handleSave}
              className="btn-primary-action flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-md transition cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Save & Apply</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
