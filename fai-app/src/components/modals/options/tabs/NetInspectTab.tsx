import React from 'react';
import type { NetInspectSettings, NetInspectFieldMapping } from '../../../../types/applicationOptions';
import { CheckSquare, Square } from 'lucide-react';

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
    <div className="flex flex-col gap-6 text-xs text-slate-800">
      
      {/* 1. GENERAL NET-INSPECT COMPLIANCE FLAGS */}
      <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
        <div className="flex items-center gap-2 mb-3">
          <h3 className="font-semibold text-xs text-slate-900 uppercase tracking-wider">
            Net-Inspect General Compliance Rules
          </h3>
        </div>

        <div className="flex flex-col gap-2.5">
          <label className="flex items-start gap-2.5 p-1.5 rounded hover:bg-slate-100 transition cursor-pointer">
            <input
              type="checkbox"
              checked={settings.enforceFieldSizes}
              onChange={(e) => onChange({ enforceFieldSizes: e.target.checked })}
              className="mt-0.5 w-4 h-4 rounded text-blue-600 border-slate-300"
            />
            <div>
              <span className="font-medium text-slate-800">
                Enforce Net-Inspect Data Field Sizes
              </span>
              <p className="text-[11px] text-slate-500">
                Truncates and validates character lengths to prevent aerospace upload rejection (e.g. 50 char limits).
              </p>
            </div>
          </label>

          <label className="flex items-start gap-2.5 p-1.5 rounded hover:bg-slate-100 transition cursor-pointer">
            <input
              type="checkbox"
              checked={settings.flagBasicAsReportable}
              onChange={(e) => onChange({ flagBasicAsReportable: e.target.checked })}
              className="mt-0.5 w-4 h-4 rounded text-blue-600 border-slate-300"
            />
            <div>
              <span className="font-medium text-slate-800">
                Flag Basic Dimensions as Reportable
              </span>
              <p className="text-[11px] text-slate-500">
                When enabled, ASME Y14.5 theoretical exact basic dimensions [Dim] will generate Form 3 requirement rows.
              </p>
            </div>
          </label>

          <label className="flex items-start gap-2.5 p-1.5 rounded hover:bg-slate-100 transition cursor-pointer">
            <input
              type="checkbox"
              checked={settings.flagReferenceAsReportable}
              onChange={(e) => onChange({ flagReferenceAsReportable: e.target.checked })}
              className="mt-0.5 w-4 h-4 rounded text-blue-600 border-slate-300"
            />
            <div>
              <span className="font-medium text-slate-800">
                Flag Reference Dimensions as Reportable
              </span>
              <p className="text-[11px] text-slate-500">
                Include informational reference dimensions (Dim) in published Net-Inspect inspection records.
              </p>
            </div>
          </label>

          <label className="flex items-start gap-2.5 p-1.5 rounded hover:bg-slate-100 transition cursor-pointer">
            <input
              type="checkbox"
              checked={settings.populateProfileNominal}
              onChange={(e) => onChange({ populateProfileNominal: e.target.checked })}
              className="mt-0.5 w-4 h-4 rounded text-blue-600 border-slate-300"
            />
            <div>
              <span className="font-medium text-slate-800">
                Populate profile geometric tolerance requirement fields with "&lt;= nominal value"
              </span>
              <p className="text-[11px] text-slate-500">
                Standard aerospace convention for surface profile and line profile feature control frames.
              </p>
            </div>
          </label>
        </div>
      </div>

      {/* 2. CUSTOM FIELD MAPPING (BENCHMARK MATRIX) */}
      <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-xs text-slate-900 uppercase tracking-wider">
              Custom Field Mapping
            </h3>
          </div>
          <span className="text-[10px] text-slate-500">
            10 Standard Aerospace Slots
          </span>
        </div>

        <div className="border border-slate-200 rounded bg-white overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-100 border-b border-slate-200">
              <tr>
                <th className="py-2 px-3 w-12 text-center font-semibold text-[11px] text-slate-600">#</th>
                <th className="py-2 px-3 font-semibold text-[11px] text-slate-600">
                  Quality Control Custom Field (LOONIST)
                </th>
                <th className="py-2 px-3 font-semibold text-[11px] text-slate-600">
                  Net-Inspect Additional Field
                </th>
                <th className="py-2 px-3 w-20 text-center font-semibold text-[11px] text-slate-600">
                  Publish
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {settings.customFieldMappings.map((mapping: NetInspectFieldMapping, idx: number) => (
                <tr key={mapping.customFieldKey} className="hover:bg-slate-50 transition">
                  <td className="py-2 px-3 text-center font-mono text-[10px] text-slate-400">{idx + 1}</td>
                  <td className="py-2 px-3 font-medium text-slate-900">
                    {mapping.customFieldLabel}
                    <span className="ml-2 font-mono text-[10px] text-slate-400">({mapping.customFieldKey})</span>
                  </td>
                  <td className="py-2 px-3">
                    <input
                      type="text"
                      value={mapping.netInspectField}
                      onChange={(e) => handleUpdateFieldMapping(mapping.customFieldKey, e.target.value)}
                      placeholder="e.g. Serial Number, Heat Code..."
                      className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1 text-xs text-slate-800 outline-none focus:border-blue-600"
                    />
                  </td>
                  <td className="py-2 px-3 text-center">
                    <button
                      type="button"
                      onClick={() => handleTogglePublish(mapping.customFieldKey)}
                      className={`p-1 rounded cursor-pointer transition ${
                        mapping.publish
                          ? 'text-blue-600 '
                          : 'text-slate-300 hover:text-slate-900'
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
