import React from 'react';
import type { NetInspectSettings, NetInspectFieldMapping } from '../../../../types/applicationOptions';
import { Cloud, ShieldCheck, CheckSquare, Square } from 'lucide-react';

interface NetInspectTabProps {
  settings: NetInspectSettings;
  onChange: (patch: Partial<NetInspectSettings>) => void;
}

export const NetInspectTab: React.FC<NetInspectTabProps> = ({
  settings,
  onChange
}) => {
  const handleTogglePublish = (customFieldKey: string) => {
    const updated = settings.customFieldMappings.map((m: NetInspectFieldMapping) => {
      if (m.customFieldKey === customFieldKey) {
        return { ...m, publish: !m.publish };
      }
      return m;
    });
    onChange({ customFieldMappings: updated });
  };

  const handleUpdateFieldMapping = (customFieldKey: string, netInspectField: string) => {
    const updated = settings.customFieldMappings.map((m: NetInspectFieldMapping) => {
      if (m.customFieldKey === customFieldKey) {
        return { ...m, netInspectField };
      }
      return m;
    });
    onChange({ customFieldMappings: updated });
  };

  return (
    <div className="flex flex-col gap-6 text-xs text-slate-800 dark:text-zinc-200">
      
      {/* 1. GENERAL NET-INSPECT COMPLIANCE FLAGS */}
      <div className="bg-slate-50 dark:bg-zinc-900/60 p-4 rounded-lg border border-slate-200 dark:border-zinc-800">
        <div className="flex items-center gap-2 mb-3">
          <Cloud className="w-4 h-4 text-sky-600 dark:text-sky-400" />
          <h3 className="font-semibold text-xs text-slate-900 dark:text-white uppercase tracking-wider">
            Net-Inspect General Compliance Rules
          </h3>
        </div>

        <div className="flex flex-col gap-2.5">
          <label className="flex items-start gap-2.5 p-1.5 rounded hover:bg-slate-100 dark:hover:bg-zinc-800/60 transition cursor-pointer">
            <input
              type="checkbox"
              checked={settings.enforceFieldSizes}
              onChange={(e) => onChange({ enforceFieldSizes: e.target.checked })}
              className="mt-0.5 w-4 h-4 rounded text-sky-600 focus:ring-sky-500 border-slate-300 dark:border-zinc-700"
            />
            <div>
              <span className="font-medium text-slate-800 dark:text-zinc-200">
                Enforce Net-Inspect Data Field Sizes
              </span>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                Truncates and validates character lengths to prevent aerospace upload rejection (e.g. 50 char limits).
              </p>
            </div>
          </label>

          <label className="flex items-start gap-2.5 p-1.5 rounded hover:bg-slate-100 dark:hover:bg-zinc-800/60 transition cursor-pointer">
            <input
              type="checkbox"
              checked={settings.flagBasicAsReportable}
              onChange={(e) => onChange({ flagBasicAsReportable: e.target.checked })}
              className="mt-0.5 w-4 h-4 rounded text-sky-600 focus:ring-sky-500 border-slate-300 dark:border-zinc-700"
            />
            <div>
              <span className="font-medium text-slate-800 dark:text-zinc-200">
                Flag Basic Dimensions as Reportable
              </span>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                When enabled, ASME Y14.5 theoretical exact basic dimensions [Dim] will generate Form 3 requirement rows.
              </p>
            </div>
          </label>

          <label className="flex items-start gap-2.5 p-1.5 rounded hover:bg-slate-100 dark:hover:bg-zinc-800/60 transition cursor-pointer">
            <input
              type="checkbox"
              checked={settings.flagReferenceAsReportable}
              onChange={(e) => onChange({ flagReferenceAsReportable: e.target.checked })}
              className="mt-0.5 w-4 h-4 rounded text-sky-600 focus:ring-sky-500 border-slate-300 dark:border-zinc-700"
            />
            <div>
              <span className="font-medium text-slate-800 dark:text-zinc-200">
                Flag Reference Dimensions as Reportable
              </span>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                Include informational reference dimensions (Dim) in published Net-Inspect inspection records.
              </p>
            </div>
          </label>

          <label className="flex items-start gap-2.5 p-1.5 rounded hover:bg-slate-100 dark:hover:bg-zinc-800/60 transition cursor-pointer">
            <input
              type="checkbox"
              checked={settings.populateProfileNominal}
              onChange={(e) => onChange({ populateProfileNominal: e.target.checked })}
              className="mt-0.5 w-4 h-4 rounded text-sky-600 focus:ring-sky-500 border-slate-300 dark:border-zinc-700"
            />
            <div>
              <span className="font-medium text-slate-800 dark:text-zinc-200">
                Populate profile geometric tolerance requirement fields with "&lt;= nominal value"
              </span>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                Standard aerospace convention for surface profile and line profile feature control frames.
              </p>
            </div>
          </label>
        </div>
      </div>

      {/* 2. CUSTOM FIELD MAPPING (BENCHMARK MATRIX) */}
      <div className="bg-slate-50 dark:bg-zinc-900/60 p-4 rounded-lg border border-slate-200 dark:border-zinc-800">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-sky-600 dark:text-sky-400" />
            <h3 className="font-semibold text-xs text-slate-900 dark:text-white uppercase tracking-wider">
              Custom Field Mapping (Quality Control ➔ Net-Inspect Additional Fields)
            </h3>
          </div>
          <span className="text-[10px] text-slate-500 dark:text-zinc-400">
            10 Standard Aerospace Slots
          </span>
        </div>

        <div className="border border-slate-200 dark:border-zinc-800 rounded bg-white dark:bg-zinc-950 overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-100 dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-800">
              <tr>
                <th className="py-2 px-3 w-12 text-center font-semibold text-[11px] text-slate-600 dark:text-zinc-400">#</th>
                <th className="py-2 px-3 font-semibold text-[11px] text-slate-600 dark:text-zinc-400">
                  Quality Control Custom Field (LOONIST)
                </th>
                <th className="py-2 px-3 font-semibold text-[11px] text-slate-600 dark:text-zinc-400">
                  Net-Inspect Additional Field
                </th>
                <th className="py-2 px-3 w-20 text-center font-semibold text-[11px] text-slate-600 dark:text-zinc-400">
                  Publish
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60">
              {settings.customFieldMappings.map((mapping: NetInspectFieldMapping, idx: number) => (
                <tr key={mapping.customFieldKey} className="hover:bg-slate-50 dark:hover:bg-zinc-900/50 transition">
                  <td className="py-2 px-3 text-center font-mono text-[10px] text-slate-400">{idx + 1}</td>
                  <td className="py-2 px-3 font-medium text-slate-900 dark:text-zinc-100">
                    {mapping.customFieldLabel}
                    <span className="ml-2 font-mono text-[10px] text-slate-400">({mapping.customFieldKey})</span>
                  </td>
                  <td className="py-2 px-3">
                    <input
                      type="text"
                      value={mapping.netInspectField}
                      onChange={(e) => handleUpdateFieldMapping(mapping.customFieldKey, e.target.value)}
                      placeholder="e.g. Serial Number, Heat Code..."
                      className="w-full bg-slate-50 dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 rounded px-2.5 py-1 text-xs text-slate-800 dark:text-zinc-200 outline-none focus:border-sky-500"
                    />
                  </td>
                  <td className="py-2 px-3 text-center">
                    <button
                      type="button"
                      onClick={() => handleTogglePublish(mapping.customFieldKey)}
                      className={`p-1 rounded cursor-pointer transition ${
                        mapping.publish 
                          ? 'text-sky-600 dark:text-sky-400' 
                          : 'text-slate-300 dark:text-zinc-600 hover:text-slate-500'
                      }`}
                      title={mapping.publish ? 'Publish to Net-Inspect' : 'Do not publish'}
                    >
                      {mapping.publish ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
