import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, ShieldCheck } from 'lucide-react';

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AboutModal: React.FC<AboutModalProps> = ({
  isOpen,
  onClose
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const content = (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-950/75 backdrop-blur-xs select-none p-4">
      <div
        className="w-[440px] max-w-[95vw] bg-white border border-slate-300 rounded-lg shadow-2xl overflow-hidden flex flex-col text-slate-800"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="h-11 bg-slate-100 border-b border-slate-200 px-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded bg-slate-900 flex items-center justify-center text-[10px] font-mono font-bold text-white">
              L
            </span>
            <h2 className="text-xs font-bold text-slate-900 tracking-wide uppercase">
              About LOONIST
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded hover:bg-slate-200 text-slate-500 hover:text-slate-900 transition cursor-pointer"
            title="Close [Esc]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 flex flex-col gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-slate-900">LOONIST FAI Platform</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 font-mono font-semibold">
                v2.0
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Aerospace First Article Inspection & GD&T Ballooning Engine compliant with SAE AS9102 Rev B/C and ASME Y14.5.
            </p>
          </div>

          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-3">
            <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
            <div className="text-[11px] text-emerald-800">
              <div className="font-bold">Air-Gapped Architecture</div>
              <div className="text-emerald-600 text-[10px]">
                100% on-device AI vision • Zero telemetry • ITAR/EAR compliant
              </div>
            </div>
          </div>

          <div className="text-[10px] text-slate-400 font-mono">
            Electron • SQLite Local DB • React 19 • PDF.js
          </div>
        </div>

        {/* Footer */}
        <div className="h-11 bg-slate-100 border-t border-slate-200 px-4 flex items-center justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded text-xs font-semibold bg-slate-800 hover:bg-slate-900 text-white shadow-xs transition cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
};
