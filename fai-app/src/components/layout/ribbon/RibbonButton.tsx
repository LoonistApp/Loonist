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
  style?: React.CSSProperties;
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
  className = '',
  style
}) => {
  const tooltipText = title ? (hotkey ? `${title} [${hotkey}]` : title) : hotkey ? `[${hotkey}]` : undefined;

  // Variant: LARGE (stacked icon over text - CAD primary action style)
  if (variant === 'large') {
    let activeBg = 'bg-slate-200 text-slate-900 border-slate-400 dark:bg-zinc-700 dark:text-white dark:border-zinc-500';
    if (active) {
      if (accent === 'emerald') activeBg = 'bg-emerald-50 text-emerald-700 border-emerald-400 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-700';
      else if (accent === 'amber') activeBg = 'bg-amber-50 text-amber-700 border-amber-400 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-700';
      else if (accent === 'red') activeBg = 'bg-red-50 text-red-700 border-red-400 dark:bg-red-950/60 dark:text-red-300 dark:border-red-700';
      else activeBg = 'bg-slate-200 text-slate-900 border-slate-400 dark:bg-zinc-700 dark:text-white dark:border-zinc-500';
    }

    return (
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        title={tooltipText}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: subLabel ? 'flex-start' : 'center',
          paddingTop: subLabel ? '3px' : '0px',
          paddingBottom: subLabel ? '2px' : '0px',
          paddingLeft: '4px',
          paddingRight: '4px',
          minWidth: '60px',
          height: '50px',
          boxSizing: 'border-box',
          ...style
        }}
        className={`group relative rounded-sm border transition select-none cursor-pointer text-center ${
          active
            ? `${activeBg} shadow-2xs font-semibold`
            : 'border-transparent text-slate-700 hover:text-slate-900 hover:bg-slate-100/90 hover:border-slate-300/80 dark:text-slate-300 dark:hover:text-white dark:hover:bg-zinc-800/80 dark:hover:border-zinc-700'
        } disabled:opacity-35 disabled:pointer-events-none disabled:grayscale ${className}`}
      >
        <div 
          style={{ 
            height: '20px', 
            width: '100%',
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            marginBottom: '2px'
          }}
          className="relative"
        >
          {icon}
          {badge !== undefined && (
            <span className="absolute -top-1.5 -right-2 px-1 py-0.2 min-w-[14px] text-[9px] font-mono font-bold rounded-full bg-slate-900 dark:bg-zinc-200 text-white dark:text-zinc-900 shadow-2xs leading-tight">
              {badge}
            </span>
          )}
        </div>
        <div 
          style={{ 
            width: '100%',
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            justifyContent: 'flex-start'
          }}
        >
          {label && (
            <span 
              style={{ 
                whiteSpace: 'nowrap', 
                fontSize: '10.5px', 
                fontWeight: 500, 
                lineHeight: '12px',
                textAlign: 'center',
                display: 'block'
              }}
              className="tracking-tight text-slate-800 dark:text-slate-200"
            >
              {label}
            </span>
          )}
          {subLabel && (
            <span 
              style={{ 
                whiteSpace: 'nowrap', 
                fontSize: '9px', 
                lineHeight: '10px', 
                marginTop: '1px',
                textAlign: 'center',
                display: 'block'
              }}
              className="text-slate-400 dark:text-zinc-400 font-mono"
            >
              {subLabel}
            </span>
          )}
        </div>
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
        style={style}
        className={`relative flex items-center justify-center w-7 h-7 rounded-sm border transition select-none cursor-pointer ${
          active
            ? 'bg-slate-200 text-slate-900 border-slate-400 shadow-2xs dark:bg-zinc-700 dark:text-white dark:border-zinc-500 font-bold'
            : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100 hover:border-slate-300 dark:text-slate-300 dark:hover:text-white dark:hover:bg-zinc-800 dark:hover:border-zinc-700'
        } disabled:opacity-35 disabled:pointer-events-none disabled:grayscale ${className}`}
      >
        {icon}
        {badge !== undefined && (
          <span className="absolute -top-1 -right-1 px-1 py-0.2 min-w-[12px] text-[8px] font-mono font-bold rounded-full bg-slate-900 dark:bg-zinc-200 text-white dark:text-zinc-900 leading-tight">
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
      style={style}
      className={`group relative flex items-center gap-1.5 h-6 px-2 py-0.5 rounded-sm border transition select-none cursor-pointer ${
        active
          ? 'bg-slate-200 text-slate-900 border-slate-400 shadow-2xs dark:bg-zinc-700 dark:text-white dark:border-zinc-500 font-semibold'
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
