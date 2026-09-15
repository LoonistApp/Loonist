import React, { useRef, useEffect, useState, useCallback } from 'react';
import type * as pdfjsLib from 'pdfjs-dist';
import { PDFRenderService } from '../../services/pdfRenderer';
import type { SheetMetadata, ViewportTool } from '../../types/blueprint';
import type { EngineeringCharacteristic, BalloonAppearance } from '../../types/characteristics';
import { Loader2 } from 'lucide-react';

interface ViewportCanvasProps {
  pdfDoc: pdfjsLib.PDFDocumentProxy | null;
  sheet: SheetMetadata | null;
  scale: number;
  rotation: number;
  activeTool: ViewportTool;
  characteristics?: EngineeringCharacteristic[];
  selectedCharId?: string | null;
  balloonAppearance?: BalloonAppearance;
  onSelectCharacteristic?: (char: EngineeringCharacteristic) => void;
  onUpdateCharacteristic?: (char: EngineeringCharacteristic) => void;
  onBoxCapture?: (
    box: { x: number; y: number; width: number; height: number },
    pageNumber: number,
    cropCanvas?: HTMLCanvasElement
  ) => void;
  onScaleChange: (scale: number) => void;
  onTransformChange?: (x: number, y: number) => void;
  onFpsUpdate?: (fps: number) => void;
  onCropGenerated?: (dataUrl: string) => void;
}

