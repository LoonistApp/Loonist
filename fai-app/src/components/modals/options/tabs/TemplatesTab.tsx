import React, { useRef } from 'react';
import type { TemplatesSettings, TemplateItem } from '../../../../types/applicationOptions';
import { 
  Folder, 
  FileSpreadsheet, 
  Plus, 
  Trash2, 
  CheckCircle2
} from 'lucide-react';

interface TemplatesTabProps {
  settings: TemplatesSettings;
  onChange: (patch: Partial<TemplatesSettings>) => void;
}

export const TemplatesTab: React.FC<TemplatesTabProps> = ({
  settings,
  onChange
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSetDefault = (id: string) => {
    const updated = settings.templates.map((t: TemplateItem) => ({
      ...t,
      isDefault: t.id === id
    }));
    onChange({ templates: updated, activeTemplateId: id });
  };

  const handleDeleteTemplate = (id: string) => {
    const updated = settings.templates.filter((t: TemplateItem) => t.id !== id);
    onChange({ templates: updated });
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const newTemplate: TemplateItem = {
      id: `tmpl-${Date.now()}`,
      name: file.name.replace(/\.[^/.]+$/, ""),
      filename: file.name,
      standard: 'Custom',
      isDefault: false,
      isCustom: true,
      lastModified: new Date().toLocaleDateString()
    };

    onChange({
      templates: [...settings.templates, newTemplate]
    });

    e.target.value = '';
  };

  return (
    <div className="flex flex-col gap-6 text-xs text-slate-800 dark:text-zinc-200">
      
      {/* 1. FILE LOCATIONS */}
      <div className="bg-slate-50 dark:bg-zinc-900/60 p-4 rounded-lg border border-slate-200 dark:border-zinc-800">
        <div className="flex items-center gap-2 mb-3">
          <Folder className="w-4 h-4 text-sky-600 dark:text-sky-400" />
          <h3 className="font-semibold text-xs text-slate-900 dark:text-white uppercase tracking-wider">
            Template File Locations & Cloudflare R2 Sync
          </h3>
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <span className="w-44 text-[11px] font-medium text-slate-600 dark:text-zinc-400">
              Project Templates Folder:
            </span>
            <div className="flex-1 flex items-center gap-2">
              <input
                type="text"
                value={settings.projectTemplatesFolder}
                onChange={(e) => onChange({ projectTemplatesFolder: e.target.value })}
                className="flex-1 bg-white dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 rounded px-2.5 py-1 text-xs text-slate-800 dark:text-zinc-200 outline-none focus:border-sky-500 font-mono"
              />
              <button
                type="button"
                onClick={() => {}}
                className="px-2.5 py-1 bg-slate-200 dark:bg-zinc-800 hover:bg-slate-300 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 rounded border border-slate-300 dark:border-zinc-700 transition cursor-pointer flex items-center gap-1.5"
                title="Browse local directory"
              >
                <Folder className="w-3.5 h-3.5" /> Browse
              </button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <span className="w-44 text-[11px] font-medium text-slate-600 dark:text-zinc-400">
              Export Template Folder:
            </span>
            <div className="flex-1 flex items-center gap-2">
              <input
                type="text"
                value={settings.exportTemplatesFolder}
                onChange={(e) => onChange({ exportTemplatesFolder: e.target.value })}
                className="flex-1 bg-white dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 rounded px-2.5 py-1 text-xs text-slate-800 dark:text-zinc-200 outline-none focus:border-sky-500 font-mono"
              />
              <button
                type="button"
                onClick={() => {}}
                className="px-2.5 py-1 bg-slate-200 dark:bg-zinc-800 hover:bg-slate-300 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 rounded border border-slate-300 dark:border-zinc-700 transition cursor-pointer flex items-center gap-1.5"
                title="Browse local directory"
              >
                <Folder className="w-3.5 h-3.5" /> Browse
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 2. EXCEL EXPORT TEMPLATES GRID */}
      <div className="bg-slate-50 dark:bg-zinc-900/60 p-4 rounded-lg border border-slate-200 dark:border-zinc-800">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <h3 className="font-semibold text-xs text-slate-900 dark:text-white uppercase tracking-wider">
              AS9102 & Customer Excel Export Templates (.xlsx)
            </h3>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".xlsx,.xltx,.xls"
              className="hidden"
            />
            <button
              type="button"
              onClick={handleUploadClick}
              className="flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-600 text-white px-2.5 py-1 rounded font-medium text-xs transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Add Custom Template
            </button>
          </div>
        </div>

        <div className="border border-slate-200 dark:border-zinc-800 rounded bg-white dark:bg-zinc-950 overflow-hidden max-h-[300px] overflow-y-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-100 dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-800 sticky top-0">
              <tr>
                <th className="py-1.5 px-3 w-10 text-center font-semibold text-[11px] text-slate-600 dark:text-zinc-400">#</th>
                <th className="py-1.5 px-3 font-semibold text-[11px] text-slate-600 dark:text-zinc-400">Template Name</th>
                <th className="py-1.5 px-3 font-semibold text-[11px] text-slate-600 dark:text-zinc-400">Standard</th>
                <th className="py-1.5 px-3 font-semibold text-[11px] text-slate-600 dark:text-zinc-400">File Name</th>
                <th className="py-1.5 px-3 w-20 text-center font-semibold text-[11px] text-slate-600 dark:text-zinc-400">Default</th>
                <th className="py-1.5 px-3 w-16 text-center font-semibold text-[11px] text-slate-600 dark:text-zinc-400">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60">
              {settings.templates.map((tmpl: TemplateItem, idx: number) => (
                <tr 
                  key={tmpl.id} 
                  className={`hover:bg-slate-50 dark:hover:bg-zinc-900/50 transition ${
                    tmpl.isDefault ? 'bg-sky-50/40 dark:bg-sky-950/20' : ''
                  }`}
                >
                  <td className="py-1.5 px-3 text-center font-mono text-[10px] text-slate-400">{idx + 1}</td>
                  <td className="py-1.5 px-3 font-medium text-slate-900 dark:text-zinc-100 flex items-center gap-1.5">
                    {tmpl.name}
                    {tmpl.isCustom && (
                      <span className="text-[9px] bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 px-1 py-0.2 rounded border border-amber-200 dark:border-amber-800">
                        Custom
                      </span>
                    )}
                  </td>
                  <td className="py-1.5 px-3 text-slate-600 dark:text-zinc-400">{tmpl.standard}</td>
                  <td className="py-1.5 px-3 font-mono text-[11px] text-slate-500 dark:text-zinc-400">{tmpl.filename}</td>
                  <td className="py-1.5 px-3 text-center">
                    <button
                      type="button"
                      onClick={() => handleSetDefault(tmpl.id)}
                      className={`p-1 rounded cursor-pointer transition ${
                        tmpl.isDefault 
                          ? 'text-sky-600 dark:text-sky-400' 
                          : 'text-slate-300 dark:text-zinc-600 hover:text-slate-600 dark:hover:text-zinc-300'
                      }`}
                      title={tmpl.isDefault ? 'Default template' : 'Set as default'}
                    >
                      <CheckCircle2 className="w-4 h-4" />
                    </button>
                  </td>
                  <td className="py-1.5 px-3 text-center">
                    {tmpl.isCustom ? (
                      <button
                        type="button"
                        onClick={() => handleDeleteTemplate(tmpl.id)}
                        className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-950/40 text-red-600 dark:text-red-400 cursor-pointer"
                        title="Remove template"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    ) : (
                      <span className="text-[10px] text-slate-400">Locked</span>
                    )}
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
