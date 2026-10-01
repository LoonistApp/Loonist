import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2 } from 'lucide-react';

interface ToastProps {
  message: string | null;
  onDismiss: () => void;
  duration?: number;
}

/** Transient bottom-center confirmation for actions that complete with no other visible change. */
export function Toast({ message, onDismiss, duration = 2200 }: ToastProps) {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(onDismiss, duration);
    return () => clearTimeout(timer);
  }, [message, duration, onDismiss]);

  if (!message) return null;

  return createPortal(
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[99999] pointer-events-none select-none">
      <div className="flex items-center gap-2 px-3.5 py-2 rounded-md bg-slate-900 border border-slate-700 shadow-2xl text-white text-[12px] font-medium animate-in fade-in duration-150">
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
        {message}
      </div>
    </div>,
    document.body
  );
}
