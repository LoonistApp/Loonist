import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type * as pdfjsLib from 'pdfjs-dist';
import { PDFRenderService } from './services/pdfRenderer';
import { RibbonBar } from './components/layout/RibbonBar';
import { LeftPropertiesDock } from './components/layout/LeftPropertiesDock';
import { TableManager } from './components/layout/TableManager';
import { ViewportCanvas } from './components/viewport/ViewportCanvas';
import { ViewportToolbar } from './components/viewport/ViewportToolbar';
import { SheetTabs } from './components/viewport/SheetTabs';
import { HorizontalSplitter, VerticalSplitter } from './components/layout/Splitter';
import { AiExtractionService } from './services/ai/aiExtractionService';
import { As9102ExcelExporter } from './services/export/as9102ExcelExporter';
import { MarkedPdfExporter } from './services/export/markedPdfExporter';
import { AuditLedgerService } from './services/compliance/auditLedgerService';
import { MeasurementEngine } from './services/compliance/measurementEngine';
import { RenumberingService } from './services/ballooning/renumberingService';
import { ProjectArchiveService, type LoonistProjectPackage } from './services/project/projectArchiveService';
import { SpatialPlacementService } from './services/ballooning/spatialPlacementService';
import type { 
  EngineeringCharacteristic, 
  ProjectProperties, 
  BalloonAppearance 
} from './types/characteristics';
import type { BlueprintDocument, ViewportTool } from './types/blueprint';
import { ExtractionReviewDrawer } from './components/extraction/ExtractionReviewDrawer';
import { FileUp, FileText, Zap } from 'lucide-react';

interface DocumentCacheItem {
  id: string;
  name: string;
  filePath?: string;
  fileSize: number;
  fileHash: string;
  buffer: ArrayBuffer;
  pdfDoc: pdfjsLib.PDFDocumentProxy;
  blueprintDoc: BlueprintDocument;
  characteristics: EngineeringCharacteristic[];
  projectProps: ProjectProperties;
  selectedCharId: string | null;
  activeSheetIndex: number;
  scale: number;
  rotation: number;
}

