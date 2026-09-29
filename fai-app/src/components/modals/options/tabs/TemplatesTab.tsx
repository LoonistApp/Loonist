import React, { useEffect, useRef, useState } from 'react';
import type { TemplatesSettings, TemplateItem } from '../../../../types/applicationOptions';
import { BUILT_IN_TEMPLATE_ID } from '../../../../types/applicationOptions';
import {
  FileSpreadsheet,
  Plus,
  Trash2,
  CheckCircle2,
  Download,
  AlertTriangle,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { templateFileStore } from '../../../../services/export/templateFileStore';
import {
  inspectTemplate,
  buildStarterTemplate,
  PROJECT_TOKENS,
  CHARACTERISTIC_TOKENS
} from '../../../../services/export/excelTemplateFiller';
import { As9102ExcelExporter } from '../../../../services/export/as9102ExcelExporter';

interface TemplatesTabProps {
  settings: TemplatesSettings;
  onChange: (patch: Partial<TemplatesSettings>) => void;
}

type Feedback = { type: 'success' | 'warning' | 'error'; text: string } | null;

export const TemplatesTab: React.FC<TemplatesTabProps> = ({
  settings,
  onChange
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [missingIds, setMissingIds] = useState<Set<string>>(new Set());
  const [isUploading, setIsUploading] = useState(false);
  const [showReference, setShowReference] = useState(false);

  // Flag custom templates whose file is no longer in local storage
  const customIdsKey = settings.templates.filter(t => t.isCustom).map(t => t.id).join('|');
  useEffect(() => {
    let cancelled = false;
    const ids = customIdsKey ? customIdsKey.split('|') : [];
    Promise.all(ids.map(async id => ((await templateFileStore.load(id).catch(() => null)) ? null : id)))
      .then(results => {
        if (!cancelled) setMissingIds(new Set(results.filter((id): id is string => id !== null)));
      });
    return () => {
      cancelled = true;
    };
  }, [customIdsKey]);

  const handleSetDefault = (id: string) => {
    if (missingIds.has(id)) {
      setFeedback({ type: 'error', text: 'This template file is missing. Remove it and upload it again.' });
      return;
    }
    const updated = settings.templates.map((t: TemplateItem) => ({
      ...t,
      isDefault: t.id === id
    }));
    onChange({ templates: updated, activeTemplateId: id });
  };

  const handleDeleteTemplate = (id: string) => {
    const remaining = settings.templates.filter((t: TemplateItem) => t.id !== id);
    if (settings.activeTemplateId === id) {
      onChange({
        templates: remaining.map(t => ({ ...t, isDefault: t.id === BUILT_IN_TEMPLATE_ID })),
        activeTemplateId: BUILT_IN_TEMPLATE_ID
      });
    } else {
      onChange({ templates: remaining });
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleDownloadStarter = () => {
    As9102ExcelExporter.downloadXlsx(buildStarterTemplate(), 'LOONIST_Starter_Template.xlsx');
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setIsUploading(true);
    setFeedback(null);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const report = inspectTemplate(bytes);
      if (!report.isValid) {
        setFeedback({ type: 'error', text: report.error || 'This template could not be read.' });
        return;
      }

      const id = `tmpl-${Date.now()}`;
      await templateFileStore.save(id, bytes);

      const newTemplate: TemplateItem = {
        id,
        name: file.name.replace(/\.[^/.]+$/, ''),
        filename: file.name,
        standard: 'Custom',
        isDefault: false,
        isCustom: true,
        lastModified: new Date().toLocaleDateString()
      };
      onChange({ templates: [...settings.templates, newTemplate] });

      const fieldCount = report.projectTokens.length + report.characteristicTokens.length;
      const parts = [`Added "${newTemplate.name}" with ${fieldCount} field${fieldCount === 1 ? '' : 's'}.`];
      if (report.repeatRowSheets.length > 0) {
        parts.push(`Characteristic rows repeat on: ${report.repeatRowSheets.join(', ')}.`);
      } else {
        parts.push('No {{char.*}} row found, so characteristics will not be listed.');
      }
      if (report.unknownTokens.length > 0) {
        parts.push(`Unknown fields left blank: ${report.unknownTokens.map(t => `{{${t}}}`).join(', ')}.`);
      }
      parts.push('Click the check mark to use it for Excel export, then Save.');
      setFeedback({
        type: report.unknownTokens.length > 0 || report.repeatRowSheets.length === 0 ? 'warning' : 'success',
        text: parts.join(' ')
      });
    } catch (err) {
      console.error('Template upload failed', err);
      setFeedback({ type: 'error', text: 'The template could not be stored on this computer.' });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 text-xs text-slate-800 dark:text-zinc-200">

      {/* EXCEL EXPORT TEMPLATES GRID */}
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
              accept=".xlsx,.xltx"
              className="hidden"
            />
            <button
              type="button"
              onClick={handleDownloadStarter}
              className="flex items-center gap-1.5 bg-slate-200 dark:bg-zinc-800 hover:bg-slate-300 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 px-2.5 py-1 rounded border border-slate-300 dark:border-zinc-700 font-medium text-xs transition cursor-pointer"
              title="Download an example template with every placeholder"
            >
              <Download className="w-3.5 h-3.5" /> Starter Template
            </button>
            <button
              type="button"
              onClick={handleUploadClick}
              disabled={isUploading}
              className="flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-60 text-white px-2.5 py-1 rounded font-medium text-xs transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> {isUploading ? 'Reading…' : 'Add Custom Template'}
            </button>
          </div>
        </div>

        {feedback && (
          <div
            className={`mb-3 px-3 py-2 rounded border text-[11px] leading-relaxed ${
              feedback.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-300'
                : feedback.type === 'warning'
                ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-300'
                : 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900 text-red-700 dark:text-red-300'
            }`}
          >
            {feedback.text}
          </div>
        )}

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
                    {tmpl.isCustom && !missingIds.has(tmpl.id) && (
                      <span className="text-[9px] bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 px-1 py-0.2 rounded border border-amber-200 dark:border-amber-800">
                        Custom
                      </span>
                    )}
                    {missingIds.has(tmpl.id) && (
                      <span
                        className="flex items-center gap-0.5 text-[9px] bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 px-1 py-0.2 rounded border border-red-200 dark:border-red-800"
                        title="The file for this template is not stored on this computer. Remove it and upload it again."
                      >
                        <AlertTriangle className="w-2.5 h-2.5" /> File missing
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
                      title={tmpl.isDefault ? 'Used for Excel export' : 'Use for Excel export'}
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

        {/* PLACEHOLDER REFERENCE */}
        <button
          type="button"
          onClick={() => setShowReference(v => !v)}
          className="mt-3 flex items-center gap-1 text-[11px] font-medium text-sky-700 dark:text-sky-400 hover:underline cursor-pointer"
        >
          {showReference ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          How custom templates work
        </button>

        {showReference && (
          <div className="mt-2 flex flex-col gap-3 text-[11px] text-slate-600 dark:text-zinc-400">
            <p className="leading-relaxed">
              Type placeholders into any cell of your Excel file. On export LOONIST replaces them and keeps all of your
              formatting, logos and merged cells. Put the <span className="font-mono">{'{{char.*}}'}</span> fields on a
              single row: that row is repeated once per characteristic and everything below it moves down. Formulas below
              that row are not adjusted.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <TokenList title="Project fields (any cell)" tokens={PROJECT_TOKENS} />
              <TokenList title="Characteristic fields (Form 3 row)" tokens={CHARACTERISTIC_TOKENS} />
            </div>
          </div>
        )}
      </div>

    </div>
  );
};

const TokenList: React.FC<{ title: string; tokens: Record<string, string> }> = ({ title, tokens }) => (
  <div className="border border-slate-200 dark:border-zinc-800 rounded bg-white dark:bg-zinc-950">
    <div className="px-2.5 py-1.5 border-b border-slate-200 dark:border-zinc-800 font-semibold text-slate-700 dark:text-zinc-300">
      {title}
    </div>
    <ul className="divide-y divide-slate-100 dark:divide-zinc-800/60">
      {Object.entries(tokens).map(([key, label]) => (
        <li key={key} className="px-2.5 py-1 flex items-center justify-between gap-2">
          <span className="font-mono text-slate-800 dark:text-zinc-200">{`{{${key}}}`}</span>
          <span className="text-right text-slate-500 dark:text-zinc-500">{label}</span>
        </li>
      ))}
    </ul>
  </div>
);
