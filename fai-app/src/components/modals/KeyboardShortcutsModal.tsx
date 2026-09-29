import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Keyboard } from 'lucide-react';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ShortcutItem {
  keys: string;
  description: string;
}

const SHORTCUT_GROUPS: Array<{ title: string; shortcuts: ShortcutItem[] }> = [
  {
    title: 'CANVAS & VIEWPORT NAVIGATION',
    shortcuts: [
      { keys: 'Space + Drag', description: 'Pan blueprint canvas' },
      { keys: 'Double-Click', description: 'Enable free pan mode' },
      { keys: 'Ctrl + Scroll', description: 'Zoom in / zoom out' },
      { keys: 'Ctrl + 0', description: 'Fit drawing to screen' },
      { keys: 'R', description: 'Rotate drawing 90° CW' }
    ]
  },
  {
    title: 'BALLOONS & INSPECTION',
    shortcuts: [
      { keys: 'Del / Backspace', description: 'Delete selected balloon' },
      { keys: 'Tab', description: 'Next characteristic row' },
      { keys: 'Shift + Tab', description: 'Previous characteristic row' },
      { keys: 'Ctrl + S', description: 'Save project archive (.loonist)' },
      { keys: 'Ctrl + O', description: 'Open drawing file (PDF)' },
      { keys: 'Esc', description: 'Deselect / close active modal' }
    ]
  }
];

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({
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
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-950/75 backdrop-blur-xs select-none p-4 animate-in fade-in duration-100">
      <div
        className="w-[520px] max-w-[95vw] bg-white dark:bg-[#18181b] border border-slate-300 dark:border-zinc-700/80 rounded-lg shadow-2xl overflow-hidden flex flex-col text-slate-800 dark:text-zinc-100 ring-1 ring-black/30"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="h-11 bg-slate-100 dark:bg-[#202024] border-b border-slate-200 dark:border-zinc-800 px-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-1 rounded bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300">
              <Keyboard className="w-4 h-4" />
            </div>
            <h2 className="text-xs font-bold text-slate-900 dark:text-white tracking-wide uppercase">
              Keyboard Shortcuts
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded hover:bg-slate-200 dark:hover:bg-zinc-800 text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white transition cursor-pointer"
            title="Close [Esc]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 flex flex-col gap-4 overflow-y-auto max-h-[70vh]">
          {SHORTCUT_GROUPS.map((group) => (
            <div key={group.title} className="flex flex-col gap-2">
              <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">
                {group.title}
              </span>
              <div className="flex flex-col divide-y divide-slate-100 dark:divide-zinc-800/80 bg-slate-50 dark:bg-zinc-900/50 rounded-lg border border-slate-200 dark:border-zinc-800">
                {group.shortcuts.map((s) => (
                  <div key={s.keys} className="flex items-center justify-between px-3 py-2 text-xs">
                    <span className="text-slate-700 dark:text-zinc-300 font-medium">
                      {s.description}
                    </span>
                    <kbd className="px-2 py-0.5 rounded font-mono text-[11px] font-bold bg-white dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 text-slate-900 dark:text-zinc-100 shadow-2xs">
                      {s.keys}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="h-11 bg-slate-100 dark:bg-[#1a1a1d] border-t border-slate-200 dark:border-zinc-800 px-4 flex items-center justify-between shrink-0">
          <span className="text-[10px] text-slate-400 dark:text-zinc-500 font-mono">
            Press [Esc] to close
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded text-xs font-semibold bg-slate-800 hover:bg-slate-900 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-white shadow-xs transition cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
};
