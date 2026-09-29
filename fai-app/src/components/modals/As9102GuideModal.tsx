import React, { useState } from 'react';
import { 
  X, 
  FileSpreadsheet, 
  ShieldCheck 
} from 'lucide-react';
import { AS9102_FORMS_GUIDE } from '../../data/helpData';

interface As9102GuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const As9102GuideModal: React.FC<As9102GuideModalProps> = ({
  isOpen,
  onClose
}) => {
  const [activeFormIndex, setActiveFormIndex] = useState(0);

  if (!isOpen) return null;

  const currentForm = AS9102_FORMS_GUIDE[activeFormIndex];

  return (
    <div 
      className="fixed inset-0 z-modal flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-4xl h-[600px] bg-white border border-slate-300 rounded-xl shadow-2xl flex flex-col text-slate-800 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-emerald-600 flex items-center justify-center text-white shadow-xs">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 leading-tight">
                SAE AS9102 Rev B/C Compliance Reference Guide
              </h3>
              <p className="text-[11px] text-slate-500">
                Aerospace First Article Inspection Requirement (FAIR) Forms 1, 2, and 3
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-md text-slate-400 hover:text-slate-900 hover:bg-slate-200 transition cursor-pointer"
            title="Close [ESC]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Selector Tabs */}
        <div className="px-6 py-3 border-b border-slate-200 flex items-center gap-2 bg-white shrink-0">
          {AS9102_FORMS_GUIDE.map((f, idx) => (
            <button
              key={f.formNumber}
              type="button"
              onClick={() => setActiveFormIndex(idx)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                activeFormIndex === idx
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 '
              }`}
            >
              <span className="w-4 h-4 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-mono">
                {f.formNumber}
              </span>
              <span>Form {f.formNumber}: {f.formTitle}</span>
            </button>
          ))}
        </div>

        {/* Form Details Area */}
        <div className="flex-1 min-h-0 overflow-y-auto p-6 flex flex-col gap-4 bg-slate-50">
          {/* Summary Banner */}
          <div className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-2xs flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider font-mono">
                Form {currentForm.formNumber} Purpose
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                Standard: SAE AS9102 Rev C
              </span>
            </div>
            <p className="text-xs text-slate-700">
              {currentForm.purpose}
            </p>
          </div>

          {/* Key Fields Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-xs">
            <table className="min-w-full text-left border-collapse text-xs">
              <thead className="bg-slate-100 border-b border-slate-200 text-slate-600 font-semibold">
                <tr>
                  <th className="py-2 px-3 w-16 text-center font-mono">Field #</th>
                  <th className="py-2 px-3 w-48">Field Name</th>
                  <th className="py-2 px-3 w-28 text-center">Status</th>
                  <th className="py-2 px-3">Description & Aerospace Intent</th>
                  <th className="py-2 px-3 w-48 font-mono">Sample Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {currentForm.keyFields.map((field) => (
                  <tr key={field.fieldNumber} className="hover:bg-slate-50 transition">
                    <td className="py-2 px-3 text-center font-mono font-bold text-slate-500">
                      #{field.fieldNumber}
                    </td>
                    <td className="py-2 px-3 font-semibold text-slate-900">
                      {field.fieldName}
                    </td>
                    <td className="py-2 px-3 text-center">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        field.isRequired
                          ? 'bg-slate-200 text-slate-800 '
                          : 'bg-slate-100 text-slate-500 '
                      }`}>
                        {field.isRequired ? 'Mandatory' : 'Conditional'}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-slate-600 text-[11.5px]">
                      {field.description}
                    </td>
                    <td className="py-2 px-3 font-mono text-[11px] text-emerald-700 truncate max-w-[200px]" title={field.sampleValue}>
                      {field.sampleValue}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Quality Audit Tip */}
          <div className="p-3 bg-slate-100 border border-slate-200 rounded-lg text-xs text-slate-700 flex items-start gap-2 mt-auto">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <span>
              <strong>LOONIST Compliance Guarantee:</strong> When exporting via the File Backstage menu or Reports tab, 
              LOONIST generates native multi-tab XLSX files strictly adhering to the SAE AS9102 Rev C specification, 
              ready for direct upload into prime contractor portals (e.g. Net-Inspect).
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold transition cursor-pointer"
          >
            Close Guide
          </button>
        </div>
      </div>
    </div>
  );
};
