import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Settings } from 'lucide-react';
import { ApplicationOptionsView, type OptionsSectionId } from './ApplicationOptionsView';

export type { OptionsSectionId };

interface ApplicationOptionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialSection?: OptionsSectionId;
}

export const ApplicationOptionsModal: React.FC<ApplicationOptionsModalProps> = ({
  isOpen,
  onClose,
  initialSection = 'workspace'
}) => {
  // Keyboard shortcut: ESC to close
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

  return createPortal(
    <div 
      className="fixed inset-0 z-modal flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 p-4 overflow-y-auto"
      style={{ zIndex: 99999 }}
      onClick={onClose}
    >
      <div 
        className="w-full max-w-5xl bg-white rounded-xl shadow-2xl border border-slate-300 flex flex-col overflow-hidden text-slate-900"
        style={{
          width: 'min(980px, calc(100vw - 32px))',
          height: 'min(680px, calc(100vh - 36px))',
          maxHeight: 'calc(100vh - 36px)',
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="options-dialog-title"
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER BAR */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 bg-slate-50 select-none shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md bg-blue-50 text-blue-600 flex items-center justify-center">
              <Settings className="w-4 h-4" />
            </div>
            <div>
              <h2 id="options-dialog-title" className="text-sm font-bold text-slate-900 flex items-center gap-2">
                Application Options
                <span className="text-[10px] font-mono font-normal text-slate-500 bg-slate-200 px-1.5 py-0.5 rounded">
                  LOONIST 2026.9
                </span>
              </h2>
              <p className="text-[11px] text-slate-500">
                Global Workstation Configuration, Factory Lists, and Compliance Preferences
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-900 hover:bg-slate-200 transition cursor-pointer"
            title="Close Options (ESC)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* APPLICATION OPTIONS VIEW */}
        <ApplicationOptionsView
          onSave={onClose}
          onClose={onClose}
          initialSection={initialSection}
        />
      </div>
    </div>,
    document.body
  );
};
