import * as pdfjsLib from 'pdfjs-dist';
// Configure PDF.js worker using Vite URL resolver
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { SheetMetadata } from '../types/blueprint';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

export class PDFRenderService {
  private static currentRenderTask: pdfjsLib.RenderTask | null = null;

  /**
   * Loads a PDF Document from an ArrayBuffer
   */
  public static async loadDocument(data: ArrayBuffer | Uint8Array): Promise<pdfjsLib.PDFDocumentProxy> {
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(data),
      useSystemFonts: true,
      cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@6.3.289/cmaps/',
      cMapPacked: true,
    });
    return await loadingTask.promise;
  }

  /**
   * Extracts metadata and dimensions for all pages/sheets in the blueprint
   */
  public static async getSheetsMetadata(pdfDoc: pdfjsLib.PDFDocumentProxy): Promise<SheetMetadata[]> {
    const sheets: SheetMetadata[] = [];
    for (let i = 1; i <= pdfDoc.numPages; i++) {
      const page = await pdfDoc.getPage(i);
      const viewport = page.getViewport({ scale: 1.0 });
      sheets.push({
        pageNumber: i,
        width: viewport.width,
        height: viewport.height,
        aspectRatio: viewport.width / viewport.height,
        label: `Sheet ${i} of ${pdfDoc.numPages}`
      });
      page.cleanup();
    }
    return sheets;
  }

  /**
   * Renders a specific sheet onto an HTML5 canvas with sub-pixel sharpness
   */
  public static async renderSheet(
    pdfDoc: pdfjsLib.PDFDocumentProxy,
    sheetNumber: number,
    canvas: HTMLCanvasElement,
    scale: number,
    rotation: number = 0
  ): Promise<void> {
    // 1. Cancel previous in-flight render task and await its rejection to prevent canvas reuse conflicts
    if (this.currentRenderTask) {
      try {
        const previousTask = this.currentRenderTask;
        this.currentRenderTask = null;
        previousTask.cancel();
        await previousTask.promise.catch(() => {});
      } catch {
        // Ignored
      }
    }

    const page = await pdfDoc.getPage(sheetNumber);
    const dpr = window.devicePixelRatio || 1;

    // Viewport matching the requested scale and rotation
    const viewport = page.getViewport({ scale: scale * dpr, rotation });

    // Backing buffer sized for Hi-DPI
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);

    // CSS size matches logical scale
    canvas.style.width = `${Math.floor(viewport.width / dpr)}px`;
    canvas.style.height = `${Math.floor(viewport.height / dpr)}px`;

    const context = canvas.getContext('2d', { alpha: false });
    if (!context) {
      page.cleanup();
      return;
    }

    // High quality rasterization
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';

    const renderContext = {
      canvasContext: context,
      viewport: viewport,
      canvas: canvas,
      intent: 'display' as const,
    };

    const renderTask = page.render(renderContext);
    this.currentRenderTask = renderTask;

    try {
      await renderTask.promise;
    } catch (err: any) {
      if (err?.name !== 'RenderingCancelledException') {
        console.error('PDF Page render error:', err);
      }
    } finally {
      if (this.currentRenderTask === renderTask) {
        this.currentRenderTask = null;
      }
      page.cleanup();
    }
  }

  /**
   * Releases resources and active render tasks
   */
  public static dispose(): void {
    if (this.currentRenderTask) {
      try {
        this.currentRenderTask.cancel();
      } catch {
        // Ignored
      }
      this.currentRenderTask = null;
    }
  }
}