export function App() {
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [blueprintDoc, setBlueprintDoc] = useState<BlueprintDocument | null>(null);
  const [activeSheetIndex, setActiveSheetIndex] = useState(0);
  const [scale, setScale] = useState(1.0);
  const [rotation, setRotation] = useState(0);
  const [activeTool, setActiveTool] = useState<ViewportTool>('pan');
  const [isLoading, setIsLoading] = useState(false);
  const [fps, setFps] = useState(60);

  // Multi-Document Project Ingestion State (InspectionXpert Benchmark)
  const [projectFiles, setProjectFiles] = useState<Array<{ id: string; name: string; type: 'pdf' | 'dwg' | 'catpart'; filePath?: string }>>([]);
  const [activeFileId, setActiveFileId] = useState<string>('');
  const docCacheRef = useRef<Map<string, DocumentCacheItem>>(new Map());

  // Inspection & Characteristic State
  const [characteristics, setCharacteristics] = useState<EngineeringCharacteristic[]>([]);
  const [selectedCharId, setSelectedCharId] = useState<string | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [hudCropDataUrl, setHudCropDataUrl] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Aerospace CAD Dark Mode Theme State
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('loonist_theme');
      if (saved) return saved === 'dark';
      return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('loonist_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('loonist_theme', 'light');
    }
  }, [isDarkMode]);

  const handleToggleDarkMode = useCallback(() => {
    setIsDarkMode((prev) => !prev);
  }, []);

  // Balloon Appearance & Locking
  const [balloonAppearance, setBalloonAppearance] = useState<BalloonAppearance>({
    shape: 'circle',
    fit: 2,
    fontSize: 10,
    color: 'blue',
    showLeaderLine: true
  });
  const [balloonsLocked, setBalloonsLocked] = useState(false);

  // AS9102 Project Properties
  const [projectProps, setProjectProps] = useState<ProjectProperties>({
    partName: 'TURBINE MOUNT BRACKET - HIGH PRESSURE COMPRESSOR',
    partNumber: 'AS9102-TMB-001',
    partRevision: 'C',
    drawingName: 'Turbine Mount Bracket',
    drawingNumber: 'AS9102-TMB-001',
    drawingRevision: 'C',
    cageCode: '1A2B3',
    lotSize: 200,
    samplingLevel: 'II',
    samplingType: 'NORMAL',
    aql: '1.0'
  });

  // Selected characteristic object
  const selectedChar = useMemo(() => {
    return characteristics.find((c) => c.id === selectedCharId) || null;
  }, [characteristics, selectedCharId]);

  // Keep cache item for active document updated whenever document-level state changes
  useEffect(() => {
    if (!activeFileId || !pdfDoc || !blueprintDoc) return;
    const existing = docCacheRef.current.get(activeFileId);
    if (existing) {
      existing.characteristics = characteristics;
      existing.projectProps = projectProps;
      existing.selectedCharId = selectedCharId;
      existing.activeSheetIndex = activeSheetIndex;
      existing.scale = scale;
      existing.rotation = rotation;
      existing.blueprintDoc = blueprintDoc;
      existing.pdfDoc = pdfDoc;
    }
  }, [activeFileId, characteristics, projectProps, selectedCharId, activeSheetIndex, scale, rotation, blueprintDoc, pdfDoc]);

  // Ensure currently active document is stored in docCacheRef on mount or render
  useEffect(() => {
    if (!blueprintDoc || !pdfDoc) return;
    const id = activeFileId || blueprintDoc.name;
    if (!docCacheRef.current.has(id)) {
      docCacheRef.current.set(id, {
        id,
        name: blueprintDoc.name,
        filePath: blueprintDoc.filePath,
        fileSize: blueprintDoc.fileSize,
        fileHash: blueprintDoc.fileHash,
        buffer: new ArrayBuffer(0),
        pdfDoc,
        blueprintDoc,
        characteristics,
        projectProps,
        selectedCharId,
        activeSheetIndex,
        scale,
        rotation
      });
    }
  }, [blueprintDoc, pdfDoc, activeFileId, characteristics, projectProps, selectedCharId, activeSheetIndex, scale, rotation]);

  // Forward ref for mutually recursive callbacks
  const handleOpenBlueprintRef = useRef<() => Promise<void>>(async () => {});
  const loadPdfBufferRef = useRef<((buffer: ArrayBuffer, fileName: string, fileSize: number, fileHash: string, filePath?: string) => Promise<void>) | null>(null);

  // Switch active document tab and restore its state from in-memory cache
  const handleSelectFile = useCallback(async (targetFileId: string) => {
    if (targetFileId === activeFileId) return;

    // 1. Save currently active document state to cache
    if (activeFileId && docCacheRef.current.has(activeFileId)) {
      const current = docCacheRef.current.get(activeFileId)!;
      current.characteristics = characteristics;
      current.projectProps = projectProps;
      current.selectedCharId = selectedCharId;
      current.activeSheetIndex = activeSheetIndex;
      current.scale = scale;
      current.rotation = rotation;
      if (blueprintDoc) current.blueprintDoc = blueprintDoc;
      if (pdfDoc) current.pdfDoc = pdfDoc;
    }

    // 2. Resolve target document from cache by ID, name, or substring
    let target = docCacheRef.current.get(targetFileId);
    if (!target) {
      const matchedTab = projectFiles.find((f) => f.id === targetFileId || f.name === targetFileId);
      if (matchedTab) {
        target = docCacheRef.current.get(matchedTab.name) ||
          Array.from(docCacheRef.current.values()).find((d) => d.name === matchedTab.name);

        // If not in cache but filePath is known, reload automatically from disk via Electron
        if (!target && matchedTab.filePath && window.api?.loadBlueprintPath && loadPdfBufferRef.current) {
          setIsLoading(true);
          try {
            const res = await window.api.loadBlueprintPath(matchedTab.filePath);
            if (!res.cancelled && res.buffer && res.fileName && res.fileHash) {
              await loadPdfBufferRef.current(
                res.buffer,
                res.fileName,
                res.fileSize || res.buffer.byteLength,
                res.fileHash,
                res.filePath
              );
              return;
            }
          } catch (e) {
            console.error('Failed to auto-reload document from disk:', e);
          } finally {
            setIsLoading(false);
          }
        }
      }
    }

    if (!target) {
      console.warn(`Document ${targetFileId} not in memory cache. Prompting file picker.`);
      await handleOpenBlueprintRef.current();
      return;
    }

    // 3. Swap state to target document
    setPdfDoc(target.pdfDoc);
    setBlueprintDoc(target.blueprintDoc);
    setCharacteristics(target.characteristics);
    setProjectProps(target.projectProps);
    setSelectedCharId(target.selectedCharId);
    const safeSheetIndex = Math.min(target.activeSheetIndex, Math.max(0, target.blueprintDoc.numSheets - 1));
    setActiveSheetIndex(safeSheetIndex);
    setScale(target.scale || 1.0);
    setRotation(target.rotation || 0);
    setActiveFileId(target.id);
  }, [activeFileId, characteristics, projectProps, selectedCharId, activeSheetIndex, scale, rotation, blueprintDoc, pdfDoc, projectFiles]);

  // Close a document tab
  const handleCloseFile = useCallback((fileIdToClose: string) => {
    docCacheRef.current.delete(fileIdToClose);

    setProjectFiles((prev) => {
      const remaining = prev.filter((f) => f.id !== fileIdToClose && f.name !== fileIdToClose);

      // If closed file was currently active, switch to another file or reset
      if (activeFileId === fileIdToClose || (blueprintDoc && blueprintDoc.name === fileIdToClose)) {
        if (remaining.length > 0) {
          const nextFile = remaining[remaining.length - 1];
          const target = docCacheRef.current.get(nextFile.id) || docCacheRef.current.get(nextFile.name);
          if (target) {
            setPdfDoc(target.pdfDoc);
            setBlueprintDoc(target.blueprintDoc);
            setCharacteristics(target.characteristics);
            setProjectProps(target.projectProps);
            setSelectedCharId(target.selectedCharId);
            const safeSheetIndex = Math.min(target.activeSheetIndex, Math.max(0, target.blueprintDoc.numSheets - 1));
            setActiveSheetIndex(safeSheetIndex);
            setScale(target.scale || 1.0);
            setRotation(target.rotation || 0);
            setActiveFileId(nextFile.id);
          }
        } else {
          setPdfDoc(null);
          setBlueprintDoc(null);
          setCharacteristics([]);
          setSelectedCharId(null);
          setActiveFileId('');
        }
      }

      return remaining;
    });
  }, [activeFileId, blueprintDoc]);

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

      const fileId = fileName;

      // If already cached, switch to it
      if (docCacheRef.current.has(fileId)) {
        await handleSelectFile(fileId);
        setIsLoading(false);
        return;
      }

      // 1. Save currently active document state before loading new one
      if (activeFileId && docCacheRef.current.has(activeFileId)) {
        const current = docCacheRef.current.get(activeFileId)!;
        current.characteristics = characteristics;
        current.projectProps = projectProps;
        current.selectedCharId = selectedCharId;
        current.activeSheetIndex = activeSheetIndex;
        current.scale = scale;
        current.rotation = rotation;
        if (blueprintDoc) current.blueprintDoc = blueprintDoc;
        if (pdfDoc) current.pdfDoc = pdfDoc;
      }

      // 2. Ingest new PDF document
      const loadedDoc = await PDFRenderService.loadDocument(buffer);
      const sheets = await PDFRenderService.getSheetsMetadata(loadedDoc);

      const isSample = fileName.includes('Sample') || fileName.includes('Turbine_Bracket');
      const newBlueprintDoc: BlueprintDocument = {
        id: fileHash.slice(0, 12),
        name: fileName,
        filePath: filePath,
        fileSize: fileSize,
        fileHash: fileHash,
        numSheets: loadedDoc.numPages,
        sheets: sheets,
        activeSheetIndex: 0
      };

      const newProps: ProjectProperties = isSample ? {
        partName: 'TURBINE MOUNT BRACKET - HIGH PRESSURE COMPRESSOR',
        partNumber: 'AS9102-TMB-001',
        partRevision: 'C',
        drawingName: 'Turbine Mount Bracket',
        drawingNumber: 'AS9102-TMB-001',
        drawingRevision: 'C',
        cageCode: '1A2B3',
        lotSize: 200,
        samplingLevel: 'II',
        samplingType: 'NORMAL',
        aql: '1.0'
      } : {
        partName: fileName.replace(/\.[^/.]+$/, '').toUpperCase(),
        partNumber: fileName.split('_')[0] || 'PART-001',
        partRevision: 'A',
        drawingName: fileName,
        drawingNumber: fileName.replace(/\.[^/.]+$/, ''),
        drawingRevision: 'A',
        cageCode: '1A2B3',
        lotSize: 100,
        samplingLevel: 'II',
        samplingType: 'NORMAL',
        aql: '1.0'
      };

      // 3. Cache the new document
      const newCacheItem: DocumentCacheItem = {
        id: fileId,
        name: fileName,
        filePath,
        fileSize,
        fileHash,
        buffer,
        pdfDoc: loadedDoc,
        blueprintDoc: newBlueprintDoc,
        characteristics: [],
        projectProps: newProps,
        selectedCharId: null,
        activeSheetIndex: 0,
        scale: 1.0,
        rotation: 0
      };
      docCacheRef.current.set(fileId, newCacheItem);

      // 4. Update project files list (deduplicating by filename or ID)
      setProjectFiles((prev) => {
        const existingIdx = prev.findIndex((f) => f.name === fileName || f.id === fileId);
        if (existingIdx >= 0) {
          const updated = [...prev];
          updated[existingIdx] = { id: fileId, name: fileName, type: 'pdf', filePath };
          return updated;
        }
        return [...prev, { id: fileId, name: fileName, type: 'pdf', filePath }];
      });

      // 5. Activate in view
      setPdfDoc(loadedDoc);
      setBlueprintDoc(newBlueprintDoc);
      setProjectProps(newProps);
      setSelectedCharId(null);
      setActiveSheetIndex(0);
      setScale(1.0);
      setRotation(0);
      setActiveFileId(fileId);

      // Auto-extract characteristics for the sample blueprint so balloons and table are immediately populated
      if (fileName.includes('Sample') || fileName.includes('AS9102')) {
        try {
          const result = await AiExtractionService.extractCharacteristics(loadedDoc);
          setCharacteristics(result.characteristics);
          setProjectProps(result.projectProps);
          if (result.characteristics.length > 0) {
            setSelectedCharId(result.characteristics[0].id);
          }
        } catch (extractErr) {
          console.warn('Auto-extraction on sample load skipped:', extractErr);
          setCharacteristics([]);
        }
      } else {
        setCharacteristics([]);
      }
    } catch (err) {
      console.error('Failed to load blueprint document:', err);
      alert('Error loading PDF blueprint. Please check file format.');
    } finally {
      setIsLoading(false);
    }
  }, [activeFileId, characteristics, projectProps, selectedCharId, activeSheetIndex, scale, rotation, blueprintDoc, pdfDoc, handleSelectFile]);

  useEffect(() => {
    loadPdfBufferRef.current = loadPdfBuffer;
  }, [loadPdfBuffer]);

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

  useEffect(() => {
    handleOpenBlueprintRef.current = handleOpenBlueprint;
  }, [handleOpenBlueprint]);

  // Handler for loading built-in test blueprint
  const handleLoadSample = useCallback(async () => {
    const sampleId = 'AS9102_Sample_Turbine_Bracket_RevC.pdf';
    if (docCacheRef.current.has(sampleId)) {
      await handleSelectFile(sampleId);
      return;
    }

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

    try {
      setIsLoading(true);
      const res = await fetch('/sample_blueprint.pdf');
      const buffer = await res.arrayBuffer();
      await loadPdfBuffer(
        buffer,
        sampleId,
        buffer.byteLength,
        'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
      );
    } catch (err) {
      console.error('Failed to fetch sample blueprint:', err);
    } finally {
      setIsLoading(false);
    }
  }, [loadPdfBuffer, handleSelectFile]);

  // Auto-load sample blueprint on first launch only
  const hasInitializedRef = useRef(false);
  useEffect(() => {
    if (hasInitializedRef.current) return;
    hasInitializedRef.current = true;

    // Only load sample if no blueprint is currently loaded
    if (!pdfDoc && !blueprintDoc) {
      void handleLoadSample();
    }
  }, [handleLoadSample, pdfDoc, blueprintDoc]);

  // Global CAD Hotkeys
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'TEXTAREA') return;

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
  const handleRotateCw = () => setRotation((r) => (r + 90) % 360);
  const handleRotateCcw = () => setRotation((r) => (r - 90 + 360) % 360);

  const handleFitPage = () => {
    if (!blueprintDoc?.sheets[activeSheetIndex]) return;
    const sheet = blueprintDoc.sheets[activeSheetIndex];
    const availWidth = window.innerWidth - 380; // account for left sidebar
    const availHeight = window.innerHeight - 340; // account for ribbon + bottom table
    const fitScale = Math.min(availWidth / sheet.width, availHeight / sheet.height, 1.2);
    setScale(Math.max(0.25, Math.min(32.0, fitScale)));
  };

  const handleFitWidth = () => {
    if (!blueprintDoc?.sheets[activeSheetIndex]) return;
    const sheet = blueprintDoc.sheets[activeSheetIndex];
    const availWidth = window.innerWidth - 380;
    const fitScale = availWidth / sheet.width;
    setScale(Math.max(0.25, Math.min(32.0, fitScale)));
  };

  // Smart Extract Handler (Auto-Ballooning)
  const handleSmartExtract = useCallback(async () => {
    if (!pdfDoc) return;
    try {
      setIsExtracting(true);
      const result = await AiExtractionService.extractCharacteristics(pdfDoc);
      setCharacteristics(result.characteristics);
      setProjectProps(result.projectProps);
      if (result.characteristics.length > 0) {
        setSelectedCharId(result.characteristics[0].id);
      }
    } catch (err) {
      console.error('Failed to run Smart Extract:', err);
      alert('Failed to extract characteristics. Please verify PDF stream.');
    } finally {
      setIsExtracting(false);
    }
  }, [pdfDoc]);

  // Export to AS9102 Excel Handler
  const handleExportExcel = useCallback(() => {
    if (characteristics.length === 0) {
      alert('Please run Smart Extract or add characteristics before exporting.');
      return;
    }
    As9102ExcelExporter.exportToExcel(
      characteristics,
      projectProps,
      `${projectProps.partNumber || 'AS9102'}_FAIR_Report.xlsx`
    );
  }, [characteristics, projectProps]);

  // Vector Marked Blueprint PDF Exporter (pdf-lib)
  const handleExportMarkedPdf = useCallback(async () => {
    if (!blueprintDoc || characteristics.length === 0) {
      alert('Please load a blueprint and characteristics before exporting marked PDF.');
      return;
    }
    try {
      setIsLoading(true);
      let originalBytes: ArrayBuffer | Uint8Array | null = null;
      const activeCache = activeFileId ? docCacheRef.current.get(activeFileId) : null;
      if (activeCache?.buffer && activeCache.buffer.byteLength > 0) {
        originalBytes = activeCache.buffer;
      } else if (blueprintDoc.filePath && window.api?.loadBlueprintPath) {
        const res = await window.api.loadBlueprintPath(blueprintDoc.filePath);
        if (!res.cancelled && res.buffer) {
          originalBytes = res.buffer;
        }
      }
      if (!originalBytes) {
        const res = await fetch('/sample_blueprint.pdf');
        originalBytes = await res.arrayBuffer();
      }

      const markedBytes = await MarkedPdfExporter.generateMarkedPdf(
        originalBytes,
        characteristics,
        balloonAppearance
      );

      const defaultName = `${projectProps.partNumber || 'Blueprint'}_BALLOONED_MARKED.pdf`;
      MarkedPdfExporter.downloadMarkedPdf(markedBytes, defaultName);
    } catch (err) {
      console.error('Failed to generate marked PDF:', err);
      alert('Failed to export marked PDF.');
    } finally {
      setIsLoading(false);
    }
  }, [blueprintDoc, characteristics, balloonAppearance, activeFileId, projectProps]);

  // When a characteristic or balloon is selected
  const handleSelectCharacteristic = useCallback((char: EngineeringCharacteristic) => {
    setSelectedCharId(char.id);
    const targetSheetIndex = char.sheetNumber - 1;
    if (targetSheetIndex !== activeSheetIndex && targetSheetIndex >= 0 && blueprintDoc && targetSheetIndex < blueprintDoc.numSheets) {
      setActiveSheetIndex(targetSheetIndex);
    }
  }, [activeSheetIndex, blueprintDoc]);

  // Update characteristic in state with live measurement evaluation & audit logging
  const handleUpdateCharacteristic = useCallback((updated: EngineeringCharacteristic) => {
    const evalRes = MeasurementEngine.evaluateMeasurement(updated, updated.measuredValue ?? null);
    const evaluated: EngineeringCharacteristic = {
      ...updated,
      conformanceStatus: evalRes.status,
      deviation: evalRes.deviation
    };

    setCharacteristics((prev) => {
      const oldChar = prev.find(c => c.id === updated.id);
      if (oldChar && oldChar.measuredValue !== evaluated.measuredValue) {
        AuditLedgerService.recordEntry({
          characteristicId: evaluated.id,
          itemNumber: evaluated.itemNumber,
          subNumber: evaluated.subNumber,
          action: 'MEASUREMENT_RECORDED',
          inspectorInitials: evaluated.inspectorInitials || 'INSP',
          previousValue: oldChar.measuredValue,
          newValue: evaluated.measuredValue,
          conformanceStatus: evaluated.conformanceStatus,
          details: `Measurement updated to ${evaluated.measuredValue ?? 'null'} (${evaluated.conformanceStatus})`
        });
      }
      return prev.map((c) => (c.id === evaluated.id ? evaluated : c));
    });
  }, []);

  // Delete characteristic with automatic AS9102 cascade renumbering
  const handleDeleteCharacteristic = useCallback((charId: string) => {
    setCharacteristics((prev) => {
      const renumbered = RenumberingService.deleteAndRenumber(prev, charId);
      setSelectedCharId((currentSelected) => {
        if (currentSelected === charId) {
          return renumbered.length > 0 ? renumbered[0].id : null;
        }
        return currentSelected;
      });
      return renumbered;
    });
  }, []);

  // Manual OCR / Marquee Box Capture
  const handleBoxCapture = useCallback(async (
    box: { x: number; y: number; width: number; height: number },
    pageNumber: number
  ) => {
    try {
      const maxItemNumber = characteristics.reduce((max, c) => Math.max(max, c.itemNumber), 0);
      const nextItemNumber = maxItemNumber + 1;
      const newChar = await AiExtractionService.captureBox(pdfDoc, box, pageNumber, nextItemNumber);
      setCharacteristics((prev) => [...prev, newChar]);
      setSelectedCharId(newChar.id);
      setActiveTool('select');
    } catch (err) {
      console.error('Failed to capture marquee box:', err);
    }
  }, [characteristics, pdfDoc]);

  // Renumber all characteristics sequentially
  const handleRenumberAll = useCallback(() => {
    setCharacteristics((prev) => RenumberingService.cascadeRenumber(prev));
  }, []);

  // Sprint 4: Auto-reposition balloons across all sheets avoiding callout & boundary collisions
  const handleRepositionBalloons = useCallback(() => {
    if (characteristics.length === 0 || !blueprintDoc) return;
    const sheetsMeta = blueprintDoc.sheets.map((s) => ({
      pageNumber: s.pageNumber,
      width: s.width,
      height: s.height
    }));
    const repositioned = SpatialPlacementService.recalculateAllSheets(characteristics, sheetsMeta, true);
    setCharacteristics(repositioned);
  }, [characteristics, blueprintDoc]);

  // Sprint 4: Save LOONIST Self-Contained Project Package (*.loonist)
  const handleSaveProject = useCallback(async () => {
    try {
      const activeCache = activeFileId ? docCacheRef.current.get(activeFileId) : null;
      const pdfBuffer = activeCache?.buffer && activeCache.buffer.byteLength > 0 ? activeCache.buffer : null;
      const fileName = blueprintDoc?.name || 'Inspection_Drawing.pdf';

      const pkg = ProjectArchiveService.createPackage(
        projectProps,
        characteristics,
        blueprintDoc,
        pdfBuffer,
        fileName,
        activeSheetIndex,
        scale,
        rotation
      );

      const serialized = ProjectArchiveService.serialize(pkg);
      const defaultName = `${projectProps.partNumber || 'Project'}_AS9102.loonist`;

      if (window.api?.saveProjectFile) {
        const res = await window.api.saveProjectFile(defaultName, serialized);
        if (!res.cancelled && res.filePath) {
          console.log('Saved LOONIST project to:', res.filePath);
        }
      } else {
        ProjectArchiveService.downloadProject(pkg, defaultName);
      }
    } catch (err) {
      console.error('Failed to save LOONIST project:', err);
      alert('Failed to save project package.');
    }
  }, [activeFileId, blueprintDoc, projectProps, characteristics, activeSheetIndex, scale, rotation]);

  // Sprint 4: Open LOONIST Self-Contained Project Package (*.loonist)
  const handleOpenProject = useCallback(async () => {
    try {
      let pkg: LoonistProjectPackage | null = null;

      if (window.api?.loadProjectFile) {
        const res = await window.api.loadProjectFile();
        if (res.cancelled || !res.content) return;
        pkg = ProjectArchiveService.deserialize(res.content);
      } else {
        pkg = await ProjectArchiveService.pickProjectFile();
      }

      if (!pkg) return;

      setIsLoading(true);

      // If project has embedded PDF buffer, load it into PDF viewer
      if (pkg.pdfBase64 && loadPdfBufferRef.current) {
        const buffer = ProjectArchiveService.base64ToArrayBuffer(pkg.pdfBase64);
        const pdfName = pkg.pdfFileName || 'blueprint.pdf';
        await loadPdfBufferRef.current(
          buffer,
          pdfName,
          buffer.byteLength,
          'loonist-imported-hash'
        );
      }

      // Restore inspection state from the archive
      setCharacteristics(pkg.characteristics || []);
      setProjectProps(pkg.projectProps);
      if (typeof pkg.activeSheetIndex === 'number') setActiveSheetIndex(pkg.activeSheetIndex);
      if (typeof pkg.scale === 'number') setScale(pkg.scale);
      if (typeof pkg.rotation === 'number') setRotation(pkg.rotation);
      if (pkg.characteristics && pkg.characteristics.length > 0) {
        setSelectedCharId(pkg.characteristics[0].id);
      }
    } catch (err) {
      console.error('Failed to open LOONIST project:', err);
      alert('Failed to open project package. Please verify file format.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Sprint 4: Global Hotkeys (Ctrl+S / Cmd+S to Save, Ctrl+O / Cmd+O to Open)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        void handleSaveProject();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'o') {
        e.preventDefault();
        void handleOpenProject();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSaveProject, handleOpenProject]);

  // Persistent Layout Dimensions (VS Code / Cursor Style)
  const [leftPanelWidth, setLeftPanelWidth] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('loonist_fai_left_panel_width');
      if (saved) {
        const num = Number(saved);
        if (!isNaN(num) && num >= 220 && num <= 950) return num;
      }
    } catch {}
    return 320;
  });

  const [bottomPanelHeight, setBottomPanelHeight] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('loonist_fai_bottom_panel_height');
      if (saved) {
        const num = Number(saved);
        if (!isNaN(num) && num >= 100 && num <= 800) return num;
      }
    } catch {}
    return 220;
  });

  const [isLeftPanelOpen, setIsLeftPanelOpen] = useState(true);
  const [isBottomPanelOpen, setIsBottomPanelOpen] = useState(true);
  const [isLeftPanelMaximized, setIsLeftPanelMaximized] = useState(false);
  const [isBottomPanelMaximized, setIsBottomPanelMaximized] = useState(false);

  // Store pre-maximized normal dimensions so double-clicking restores the exact previous size
  const savedNormalLeftWidthRef = useRef<number>(leftPanelWidth);
  const savedNormalBottomHeightRef = useRef<number>(bottomPanelHeight);
  const lastOpenPanelsRef = useRef({ left: true, bottom: true });

  const handleLeftWidthChange = useCallback((newWidth: number) => {
    setIsLeftPanelMaximized(false);
    savedNormalLeftWidthRef.current = newWidth;
    setLeftPanelWidth(newWidth);
    try {
      localStorage.setItem('loonist_fai_left_panel_width', String(newWidth));
    } catch {}
  }, []);

  const handleBottomHeightChange = useCallback((newHeight: number) => {
    setIsBottomPanelMaximized(false);
    savedNormalBottomHeightRef.current = newHeight;
    setBottomPanelHeight(newHeight);
    try {
      localStorage.setItem('loonist_fai_bottom_panel_height', String(newHeight));
    } catch {}
  }, []);

  // Left Panel Double-Click: Maximize / Restore previous size
  const handleToggleMaximizeLeft = useCallback(() => {
    if (isLeftPanelMaximized) {
      // Restore exact previous width
      const restored = savedNormalLeftWidthRef.current || 320;
      setLeftPanelWidth(restored);
      setIsLeftPanelMaximized(false);
    } else {
      // Save exact current width before maximizing
      savedNormalLeftWidthRef.current = leftPanelWidth;
      // Maximize to ~65% of window width (keeping Drawing Viewer visible)
      const maxTarget = Math.min(950, Math.round(window.innerWidth * 0.65));
      setLeftPanelWidth(maxTarget);
      setIsLeftPanelMaximized(true);
    }
  }, [isLeftPanelMaximized, leftPanelWidth]);

  // Bottom Panel Double-Click: Maximize / Restore previous size
  const handleToggleMaximizeBottom = useCallback(() => {
    if (isBottomPanelMaximized) {
      // Restore exact previous height
      const restored = savedNormalBottomHeightRef.current || 220;
      setBottomPanelHeight(restored);
      setIsBottomPanelMaximized(false);
    } else {
      // Save exact current height before maximizing
      savedNormalBottomHeightRef.current = bottomPanelHeight;
      // Maximize to ~68% of window height (keeping Drawing Viewer visible above)
      const maxTarget = Math.round(window.innerHeight * 0.68);
      setBottomPanelHeight(maxTarget);
      setIsBottomPanelMaximized(true);
    }
  }, [isBottomPanelMaximized, bottomPanelHeight]);

  const handleToggleLeftPanel = useCallback(() => {
    setIsLeftPanelOpen((prev) => !prev);
  }, []);

  const handleToggleBottomPanel = useCallback(() => {
    setIsBottomPanelOpen((prev) => !prev);
  }, []);

  const handleToggleFullDrawing = useCallback(() => {
    if (isLeftPanelOpen || isBottomPanelOpen) {
      lastOpenPanelsRef.current = { left: isLeftPanelOpen, bottom: isBottomPanelOpen };
      setIsLeftPanelOpen(false);
      setIsBottomPanelOpen(false);
    } else {
      setIsLeftPanelOpen(lastOpenPanelsRef.current.left);
      setIsBottomPanelOpen(lastOpenPanelsRef.current.bottom);
    }
  }, [isLeftPanelOpen, isBottomPanelOpen]);

  const currentSheet = blueprintDoc?.sheets[activeSheetIndex] || null;

  return (
    <div className={`flex flex-col w-screen h-screen ${isDarkMode ? 'dark bg-slate-950 text-slate-100' : 'bg-slate-100 text-slate-900'} overflow-hidden font-sans select-none relative transition-colors duration-200`}>
      {isLoading && (
        <div className="absolute top-0 left-0 right-0 h-1 bg-blue-600 animate-pulse z-50" />
      )}
      {/* 1. TOP RIBBON BAR (InspectionXpert Benchmark) */}
      <RibbonBar
        onSmartExtract={handleSmartExtract}
        isExtracting={isExtracting}
        onAddFile={handleOpenBlueprint}
        onSaveProject={handleSaveProject}
        onOpenProject={handleOpenProject}
        onExportExcel={handleExportExcel}
        onExportPdf={handleExportMarkedPdf}
        onRenumberAll={handleRenumberAll}
        activeTool={activeTool}
        onToolChange={setActiveTool}
        onFitPage={handleFitPage}
        onFitWidth={handleFitWidth}
        onRotateClockwise={handleRotateCw}
        onRotateCounterClockwise={handleRotateCcw}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        balloonAppearance={balloonAppearance}
        onUpdateBalloonAppearance={setBalloonAppearance}
        balloonsLocked={balloonsLocked}
        onToggleLockBalloons={() => setBalloonsLocked(!balloonsLocked)}
        projectFiles={projectFiles}
        activeFileId={activeFileId}
        onSelectFile={handleSelectFile}
        onCloseFile={handleCloseFile}
        isLeftPanelOpen={isLeftPanelOpen}
        isBottomPanelOpen={isBottomPanelOpen}
        onToggleLeftPanel={handleToggleLeftPanel}
        onToggleBottomPanel={handleToggleBottomPanel}
        onToggleFullDrawing={handleToggleFullDrawing}
        characteristicsCount={characteristics.length}
        isDrawerOpen={isDrawerOpen}
        onToggleDrawer={() => setIsDrawerOpen((prev) => !prev)}
        isDarkMode={isDarkMode}
        onToggleDarkMode={handleToggleDarkMode}
      />

      {/* 2. MIDDLE SPLIT: LEFT PROPERTIES DOCK + VERTICAL SPLITTER + CENTER VIEWPORT */}
      <div className="flex-1 flex w-full overflow-hidden relative">
        {/* LEFT DOCKABLE PROPERTIES PANEL */}
        {isLeftPanelOpen && (
          <LeftPropertiesDock
            characteristics={characteristics}
            selectedChar={selectedChar}
            onSelectCharacteristic={handleSelectCharacteristic}
            onUpdateCharacteristic={handleUpdateCharacteristic}
            onDeleteCharacteristic={handleDeleteCharacteristic}
            onRenumberAll={handleRenumberAll}
            projectProps={projectProps}
            onUpdateProjectProps={setProjectProps}
            onExportExcel={handleExportExcel}
            hudCropDataUrl={hudCropDataUrl}
            isOpen={isLeftPanelOpen}
            onToggleOpen={setIsLeftPanelOpen}
            width={leftPanelWidth}
            onWidthChange={handleLeftWidthChange}
          />
        )}

        {/* DRAGGABLE RESIZABLE VERTICAL SPLITTER (LEFT PANEL ↔ DRAWING VIEWER) */}
        {isLeftPanelOpen && (
          <VerticalSplitter
            currentWidth={leftPanelWidth}
            onWidthChange={handleLeftWidthChange}
            onToggleMaximize={handleToggleMaximizeLeft}
            minWidth={240}
            maxWidth={Math.min(950, Math.round(window.innerWidth * 0.70))}
          />
        )}

        {/* CENTER CAD VIEWPORT (CANVAS + MULTI-SHEET TABS) */}
        <div className="relative flex-1 h-full overflow-hidden flex flex-col bg-slate-200/60 min-w-0">
          <main className="relative flex-1 w-full overflow-hidden flex items-center justify-center min-h-0">
            {blueprintDoc && currentSheet ? (
              <>
                <ViewportCanvas
                  pdfDoc={pdfDoc}
                  sheet={currentSheet}
                  scale={scale}
                  rotation={rotation}
                  activeTool={activeTool}
                  characteristics={characteristics}
                  selectedCharId={selectedCharId}
                  balloonAppearance={balloonAppearance}
                  onSelectCharacteristic={handleSelectCharacteristic}
                  onUpdateCharacteristic={handleUpdateCharacteristic}
                  onBoxCapture={handleBoxCapture}
                  onScaleChange={setScale}
                  onFpsUpdate={setFps}
                  onCropGenerated={setHudCropDataUrl}
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
                  onRotate={handleRotateCw}
                />
              </>
            ) : (
              /* Empty State Dropzone */
              <div className="flex flex-col items-center justify-center p-8 text-center max-w-lg bg-white border border-slate-200 rounded-lg shadow-sm">
                <div className="w-12 h-12 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center mb-4 text-blue-600">
                  <FileUp className="w-6 h-6" />
                </div>
                <h2 className="text-base font-bold text-slate-900 mb-1">
                  No Engineering Blueprint Loaded
                </h2>
                <p className="text-xs text-slate-500 mb-6 leading-relaxed">
                  Open an aerospace drawing PDF (AS9102 / ASME Y14.5) to view and inspect dimensions.
                </p>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleOpenBlueprint}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs rounded border border-blue-700 shadow-xs transition"
                  >
                    <FileText className="w-4 h-4" />
                    <span>Select Blueprint (.pdf)</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleLoadSample}
                    className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 font-medium text-xs rounded border border-slate-300 shadow-xs transition"
                  >
                    <Zap className="w-4 h-4 text-slate-500" />
                    <span>Load Sample Drawing</span>
                  </button>
                </div>
              </div>
            )}
          </main>

          {/* MULTI-SHEET CAD TABS (Sheet 1 of 2, Sheet 2 of 2) DOCKED AT BOTTOM OF DRAWING VIEWER */}
          {blueprintDoc && (
            <SheetTabs
              sheets={blueprintDoc.sheets}
              activeSheetIndex={activeSheetIndex}
              onSelectSheet={setActiveSheetIndex}
            />
          )}
        </div>
      </div>

      {/* 3. DRAGGABLE RESIZABLE HORIZONTAL SPLITTER (DRAWING VIEWER ↔ BOTTOM PANEL) */}
      {isBottomPanelOpen && (
        <HorizontalSplitter
          currentHeight={bottomPanelHeight}
          onHeightChange={handleBottomHeightChange}
          onToggleMaximize={handleToggleMaximizeBottom}
          minHeight={100}
          maxHeight={Math.round(window.innerHeight * 0.75)}
        />
      )}

      {/* 5. BOTTOM TABLE MANAGER (Characteristics, BOM, Specifications) */}
      {isBottomPanelOpen && (
        <TableManager
          characteristics={characteristics}
          selectedCharId={selectedCharId}
          onSelectCharacteristic={handleSelectCharacteristic}
          onUpdateCharacteristic={handleUpdateCharacteristic}
          onExportExcel={handleExportExcel}
          onDeleteCharacteristic={handleDeleteCharacteristic}
          onRenumberAll={handleRenumberAll}
          onRepositionBalloons={handleRepositionBalloons}
          isOpen={isBottomPanelOpen}
          onToggleOpen={setIsBottomPanelOpen}
          panelHeight={bottomPanelHeight}
          onHeightChange={handleBottomHeightChange}
          isMaximized={isBottomPanelMaximized}
          onToggleMaximize={handleToggleMaximizeBottom}
        />
      )}

      {/* 6. HITL AI CHARACTERISTICS REVIEW DRAWER (Magnified 300 DPI Crop Box) */}
      <ExtractionReviewDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        characteristics={characteristics}
        onUpdateCharacteristics={setCharacteristics}
        onSelectCharacteristic={handleSelectCharacteristic}
        selectedCharId={selectedCharId}
        cropUrl={hudCropDataUrl}
      />
    </div>
  );
}

export default App;
