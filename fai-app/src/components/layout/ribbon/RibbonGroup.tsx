import React from 'react';

export interface RibbonGroupProps {
  title: string;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
  noSeparator?: boolean;
}

export const RibbonGroup: React.FC<RibbonGroupProps> = ({
  title,
  children,
  className = '',
  contentClassName = '',
  noSeparator = false
}) => {
  return (
    <div
      className={`relative flex flex-col justify-between h-[68px] px-2 py-1 shrink-0 select-none ${
        noSeparator ? '' : 'border-r border-slate-200 dark:border-zinc-800/80'
      } ${className}`}
    >
      {/* Group Controls Area */}
      <div className={`flex items-center gap-1.5 flex-1 min-h-0 ${contentClassName}`}>
        {children}
      </div>

      {/* Engineering Group Label */}
      <div className="flex items-center justify-center pt-0.5 mt-0.5 border-t border-slate-100 dark:border-zinc-800/50">
        <span className="text-[9px] font-sans font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500 whitespace-nowrap select-none">
          {title}
        </span>
      </div>
    </div>
  );
};
