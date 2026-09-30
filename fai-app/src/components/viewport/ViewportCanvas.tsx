import React, { useRef, useEffect, useState, useCallback } from 'react';
import type * as pdfjsLib from 'pdfjs-dist';
import { PDFRenderService } from '../../services/pdfRenderer';
import type { SheetMetadata, ViewportTool } from '../../types/blueprint';
import type { EngineeringCharacteristic, BalloonAppearance } from '../../types/characteristics';
import { Loader2, Trash2 } from 'lucide-react';
import { useApplicationOptions } from '../../stores/useApplicationOptionsStore';

interface ViewportCanvasProps {
  pdfDoc: pdfjsLib.PDFDocumentProxy | null;
  sheet: SheetMetadata | null;
  scale: number;
  rotation: number;
  activeTool: ViewportTool;
  onToolChange?: (tool: ViewportTool) => void;
  characteristics?: EngineeringCharacteristic[];
  selectedCharId?: string | null;
  balloonAppearance?: BalloonAppearance;
  onSelectCharacteristic?: (char: EngineeringCharacteristic) => void;
  onUpdateCharacteristic?: (char: EngineeringCharacteristic) => void;
  onUpdateCharacteristics?: (chars: EngineeringCharacteristic[]) => void;
  onDeleteCharacteristic?: (charId: string) => void;
  onOpenInspector?: () => void;
  onBoxCapture?: (
    box: { x: number; y: number; width: number; height: number },
    pageNumber: number,
    cropCanvas?: HTMLCanvasElement
  ) => void;
  onScaleChange: (scale: number) => void;
  onTransformChange?: (x: number, y: number) => void;
  onFpsUpdate?: (fps: number) => void;
  onCropGenerated?: (dataUrl: string) => void;
  watermark?: string;
}

const COLOR_MAP: Record<string, string> = {
  blue: '#2563eb',
  green: '#059669',
  amber: '#d97706',
  red: '#dc2626',
  black: '#0f172a'
};

