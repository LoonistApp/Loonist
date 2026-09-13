import React, { useState, useRef, useEffect, useCallback } from 'react';

export interface HorizontalSplitterProps {
  currentHeight: number;
  onHeightChange: (height: number) => void;
  onToggleMaximize?: () => void;
  minHeight?: number;
  maxHeight?: number;
  className?: string;
  // Optional backwards-compatibility props
  isOpen?: boolean;
  isCollapsed?: boolean;
  onToggleOpen?: (open: boolean) => void;
  onToggleCollapse?: () => void;
}

/**
 * Professional draggable resizable horizontal splitter (Drawing Viewer ↔ Bottom Data Panel).
 * - Normal: Crisp 1px subtle divider with visible subtle center grip affordance.
 * - Hover: Illuminates with vivid #0078d4 electric blue line, expands grip pill, shows row-resize cursor.
 * - Drag: Smooth real-time height resizing at 60 FPS with full-screen pointer overlay.
 * - Double-click: Toggles maximize / restores exact previous height.
 */
export const HorizontalSplitter: React.FC<HorizontalSplitterProps> = ({
  currentHeight,
  onHeightChange,
  onToggleMaximize,
  minHeight = 100,
  maxHeight,
  className = ''
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const isDraggingRef = useRef(false);
  const startYRef = useRef(0);
  const startHeightRef = useRef(currentHeight);

  // Keep latest callbacks and props in a ref to eliminate stale closure issues
  const latestRef = useRef({
    currentHeight,
    minHeight,
    maxHeight,
    onHeightChange,
    onToggleMaximize
  });

  useEffect(() => {
    latestRef.current = {
      currentHeight,
      minHeight,
      maxHeight,
      onHeightChange,
      onToggleMaximize
    };
  });

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();

    isDraggingRef.current = true;
    startYRef.current = e.clientY;
    startHeightRef.current = latestRef.current.currentHeight || currentHeight || 220;
    setIsDragging(true);

    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'row-resize';

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isDraggingRef.current) return;
      if (moveEvent.buttons === 0) {
        handleMouseUp();
        return;
      }
      moveEvent.preventDefault();
      // Moving mouse UP (clientY decreases) -> bottom panel height increases
      // Moving mouse DOWN (clientY increases) -> bottom panel height decreases
      const deltaY = startYRef.current - moveEvent.clientY;
      const targetHeight = startHeightRef.current + deltaY;
      const minH = latestRef.current.minHeight || 100;
      const maxH = latestRef.current.maxHeight || Math.round(window.innerHeight * 0.75);

      const clamped = Math.min(maxH, Math.max(minH, targetHeight));
      latestRef.current.onHeightChange(clamped);
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
      setIsDragging(false);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      window.removeEventListener('mousemove', handleMouseMove, true);
      window.removeEventListener('mouseup', handleMouseUp, true);
    };

    window.addEventListener('mousemove', handleMouseMove, true);
    window.addEventListener('mouseup', handleMouseUp, true);
  }, [currentHeight]);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    latestRef.current.onToggleMaximize?.();
  }, []);

  return (
    <>
      {/* Full-screen drag backdrop: guarantees pointer events are never captured by canvas or text */}
      {isDragging && (
        <div
          className="fixed inset-0 z-[99999] cursor-row-resize select-none bg-transparent"
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99999, cursor: 'row-resize', pointerEvents: 'auto', userSelect: 'none' }}
        />
      )}

      <div
        role="separator"
        aria-orientation="horizontal"
        tabIndex={0}
        onMouseDown={handleMouseDown}
        onDoubleClick={handleDoubleClick}
        className={`w-full h-3.5 cursor-row-resize select-none relative z-50 flex items-center justify-center transition-colors group shrink-0 bg-transparent hover:bg-blue-500/15 ${
          isDragging ? 'bg-blue-500/20' : ''
        } ${className}`}
        style={{ cursor: 'row-resize' }}
        title="Drag vertically to resize bottom panel. Double-click to maximize / restore."
      >
        {/* Subtle 1px baseline border in normal state, glowing 2px #0078d4 blue on hover / active drag */}
        <div
          className={`w-full absolute top-1/2 -translate-y-1/2 left-0 transition-all pointer-events-none ${
            isDragging
              ? 'h-[2px] bg-[#0078d4] shadow-[0_0_8px_rgba(0,120,212,0.85)]'
              : 'h-[1px] bg-slate-300 group-hover:h-[2px] group-hover:bg-[#0078d4] group-hover:shadow-[0_0_6px_rgba(0,120,212,0.7)]'
          }`}
        />

        {/* Grab indicator handle: sleek subtle pill in normal state, bright blue on hover / drag */}
        <div
          className={`h-1 rounded-full transition-all pointer-events-none z-10 ${
            isDragging
              ? 'opacity-100 w-20 bg-[#0078d4] shadow-xs'
              : 'opacity-70 w-12 bg-slate-400 group-hover:opacity-100 group-hover:w-20 group-hover:bg-[#0078d4] shadow-2xs'
          }`}
        />
      </div>
    </>
  );
};

