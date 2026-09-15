import React from 'react';

export interface RibbonButtonProps {
  variant?: 'large' | 'small' | 'icon-only';
  icon: React.ReactNode;
  label?: string;
  subLabel?: string;
  onClick?: () => void;
  disabled?: boolean;
  active?: boolean;
  title?: string;
  hotkey?: string;
  badge?: string | number;
  accent?: 'blue' | 'amber' | 'emerald' | 'red' | 'default';
  className?: string;
}

export const RibbonButton: React.FC<RibbonButtonProps> = ({
  variant = 'small',
  icon,
  label,
  subLabel,
  onClick,
  disabled = false,
  active = false,
  title,
  hotkey,
  badge,
  accent = 'default',
  className = ''
}) => {
  const tooltipText = title ? (hotkey ? `${title} [${hotkey}]` : title) : hotkey ? `[${hotkey}]` : undefined;

  // Variant: LARGE (stacked icon over text - CAD primary action style)
  if (variant === 'large') {
    let activeBg = 'bg-slate-100 text-slate-900 border-slate-300 dark:bg-zinc-800 dark:text-white dark:border-zinc-700';
    if (active) {
      if (accent === 'blue') activeBg = 'bg-blue-50 text-blue-700 border-blue-400 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-700';
      else if (accent === 'emerald') activeBg = 'bg-emerald-50 text-emerald-700 border-emerald-400 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-700';
      else if (accent === 'amber') activeBg = 'bg-amber-50 text-amber-700 border-amber-400 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-700';
      else if (accent === 'red') activeBg = 'bg-red-50 text-red-700 border-red-400 dark:bg-red-950/60 dark:text-red-300 dark:border-red-700';
      else activeBg = 'bg-blue-50 text-blue-700 border-blue-400 dark:bg-zinc-800 dark:text-blue-300 dark:border-zinc-600';
    }

    return (
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        title={tooltipText}
        className={`group relative flex flex-col items-center justify-center min-w-[54px] h-[58px] px-2 py-1 rounded-sm border transition select-none cursor-pointer text-center ${
          active
            ? `${activeBg} shadow-2xs font-semibold`
            : 'border-transparent text-slate-700 hover:text-slate-900 hover:bg-slate-100/90 hover:border-slate-300/80 dark:text-slate-300 dark:hover:text-white dark:hover:bg-zinc-800/80 dark:hover:border-zinc-700'
        } disabled:opacity-35 disabled:pointer-events-none disabled:grayscale ${className}`}
      >
        <div className="relative flex items-center justify-center mb-0.5">
          {icon}
          {badge !== undefined && (
            <span className="absolute -top-1.5 -right-2 px-1 py-0.2 min-w-[14px] text-[9px] font-mono font-bold rounded-full bg-blue-600 text-white shadow-2xs leading-tight">
              {badge}
            </span>
          )}
        </div>
        {label && (
          <span className="text-[10px] leading-tight font-medium tracking-tight whitespace-nowrap">
            {label}
          </span>
        )}
        {subLabel && (
          <span className="text-[9px] leading-none text-slate-400 dark:text-zinc-400 whitespace-nowrap mt-0.5">
            {subLabel}
          </span>
        )}
      </button>
    );
  }

  // Variant: ICON-ONLY (compact icon box with tooltip)
  if (variant === 'icon-only') {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        title={tooltipText}
        className={`relative flex items-center justify-center w-7 h-7 rounded-sm border transition select-none cursor-pointer ${
          active
            ? 'bg-blue-50 text-blue-700 border-blue-300 shadow-2xs dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-700 font-bold'
            : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100 hover:border-slate-300 dark:text-slate-300 dark:hover:text-white dark:hover:bg-zinc-800 dark:hover:border-zinc-700'
        } disabled:opacity-35 disabled:pointer-events-none disabled:grayscale ${className}`}
      >
        {icon}
        {badge !== undefined && (
          <span className="absolute -top-1 -right-1 px-1 py-0.2 min-w-[12px] text-[8px] font-mono font-bold rounded-full bg-blue-600 text-white leading-tight">
            {badge}
          </span>
        )}
      </button>
    );
  }

  // Variant: SMALL (horizontal icon + label - dense CAD command strip layout)
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={tooltipText}
      className={`group relative flex items-center gap-1.5 h-6 px-2 py-0.5 rounded-sm border transition select-none cursor-pointer ${
        active
          ? 'bg-blue-50 text-blue-700 border-blue-300 shadow-2xs dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-700 font-semibold'
          : 'border-transparent text-slate-700 hover:text-slate-900 hover:bg-slate-100 hover:border-slate-300 dark:text-slate-300 dark:hover:text-white dark:hover:bg-zinc-800 dark:hover:border-zinc-700'
      } disabled:opacity-35 disabled:pointer-events-none disabled:grayscale ${className}`}
    >
      <span className="shrink-0 flex items-center justify-center">{icon}</span>
      {label && <span className="text-[11px] leading-none whitespace-nowrap font-medium">{label}</span>}
      {badge !== undefined && (
        <span className="ml-auto px-1 py-0.2 min-w-[14px] text-[9px] font-mono font-semibold rounded bg-slate-200 text-slate-700 dark:bg-zinc-700 dark:text-slate-200 leading-tight">
          {badge}
        </span>
      )}
    </button>
  );
};
