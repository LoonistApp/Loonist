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
import { DrawingExtractionService } from './services/ai/drawingExtractionService';
import { As9102ExcelExporter } from './services/export/as9102ExcelExporter';
import { fillExcelTemplate, buildProjectValues, buildCharacteristicValues } from './services/export/excelTemplateFiller';
import { templateFileStore } from './services/export/templateFileStore';
import { BUILT_IN_TEMPLATE_ID } from './types/applicationOptions';
import { MarkedPdfExporter } from './services/export/markedPdfExporter';
import { AuditLedgerService } from './services/compliance/auditLedgerService';
import { evaluateExportReadiness } from './services/validation/characteristicExportGate';
import { MeasurementEngine } from './services/compliance/measurementEngine';
import { RenumberingService } from './services/ballooning/renumberingService';
import { ProjectArchiveService, type LoonistProjectPackage } from './services/project/projectArchiveService';
import { SpatialPlacementService } from './services/ballooning/spatialPlacementService';
import { 
  type EngineeringCharacteristic, 
  type ProjectProperties, 
  type BalloonAppearance,
  DEFAULT_AEROSPACE_TOLERANCES 
} from './types/characteristics';
import { DEFAULT_PROJECT_SETTINGS, type ProjectSettings } from './types/settings';
import { getPersistentSetting, setPersistentSetting } from './utils/persistentSettings';
import { DEFAULT_METRIC_ISO_TOLERANCES, ToleranceEngine } from './services/ai/toleranceEngine';
import type { BlueprintDocument, ViewportTool } from './types/blueprint';
import { ExportModal } from './components/layout/ExportModal';
import { showLoonistDialog } from './utils/dialog';
import { useApplicationOptions } from './stores/useApplicationOptionsStore';
import { CloudflareLicenseClient } from './services/license/licenseClient';

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
  const [appOptions] = useApplicationOptions();

  // Verify the stored license offline on start-up (signature, device binding, expiry)
  useEffect(() => {
    CloudflareLicenseClient.refreshStatus().catch(err => console.warn('License verification failed:', err));
  }, []);

  // Load the persisted audit ledger so prior-session history is visible, not just this session's entries
  useEffect(() => {
    void AuditLedgerService.hydrate();
  }, []);
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [blueprintDoc, setBlueprintDoc] = useState<BlueprintDocument | null>(null);
  const [activeSheetIndex, setActiveSheetIndex] = useState(0);
  const [scale, setScale] = useState(1.0);
  const [rotation, setRotation] = useState(0);
  const [activeTool, setActiveTool] = useState<ViewportTool>('pan');
  const [isLoading, setIsLoading] = useState(false);
  const [fps, setFps] = useState(60);
  const [isDraggingFileOver, setIsDraggingFileOver] = useState(false);

  // Multi-Document Project Ingestion State (InspectionXpert Benchmark)
  const [projectFiles, setProjectFiles] = useState<Array<{ id: string; name: string; type: 'pdf' | 'dwg' | 'catpart'; filePath?: string }>>([]);
  const [activeFileId, setActiveFileId] = useState<string>('');
  const docCacheRef = useRef<Map<string, DocumentCacheItem>>(new Map());

  // Inspection & Characteristic State
  const [characteristics, setCharacteristics] = useState<EngineeringCharacteristic[]>([]);
  const [undoStack, setUndoStack] = useState<EngineeringCharacteristic[][]>([]);
  const [redoStack, setRedoStack] = useState<EngineeringCharacteristic[][]>([]);
  const [selectedCharId, setSelectedCharId] = useState<string | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isInspecting, setIsInspecting] = useState(false);
  const [hasInspectionResults, setHasInspectionResults] = useState(false);
  const [hudCropDataUrl, setHudCropDataUrl] = useState<string | null>(null);
  const [isInspectOpen, setIsInspectOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [selectedExportTemplate, setSelectedExportTemplate] = useState('AS9102C.xlt');
  const [tableFilter, setTableFilter] = useState<'all' | 'critical' | 'review'>('all');

  // Aerospace CAD Dark Mode Theme State
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('loonist_theme');
      if (saved) return saved === 'dark';
      return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  // On mount, reconcile with the durable (file-backed) theme setting in case
  // localStorage didn't survive the last app restart.
  useEffect(() => {
    let cancelled = false;
    getPersistentSetting('loonist_theme').then((saved) => {
      if (!cancelled && saved) {
        setIsDarkMode(saved === 'dark');
      }
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      setPersistentSetting('loonist_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      setPersistentSetting('loonist_theme', 'light');
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
    color: 'black',
    showLeaderLine: true
  });
  const [balloonsLocked, setBalloonsLocked] = useState(false);

  // AS9102 Project Properties
  const [projectProps, setProjectProps] = useState<ProjectProperties>({
    partName: '',
    partNumber: '',
    partRevision: '',
    drawingName: '',
    drawingNumber: '',
    drawingRevision: '',
    cageCode: '',
    lotSize: 1,
    samplingLevel: 'II',
    samplingType: 'NORMAL',
    aql: '1.0'
  });

  // Project Settings Subsystem (2-Zone Industrial Defaults & Persistence)
  const [projectSettings, setProjectSettings] = useState<ProjectSettings>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('loonist_project_settings_default');
        if (saved) {
          const parsed = JSON.parse(saved);
          return { ...DEFAULT_PROJECT_SETTINGS, ...parsed };
        }
      } catch (e) {
        // ignore fallback
      }
    }
    return DEFAULT_PROJECT_SETTINGS;
  });

  // On mount, reconcile with the durable (file-backed) default settings in
  // case localStorage didn't survive the last app restart.
  useEffect(() => {
    let cancelled = false;
    getPersistentSetting('loonist_project_settings_default').then((saved) => {
      if (cancelled || !saved) return;
      try {
        const parsed = JSON.parse(saved);
        setProjectSettings({ ...DEFAULT_PROJECT_SETTINGS, ...parsed });
      } catch {
        // ignore malformed persisted settings
      }
    });
    return () => { cancelled = true; };
  }, []);

  // Handle Project Settings Update with Retroactive Tolerance Recalculation
  const handleUpdateSettings = useCallback((newSettings: ProjectSettings) => {
    setProjectSettings(newSettings);

    // Retroactively recompute title block tolerances for all characteristics inheriting general tolerances
    setCharacteristics((prevChars) => {
      if (prevChars.length === 0) return prevChars;
      return prevChars.map((ch) => {
        if (ch.isToleranceInherited || ch.toleranceSource?.includes('Title Block')) {
          const nominal = ch.cleanNominal !== null ? ch.cleanNominal.toString() : (ch.rawText || '');
          const isAngular = ch.type === 'angle' || (typeof ch.rawText === 'string' && ch.rawText.includes('°'));
          const resolved = ToleranceEngine.resolveTitleBlockTolerance(nominal, isAngular, newSettings.tolerances);
          const minLim = ch.cleanNominal !== null ? ch.cleanNominal - resolved.lowerTol : null;
          const maxLim = ch.cleanNominal !== null ? ch.cleanNominal + resolved.upperTol : null;
          return {
            ...ch,
            upperTol: resolved.upperTol,
            lowerTol: resolved.lowerTol,
            minLimit: minLim,
            maxLimit: maxLim,
            toleranceSource: resolved.source
          };
        }
        return ch;
      });
    });
  }, []);

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
    if (blueprintDoc) {
      docCacheRef.current.delete(blueprintDoc.name);
      if (blueprintDoc.id) docCacheRef.current.delete(blueprintDoc.id);
    }

    setProjectFiles((prev) => {
      const remaining = prev.filter((f) => f.id !== fileIdToClose && f.name !== fileIdToClose);

      // If no drawings remain in project, reset all drawing and project properties to blank defaults
      if (remaining.length === 0) {
        setPdfDoc(null);
        setBlueprintDoc(null);
        setCharacteristics([]);
        setSelectedCharId(null);
        setActiveFileId('');
        setActiveSheetIndex(0);
        setHudCropDataUrl(null);
        setHasInspectionResults(false);
        setIsInspecting(false);
        docCacheRef.current.clear();
        setProjectProps({
          partName: '',
          partNumber: '',
          partRevision: '',
          drawingName: '',
          drawingNumber: '',
          drawingRevision: '',
          cageCode: '',
          lotSize: 1,
          samplingLevel: 'II',
          samplingType: 'NORMAL',
          aql: '1.0'
        });
      } else if (activeFileId === fileIdToClose || (blueprintDoc && (blueprintDoc.name === fileIdToClose || blueprintDoc.id === fileIdToClose))) {
        // If closed file was currently active, switch to next available drawing
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
    filePath?: string,
    isNewProject: boolean = false
  ) => {
    try {
      setIsLoading(true);

      const fileId = fileName;

      // If starting a new project, reset the document cache and undo/redo stacks
      if (isNewProject) {
        docCacheRef.current.clear();
        setUndoStack([]);
        setRedoStack([]);
        setProjectSettings(DEFAULT_PROJECT_SETTINGS);
      } else {
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

      // 4. Update project files list
      if (isNewProject) {
        setProjectFiles([{ id: fileId, name: fileName, type: 'pdf', filePath }]);
      } else {
        setProjectFiles((prev) => {
          const existingIdx = prev.findIndex((f) => f.name === fileName || f.id === fileId);
          if (existingIdx >= 0) {
            const updated = [...prev];
            updated[existingIdx] = { id: fileId, name: fileName, type: 'pdf', filePath };
            return updated;
          }
          return [...prev, { id: fileId, name: fileName, type: 'pdf', filePath }];
        });
      }

      // 5. Activate in view
      setPdfDoc(loadedDoc);
      setBlueprintDoc(newBlueprintDoc);
      setCharacteristics([]);
      setProjectProps(newProps);
      setSelectedCharId(null);
      setActiveSheetIndex(0);
      setScale(1.0);
      setRotation(0);
      setActiveFileId(fileId);

      // Auto-extract characteristics for the sample blueprint so balloons and table are immediately populated
      if (fileName.includes('Sample') || fileName.includes('AS9102')) {
        try {
          const result = await DrawingExtractionService.extractCharacteristics(loadedDoc, undefined, projectSettings);
          setCharacteristics(result.characteristics);
          setProjectProps(result.projectProps);
          if (result.projectProps?.units && result.projectProps.units !== projectSettings.units) {
            setProjectSettings(prev => ({
              ...prev,
              units: result.projectProps.units!,
              tolerances: result.projectProps.units === 'mm' ? DEFAULT_METRIC_ISO_TOLERANCES : DEFAULT_AEROSPACE_TOLERANCES
            }));
          }
          if (result.characteristics.length > 0) {
            setSelectedCharId(null);
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
      await showLoonistDialog('Error loading PDF blueprint. Please check file format.');
    } finally {
      setIsLoading(false);
    }
  }, [activeFileId, characteristics, projectProps, selectedCharId, activeSheetIndex, scale, rotation, blueprintDoc, pdfDoc, handleSelectFile, projectSettings]);

  useEffect(() => {
    loadPdfBufferRef.current = loadPdfBuffer;
  }, [loadPdfBuffer]);

  // Handler for opening blueprint from native OS file picker
  const handleOpenBlueprint = useCallback(async (options?: { isNewProject?: boolean }) => {
    const isNew = options?.isNewProject ?? false;

    if (window.api?.openBlueprintDialog) {
      const result = await window.api.openBlueprintDialog();
      if (!result.cancelled && result.buffer && result.fileName && result.fileHash) {
        await loadPdfBuffer(
          result.buffer,
          result.fileName,
          result.fileSize || result.buffer.byteLength,
          result.fileHash,
          result.filePath,
          isNew
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
          await loadPdfBuffer(buffer, file.name, file.size, 'local-browser-hash', undefined, isNew);
        }
      };
      input.click();
    }
  }, [loadPdfBuffer]);

  useEffect(() => {
    handleOpenBlueprintRef.current = handleOpenBlueprint;
  }, [handleOpenBlueprint]);

  // Handler for dropping a PDF blueprint directly onto the empty canvas
  const handleCanvasFileDrop = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      await showLoonistDialog('Only PDF blueprint files can be dropped here.');
      return;
    }
    const buffer = await file.arrayBuffer();
    const digest = await crypto.subtle.digest('SHA-256', buffer);
    const fileHash = Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
    await loadPdfBuffer(buffer, file.name, file.size, fileHash, undefined, true);
  }, [loadPdfBuffer]);

  // Handler for New Project - launches file picker without wiping or closing the existing drawing!
  // The existing drawing remains open and active until/unless a new drawing file is imported.
  const handleNewProject = useCallback(() => {
    if (characteristics.length > 0 && !window.confirm('Start a new inspection project? Unsaved changes will be cleared upon importing a new drawing.')) {
      return;
    }
    void handleOpenBlueprint({ isNewProject: true });
  }, [characteristics.length, handleOpenBlueprint]);

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

  const [extractScope, setExtractScope] = useState<'active' | 'all'>('active');

  // Smart Extract Handler (Auto-Ballooning)
  const handleSmartExtract = useCallback(async (scopeOverride?: 'active' | 'all') => {
    if (!pdfDoc) return;
    const scope = scopeOverride || extractScope;
    try {
      setIsExtracting(true);
      const targetSheet = scope === 'active' ? (activeSheetIndex + 1) : undefined;
      const result = await DrawingExtractionService.extractCharacteristics(
        pdfDoc,
        undefined,
        projectSettings,
        targetSheet,
        characteristics
      );
      setCharacteristics(result.characteristics);
      setProjectProps(prev => ({ ...prev, ...result.projectProps }));
      if (result.projectProps?.units && result.projectProps.units !== projectSettings.units) {
        setProjectSettings(prev => ({
          ...prev,
          units: result.projectProps.units!,
          tolerances: result.projectProps.units === 'mm' ? DEFAULT_METRIC_ISO_TOLERANCES : DEFAULT_AEROSPACE_TOLERANCES
        }));
      }

      // Do NOT auto-select characteristic; keep side panel on Project overview
      setSelectedCharId(null);

      // If active sheet was extracted and 0 characteristics found on it:
      if (targetSheet) {
        const sheetChars = result.characteristics.filter(c => c.sheetNumber === targetSheet);
        if (sheetChars.length === 0) {
          await showLoonistDialog(
            `Sheet ${targetSheet} was recognized as an introductory/cover page or contains no dimensional callouts.`
          );
        }
      }
    } catch (err) {
      console.error('Failed to run Smart Extract:', err);
      await showLoonistDialog('Failed to extract characteristics. Please verify PDF stream.');
    } finally {
      setIsExtracting(false);
    }
  }, [pdfDoc, projectSettings, activeSheetIndex, characteristics, extractScope]);

  // Top Action: Run Inspection Analysis (Generates/Refreshes Results, does NOT open panel directly)
  const handleRunInspection = useCallback(async () => {
    if (!blueprintDoc && !pdfDoc) {
      await showLoonistDialog('Please load an engineering drawing first.');
      return;
    }

    // Must balloon/extract characteristics first
    if (characteristics.length === 0) {
      await showLoonistDialog(
        'No inspection characteristics found.\nRun Smart Extract or manually add balloons before starting the inspection.'
      );
      return;
    }

    try {
      setIsInspecting(true);

      // Re-evaluate every characteristic's measurement conformance against engineering tolerances
      const analyzed = characteristics.map((char) => {
        const evalRes = MeasurementEngine.evaluateMeasurement(char, char.measuredValue ?? null);
        return {
          ...char,
          conformanceStatus: evalRes.status,
          deviation: evalRes.deviation,
          verificationStatus: char.verificationStatus || 'verified'
        };
      });

      // CAD action processing delay for visual responsiveness
      await new Promise((resolve) => setTimeout(resolve, 600));

      setCharacteristics(analyzed);
      setHasInspectionResults(true);

      // Record audit ledger entry
      AuditLedgerService.recordEntry({
        characteristicId: 'BATCH_INSPECT',
        itemNumber: 0,
        subNumber: '0',
        action: 'INSPECTION_RUN',
        details: `Inspection analysis executed on ${analyzed.length} characteristics.`
      });
    } catch (err) {
      console.error('Failed to run inspection:', err);
      await showLoonistDialog('Failed to run inspection analysis.');
    } finally {
      setIsInspecting(false);
    }
  }, [blueprintDoc, pdfDoc, characteristics]);

  // Export to AS9102 Excel / CSV Handler
  // Blocks a customer-facing export unless every characteristic is either reviewed or exempt
  // (reference/basic dimensions are informational-only and never physically measured). A user
  // who explicitly overrides is recorded in the audit ledger — an override is part of the
  // permanent record, never a silent bypass.
  const confirmExportReadiness = useCallback((exportLabel: string): boolean => {
    const { blockers } = evaluateExportReadiness(characteristics);
    if (blockers.length === 0) return true;

    const proceed = window.confirm(
      `${blockers.length} characteristic${blockers.length === 1 ? '' : 's'} still need${blockers.length === 1 ? 's' : ''} review or measurement before this ${exportLabel} reflects verified inspection data.\n\n` +
      `Exporting now will include unverified/unmeasured values in a customer-facing document.\n\n` +
      `Export anyway?`
    );

    if (proceed) {
      AuditLedgerService.recordEntry({
        action: 'REPORT_EXPORTED',
        details: `${exportLabel} exported with ${blockers.length} unresolved characteristic(s) (needs_review or unmeasured), overridden by explicit user acknowledgment.`
      });
    }

    return proceed;
  }, [characteristics]);

  const handleExportExcel = useCallback(async (format: 'xlsx' | 'csv' = 'xlsx') => {
    if (characteristics.length === 0) {
      showLoonistDialog('Please run Smart Extract or add characteristics before exporting.');
      return;
    }
    if (!confirmExportReadiness('AS9102 report')) {
      return;
    }
    if (format === 'csv') {
      As9102ExcelExporter.exportToCsv(
        characteristics,
        projectProps,
        `${projectProps.partNumber || 'AS9102'}_Characteristics.csv`
      );
      return;
    }

    const fileName = `${projectProps.partNumber || 'AS9102'}_FAIR_Report.xlsx`;
    const { activeTemplateId, templates } = appOptions.templates;
    const customTemplate = templates.find(t => t.id === activeTemplateId && t.isCustom);
    if (!customTemplate || activeTemplateId === BUILT_IN_TEMPLATE_ID) {
      As9102ExcelExporter.exportToExcel(characteristics, projectProps, fileName);
      return;
    }

    try {
      const templateBytes = await templateFileStore.load(customTemplate.id);
      if (!templateBytes) {
        await showLoonistDialog(
          `The template file for "${customTemplate.name}" is missing. The report was exported with the built-in AS9102 layout instead. Re-upload the template in Options → Templates.`
        );
        As9102ExcelExporter.exportToExcel(characteristics, projectProps, fileName);
        return;
      }
      const filled = fillExcelTemplate(
        templateBytes,
        buildProjectValues(projectProps, characteristics.length),
        characteristics.map(buildCharacteristicValues)
      );
      As9102ExcelExporter.downloadXlsx(filled, fileName);
    } catch (err) {
      console.error('Custom template export failed:', err);
      await showLoonistDialog(
        `Could not fill the template "${customTemplate.name}". Check that it opens in Excel, or switch back to the built-in template in Options → Templates.`
      );
    }
  }, [characteristics, projectProps, appOptions.templates, confirmExportReadiness]);

  // Vector Marked Blueprint PDF Exporter (pdf-lib)
  const handleExportMarkedPdf = useCallback(async () => {
    if (!blueprintDoc || characteristics.length === 0) {
      await showLoonistDialog('Please load a blueprint and characteristics before exporting marked PDF.');
      return;
    }
    if (!confirmExportReadiness('marked-up PDF')) {
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
        balloonAppearance,
        {
          highlightNonConformance: true,
          showLeaderLines: true,
          watermark: projectSettings.watermark
        }
      );

      const defaultName = `${projectProps.partNumber || 'Blueprint'}_BALLOONED_MARKED.pdf`;
      MarkedPdfExporter.downloadMarkedPdf(markedBytes, defaultName);
    } catch (err) {
      console.error('Failed to generate marked PDF:', err);
      await showLoonistDialog('Failed to export marked PDF.');
    } finally {
      setIsLoading(false);
    }
  }, [blueprintDoc, characteristics, balloonAppearance, activeFileId, projectProps, confirmExportReadiness]);

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

    // Captured via an object property (not a reassigned `let`) outside the updater so the updater
    // itself stays pure (React may invoke it more than once, e.g. under StrictMode) — the audit
    // side effect fires exactly once, after commit.
    const captured: { changed: { oldValue: number | null | undefined } | null } = { changed: null };

    setCharacteristics((prev) => {
      const oldChar = prev.find(c => c.id === updated.id);
      if (oldChar && oldChar.measuredValue !== evaluated.measuredValue) {
        captured.changed = { oldValue: oldChar.measuredValue };
      }
      return prev.map((c) => (c.id === evaluated.id ? evaluated : c));
    });

    if (captured.changed) {
      AuditLedgerService.recordEntry({
        characteristicId: evaluated.id,
        itemNumber: evaluated.itemNumber,
        subNumber: evaluated.subNumber,
        action: 'MEASUREMENT_RECORDED',
        inspectorInitials: evaluated.inspectorInitials,
        previousValue: captured.changed.oldValue,
        newValue: evaluated.measuredValue,
        conformanceStatus: evaluated.conformanceStatus,
        details: `Measurement updated to ${evaluated.measuredValue ?? 'null'} (${evaluated.conformanceStatus})`
      });
    }
  }, []);

  // Delete characteristic with automatic AS9102 cascade renumbering
  const handleDeleteCharacteristic = useCallback((charId: string) => {
    setCharacteristics((prev) => {
      setUndoStack((u) => [...u.slice(-30), prev]);
      setRedoStack([]);
      const renumbered = RenumberingService.deleteAndRenumber(prev, charId);
      setSelectedCharId((currentSelected) => {
        if (currentSelected === charId) {
          const nextOnSheet = renumbered.find((c) => c.sheetNumber === activeSheetIndex + 1);
          if (!nextOnSheet) {
            setHudCropDataUrl(null);
          }
          return nextOnSheet ? nextOnSheet.id : null;
        }
        return currentSelected;
      });
      return renumbered;
    });
  }, [activeSheetIndex]);

  // Manual OCR / Marquee Box Capture
  const handleBoxCapture = useCallback(async (
    box: { x: number; y: number; width: number; height: number },
    pageNumber: number,
    cropCanvas?: HTMLCanvasElement
  ) => {
    try {
      const maxItemNumber = characteristics.reduce((max, c) => Math.max(max, c.itemNumber), 0);
      const nextItemNumber = maxItemNumber + 1;
      const newChar = await DrawingExtractionService.captureBox(pdfDoc, box, pageNumber, nextItemNumber, cropCanvas, projectSettings);
      setUndoStack((u) => [...u.slice(-30), characteristics]);
      setRedoStack([]);
      setCharacteristics((prev) => [...prev, newChar]);
      setSelectedCharId(newChar.id);
      if (cropCanvas) {
        try {
          setHudCropDataUrl(cropCanvas.toDataURL());
        } catch {}
      }
    } catch (err: any) {
      console.warn('Marquee box capture rejected:', err);
      if (err?.message) {
        await showLoonistDialog(err.message, 'Non-Inspectable Area');
      }
      setActiveTool('select');
    }
  }, [characteristics, pdfDoc]);

  // Renumber all characteristics sequentially
  const handleRenumberAll = useCallback(() => {
    setCharacteristics((prev) => {
      setUndoStack((u) => [...u.slice(-30), prev]);
      setRedoStack([]);
      return RenumberingService.cascadeRenumber(prev);
    });
  }, []);

  // Sprint 4: Auto-reposition balloons across all sheets avoiding callout & boundary collisions
  const handleRepositionBalloons = useCallback(() => {
    if (characteristics.length === 0 || !blueprintDoc) return;
    const sheetsMeta = blueprintDoc.sheets.map((s) => ({
      pageNumber: s.pageNumber,
      width: s.width,
      height: s.height
    }));
    setUndoStack((u) => [...u.slice(-30), characteristics]);
    setRedoStack([]);
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
        rotation,
        projectSettings
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
      await showLoonistDialog('Failed to save project package.');
    }
  }, [activeFileId, blueprintDoc, projectProps, characteristics, activeSheetIndex, scale, rotation, projectSettings]);

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
      if (pkg.settings) {
        setProjectSettings(pkg.settings);
      }
      if (typeof pkg.activeSheetIndex === 'number') setActiveSheetIndex(pkg.activeSheetIndex);
      if (typeof pkg.scale === 'number') setScale(pkg.scale);
      if (typeof pkg.rotation === 'number') setRotation(pkg.rotation);
      if (pkg.characteristics && pkg.characteristics.length > 0) {
        setSelectedCharId(pkg.characteristics[0].id);
      }
    } catch (err) {
      console.error('Failed to open LOONIST project:', err);
      await showLoonistDialog('Failed to open project package. Please verify file format.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Undo & Redo System
  const handleUndo = useCallback(() => {
    setUndoStack((prevUndo) => {
      if (prevUndo.length === 0) return prevUndo;
      const previous = prevUndo[prevUndo.length - 1];
      const newUndo = prevUndo.slice(0, -1);
      setRedoStack((prevRedo) => [...prevRedo, characteristics]);
      setCharacteristics(previous);
      return newUndo;
    });
  }, [characteristics]);

  const handleRedo = useCallback(() => {
    setRedoStack((prevRedo) => {
      if (prevRedo.length === 0) return prevRedo;
      const next = prevRedo[prevRedo.length - 1];
      const newRedo = prevRedo.slice(0, -1);
      setUndoStack((prevUndo) => [...prevUndo, characteristics]);
      setCharacteristics(next);
      return newRedo;
    });
  }, [characteristics]);

  // Sprint 4: Global Hotkeys (Ctrl+S to Save, Ctrl+O to Open, Ctrl+W to Close, Ctrl+Z / Ctrl+Y for Undo/Redo, Alt+F4 to Close Window)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        void handleSaveProject();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'o') {
        e.preventDefault();
        void handleOpenBlueprint();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        handleNewProject();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'w') {
        e.preventDefault();
        if (activeFileId) {
          handleCloseFile(activeFileId);
        } else if (blueprintDoc) {
          handleCloseFile(blueprintDoc.id || blueprintDoc.name);
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      } else if (e.altKey && e.key === 'F4') {
        e.preventDefault();
        if (window.api?.closeWindow) {
          void window.api.closeWindow();
        } else {
          window.close();
        }
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        const activeTag = (document.activeElement?.tagName || '').toLowerCase();
        if (activeTag !== 'input' && activeTag !== 'textarea' && selectedCharId) {
          e.preventDefault();
          handleDeleteCharacteristic(selectedCharId);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
  }, [handleSaveProject, handleOpenProject, activeFileId, blueprintDoc, handleCloseFile, selectedCharId, handleDeleteCharacteristic, handleUndo, handleRedo, handleNewProject, handleOpenBlueprint]);

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

  const handleToggleInspector = useCallback(() => {
    if (isLeftPanelOpen && isInspectOpen) {
      setIsInspectOpen(false);
    } else {
      setIsLeftPanelOpen(true);
      setIsInspectOpen(true);
      if (leftPanelWidth < 380) {
        setLeftPanelWidth(420);
      }
    }
  }, [isLeftPanelOpen, isInspectOpen, leftPanelWidth]);

  const handleCloseInspector = useCallback(() => {
    setIsInspectOpen(false);
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

  const handleResetLayout = useCallback(() => {
    handleLeftWidthChange(320);
    handleBottomHeightChange(220);
    setIsLeftPanelOpen(true);
    setIsBottomPanelOpen(true);
  }, [handleLeftWidthChange, handleBottomHeightChange]);

  const currentSheet = blueprintDoc?.sheets[activeSheetIndex] || null;

  return (
    <div className={`flex flex-col w-screen h-screen ${isDarkMode ? 'dark text-slate-100' : 'bg-slate-100 text-slate-900'} overflow-hidden font-sans select-none relative transition-colors duration-200`}>
      {isLoading && (
        <div className="absolute top-0 left-0 right-0 h-1 bg-slate-900 animate-pulse z-50" />
      )}
      {/* 1. TOP RIBBON BAR (Desktop Engineering Ribbon System) */}
      <RibbonBar
        onSmartExtract={handleSmartExtract}
        isExtracting={isExtracting}
        extractScope={extractScope}
        onSetExtractScope={setExtractScope}
        onSaveProject={handleSaveProject}
        onOpenProject={handleOpenProject}
        onExportExcel={handleExportExcel}
        onExportPdf={handleExportMarkedPdf}
        onRenumberAll={handleRenumberAll}
        onRepositionBalloons={handleRepositionBalloons}
        onLoadSample={handleLoadSample}
        onNewProject={handleNewProject}
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
        onToggleMaximizeLeft={handleToggleMaximizeLeft}
        onToggleMaximizeBottom={handleToggleMaximizeBottom}
        onResetLayout={handleResetLayout}
        characteristicsCount={characteristics.length}
        characteristics={characteristics}
        selectedCharId={selectedCharId}
        selectedChar={selectedChar}
        onDeleteCharacteristic={handleDeleteCharacteristic}
        blueprintDoc={blueprintDoc}
        activeSheetIndex={activeSheetIndex}
        onSelectSheet={setActiveSheetIndex}
        projectProps={projectProps}
        onUpdateProjectProps={setProjectProps}
        tableFilter={tableFilter}
        onSetTableFilter={setTableFilter}
        settings={projectSettings}
        onUpdateSettings={handleUpdateSettings}
        onRunInspection={handleRunInspection}
        isInspecting={isInspecting}
        hasInspectionResults={hasInspectionResults}
        isDrawerOpen={isLeftPanelOpen && isInspectOpen}
        onToggleDrawer={handleToggleInspector}
        isDarkMode={isDarkMode}
        onToggleDarkMode={handleToggleDarkMode}
        onUndo={handleUndo}
        onRedo={handleRedo}
        canUndo={undoStack.length > 0}
        canRedo={redoStack.length > 0}
      />

      {/* 2. MIDDLE SPLIT: LEFT PROPERTIES DOCK + VERTICAL SPLITTER + CENTER VIEWPORT */}
      <div className="flex-1 flex w-full overflow-hidden relative">
        {/* LEFT DOCKABLE PROPERTIES PANEL */}
        {isLeftPanelOpen && (
          <LeftPropertiesDock
            characteristics={characteristics}
            selectedChar={selectedChar}
            onSelectCharacteristic={handleSelectCharacteristic}
            onClearSelectedCharacteristic={() => setSelectedCharId(null)}
            onUpdateCharacteristic={handleUpdateCharacteristic}
            onUpdateCharacteristics={setCharacteristics}
            onDeleteCharacteristic={handleDeleteCharacteristic}
            onRenumberAll={handleRenumberAll}
            projectProps={projectProps}
            onUpdateProjectProps={setProjectProps}
            onExportExcel={handleExportExcel}
            onExportPdf={handleExportMarkedPdf}
            hasDrawing={Boolean(blueprintDoc)}
            hudCropDataUrl={hudCropDataUrl}
            activeSheetNumber={activeSheetIndex + 1}
            isOpen={isLeftPanelOpen}
            onToggleOpen={setIsLeftPanelOpen}
            width={leftPanelWidth}
            onWidthChange={handleLeftWidthChange}
            isInspectOpen={isInspectOpen}
            onToggleInspect={handleToggleInspector}
            onCloseInspect={handleCloseInspector}
            hasInspectionResults={hasInspectionResults}
            onRunInspection={handleRunInspection}
            isInspecting={isInspecting}
            isExportOpen={isExportModalOpen}
            onOpenExportModal={() => {
              handleCloseInspector();
              setIsExportModalOpen(true);
            }}
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
        <div 
          className="relative flex-1 h-full overflow-hidden flex flex-col min-w-0 transition-all duration-200"
          style={{
            backgroundColor:
              appOptions.workspace.canvasBackground === 'white'
                ? '#f8fafc'
                : appOptions.workspace.canvasBackground === 'blueprint'
                ? '#0b132b'
                : '#141416'
          }}
        >
          <main
            className="relative flex-1 w-full overflow-hidden flex items-center justify-center min-h-0"
            onDragOver={(e) => {
              if (blueprintDoc) return;
              e.preventDefault();
              setIsDraggingFileOver(true);
            }}
            onDragLeave={() => setIsDraggingFileOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDraggingFileOver(false);
              if (blueprintDoc) return;
              const file = e.dataTransfer.files?.[0];
              if (file) void handleCanvasFileDrop(file);
            }}
          >
            {blueprintDoc && currentSheet ? (
              <>
                <ViewportCanvas
                  pdfDoc={pdfDoc}
                  sheet={currentSheet}
                  scale={scale}
                  rotation={rotation}
                  activeTool={activeTool}
                  onToolChange={setActiveTool}
                  characteristics={characteristics}
                  selectedCharId={selectedCharId}
                  balloonAppearance={balloonAppearance}
                  onSelectCharacteristic={handleSelectCharacteristic}
                  onUpdateCharacteristic={handleUpdateCharacteristic}
                  onUpdateCharacteristics={setCharacteristics}
                  onDeleteCharacteristic={handleDeleteCharacteristic}
                  onOpenInspector={() => {
                    setIsLeftPanelOpen(true);
                    setIsInspectOpen(true);
                  }}
                  onBoxCapture={handleBoxCapture}
                  onScaleChange={setScale}
                  onFpsUpdate={setFps}
                  onCropGenerated={setHudCropDataUrl}
                  watermark={projectSettings.watermark}
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
              /* Minimal, Centered Empty-Canvas State */
              <>
                <div 
                  className="absolute inset-0 pointer-events-none opacity-40"
                  style={{
                    backgroundImage:
                      appOptions.workspace.canvasBackground === 'white'
                        ? 'linear-gradient(to right, #cbd5e1 1px, transparent 1px), linear-gradient(to bottom, #cbd5e1 1px, transparent 1px)'
                        : appOptions.workspace.canvasBackground === 'blueprint'
                        ? 'linear-gradient(to right, rgba(56, 189, 248, 0.18) 1px, transparent 1px), linear-gradient(to bottom, rgba(56, 189, 248, 0.18) 1px, transparent 1px)'
                        : 'linear-gradient(to right, rgba(255, 255, 255, 0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(255, 255, 255, 0.05) 1px, transparent 1px)',
                    backgroundSize: '32px 32px'
                  }}
                />
                {isDraggingFileOver && (
                  <div className="absolute inset-4 z-20 rounded-lg border-2 border-dashed border-blue-500 bg-blue-500/10 pointer-events-none" />
                )}
                <div className="relative z-10 flex flex-col items-center justify-center text-center select-none px-6">
                  <h2
                    className="text-sm font-semibold tracking-wide mb-1"
                    style={{
                      color:
                        appOptions.workspace.canvasBackground === 'white'
                          ? '#0f172a'
                          : '#ffffff'
                    }}
                  >
                    No Drawing Loaded
                  </h2>
                  <p
                    className="text-xs font-normal mb-4"
                    style={{
                      color:
                        appOptions.workspace.canvasBackground === 'white'
                          ? '#64748b'
                          : '#ffffff'
                    }}
                  >
                    Open a drawing to begin, or drop a PDF here.
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void handleOpenBlueprint({ isNewProject: true })}
                      className="flex items-center gap-2 px-4 py-2 rounded bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold shadow-xs transition cursor-pointer"
                    >
                      Open Drawing (PDF)
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleOpenProject()}
                      className="flex items-center gap-2 px-4 py-2 rounded bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 text-xs font-semibold shadow-xs transition cursor-pointer"
                    >
                      Open Project (.loonist)
                    </button>
                  </div>
                </div>
              </>
            )}
          </main>

          {/* MULTI-SHEET CAD TABS (Sheet 1 of 2, Sheet 2 of 2) DOCKED AT BOTTOM OF DRAWING VIEWER */}
          {blueprintDoc && (
            <SheetTabs
              sheets={blueprintDoc.sheets}
              activeSheetIndex={activeSheetIndex}
              onSelectSheet={(idx) => {
                setActiveSheetIndex(idx);
                setSelectedCharId((prevId) => {
                  const char = characteristics.find((c) => c.id === prevId);
                  if (char && char.sheetNumber !== idx + 1) {
                    setHudCropDataUrl(null);
                    return null;
                  }
                  return prevId;
                });
              }}
              onExtractSheet={() => handleSmartExtract('active')}
              isExtracting={isExtracting}
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
          filterType={tableFilter}
          onFilterChange={setTableFilter}
          activeSheetNumber={activeSheetIndex + 1}
          totalSheets={blueprintDoc?.numSheets || 1}
        />
      )}

      {/* 6. TOP-LEVEL AS9102 & BLUEPRINT EXPORT DELIVERABLES MODAL */}
      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        onExportExcel={handleExportExcel}
        onExportPdf={handleExportMarkedPdf}
        characteristicsCount={characteristics.length}
        hasDrawing={Boolean(blueprintDoc)}
        selectedTemplate={selectedExportTemplate}
        onSelectTemplate={setSelectedExportTemplate}
      />
    </div>
  );
}

export default App;
