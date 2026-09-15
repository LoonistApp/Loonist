/**
 * Image Pre-Processing Service for Blueprint Vision & OCR Pipeline
 * 
 * Provides high-speed canvas image transformations:
 * 1. Grayscale & Contrast Normalization
 * 2. Background Inversion (handles blue/dark blueprints to ensure black-on-white text)
 * 3. Otsu's Adaptive Threshold Binarization (removes paper noise, grain, and scanner shadows)
 * 4. Deskew Angle Detection & Rectification (-5° to +5° via projection profile variance)
 * 5. Margin Padding (adds clean white boundary margins for optimal OCR bounding)
 */

export interface PreprocessOptions {
  autoDeskew?: boolean;
  binarize?: boolean;
  padding?: number;
  contrastStretch?: boolean;
}

export class ImagePreprocessingService {
  /**
   * Applies Otsu's thresholding to an ImageData buffer, converting to pure black and white.
   */
  public static binarizeImageData(imageData: ImageData): ImageData {
    const data = imageData.data;
    const len = data.length;
    const histogram = new Array(256).fill(0);

    // 1. Calculate grayscale and build histogram
    for (let i = 0; i < len; i += 4) {
      const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
      histogram[gray]++;
    }

    // 2. Otsu's algorithm to find optimal threshold
    const total = len / 4;
    let sum = 0;
    for (let i = 0; i < 256; i++) {
      sum += i * histogram[i];
    }

    let sumB = 0;
    let wB = 0;
    let wF = 0;
    let varMax = 0;
    let threshold1 = 128;
    let threshold2 = 128;

    for (let t = 0; t < 256; t++) {
      wB += histogram[t];
      if (wB === 0) continue;
      wF = total - wB;
      if (wF === 0) break;

      sumB += t * histogram[t];
      const mB = sumB / wB;
      const mF = (sum - sumB) / wF;

      const varBetween = wB * wF * (mB - mF) * (mB - mF);
      if (varBetween > varMax) {
        varMax = varBetween;
        threshold1 = t;
        threshold2 = t;
      } else if (varBetween === varMax && varMax > 0) {
        threshold2 = t;
      }
    }

    const threshold = Math.round((threshold1 + threshold2) / 2);

    // Check if background is dark (e.g. true blueprint or negative scan)
    let darkPixels = 0;
    for (let i = 0; i < len; i += 4) {
      const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
      if (gray < threshold) darkPixels++;
    }
    const isDarkBackground = darkPixels > total * 0.5;

    // 3. Apply threshold (ensure black text on pure white background)
    for (let i = 0; i < len; i += 4) {
      const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
      let val: number;
      if (isDarkBackground) {
        val = gray >= threshold ? 0 : 255;
      } else {
        val = gray < threshold ? 0 : 255;
      }
      data[i] = val;     // R
      data[i + 1] = val; // G
      data[i + 2] = val; // B
      data[i + 3] = 255; // Alpha
    }

    return imageData;
  }

  /**
   * Detects the skew angle (in degrees) of text within an ImageData buffer
   * using Horizontal Projection Profile variance across [-5°, +5°].
   */
  public static detectSkewAngle(imageData: ImageData): number {
    const width = imageData.width;
    const height = imageData.height;
    if (width < 20 || height < 20) return 0;

    const data = imageData.data;
    let bestAngle = 0;
    let maxVariance = -1;

    // Test angles from -4.0° to +4.0° in 0.5° increments
    for (let angle = -4.0; angle <= 4.0; angle += 0.5) {
      const rad = (angle * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);

      const profile = new Array(height).fill(0);

      // Sub-sample pixels for fast <5ms calculation
      const step = Math.max(1, Math.floor(width / 120));
      for (let y = 0; y < height; y += step) {
        for (let x = 0; x < width; x += step) {
          const idx = (y * width + x) * 4;
          const isBlack = data[idx] < 128;
          if (isBlack) {
            // Rotated y-coordinate
            const rotY = Math.round(-x * sin + y * cos);
            if (rotY >= 0 && rotY < height) {
              profile[rotY]++;
            }
          }
        }
      }

      // Compute variance of horizontal projections
      let mean = 0;
      for (let i = 0; i < height; i++) {
        mean += profile[i];
      }
      mean /= height;

      let variance = 0;
      for (let i = 0; i < height; i++) {
        const diff = profile[i] - mean;
        variance += diff * diff;
      }

      if (variance > maxVariance) {
        maxVariance = variance;
        bestAngle = angle;
      }
    }

    return bestAngle;
  }

  /**
   * Preprocesses an HTMLCanvasElement: performs binarization, deskewing, and boundary padding.
   */
  public static preprocessCanvas(
    sourceCanvas: HTMLCanvasElement,
    options: PreprocessOptions = {}
  ): HTMLCanvasElement {
    const {
      autoDeskew = true,
      binarize = true,
      padding = 12
    } = options;

    const width = sourceCanvas.width;
    const height = sourceCanvas.height;

    // Create intermediate working canvas
    const workCanvas = document.createElement('canvas');
    workCanvas.width = width;
    workCanvas.height = height;
    const ctx = workCanvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return sourceCanvas;

    // Draw source
    ctx.drawImage(sourceCanvas, 0, 0);
    let imgData = ctx.getImageData(0, 0, width, height);

    // 1. Otsu Adaptive Binarization
    if (binarize) {
      imgData = this.binarizeImageData(imgData);
      ctx.putImageData(imgData, 0, 0);
    }

    // 2. Deskewing
    let skewAngle = 0;
    if (autoDeskew && width > 40 && height > 40) {
      skewAngle = this.detectSkewAngle(imgData);
    }

    // 3. Final Canvas with padding & optional deskew rotation
    const paddedCanvas = document.createElement('canvas');
    paddedCanvas.width = width + padding * 2;
    paddedCanvas.height = height + padding * 2;
    const padCtx = paddedCanvas.getContext('2d');
    if (!padCtx) return workCanvas;

    // Fill white background
    padCtx.fillStyle = '#ffffff';
    padCtx.fillRect(0, 0, paddedCanvas.width, paddedCanvas.height);

    if (Math.abs(skewAngle) > 0.4) {
      padCtx.save();
      padCtx.translate(paddedCanvas.width / 2, paddedCanvas.height / 2);
      padCtx.rotate((-skewAngle * Math.PI) / 180);
      padCtx.drawImage(workCanvas, -width / 2, -height / 2);
      padCtx.restore();
    } else {
      padCtx.drawImage(workCanvas, padding, padding);
    }

    return paddedCanvas;
  }

  /**
   * Crops a specified sub-rectangle from a source canvas and applies pre-processing.
   */
  public static cropAndPreprocess(
    sourceCanvas: HTMLCanvasElement,
    rect: { x: number; y: number; width: number; height: number },
    options: PreprocessOptions = {}
  ): HTMLCanvasElement {
    const cropW = Math.max(1, Math.round(rect.width));
    const cropH = Math.max(1, Math.round(rect.height));

    const cropCanvas = document.createElement('canvas');
    cropCanvas.width = cropW;
    cropCanvas.height = cropH;
    const ctx = cropCanvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return cropCanvas;

    // Fill white base
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, cropW, cropH);

    // Draw crop from source
    ctx.drawImage(
      sourceCanvas,
      rect.x, rect.y, rect.width, rect.height,
      0, 0, cropW, cropH
    );

    return this.preprocessCanvas(cropCanvas, options);
  }
}
