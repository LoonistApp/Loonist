import React, { useRef, useEffect, useState, useCallback } from 'react';
import type * as pdfjsLib from 'pdfjs-dist';
import { PDFRenderService } from '../../services/pdfRenderer';
import type { SheetMetadata, ViewportTool } from '../../types/blueprint';
import type { EngineeringCharacteristic } from '../../types/characteristics';
import { Loader2 } from 'lucide-react';

interface ViewportCanvasProps {
  pdfDoc: pdfjsLib.PDFDocumentProxy | null;
  sheet: SheetMetadata | null;
  scale: number;
  rotation: number;
  activeTool: ViewportTool;
  characteristics?: EngineeringCharacteristic[];
  selectedCharId?: string | null;
  onSelectCharacteristic?: (char: EngineeringCharacteristic) => void;
  onScaleChange: (scale: number) => void;
  onTransformChange?: (x: number, y: number) => void;
  onFpsUpdate?: (fps: number) => void;
}

export const ViewportCanvas: React.FC<ViewportCanvasProps> = ({
  pdfDoc,
  sheet,
  scale,
  rotation,
  activeTool,
  characteristics = [],
  selectedCharId,
  onSelectCharacteristic,
  onScaleChange,
  onTransformChange,
  onFpsUpdate
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
        if (onFpsUpdate) onFpsUpdate(Math.min(60, fps));
      }
      animId = requestAnimationFrame(measure);
    };
    animId = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(animId);
  }, [onFpsUpdate]);

  // Center & Fit sheet on initial load or sheet switch
  useEffect(() => {
    if (!containerRef.current || !sheet) return;
    const container = containerRef.current;
    const padding = 40;
    const availWidth = container.clientWidth - padding * 2;
    const availHeight = container.clientHeight - padding * 2;

    const fitScale = Math.min(availWidth / sheet.width, availHeight / sheet.height, 1.2);
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

  // --- PAN DRAG HANDLING ---
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    // Left click with Pan tool, middle click (button 1), or Spacebar held
    const isPanAction = e.button === 1 || activeTool === 'pan' || e.button === 0;
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
  }, [activeTool]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;

    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    const newX = Math.round(dragStartRef.current.originX + dx);
    const newY = Math.round(dragStartRef.current.originY + dy);

    applyTransform(newX, newY, scale);
  }, [scale, applyTransform]);

  const handleMouseUp = useCallback(() => {
    isDraggingRef.current = false;
    if (containerRef.current) {
      containerRef.current.style.cursor = activeTool === 'pan' ? 'grab' : 'crosshair';
    }
  }, [activeTool]);

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
            linear-gradient(to right, #e2e8f0 1px, transparent 1px),
            linear-gradient(to bottom, #e2e8f0 1px, transparent 1px)
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

        {/* Interactive AS9102 Balloon Markers & Dimension Highlights */}
        {sheet && (
          <div className="absolute inset-0 pointer-events-none">
            {activeSheetCharacteristics.map((char) => {
              const isSelected = selectedCharId === char.id;
              const isFlagged = char.verificationStatus === 'needs_review';

              return (
                <div key={char.id} className="pointer-events-auto">
                  {/* Subtle Bounding Highlight Around Dimension Text */}
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
                    }}
                    className={`cursor-pointer rounded-xs transition-colors ${
                      isSelected
                        ? 'border-2 border-blue-600 bg-blue-500/20 shadow-xs'
                        : 'border border-blue-400/30 hover:border-blue-500 hover:bg-blue-500/10'
                    }`}
                    title={`Balloon #${char.subNumber || char.itemNumber}: ${char.rawText} (${char.drawingZone})`}
                  />

                  {/* AS9102 Circular Balloon Badge */}
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectCharacteristic?.(char);
                    }}
                    style={{
                      position: 'absolute',
                      left: `${char.boundingBox.x - 24}px`,
                      top: `${char.boundingBox.y - 4}px`,
                    }}
                    className="cursor-pointer group flex items-center justify-center transition-transform hover:scale-125"
                    title={`Click to review Balloon #${char.subNumber || char.itemNumber}: ${char.rawText}`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full font-bold font-mono text-[10px] flex items-center justify-center border shadow-xs select-none transition ${
                        isSelected
                          ? 'bg-amber-600 text-white border-white ring-2 ring-amber-400 scale-110'
                          : isFlagged
                          ? 'bg-amber-500 text-white border-white'
                          : 'bg-blue-600 text-white border-white'
                      }`}
                    >
                      {char.subNumber || char.itemNumber}
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
