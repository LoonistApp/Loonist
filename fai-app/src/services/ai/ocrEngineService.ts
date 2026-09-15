import { createWorker, type Worker } from 'tesseract.js';

export interface OcrTextResult {
  text: string;
  rawText: string;
  confidence: number; // 0.0 to 1.0
  box?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface SheetOcrBox {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
}

export class OcrEngineService {
  private static workerInstance: Worker | null = null;
  private static initPromise: Promise<Worker> | null = null;

  /**
   * Initializes or returns the cached local Tesseract.js WebAssembly worker.
   */
  public static async getWorker(): Promise<Worker> {
    if (this.workerInstance) {
      return this.workerInstance;
    }

    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = (async () => {
      try {
        const worker = await createWorker('eng');
        // Whitelist common engineering characters for high precision
        await worker.setParameters({
          tessedit_char_whitelist: '0123456789.+-xX/°ØRrcCA-Za-z(),#:%|= ',
          tessedit_pageseg_mode: '6' as any // Assume a single uniform block of text
        });
        this.workerInstance = worker;
        return worker;
      } catch (err) {
        console.error('Failed to initialize local OCR worker:', err);
        throw err;
      }
    })();

    return this.initPromise;
  }

  /**
   * Normalizes OCR character misinterpretations into standard ASME Y14.5 symbols.
   */
  public static normalizeCadOcr(rawText: string): string {
    let t = rawText.trim();

    // 1. Convert 'O' or 'o' or standalone '0' or 'P' preceding numbers or leading decimal into Diameter symbol 'Ø'
    // e.g. "O.750", "o12.5", "dia 10", "DIA. 25"
    t = t.replace(/\b(?:dia|dia\.)\s*(\.?\d+(?:\.\d+)?)/gi, 'Ø$1');
    t = t.replace(/(?:^|\b)[OoP]\s*(\.?\d+(?:\.\d+)?)/g, 'Ø$1');

    // 2. Tolerance plus-minus normalization
    t = t.replace(/\s*\+\s*-\s*/g, ' ± ');

    // 3. Angular degree symbol: "45c", "30 deg", "45 DEG"
    t = t.replace(/(\d+(?:\.\d+)?)c\b/gi, '$1°');
    t = t.replace(/(\d+(?:\.\d+)?)\s*(?:deg|degrees)\b/gi, '$1°');

    // 4. Feature symbols: Depth, Counterbore, Countersink
    t = t.replace(/\b(?:DEPTH|DP)\s*(\.?\d+(?:\.\d+)?)/gi, '↧ $1');
    t = t.replace(/\b(?:C'BORE|CBORE|CB)\s*(\.?\d+(?:\.\d+)?)/gi, '⌴ $1');
    t = t.replace(/\b(?:C'SINK|CSINK|CS)\s*(\.?\d+(?:\.\d+)?)/gi, '⌵ $1');

    // 5. Clean up redundant spaces
    t = t.replace(/\s+/g, ' ').trim();

    return t;
  }

  /**
   * Performs optical recognition on a cropped image canvas or data URL.
   * Runs a secondary 90° orientation pass if aspect ratio or confidence suggests vertical text.
   */
  public static async recognizeCrop(
    imageSource: HTMLCanvasElement | string
  ): Promise<OcrTextResult> {
    try {
      const worker = await this.getWorker();

      // Pass 1: Horizontal (0°)
      const result0 = await worker.recognize(imageSource);
      const rawText0 = result0.data.text.trim();
      const conf0 = (result0.data.confidence || 0) / 100;

      // If text is clear and has reasonable confidence, return immediately
      if (rawText0.length > 0 && conf0 > 0.65) {
        return {
          rawText: rawText0,
          text: this.normalizeCadOcr(rawText0),
          confidence: conf0
        };
      }

      // Pass 2: Vertical dimension check (rotate 90° clockwise if canvas available)
      if (typeof imageSource !== 'string' && imageSource instanceof HTMLCanvasElement) {
        const w = imageSource.width;
        const h = imageSource.height;

        // If it's taller than wide or conf0 was low, rotate and try 90° pass
        const rotCanvas = document.createElement('canvas');
        rotCanvas.width = h;
        rotCanvas.height = w;
        const ctx = rotCanvas.getContext('2d');
        if (ctx) {
          ctx.translate(h / 2, w / 2);
          ctx.rotate((90 * Math.PI) / 180);
          ctx.drawImage(imageSource, -w / 2, -h / 2);

          const result90 = await worker.recognize(rotCanvas);
          const rawText90 = result90.data.text.trim();
          const conf90 = (result90.data.confidence || 0) / 100;

          if (conf90 > conf0 && rawText90.length > 0) {
            return {
              rawText: rawText90,
              text: this.normalizeCadOcr(rawText90),
              confidence: conf90
            };
          }
        }
      }

      return {
        rawText: rawText0,
        text: this.normalizeCadOcr(rawText0),
        confidence: Math.max(0.1, conf0)
      };
    } catch (err) {
      console.warn('OCR crop recognition failed:', err);
      return {
        rawText: '',
        text: '',
        confidence: 0
      };
    }
  }

  /**
   * Performs full-sheet OCR on a rendered blueprint canvas (scanned paper fallback).
   * Parses line and word bounding boxes.
   */
  public static async recognizeSheet(
    sheetCanvas: HTMLCanvasElement
  ): Promise<SheetOcrBox[]> {
    try {
      const worker = await this.getWorker();
      const result = await worker.recognize(sheetCanvas);

      const boxes: SheetOcrBox[] = [];
      const lines = (result.data as any).lines || [];

      for (const line of lines) {
        const lineText = line.text.trim();
        if (!lineText) continue;

        const normalized = this.normalizeCadOcr(lineText);
        const conf = (line.confidence || 0) / 100;
        const bbox = line.bbox;

        boxes.push({
          text: normalized,
          x: bbox.x0,
          y: bbox.y0,
          width: bbox.x1 - bbox.x0,
          height: bbox.y1 - bbox.y0,
          confidence: conf
        });
      }

      return boxes;
    } catch (err) {
      console.error('Full-sheet OCR recognition failed:', err);
      return [];
    }
  }

  /**
   * Cleanly terminates the OCR worker to release resources.
   */
  public static async terminate(): Promise<void> {
    if (this.workerInstance) {
      try {
        await this.workerInstance.terminate();
      } catch (err) {
        console.warn('Error terminating OCR worker:', err);
      }
      this.workerInstance = null;
      this.initPromise = null;
    }
  }
}
