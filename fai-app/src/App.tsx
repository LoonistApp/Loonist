import { useState, useEffect, useCallback } from 'react';
import type * as pdfjsLib from 'pdfjs-dist';
import { PDFRenderService } from './services/pdfRenderer';
import { Header } from './components/layout/Header';
import { ViewportCanvas } from './components/viewport/ViewportCanvas';
import { ViewportToolbar } from './components/viewport/ViewportToolbar';
import { SheetTabs } from './components/viewport/SheetTabs';
import type { BlueprintDocument, ViewportTool } from './types/blueprint';
import { FileUp, FileText, Zap } from 'lucide-react';

export function App() {
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [blueprintDoc, setBlueprintDoc] = useState<BlueprintDocument | null>(null);
  const [activeSheetIndex, setActiveSheetIndex] = useState(0);
  const [scale, setScale] = useState(1.0);
  const [rotation, setRotation] = useState(0);
  const [activeTool, setActiveTool] = useState<ViewportTool>('pan');
  const [isLoading, setIsLoading] = useState(false);
  const [fps, setFps] = useState(60);

  // Ingest PDF buffer and initialize multi-sheet document model
  const loadPdfBuffer = useCallback(async (
    buffer: ArrayBuffer,
    fileName: string,
    fileSize: number,
    fileHash: string,
    filePath?: string
  ) => {
    try {
      setIsLoading(true);
      // Load document through PDFRenderService
      const loadedDoc = await PDFRenderService.loadDocument(buffer);
      const sheets = await PDFRenderService.getSheetsMetadata(loadedDoc);

      setPdfDoc(loadedDoc);
      setBlueprintDoc({
        id: fileHash.slice(0, 12),
        name: fileName,
        filePath: filePath,
        fileSize: fileSize,
        fileHash: fileHash,
        numSheets: loadedDoc.numPages,
        sheets: sheets,
        activeSheetIndex: 0
      });
      setActiveSheetIndex(0);
      setRotation(0);
    } catch (err) {
      console.error('Failed to load blueprint document:', err);
      alert('Error loading PDF blueprint. Please check file format.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Handler for opening blueprint from native OS file picker
  const handleOpenBlueprint = useCallback(async () => {
    if (window.api?.openBlueprintDialog) {
      const result = await window.api.openBlueprintDialog();
      if (!result.cancelled && result.buffer && result.fileName && result.fileHash) {
        await loadPdfBuffer(
          result.buffer,
          result.fileName,
          result.fileSize || result.buffer.byteLength,
          result.fileHash,
          result.filePath
        );
      }
    } else {
      // Fallback for browser testing: trigger HTML input
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'application/pdf';
      input.onchange = async (e: any) => {
        const file = e.target.files?.[0];
        if (file) {
          const buffer = await file.arrayBuffer();
          await loadPdfBuffer(buffer, file.name, file.size, 'local-browser-hash');
        }
      };
      input.click();
    }
  }, [loadPdfBuffer]);

  // Handler for loading built-in test blueprint
  const handleLoadSample = useCallback(async () => {
    if (window.api?.loadSampleBlueprint) {
      const result = await window.api.loadSampleBlueprint();
      if (!result.cancelled && result.buffer && result.fileName && result.fileHash) {
        await loadPdfBuffer(
          result.buffer,
          result.fileName,
          result.fileSize || result.buffer.byteLength,
          result.fileHash,
          result.filePath
        );
        return;
      }
    }

    // Fallback: Fetch directly from public directory
    try {
      setIsLoading(true);
      const res = await fetch('/sample_blueprint.pdf');
      const buffer = await res.arrayBuffer();
      await loadPdfBuffer(
        buffer,
        'AS9102_Sample_Turbine_Bracket_RevC.pdf',
        buffer.byteLength,
        'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
      );
    } catch (err) {
      console.error('Failed to fetch sample blueprint:', err);
    } finally {
      setIsLoading(false);
    }
  }, [loadPdfBuffer]);

  // Auto-load sample blueprint on first launch
  useEffect(() => {
    let active = true;
    const initialize = async () => {
      if (active) {
        await handleLoadSample();
      }
    };
    void initialize();
    return () => {
      active = false;
    };
  }, [handleLoadSample]);

  // Global CAD Hotkeys
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;

      if ((e.ctrlKey || e.metaKey) && (e.key === '=' || e.key === '+')) {
        e.preventDefault();
        setScale((s) => Math.min(32.0, s * 1.25));
      } else if ((e.ctrlKey || e.metaKey) && e.key === '-') {
        e.preventDefault();
        setScale((s) => Math.max(0.25, s * 0.8));
      } else if (e.key.toLowerCase() === 'r') {
        setRotation((r) => (r + 90) % 360);
      } else if (e.key === ' ') {
        setActiveTool('pan');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Zoom controls
  const handleZoomIn = () => setScale((s) => Math.min(32.0, s * 1.25));
  const handleZoomOut = () => setScale((s) => Math.max(0.25, s * 0.8));
  const handleSetZoom = (newScale: number) => setScale(Math.max(0.25, Math.min(32.0, newScale)));
  const handleRotate = () => setRotation((r) => (r + 90) % 360);

  const handleFitPage = () => {
    if (!blueprintDoc?.sheets[activeSheetIndex]) return;
    const sheet = blueprintDoc.sheets[activeSheetIndex];
    const availWidth = window.innerWidth - 80;
    const availHeight = window.innerHeight - 150;
    const fitScale = Math.min(availWidth / sheet.width, availHeight / sheet.height, 1.2);
    setScale(Math.max(0.25, Math.min(32.0, fitScale)));
  };

  const handleFitWidth = () => {
    if (!blueprintDoc?.sheets[activeSheetIndex]) return;
    const sheet = blueprintDoc.sheets[activeSheetIndex];
    const availWidth = window.innerWidth - 80;
    const fitScale = availWidth / sheet.width;
    setScale(Math.max(0.25, Math.min(32.0, fitScale)));
  };

  const currentSheet = blueprintDoc?.sheets[activeSheetIndex] || null;

  return (
    <div className="flex flex-col w-screen h-screen bg-slate-950 text-slate-100 overflow-hidden font-sans select-none">
      {/* Top Header */}
      <Header
        document={blueprintDoc}
        onOpenBlueprint={handleOpenBlueprint}
        onLoadSample={handleLoadSample}
        isLoading={isLoading}
      />

      {/* Main Viewport Container */}
      <main className="relative flex-1 w-full h-full overflow-hidden flex items-center justify-center">
        {blueprintDoc && currentSheet ? (
          <>
            <ViewportCanvas
              pdfDoc={pdfDoc}
              sheet={currentSheet}
              scale={scale}
              rotation={rotation}
              activeTool={activeTool}
              onScaleChange={setScale}
              onFpsUpdate={setFps}
            />

            {/* Floating CAD HUD Toolbar */}
            <ViewportToolbar
              scale={scale}
              rotation={rotation}
              activeTool={activeTool}
              fps={fps}
              onToolChange={setActiveTool}
              onZoomIn={handleZoomIn}
              onZoomOut={handleZoomOut}
              onSetZoom={handleSetZoom}
              onFitPage={handleFitPage}
              onFitWidth={handleFitWidth}
              onRotate={handleRotate}
            />
          </>
        ) : (
          /* Empty State Dropzone */
          <div className="flex flex-col items-center justify-center p-8 text-center max-w-lg">
            <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mb-4 shadow-xl shadow-cyan-950/20">
              <FileUp className="w-8 h-8 text-cyan-400" />
            </div>
            <h2 className="text-lg font-bold text-slate-200 mb-1">
              No Engineering Blueprint Loaded
            </h2>
            <p className="text-xs text-slate-400 mb-6 leading-relaxed">
              Open an aerospace drawing PDF (AS9102 / ASME Y14.5) to activate the 60 FPS vector viewport engine.
            </p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleOpenBlueprint}
                className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-medium text-xs rounded-lg shadow-lg shadow-cyan-600/30 transition"
              >
                <FileText className="w-4 h-4" />
                <span>Select Blueprint (.pdf)</span>
              </button>
              <button
                type="button"
                onClick={handleLoadSample}
                className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs rounded-lg border border-slate-700 transition"
              >
                <Zap className="w-4 h-4 text-blue-400" />
                <span>Load Sample Drawing</span>
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Bottom Sheet Tabs Navigation */}
      {blueprintDoc && (
        <SheetTabs
          sheets={blueprintDoc.sheets}
          activeSheetIndex={activeSheetIndex}
          onSelectSheet={setActiveSheetIndex}
        />
      )}
    </div>
  );
}

export default App;