export const ViewportCanvas: React.FC<ViewportCanvasProps> = ({
  pdfDoc,
  sheet,
  scale,
  rotation,
  activeTool,
  onToolChange,
  characteristics = [],
  selectedCharId,
  balloonAppearance = { shape: 'circle', fit: 2, fontSize: 10, color: 'black', showLeaderLine: true },
  onSelectCharacteristic,
  onUpdateCharacteristic,
  onUpdateCharacteristics: _onUpdateCharacteristics,
  onDeleteCharacteristic,
  onOpenInspector: _onOpenInspector,
  onBoxCapture,
  onScaleChange,
  onTransformChange,
  onFpsUpdate,
  onCropGenerated,
  watermark
}) => {
  const [appOptions] = useApplicationOptions();
  const containerRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const transformRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Panning state
  const isDraggingRef = useRef(false);
  const isPanningRef = useRef(false);
  const hasJustDraggedRef = useRef(false);
  const dragStartRef = useRef<{ x: number; y: number; originX: number; originY: number }>({
    x: 0,
    y: 0,
    originX: 0,
    originY: 0
  });
  // Track double-click pan activation ref for immediate 60fps pan response in event handlers
  const isDoubleClickedPanRef = useRef(false);

  // Balloon Dragging state
  const draggingBalloonRef = useRef<{
    charId: string;
    startMouseX: number;
    startMouseY: number;
    initialBadgeX: number;
    initialBadgeY: number;
    currentBadgeX: number;
    currentBadgeY: number;
    isDragging?: boolean;
  } | null>(null);
  const [draggedBalloonPos, setDraggedBalloonPos] = useState<{ id: string; x: number; y: number } | null>(null);

  // Box Capture Marquee state
  const isCapturingRef = useRef(false);
  const [selectionBox, setSelectionBox] = useState<{ startX: number; startY: number; currentX: number; currentY: number } | null>(null);

  // Right-click context menu state
  const [contextMenu, setContextMenu] = useState<{ char: EngineeringCharacteristic; x: number; y: number } | null>(null);

  useEffect(() => {
    const handleCloseMenu = () => setContextMenu(null);
    window.addEventListener('click', handleCloseMenu);
    return () => window.removeEventListener('click', handleCloseMenu);
  }, []);

  const [isRendering, setIsRendering] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);


  // FPS tracking
  const frameCountRef = useRef(0);
  const lastFpsTimeRef = useRef<number | null>(null);

  // Update transform visually on the canvas container
  const applyTransform = useCallback((x: number, y: number, currentScale: number) => {
    transformRef.current = { x, y };
    if (layerRef.current) {
      layerRef.current.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${currentScale}) rotate(${rotation}deg)`;
    }
    if (onTransformChange) {
      onTransformChange(x, y);
    }
  }, [rotation, onTransformChange]);

  // Measure FPS
  useEffect(() => {
    let animId: number;
    lastFpsTimeRef.current = performance.now();
    const measure = () => {
      frameCountRef.current++;
      const now = performance.now();
      if (lastFpsTimeRef.current && now - lastFpsTimeRef.current >= 1000) {
        const fps = Math.round((frameCountRef.current * 1000) / (now - lastFpsTimeRef.current));
        frameCountRef.current = 0;
        lastFpsTimeRef.current = now;
        onFpsUpdate?.(fps);
      }
      animId = requestAnimationFrame(measure);
    };
    animId = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(animId);
  }, [onFpsUpdate]);

  // Fit Page to container on initial load (only once per sheet page change)
  const fittedSheetPageRef = useRef<number | null>(null);

  useEffect(() => {
    if (!sheet || !containerRef.current) return;
    if (fittedSheetPageRef.current === sheet.pageNumber) return;
    fittedSheetPageRef.current = sheet.pageNumber;

    const container = containerRef.current;
    const padding = 40;
    const availWidth = container.clientWidth - padding * 2;
    const availHeight = container.clientHeight - padding * 2;

    const scaleX = availWidth / sheet.width;
    const scaleY = availHeight / sheet.height;
    const fitScale = Math.min(scaleX, scaleY, 1.2);

    const initialX = Math.round((container.clientWidth - sheet.width * fitScale) / 2);
    const initialY = Math.round((container.clientHeight - sheet.height * fitScale) / 2);

    onScaleChange(Math.max(0.25, Math.min(fitScale, 32.0)));
    applyTransform(initialX, initialY, fitScale);
  }, [sheet, applyTransform, onScaleChange]);

  // Render PDF Page to Canvas
  useEffect(() => {
    if (!pdfDoc || !sheet || !canvasRef.current) return;

    let isMounted = true;
    setIsRendering(true);
    setRenderError(null);

    // Rasterize at 1.0 base scale so backing store handles Hi-DPI via DPR and CSS size matches logical dimensions
    const rasterScale = 1.0;

    PDFRenderService.renderSheet(pdfDoc, sheet.pageNumber, canvasRef.current, rasterScale, 0)
      .then(() => {
        if (isMounted) setIsRendering(false);
      })
      .catch((err) => {
        if (isMounted) {
          console.error('Failed to render sheet:', err);
          setRenderError('Failed to rasterize drawing sheet');
          setIsRendering(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [pdfDoc, sheet]);

  // Update scale transform smoothly
  useEffect(() => {
    applyTransform(transformRef.current.x, transformRef.current.y, scale);
  }, [scale, applyTransform]);

  // --- MOUSE WHEEL ZOOM (Pinpoint CAD Zoom Centered at Cursor) ---
  const handleWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!containerRef.current || !sheet) return;

    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Zoom factor: 1.15x per scroll notch (CAD reversed if configured)
    const effectiveDelta = appOptions.workspace.invertWheelZoom ? -e.deltaY : e.deltaY;
    const zoomFactor = effectiveDelta < 0 ? 1.15 : 0.87;
    const newScale = Math.max(0.25, Math.min(32.0, scale * zoomFactor));

    // Calculate drawing coordinate under mouse pointer before zoom
    const docX = (mouseX - transformRef.current.x) / scale;
    const docY = (mouseY - transformRef.current.y) / scale;

    // Calculate new translation to keep cursor stationary relative to drawing
    const newX = Math.round(mouseX - docX * newScale);
    const newY = Math.round(mouseY - docY * newScale);

    onScaleChange(newScale);
    applyTransform(newX, newY, newScale);
  }, [scale, sheet, onScaleChange, applyTransform, appOptions.workspace.invertWheelZoom]);

  // Handler when user mouse-downs on a balloon badge to drag it
  const handleBalloonMouseDown = useCallback((
    e: React.MouseEvent,
    char: EngineeringCharacteristic,
    currentBadgeX: number,
    currentBadgeY: number
  ) => {
    e.stopPropagation();
    onSelectCharacteristic?.(char);

    draggingBalloonRef.current = {
      charId: char.id,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      initialBadgeX: currentBadgeX,
      initialBadgeY: currentBadgeY,
      currentBadgeX: currentBadgeX,
      currentBadgeY: currentBadgeY,
      isDragging: false
    };
    // DO NOT setDraggedBalloonPos here! Wait until mouse actually moves > 3px.
  }, [onSelectCharacteristic]);

  // --- MOUSE DOWN HANDLING ---
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    isPanningRef.current = false;
    hasJustDraggedRef.current = false;

    // Double-click to pan detection directly on 2nd mousedown (supports immediate click-and-drag freely)
    if (e.button === 0 && e.detail >= 2) {
      isDoubleClickedPanRef.current = true;
      onToolChange?.('pan');
      if (isCapturingRef.current) {
        isCapturingRef.current = false;
        setSelectionBox(null);
      }
      isDraggingRef.current = true;
      dragStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        originX: transformRef.current.x,
        originY: transformRef.current.y
      };
      if (containerRef.current) {
        containerRef.current.style.cursor = 'grabbing';
      }
      return;
    }

    // 1. Box Capture Tool Handling
    if (activeTool === 'box-capture' && !isDoubleClickedPanRef.current && e.button === 0 && sheet) {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const docX = (mouseX - transformRef.current.x) / scale;
      const docY = (mouseY - transformRef.current.y) / scale;
      isCapturingRef.current = true;
      setSelectionBox({ startX: docX, startY: docY, currentX: docX, currentY: docY });
      return;
    }

    // 2. Pan Action (Left click with Pan tool, active double-click pan mode, middle click button 1, or standard click)
    const isPanModeActive = activeTool === 'pan' || isDoubleClickedPanRef.current;
    const isPanAction = e.button === 1 || isPanModeActive || (activeTool !== 'box-capture' && e.button === 0);
    if (!isPanAction) return;

    isDraggingRef.current = true;
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      originX: transformRef.current.x,
      originY: transformRef.current.y
    };

    if (containerRef.current) {
      containerRef.current.style.cursor = 'grabbing';
    }
  }, [activeTool, onToolChange, scale, sheet]);

  // --- DOUBLE CLICK TO PAN HANDLING ---
  const handleDoubleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    isDoubleClickedPanRef.current = true;
    onToolChange?.('pan');
    if (isCapturingRef.current) {
      isCapturingRef.current = false;
      setSelectionBox(null);
    }
    if (containerRef.current) {
      containerRef.current.style.cursor = 'grab';
    }
  }, [onToolChange]);

  // --- MOUSE MOVE HANDLING ---
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    // 1. Dragging Balloon Badge
    if (draggingBalloonRef.current) {
      const dx = (e.clientX - draggingBalloonRef.current.startMouseX) / scale;
      const dy = (e.clientY - draggingBalloonRef.current.startMouseY) / scale;
      if (!draggingBalloonRef.current.isDragging && Math.hypot(dx, dy) < 4) {
        return; // Ignore sub-threshold jitter
      }
      draggingBalloonRef.current.isDragging = true;
      const newBadgeX = Math.round(draggingBalloonRef.current.initialBadgeX + dx);
      const newBadgeY = Math.round(draggingBalloonRef.current.initialBadgeY + dy);
      draggingBalloonRef.current.currentBadgeX = newBadgeX;
      draggingBalloonRef.current.currentBadgeY = newBadgeY;
      setDraggedBalloonPos({ id: draggingBalloonRef.current.charId, x: newBadgeX, y: newBadgeY });
      return;
    }

    // 2. Box Capture Marquee Dragging
    if (isCapturingRef.current && selectionBox) {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const docX = (mouseX - transformRef.current.x) / scale;
      const docY = (mouseY - transformRef.current.y) / scale;
      setSelectionBox(prev => prev ? { ...prev, currentX: docX, currentY: docY } : null);
      return;
    }

    // 3. Pan Viewport Dragging
    if (!isDraggingRef.current) return;

    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    if (Math.hypot(dx, dy) > 4) {
      isPanningRef.current = true;
    }

    const newX = Math.round(dragStartRef.current.originX + dx);
    const newY = Math.round(dragStartRef.current.originY + dy);

    applyTransform(newX, newY, scale);
  }, [scale, selectionBox, applyTransform]);

  // --- MOUSE UP HANDLING ---
  const handleMouseUp = useCallback((_e?: React.MouseEvent<HTMLDivElement>) => {
    // 1. Commit Balloon Dragging
    if (draggingBalloonRef.current) {
      const wasDragging = draggingBalloonRef.current.isDragging;
      if (wasDragging) {
        hasJustDraggedRef.current = true;
        const { charId, currentBadgeX, currentBadgeY } = draggingBalloonRef.current;
        const char = characteristics.find(c => c.id === charId);
        if (char) {
          onUpdateCharacteristic?.({
            ...char,
            customBalloonPosition: { x: currentBadgeX, y: currentBadgeY }
          });
        }
        setDraggedBalloonPos(null);
      }
      draggingBalloonRef.current = null;
      return;
    }

    // 2. Complete Box Capture
    if (isCapturingRef.current && selectionBox && sheet) {
      isCapturingRef.current = false;
      const bx = Math.round(Math.min(selectionBox.startX, selectionBox.currentX));
      const by = Math.round(Math.min(selectionBox.startY, selectionBox.currentY));
      const bw = Math.round(Math.abs(selectionBox.currentX - selectionBox.startX));
      const bh = Math.round(Math.abs(selectionBox.currentY - selectionBox.startY));
      setSelectionBox(null);
      if (bw >= 10 && bh >= 8) {
        let cropCanvas: HTMLCanvasElement | undefined;
        if (canvasRef.current) {
          try {
            const mainCanvas = canvasRef.current;
            cropCanvas = document.createElement('canvas');
            const dpr = window.devicePixelRatio || 1;
            cropCanvas.width = Math.max(1, Math.round(bw * dpr * 2));
            cropCanvas.height = Math.max(1, Math.round(bh * dpr * 2));
            const ctx = cropCanvas.getContext('2d');
            if (ctx) {
              ctx.fillStyle = '#ffffff';
              ctx.fillRect(0, 0, cropCanvas.width, cropCanvas.height);
              ctx.drawImage(
                mainCanvas,
                bx * dpr,
                by * dpr,
                bw * dpr,
                bh * dpr,
                0,
                0,
                cropCanvas.width,
                cropCanvas.height
              );
            }
          } catch (err) {
            console.warn('Could not generate crop for capture box:', err);
          }
        }
        onBoxCapture?.({ x: bx, y: by, width: bw, height: bh }, sheet.pageNumber, cropCanvas);
      }
      return;
    }

    // 3. Pan Mouse Up
    isDraggingRef.current = false;
    if (containerRef.current) {
      const isPanModeActive = activeTool === 'pan' || isDoubleClickedPanRef.current;
      containerRef.current.style.cursor = 
        isPanModeActive ? 'grab' : 
        activeTool === 'box-capture' ? 'crosshair' : 
        'default';
    }
  }, [activeTool, characteristics, onBoxCapture, onUpdateCharacteristic, selectionBox, sheet]);

  // Generate HUD Crop Data URL when selected characteristic changes
  useEffect(() => {
    if (!canvasRef.current || !selectedCharId) return;
    const char = characteristics.find((c) => c.id === selectedCharId);
    if (!char) return;

    try {
      const mainCanvas = canvasRef.current;
      const cropCanvas = document.createElement('canvas');
      const pad = 16;
      const bx = Math.max(0, char.boundingBox.x - pad);
      const by = Math.max(0, char.boundingBox.y - pad);
      const bw = Math.min(mainCanvas.width, char.boundingBox.width + pad * 2);
      const bh = Math.min(mainCanvas.height, char.boundingBox.height + pad * 2);

      cropCanvas.width = Math.max(1, bw * 2);
      cropCanvas.height = Math.max(1, bh * 2);
      const ctx = cropCanvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, cropCanvas.width, cropCanvas.height);
        const dpr = window.devicePixelRatio || 1;
        ctx.drawImage(
          mainCanvas,
          bx * dpr,
          by * dpr,
          bw * dpr,
          bh * dpr,
          0,
          0,
          cropCanvas.width,
          cropCanvas.height
        );
        const dataUrl = cropCanvas.toDataURL('image/png');
        onCropGenerated?.(dataUrl);
      }
    } catch (err) {
      console.warn('Could not generate HUD crop:', err);
    }
  }, [selectedCharId, characteristics, onCropGenerated]);



  // Filter characteristics belonging to the currently active sheet
  const activeSheetCharacteristics = sheet 
    ? characteristics.filter(c => c.sheetNumber === sheet.pageNumber)
    : [];

  return (
    <div
      ref={containerRef}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onDoubleClick={handleDoubleClick}
      className={`relative flex-1 w-full h-full overflow-hidden select-none ${
        activeTool === 'pan' ? 'cursor-grab' : 'cursor-crosshair'
      }`}
      style={{
        backgroundColor:
          appOptions.workspace.canvasBackground === 'white'
            ? '#f8fafc'
            : appOptions.workspace.canvasBackground === 'blueprint'
            ? '#0b132b'
            : '#181a1f',
        transition: 'background-color 0.2s ease',
      }}
    >
      {/* Subtle CAD Alignment Grid */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-40"
        style={{
          backgroundImage:
            appOptions.workspace.canvasBackground === 'white'
              ? 'linear-gradient(to right, #cbd5e1 1px, transparent 1px), linear-gradient(to bottom, #cbd5e1 1px, transparent 1px)'
              : appOptions.workspace.canvasBackground === 'blueprint'
              ? 'linear-gradient(to right, rgba(56, 189, 248, 0.18) 1px, transparent 1px), linear-gradient(to bottom, rgba(56, 189, 248, 0.18) 1px, transparent 1px)'
              : 'linear-gradient(to right, rgba(255, 255, 255, 0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(255, 255, 255, 0.06) 1px, transparent 1px)',
          backgroundSize: '32px 32px'
        }}
      />

      {/* Loading Indicator */}
      {isRendering && (
        <div className="absolute top-3 right-3 z-10 flex items-center gap-2 bg-white border border-slate-200 text-slate-700 text-xs px-3 py-1.5 rounded shadow-sm">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-700" />
          <span>Rasterizing Blueprint...</span>
        </div>
      )}

      {/* Render Error Alert */}
      {renderError && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm shadow-md z-20">
          {renderError}
        </div>
      )}

      {/* The 60 FPS Layer Containing Blueprint Canvas and AS9102 Balloons */}
      <div
        ref={layerRef}
        className="absolute top-0 left-0 origin-top-left will-change-transform pointer-events-none"
        style={{
          width: sheet ? `${sheet.width}px` : 'auto',
          height: sheet ? `${sheet.height}px` : 'auto',
        }}
      >
        <canvas
          ref={canvasRef}
          className="absolute top-0 left-0 bg-white"
          style={{
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(0, 0, 0, 0.08)'
          }}
        />

        {/* Box Capture Marquee Selection Overlay */}
        {selectionBox && (
          <div
            style={{
              position: 'absolute',
              left: `${Math.min(selectionBox.startX, selectionBox.currentX)}px`,
              top: `${Math.min(selectionBox.startY, selectionBox.currentY)}px`,
              width: `${Math.abs(selectionBox.currentX - selectionBox.startX)}px`,
              height: `${Math.abs(selectionBox.currentY - selectionBox.startY)}px`,
              border: '2px dashed #475569',
              backgroundColor: 'rgba(100, 116, 139, 0.15)',
              boxShadow: '0 0 0 1px rgba(255, 255, 255, 0.7)',
              pointerEvents: 'none',
              zIndex: 50
            }}
          />
        )}

        {/* Interactive AS9102 Balloon Markers, Leader Lines & Dimension Highlights */}
        {sheet && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: `${sheet.width}px`,
              height: `${sheet.height}px`,
              pointerEvents: 'none'
            }}
          >
            {/* Global SVG Leader Lines Layer */}
            {balloonAppearance.showLeaderLine && (
              <svg
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: `${sheet.width}px`,
                  height: `${sheet.height}px`,
                  pointerEvents: 'none',
                  overflow: 'visible',
                  zIndex: 8
                }}
              >
                <defs>
                  <marker id="arrow-blue" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
                    <path d="M 0 2 L 8 5 L 0 8 z" fill="#2563eb" />
                  </marker>
                  <marker id="arrow-green" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
                    <path d="M 0 2 L 8 5 L 0 8 z" fill="#059669" />
                  </marker>
                  <marker id="arrow-amber" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
                    <path d="M 0 2 L 8 5 L 0 8 z" fill="#d97706" />
                  </marker>
                  <marker id="arrow-red" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
                    <path d="M 0 2 L 8 5 L 0 8 z" fill="#dc2626" />
                  </marker>
                  <marker id="arrow-black" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
                    <path d="M 0 2 L 8 5 L 0 8 z" fill="#0f172a" />
                  </marker>
                </defs>

                {activeSheetCharacteristics.map((char) => {
                  if (char.skipBalloonRender && !char.customBalloonPosition && (char.parentCharacteristicId || !balloonAppearance?.balloonGeneralNotes)) {
                    return null;
                  }

                  const isSelected = selectedCharId === char.id;
                  const isFlagged = char.verificationStatus === 'needs_review';
                  const isBeingDragged = draggedBalloonPos?.id === char.id;

                  const fit = balloonAppearance.fit || 2;
                  const badgeSize = fit === 1 ? 24 : fit === 3 ? 34 : 28;
                  const badgeHalf = badgeSize / 2;

                  let subOffset = 0;
                  if (char.subNumber && char.subNumber.includes('.')) {
                    const parts = char.subNumber.split('.');
                    const subIdx = parseInt(parts[1], 10);
                    if (!isNaN(subIdx) && subIdx > 1) {
                      subOffset = (subIdx - 1) * (badgeSize + 4);
                    }
                  }

                  const defaultOffset = 18;
                  const isHorizontalCallout = char.boundingBox.width >= char.boundingBox.height;
                  const defaultBadgeX = char.boundingBox.x < 60
                    ? Math.round(char.boundingBox.x + char.boundingBox.width + defaultOffset)
                    : Math.max(12, Math.round(char.boundingBox.x - badgeSize - (isHorizontalCallout ? 12 : defaultOffset)));
                  const defaultBadgeY = isHorizontalCallout
                    ? Math.max(12, Math.round(char.boundingBox.y - badgeSize - 10 + subOffset))
                    : Math.round(char.boundingBox.y + (char.boundingBox.height / 2) - badgeHalf + subOffset);

                  const badgeX = isBeingDragged
                    ? draggedBalloonPos.x
                    : (char.customBalloonPosition?.x ?? defaultBadgeX);
                  const badgeY = isBeingDragged
                    ? draggedBalloonPos.y
                    : (char.customBalloonPosition?.y ?? defaultBadgeY);

                  const badgeCenterX = badgeX + badgeHalf;
                  const badgeCenterY = badgeY + badgeHalf;
                  const boxMinX = char.boundingBox.x;
                  const boxMaxX = char.boundingBox.x + char.boundingBox.width;
                  const boxMinY = char.boundingBox.y;
                  const boxMaxY = char.boundingBox.y + char.boundingBox.height;

                  const anchorX = Math.max(boxMinX, Math.min(boxMaxX, badgeCenterX));
                  const anchorY = Math.max(boxMinY, Math.min(boxMaxY, badgeCenterY));
                  const leaderDist = Math.hypot(badgeCenterX - anchorX, badgeCenterY - anchorY);

                  const colorKey = char.customBalloonColor || balloonAppearance.color || 'black';
                  const baseBgColor = COLOR_MAP[colorKey] || '#0f172a';
                  const leaderColor = isSelected ? '#d97706' : baseBgColor;
                  const markerId = isSelected ? 'arrow-amber' : `arrow-${colorKey}`;

                  return (
                    <g key={`leader-${char.id}`}>
                      {/* Leader Line */}
                      <line
                        x1={badgeCenterX}
                        y1={badgeCenterY}
                        x2={anchorX}
                        y2={anchorY}
                        stroke={leaderColor}
                        strokeWidth={isSelected || isBeingDragged ? "2" : "1.5"}
                        strokeDasharray={isFlagged ? '3,3' : undefined}
                        markerEnd={leaderDist > 6 ? `url(#${markerId})` : undefined}
                      />
                      {/* Anchor dot on dimension callout boundary */}
                      <circle
                        cx={anchorX}
                        cy={anchorY}
                        r={isSelected ? 3 : 2}
                        fill={leaderColor}
                      />
                    </g>
                  );
                })}
              </svg>
            )}

            {/* Bounding Box Highlights and Draggable Badges */}
            {activeSheetCharacteristics.map((char) => {
              if (char.skipBalloonRender && !char.customBalloonPosition && (char.parentCharacteristicId || !balloonAppearance?.balloonGeneralNotes)) {
                return null;
              }

              const isSelected = selectedCharId === char.id;
              const isFlagged = char.verificationStatus === 'needs_review';
              const isBeingDragged = draggedBalloonPos?.id === char.id;
              const balloonNum = char.subNumber || char.itemNumber;

              const isFlagNote = char.subType === 'FlagNote';
              const isBasic = char.isBasic;
              const shape = char.customBalloonShape || (balloonAppearance.shape 
                ? (balloonAppearance.shape === 'circle' 
                    ? (isFlagNote ? 'triangle' : isBasic ? 'square' : 'circle') 
                    : balloonAppearance.shape)
                : (isFlagNote ? 'triangle' : isBasic ? 'square' : 'circle'));

              const fit = balloonAppearance.fit || 2;
              const badgeSize = fit === 1 ? 24 : fit === 3 ? 34 : 28;
              const badgeHalf = badgeSize / 2;
              const badgeFontSize = fit === 1 ? 10 : fit === 3 ? 13 : 11;

              let subOffset = 0;
              if (char.subNumber && char.subNumber.includes('.')) {
                const parts = char.subNumber.split('.');
                const subIdx = parseInt(parts[1], 10);
                if (!isNaN(subIdx) && subIdx > 1) {
                  subOffset = (subIdx - 1) * (badgeSize + 4);
                }
              }

              const defaultOffset = 18;
              const isHorizontalCallout = char.boundingBox.width >= char.boundingBox.height;
              const defaultBadgeX = char.boundingBox.x < 60
                ? Math.round(char.boundingBox.x + char.boundingBox.width + defaultOffset)
                : Math.max(12, Math.round(char.boundingBox.x - badgeSize - (isHorizontalCallout ? 12 : defaultOffset)));
              const defaultBadgeY = isHorizontalCallout
                ? Math.max(12, Math.round(char.boundingBox.y - badgeSize - 10 + subOffset))
                : Math.round(char.boundingBox.y + (char.boundingBox.height / 2) - badgeHalf + subOffset);

              const badgeX = isBeingDragged
                ? draggedBalloonPos.x
                : (char.customBalloonPosition?.x ?? defaultBadgeX);
              const badgeY = isBeingDragged
                ? draggedBalloonPos.y
                : (char.customBalloonPosition?.y ?? defaultBadgeY);

              const colorKey = char.customBalloonColor || balloonAppearance.color || 'black';
              const baseBgColor = COLOR_MAP[colorKey] || '#0f172a';
              const badgeBg = baseBgColor;

              return (
                <div key={char.id} style={{ pointerEvents: 'none' }}>
                  {/* High-visibility Bounding Box Highlight Around Dimension Text */}
                  <div
                    onMouseDown={(e) => {
                      e.stopPropagation();
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectCharacteristic?.(char);
                    }}
                    style={{
                      position: 'absolute',
                      left: `${char.boundingBox.x}px`,
                      top: `${char.boundingBox.y}px`,
                      width: `${char.boundingBox.width}px`,
                      height: `${char.boundingBox.height}px`,
                      border: isSelected ? '2px solid #f59e0b' : '1px solid rgba(100, 116, 139, 0.45)',
                      backgroundColor: isSelected ? 'rgba(245, 158, 11, 0.22)' : 'rgba(100, 116, 139, 0.08)',
                      boxShadow: isSelected ? '0 0 8px rgba(245, 158, 11, 0.4)' : undefined,
                      zIndex: isSelected ? 12 : 6,
                      cursor: 'pointer',
                      borderRadius: '2px',
                      transition: 'all 0.15s ease',
                      pointerEvents: 'auto'
                    }}
                    title={`Balloon #${balloonNum}: ${char.rawText} (${char.drawingZone})`}
                  />

                  {/* AS9102 Shape-Adaptive Draggable Balloon Badge */}
                  <div
                    onMouseDown={(e) => handleBalloonMouseDown(e, char, badgeX, badgeY)}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectCharacteristic?.(char);
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onSelectCharacteristic?.(char);
                      setContextMenu({ char, x: e.clientX, y: e.clientY });
                    }}
                    onDoubleClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    style={{
                      position: 'absolute',
                      left: `${badgeX}px`,
                      top: `${badgeY}px`,
                      width: `${badgeSize}px`,
                      height: `${badgeSize}px`,
                      zIndex: isSelected || isBeingDragged ? 35 : 15,
                      cursor: isBeingDragged ? 'grabbing' : 'pointer',
                      pointerEvents: 'auto'
                    }}
                    className="group flex items-center justify-center transition-transform hover:scale-110 active:scale-95"
                    title={`Balloon #${balloonNum}. Click or right-click to inspect & edit. Drag to reposition.`}
                  >
                    <svg
                      width={badgeSize}
                      height={badgeSize}
                      viewBox="0 0 36 36"
                      style={{
                        overflow: 'visible',
                        filter: isSelected || isBeingDragged
                          ? 'drop-shadow(0 0 5px rgba(245, 158, 11, 0.95)) drop-shadow(0 3px 6px rgba(0, 0, 0, 0.35))'
                          : 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.22))',
                        userSelect: 'none'
                      }}
                    >
                      {/* Circle Shape */}
                      {shape === 'circle' && (
                        <circle
                          cx="18"
                          cy="18"
                          r="16"
                          fill={badgeBg}
                          stroke={isSelected ? '#f59e0b' : '#ffffff'}
                          strokeWidth={isSelected ? '2.5' : '2'}
                        />
                      )}

                      {/* Square Shape (Basic Dimension) */}
                      {shape === 'square' && (
                        <rect
                          x="2"
                          y="2"
                          width="32"
                          height="32"
                          rx="3"
                          fill={badgeBg}
                          stroke={isSelected ? '#f59e0b' : '#ffffff'}
                          strokeWidth={isSelected ? '2.5' : '2'}
                        />
                      )}

                      {/* Triangle Shape (Flag Note) */}
                      {shape === 'triangle' && (
                        <polygon
                          points="18,2 34,33 2,33"
                          fill={badgeBg}
                          stroke={isSelected ? '#f59e0b' : '#ffffff'}
                          strokeWidth={isSelected ? '2.5' : '2'}
                          strokeLinejoin="round"
                        />
                      )}

                      {/* Hexagon Shape (Critical GD&T) */}
                      {shape === 'hexagon' && (
                        <polygon
                          points="10,2 26,2 34,18 26,34 10,34 2,18"
                          fill={badgeBg}
                          stroke={isSelected ? '#f59e0b' : '#ffffff'}
                          strokeWidth={isSelected ? '2.5' : '2'}
                          strokeLinejoin="round"
                        />
                      )}

                      {/* Balloon Shape (Authentic Balloon Silhouette) */}
                      {shape === 'balloon' && (
                        <g>
                          {/* Wavy String Tail */}
                          <path
                            d="M 18 29.5 C 16 31.5 20.5 33 18 35.5"
                            stroke="#ffffff"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            fill="none"
                          />
                          <path
                            d="M 18 29.5 C 16 31.5 20.5 33 18 35.5"
                            stroke={isSelected ? '#f59e0b' : badgeBg}
                            strokeWidth="1.4"
                            strokeLinecap="round"
                            fill="none"
                          />

                          {/* Tapered Balloon Bulb & Tied Knot */}
                          <path
                            d="M 18 1.5 C 25.5 1.5 30 6 30 12 C 30 19 25 24.5 19.5 27 L 22.5 29.5 L 13.5 29.5 L 16.5 27 C 11 24.5 6 19 6 12 C 6 6 10.5 1.5 18 1.5 Z"
                            fill={badgeBg}
                            stroke={isSelected ? '#f59e0b' : '#ffffff'}
                            strokeWidth={isSelected ? '2.5' : '2'}
                            strokeLinejoin="round"
                          />

                          {/* Subtle Specular Gloss Highlight */}
                          <path
                            d="M 26 7 C 26 4.5 23.5 3 20 2.5"
                            stroke="#ffffff"
                            strokeWidth="1.4"
                            strokeLinecap="round"
                            fill="none"
                            opacity="0.6"
                          />
                        </g>
                      )}

                      {/* Centered Characteristic / Balloon Number */}
                      <text
                        x="18"
                        y={shape === 'triangle' ? '21' : shape === 'balloon' ? '13.5' : '18'}
                        textAnchor="middle"
                        dominantBaseline="central"
                        fill="#ffffff"
                        style={{ fontFamily: 'var(--font-mono)' }}
                        fontWeight="bold"
                        fontSize={
                          String(balloonNum).length >= 4
                            ? badgeFontSize - 2.5
                            : shape === 'balloon'
                            ? badgeFontSize - 0.5
                            : badgeFontSize
                        }
                        letterSpacing="-0.5px"
                      >
                        {balloonNum}
                      </text>

                      {/* Verification Status Needs Review Badge Flag */}
                      {isFlagged && (
                        <circle
                          cx="31"
                          cy="5"
                          r="4"
                          fill="#f59e0b"
                          stroke="#ffffff"
                          strokeWidth="1.5"
                        />
                      )}
                    </svg>
                  </div>

                  {/* Quick Delete Button Attached to Selected Balloon */}
                  {isSelected && onDeleteCharacteristic && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteCharacteristic(char.id);
                      }}
                      style={{
                        position: 'absolute',
                        left: `${badgeX + badgeSize - 6}px`,
                        top: `${badgeY - 6}px`,
                        zIndex: 50,
                        pointerEvents: 'auto'
                      }}
                      className="w-4 h-4 rounded-full bg-slate-800 hover:bg-slate-950 text-slate-200 hover:text-white flex items-center justify-center shadow-md cursor-pointer transition-transform hover:scale-125"
                      title={`Delete Balloon #${balloonNum} (or press Delete)`}
                    >
                      <Trash2 className="w-2.5 h-2.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Security / ITAR Classification Watermark Overlay */}
        {watermark && watermark !== 'NONE' && (
          <div 
            className="absolute inset-0 pointer-events-none flex items-center justify-center select-none z-10 overflow-hidden"
          >
            <span 
              className="font-black tracking-widest text-red-600/15 uppercase select-none text-center"
              style={{
                fontSize: 'clamp(32px, 6vw, 84px)',
                transform: 'rotate(-30deg)',
                whiteSpace: 'nowrap'
              }}
            >
              {watermark}
            </span>
          </div>
        )}

        {/* Right-Click Balloon Context Menu */}
        {contextMenu && (
          <div
            style={{
              position: 'fixed',
              left: `${contextMenu.x}px`,
              top: `${contextMenu.y}px`,
              zIndex: 100
            }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white border border-slate-200 shadow-xl rounded-lg py-1 px-1 min-w-[170px] text-xs select-none animate-in fade-in zoom-in-95 duration-75"
          >
            <div className="px-2.5 py-1 text-[11px] font-bold text-slate-700 border-b border-slate-100 flex items-center justify-between">
              <span>Balloon #{contextMenu.char.subNumber || contextMenu.char.itemNumber}</span>
              <span className="text-[10px] text-slate-400 font-normal">{contextMenu.char.drawingZone}</span>
            </div>
            {onDeleteCharacteristic && (
              <button
                type="button"
                onClick={() => {
                  onDeleteCharacteristic(contextMenu.char.id);
                  setContextMenu(null);
                }}
                className="w-full text-left px-2.5 py-1.5 rounded hover:bg-slate-100 text-slate-700 flex items-center gap-2 cursor-pointer font-medium mt-0.5"
              >
                <Trash2 className="w-3.5 h-3.5 text-slate-500" />
                <span>Delete Balloon</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