export interface VerticalSplitterProps {
  currentWidth: number;
  onWidthChange: (width: number) => void;
  onToggleMaximize?: () => void;
  minWidth?: number;
  maxWidth?: number;
  className?: string;
  // Optional backwards-compatibility props
  isOpen?: boolean;
  isCollapsed?: boolean;
  onToggleOpen?: (open: boolean) => void;
  onToggleCollapse?: () => void;
}

/**
 * Professional draggable resizable vertical splitter (Left Sidebar ↔ Drawing Viewer).
 * - Normal: Crisp 1px subtle divider with visible subtle center grip affordance.
 * - Hover: Illuminates with vivid #0078d4 electric blue line, expands grip pill, shows col-resize cursor.
 * - Drag: Smooth real-time width resizing at 60 FPS with full-screen pointer overlay.
 * - Double-click: Toggles maximize / restores exact previous width.
 */
export const VerticalSplitter: React.FC<VerticalSplitterProps> = ({
  currentWidth,
  onWidthChange,
  onToggleMaximize,
  minWidth = 240,
  maxWidth,
  className = ''
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(currentWidth);

  // Keep latest callbacks and props in a ref to eliminate stale closure issues
  const latestRef = useRef({
    currentWidth,
    minWidth,
    maxWidth,
    onWidthChange,
    onToggleMaximize
  });

  useEffect(() => {
    latestRef.current = {
      currentWidth,
      minWidth,
      maxWidth,
      onWidthChange,
      onToggleMaximize
    };
  });

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();

    isDraggingRef.current = true;
    startXRef.current = e.clientX;
    startWidthRef.current = latestRef.current.currentWidth || currentWidth || 320;
    setIsDragging(true);

    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isDraggingRef.current) return;
      if (moveEvent.buttons === 0) {
        handleMouseUp();
        return;
      }
      moveEvent.preventDefault();
      // Moving mouse RIGHT (clientX increases) -> left panel width increases
      // Moving mouse LEFT (clientX decreases) -> left panel width decreases
      const deltaX = moveEvent.clientX - startXRef.current;
      const targetWidth = startWidthRef.current + deltaX;
      const minW = latestRef.current.minWidth || 240;
      const maxW = latestRef.current.maxWidth || Math.round(window.innerWidth * 0.70);

      const clamped = Math.min(maxW, Math.max(minW, targetWidth));
      latestRef.current.onWidthChange(clamped);
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
      setIsDragging(false);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      window.removeEventListener('mousemove', handleMouseMove, true);
      window.removeEventListener('mouseup', handleMouseUp, true);
    };

    window.addEventListener('mousemove', handleMouseMove, true);
    window.addEventListener('mouseup', handleMouseUp, true);
  }, [currentWidth]);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    latestRef.current.onToggleMaximize?.();
  }, []);

  return (
    <>
      {/* Full-screen drag backdrop: guarantees pointer events are never captured by canvas or text */}
      {isDragging && (
        <div
          className="fixed inset-0 z-[99999] cursor-col-resize select-none bg-transparent"
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99999, cursor: 'col-resize', pointerEvents: 'auto', userSelect: 'none' }}
        />
      )}

      <div
        role="separator"
        aria-orientation="vertical"
        tabIndex={0}
        onMouseDown={handleMouseDown}
        onDoubleClick={handleDoubleClick}
        className={`w-3.5 h-full cursor-col-resize select-none relative z-50 flex items-center justify-center transition-colors group shrink-0 bg-transparent hover:bg-blue-500/15 ${
          isDragging ? 'bg-blue-500/20' : ''
        } ${className}`}
        style={{ cursor: 'col-resize' }}
        title="Drag horizontally to resize sidebar. Double-click to maximize / restore."
      >
        {/* Subtle 1px baseline border in normal state, glowing 2px #0078d4 blue on hover / active drag */}
        <div
          className={`h-full absolute top-0 left-1/2 -translate-x-1/2 transition-all pointer-events-none ${
            isDragging
              ? 'w-[2px] bg-[#0078d4] shadow-[0_0_8px_rgba(0,120,212,0.85)]'
              : 'w-[1px] bg-slate-300 group-hover:w-[2px] group-hover:bg-[#0078d4] group-hover:shadow-[0_0_6px_rgba(0,120,212,0.7)]'
          }`}
        />

        {/* Grab indicator handle: sleek subtle pill in normal state, bright blue on hover / drag */}
        <div
          className={`w-1 rounded-full transition-all pointer-events-none z-10 ${
            isDragging
              ? 'opacity-100 h-20 bg-[#0078d4] shadow-xs'
              : 'opacity-70 h-12 bg-slate-400 group-hover:opacity-100 group-hover:h-20 group-hover:bg-[#0078d4] shadow-2xs'
          }`}
        />
      </div>
    </>
  );
};