export const ViewportCanvas: React.FC<ViewportCanvasProps> = ({
  pdfDoc,
  sheet,
  scale,
  rotation,
  activeTool,
  characteristics = [],
  selectedCharId,
  balloonAppearance = { shape: 'circle', fit: 2, fontSize: 10, color: 'blue', showLeaderLine: true },
  onSelectCharacteristic,
  onUpdateCharacteristic,
  onBoxCapture,
  onScaleChange,
  onTransformChange,
  onFpsUpdate,
  onCropGenerated
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const transformRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Panning state
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef<{ x: number; y: number; originX: number; originY: number }>({
    x: 0,
    y: 0,
    originX: 0,
    originY: 0
  });

  // Balloon Dragging state
  const draggingBalloonRef = useRef<{
    charId: string;
    startMouseX: number;
    startMouseY: number;
    initialBadgeX: number;
    initialBadgeY: number;
    currentBadgeX: number;
    currentBadgeY: number;
  } | null>(null);
  const [draggedBalloonPos, setDraggedBalloonPos] = useState<{ id: string; x: number; y: number } | null>(null);

  // Box Capture Marquee state
  const isCapturingRef = useRef(false);
  const [selectionBox, setSelectionBox] = useState<{ startX: number; startY: number; currentX: number; currentY: number } | null>(null);

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

  // Fit Page to container on initial load
  useEffect(() => {
    if (!sheet || !containerRef.current) return;
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

    // Zoom factor: 1.15x per scroll notch
    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
    const newScale = Math.max(0.25, Math.min(32.0, scale * zoomFactor));

    // Calculate drawing coordinate under mouse pointer before zoom
    const docX = (mouseX - transformRef.current.x) / scale;
    const docY = (mouseY - transformRef.current.y) / scale;

    // Calculate new translation to keep cursor stationary relative to drawing
    const newX = Math.round(mouseX - docX * newScale);
    const newY = Math.round(mouseY - docY * newScale);

    onScaleChange(newScale);
    applyTransform(newX, newY, newScale);
  }, [scale, sheet, onScaleChange, applyTransform]);

  // Handler when user mouse-downs on a balloon badge to drag it
  const handleBalloonMouseDown = useCallback((e: React.MouseEvent, char: EngineeringCharacteristic) => {
    e.stopPropagation();
    onSelectCharacteristic?.(char);

    const defaultBadgeX = char.boundingBox.x < 42
      ? Math.round(char.boundingBox.x + char.boundingBox.width + 12)
      : Math.max(12, Math.round(char.boundingBox.x - 34));
    const defaultBadgeY = Math.round(char.boundingBox.y + (char.boundingBox.height / 2) - 14);
    const initialX = char.customBalloonPosition?.x ?? defaultBadgeX;
    const initialY = char.customBalloonPosition?.y ?? defaultBadgeY;

    draggingBalloonRef.current = {
      charId: char.id,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      initialBadgeX: initialX,
      initialBadgeY: initialY,
      currentBadgeX: initialX,
      currentBadgeY: initialY
    };
    setDraggedBalloonPos({ id: char.id, x: initialX, y: initialY });
  }, [onSelectCharacteristic]);

  // --- MOUSE DOWN HANDLING ---
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    // 1. Box Capture Tool Handling
    if (activeTool === 'box-capture' && e.button === 0 && sheet) {
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

    // 2. Pan Action (Left click with Pan tool, middle click button 1, or standard click)
    const isPanAction = e.button === 1 || activeTool === 'pan' || (activeTool !== 'box-capture' && e.button === 0);
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
  }, [activeTool, scale, sheet]);

  // --- MOUSE MOVE HANDLING ---
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    // 1. Dragging Balloon Badge
    if (draggingBalloonRef.current) {
      const dx = (e.clientX - draggingBalloonRef.current.startMouseX) / scale;
      const dy = (e.clientY - draggingBalloonRef.current.startMouseY) / scale;
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
    const newX = Math.round(dragStartRef.current.originX + dx);
    const newY = Math.round(dragStartRef.current.originY + dy);

    applyTransform(newX, newY, scale);
  }, [scale, selectionBox, applyTransform]);

  // --- MOUSE UP HANDLING ---
  const handleMouseUp = useCallback(() => {
    // 1. Commit Balloon Dragging
    if (draggingBalloonRef.current) {
      const { charId, currentBadgeX, currentBadgeY, initialBadgeX, initialBadgeY } = draggingBalloonRef.current;
      if (Math.hypot(currentBadgeX - initialBadgeX, currentBadgeY - initialBadgeY) > 2) {
        const char = characteristics.find(c => c.id === charId);
        if (char) {
          onUpdateCharacteristic?.({
            ...char,
            customBalloonPosition: { x: currentBadgeX, y: currentBadgeY }
          });
        }
      }
      draggingBalloonRef.current = null;
      setDraggedBalloonPos(null);
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
      containerRef.current.style.cursor = 
        activeTool === 'pan' ? 'grab' : 
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

  // Track last selected characteristic to auto-pan without hijacking user mouse wheel zoom
  const lastSelectedCharIdRef = useRef<string | null>(null);

  // Auto-pan viewport to center the selected characteristic
  useEffect(() => {
    if (!selectedCharId || !containerRef.current || !sheet) return;
    if (selectedCharId === lastSelectedCharIdRef.current) return;
    lastSelectedCharIdRef.current = selectedCharId;

    const char = characteristics.find((c) => c.id === selectedCharId);
    if (!char || char.sheetNumber !== sheet.pageNumber) return;

    const container = containerRef.current;
    const containerW = container.clientWidth;
    const containerH = container.clientHeight;

    const charCenterX = char.boundingBox.x + char.boundingBox.width / 2;
    const charCenterY = char.boundingBox.y + char.boundingBox.height / 2;

    const targetX = Math.round(containerW / 2 - charCenterX * scale);
    const targetY = Math.round(containerH / 2 - charCenterY * scale);

    applyTransform(targetX, targetY, scale);
  }, [selectedCharId, characteristics, sheet, scale, applyTransform]);

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
      className={`relative flex-1 w-full h-full overflow-hidden bg-slate-100 select-none ${
        activeTool === 'pan' ? 'cursor-grab' : 'cursor-crosshair'
      }`}
    >
      {/* Subtle CAD Alignment Grid */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-40"
        style={{
          backgroundImage: `
            linear-gradient(to right, var(--border-subtle, #e2e8f0) 1px, transparent 1px),
            linear-gradient(to bottom, var(--border-subtle, #e2e8f0) 1px, transparent 1px)
          `,
          backgroundSize: '32px 32px'
        }}
      />

      {/* Loading Indicator */}
      {isRendering && (
        <div className="absolute top-3 right-3 z-10 flex items-center gap-2 bg-white border border-slate-200 text-slate-700 text-xs px-3 py-1.5 rounded shadow-sm">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
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
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(0, 0, 0, 0.08)',
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
              border: '2px dashed #2563eb',
              backgroundColor: 'rgba(37, 99, 235, 0.18)',
              boxShadow: '0 0 0 1px rgba(255, 255, 255, 0.7)',
              pointerEvents: 'none',
              zIndex: 50
            }}
          />
        )}

        {/* Interactive AS9102 Balloon Markers & Dimension Highlights */}
        {sheet && (
            {activeSheetCharacteristics.map((char) => {
              // Clean Canvas Rule: Suppress floating balloons on general notes block unless explicitly enabled
              if (char.skipBalloonRender && !balloonAppearance?.balloonGeneralNotes) {
                return null;
              }

              const isSelected = selectedCharId === char.id;
              const isFlagged = char.verificationStatus === 'needs_review';
              const isBeingDragged = draggedBalloonPos?.id === char.id;
              const balloonNum = char.subNumber || char.itemNumber;

              // Determine balloon shape: default to user appearance (circle) or special flag/basic
              const isFlagNote = char.subType === 'FlagNote';
              const isBasic = char.isBasic;
              const shape = isFlagNote ? 'triangle' : isBasic ? 'square' : (balloonAppearance.shape || 'circle');

              // Offset sub-balloons e.g. 5.1, 5.2, 5.3 vertically so they don't overlap
              let subOffset = 0;
              if (char.subNumber && char.subNumber.includes('.')) {
                const parts = char.subNumber.split('.');
                const subIdx = parseInt(parts[1], 10);
                if (!isNaN(subIdx) && subIdx > 1) {
                  subOffset = (subIdx - 1) * 32;
                }
              }

              // Centered default badge coordinates (East if near left sheet margin, West default)
              const defaultBadgeX = char.boundingBox.x < 42
                ? Math.round(char.boundingBox.x + char.boundingBox.width + 12)
                : Math.max(12, Math.round(char.boundingBox.x - 34));
              const defaultBadgeY = Math.round(char.boundingBox.y + (char.boundingBox.height / 2) - 14 + subOffset);

              // Position: active drag -> custom saved position -> default calculation
              const badgeX = isBeingDragged
                ? draggedBalloonPos.x
                : (char.customBalloonPosition?.x ?? defaultBadgeX);
              const badgeY = isBeingDragged
                ? draggedBalloonPos.y
                : (char.customBalloonPosition?.y ?? defaultBadgeY);

              // Base theme color mapping
              const baseBgColor = 
                balloonAppearance.color === 'red' ? '#dc2626' :
                balloonAppearance.color === 'green' ? '#059669' :
                balloonAppearance.color === 'amber' ? '#d97706' :
                balloonAppearance.color === 'black' ? '#0f172a' :
                '#2563eb';

              const badgeBg = isSelected 
                ? '#d97706' 
                : isFlagged 
                ? '#f59e0b' 
                : baseBgColor;

              const leaderStroke = isSelected 
                ? '#d97706' 
                : isFlagged
                ? '#f59e0b'
                : baseBgColor;

              // Calculate nearest point on bounding box for dynamic leader line anchoring
              const badgeCenterX = badgeX + 14;
              const badgeCenterY = badgeY + 14;
              const boxMinX = char.boundingBox.x;
              const boxMaxX = char.boundingBox.x + char.boundingBox.width;
              const boxMinY = char.boundingBox.y;
              const boxMaxY = char.boundingBox.y + char.boundingBox.height;

              const anchorX = Math.max(boxMinX, Math.min(boxMaxX, badgeCenterX));
              const anchorY = Math.max(boxMinY, Math.min(boxMaxY, badgeCenterY));
              const leaderDist = Math.hypot(badgeCenterX - anchorX, badgeCenterY - anchorY);

              return (
                <div key={char.id} className="pointer-events-auto">
                  {/* SVG Leader Line connecting balloon dynamically to nearest bounding box edge with arrowhead */}
                  {balloonAppearance.showLeaderLine && (
                    <svg
                      className="absolute inset-0 pointer-events-none overflow-visible"
                      style={{ zIndex: 5 }}
                    >
                      <defs>
                        <marker
                          id={`arrow-${char.id}`}
                          viewBox="0 0 10 10"
                          refX="6"
                          refY="5"
                          markerWidth="5"
                          markerHeight="5"
                          orient="auto-start-reverse"
                        >
                          <path d="M 0 2 L 8 5 L 0 8 z" fill={leaderStroke} />
                        </marker>
                      </defs>
                      <line
                        x1={badgeCenterX}
                        y1={badgeCenterY}
                        x2={anchorX}
                        y2={anchorY}
                        stroke={leaderStroke}
                        strokeWidth={isSelected || isBeingDragged ? "2" : "1.5"}
                        strokeDasharray={isFlagged ? '3,3' : undefined}
                        markerEnd={leaderDist > 20 ? `url(#arrow-${char.id})` : undefined}
                      />
                    </svg>
                  )}

                  {/* High-visibility Bounding Box Highlight Around Dimension Text */}
                  <div
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
                      border: isSelected ? '2px solid #f59e0b' : '1px solid rgba(37, 99, 235, 0.45)',
                      backgroundColor: isSelected ? 'rgba(245, 158, 11, 0.22)' : 'rgba(37, 99, 235, 0.08)',
                      boxShadow: isSelected ? '0 0 8px rgba(245, 158, 11, 0.4)' : undefined,
                      zIndex: isSelected ? 12 : 6,
                      cursor: 'pointer',
                      borderRadius: '2px',
                      transition: 'all 0.15s ease'
                    }}
                    title={`Balloon #${balloonNum}: ${char.rawText} (${char.drawingZone})`}
                  />

                  {/* AS9102 Shape-Adaptive Draggable Balloon Badge */}
                  <div
                    onMouseDown={(e) => handleBalloonMouseDown(e, char)}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectCharacteristic?.(char);
                    }}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      onUpdateCharacteristic?.({
                        ...char,
                        customBalloonPosition: undefined
                      });
                    }}
                    style={{
                      position: 'absolute',
                      left: `${badgeX}px`,
                      top: `${badgeY}px`,
                      zIndex: isSelected || isBeingDragged ? 30 : 15,
                      cursor: isBeingDragged ? 'grabbing' : 'grab'
                    }}
                    className="group flex items-center justify-center transition-transform hover:scale-110 active:scale-95"
                    title={`Drag to reposition Balloon #${balloonNum}. Double-click to auto-reset. Click to select.`}
                  >
                    {/* High-contrast shape container */}
                    <div
                      style={{
                        width: '28px',
                        height: '28px',
                        backgroundColor: badgeBg,
                        color: '#ffffff',
                        fontWeight: 'bold',
                        fontFamily: 'JetBrains Mono, monospace',
                        fontSize: '11px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: '2px solid #ffffff',
                        borderRadius: shape === 'circle' ? '9999px' : shape === 'square' ? '3px' : '6px',
                        transform: shape === 'hexagon' ? 'rotate(45deg)' : undefined,
                        boxShadow: isSelected || isBeingDragged
                          ? '0 0 0 4px rgba(245, 158, 11, 0.5), 0 4px 10px rgba(0, 0, 0, 0.25)' 
                          : '0 2px 6px rgba(0, 0, 0, 0.22)',
                        userSelect: 'none',
                        transition: isBeingDragged ? 'none' : 'box-shadow 0.15s ease'
                      }}
                    >
                      <span style={{ transform: shape === 'hexagon' ? 'rotate(-45deg)' : undefined }}>
                        {balloonNum}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
