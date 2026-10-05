import {
  PDFDocument, rgb, StandardFonts, degrees, type PDFPage, type Color,
  moveTo, lineTo, closePath, appendBezierCurve, fillAndStroke,
  setFillingColor, setStrokingColor, setLineWidth, setLineJoin, LineJoinStyle,
  pushGraphicsState, popGraphicsState
} from 'pdf-lib';
import type * as pdfjsLib from 'pdfjs-dist';
import type { EngineeringCharacteristic, BalloonAppearance, BalloonShape } from '../../types/characteristics';
import { formatBalloonNumber } from '../../utils/balloonFormat';

/**
 * Draws the balloon badge outline in the shape the user actually configured (circle, square,
 * triangle, hexagon, or the "balloon" pin silhouette) instead of always burning a circle. Vertex
 * geometry is lifted directly from ViewportCanvas's 36x36 SVG badge (the on-screen source of
 * truth for each shape) so the marked PDF visually matches what the user sees and configures in
 * the app — "s" rescales that geometry's ~16-unit half-extent to the requested badge radius, and
 * the y-component of every offset is negated because the SVG is y-down while pdf-lib's native
 * page space is y-up.
 */
function drawBadgeShape(
  page: PDFPage, shape: BalloonShape, cx: number, cy: number, r: number,
  fillColor: Color, strokeColor: Color, strokeWidth: number
): void {
  if (shape === 'circle') {
    page.drawCircle({ x: cx, y: cy, size: r, color: fillColor, borderColor: strokeColor, borderWidth: strokeWidth });
    return;
  }

  const s = r / 16;
  const pt = (dx: number, dySvg: number): [number, number] => [cx + dx * s, cy - dySvg * s];

  if (shape === 'square') {
    const [x0, y0] = pt(-16, -16);
    const [x1, y1] = pt(16, -16);
    const [x2, y2] = pt(16, 16);
    const [x3, y3] = pt(-16, 16);
    page.pushOperators(
      pushGraphicsState(), setFillingColor(fillColor), setStrokingColor(strokeColor),
      setLineWidth(strokeWidth), setLineJoin(LineJoinStyle.Round),
      moveTo(x0, y0), lineTo(x1, y1), lineTo(x2, y2), lineTo(x3, y3),
      closePath(), fillAndStroke(), popGraphicsState()
    );
    return;
  }

  if (shape === 'triangle') {
    const [x0, y0] = pt(0, -16);
    const [x1, y1] = pt(16, 15);
    const [x2, y2] = pt(-16, 15);
    page.pushOperators(
      pushGraphicsState(), setFillingColor(fillColor), setStrokingColor(strokeColor),
      setLineWidth(strokeWidth), setLineJoin(LineJoinStyle.Round),
      moveTo(x0, y0), lineTo(x1, y1), lineTo(x2, y2),
      closePath(), fillAndStroke(), popGraphicsState()
    );
    return;
  }

  if (shape === 'hexagon') {
    const verts: Array<[number, number]> = [
      pt(-8, -16), pt(8, -16), pt(16, 0), pt(8, 16), pt(-8, 16), pt(-16, 0)
    ];
    page.pushOperators(
      pushGraphicsState(), setFillingColor(fillColor), setStrokingColor(strokeColor),
      setLineWidth(strokeWidth), setLineJoin(LineJoinStyle.Round),
      moveTo(...verts[0]), ...verts.slice(1).map(([x, y]) => lineTo(x, y)),
      closePath(), fillAndStroke(), popGraphicsState()
    );
    return;
  }

  // 'balloon' — the tapered teardrop bulb (string tail omitted; it reads as decorative clutter
  // on a formal marked-up drawing and carries no inspection meaning of its own).
  const start = pt(0, -16.5);
  const c1a = pt(7.5, -16.5), c1b = pt(12, -12), c1e = pt(12, -6);
  const c2a = pt(12, 1), c2b = pt(7, 6.5), c2e = pt(1.5, 9);
  const l1 = pt(4.5, 11.5);
  const l2 = pt(-4.5, 11.5);
  const l3 = pt(-1.5, 9);
  const c3a = pt(-7, 6.5), c3b = pt(-12, 1), c3e = pt(-12, -6);
  const c4a = pt(-12, -12), c4b = pt(-7.5, -16.5), c4e = pt(0, -16.5);
  page.pushOperators(
    pushGraphicsState(), setFillingColor(fillColor), setStrokingColor(strokeColor),
    setLineWidth(strokeWidth), setLineJoin(LineJoinStyle.Round),
    moveTo(...start),
    appendBezierCurve(...c1a, ...c1b, ...c1e),
    appendBezierCurve(...c2a, ...c2b, ...c2e),
    lineTo(...l1), lineTo(...l2), lineTo(...l3),
    appendBezierCurve(...c3a, ...c3b, ...c3e),
    appendBezierCurve(...c4a, ...c4b, ...c4e),
    closePath(), fillAndStroke(), popGraphicsState()
  );
}

/** Vertical text-baseline nudge (in local 36-unit-box units, SVG y-down) matching the per-shape
 * offsets ViewportCanvas applies so the item number sits visually centered in each silhouette —
 * triangle's label sits low (wide base), the balloon's sits high (within the bulb, above the
 * taper). Returned in pdf-lib's y-up page units, already scaled to the badge radius. */
function badgeTextYOffset(shape: BalloonShape, r: number): number {
  const s = r / 16;
  if (shape === 'triangle') return -3 * s;
  if (shape === 'balloon') return 4.5 * s;
  return 0;
}

export interface MarkedPdfExportOptions {
  highlightNonConformance?: boolean; // Color out-of-spec balloons in red
  showLeaderLines?: boolean;
  watermark?: string; // Optional security watermark e.g. "ITAR RESTRICTED"
  balloonPrefix?: string;
}

export class MarkedPdfExporter {
  /**
   * Generates a vector-sharp Marked Blueprint PDF by burning vector balloons,
   * item numbers, leader lines, and conformance markers directly onto original PDF pages.
   */
  public static async generateMarkedPdf(
    pdfBuffer: ArrayBuffer,
    characteristics: EngineeringCharacteristic[],
    appearance?: Partial<BalloonAppearance>,
    options: MarkedPdfExportOptions = { highlightNonConformance: true, showLeaderLines: true },
    pdfJsDoc?: pdfjsLib.PDFDocumentProxy
  ): Promise<Uint8Array> {
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const numPages = pdfDoc.getPageCount();

    // Every characteristic's boundingBox/customBalloonPosition is computed by
    // DrawingExtractionService in pdf.js "viewport" space (top-left origin, y-down, with the
    // PDF's own /Rotate already applied — see page.getViewport({ scale: 1.0 }) there). pdf-lib
    // draws in the page's native, UN-rotated, bottom-left-origin MediaBox space, and
    // page.getSize() does not account for /Rotate at all. For a page with a non-zero intrinsic
    // rotation (common for landscape CAD drawings exported in a portrait page container —
    // see pdfRenderer.ts), naively flipping Y with pageHeight would draw every balloon in the
    // wrong place, up to 90 degrees off from the dimension it's meant to annotate. Build one
    // pdf.js viewport per page (when the caller can give us the already-loaded document) and
    // use its convertToPdfPoint(), which is pdf.js's own purpose-built inverse of that same
    // transform, instead of re-deriving the rotation math by hand.
    const pageViewports: Array<pdfjsLib.PageViewport | null> = [];
    if (pdfJsDoc) {
      for (let i = 0; i < numPages; i++) {
        try {
          const jsPage = await pdfJsDoc.getPage(i + 1);
          pageViewports.push(jsPage.getViewport({ scale: 1.0 }));
        } catch {
          pageViewports.push(null);
        }
      }
    }

    const fit = appearance?.fit ?? 2;
    const badgeRadius = fit === 1 ? 10 : fit === 3 ? 15 : 12;
    const badgeFontSize = fit === 1 ? 7 : fit === 3 ? 10 : 8.5;

    // Color definitions
    const whiteColor = rgb(1, 1, 1);
    const failRed = rgb(0.85, 0.15, 0.15);      // Reject red
    const marginalAmber = rgb(0.90, 0.55, 0.05); // Marginal amber
    const passGreen = rgb(0.10, 0.65, 0.30);    // Pass green
    const borderDark = rgb(0.15, 0.20, 0.30);
    const primaryBlue = appearance?.color === 'red' ? failRed :
      appearance?.color === 'green' ? passGreen :
      appearance?.color === 'amber' ? marginalAmber :
      appearance?.color === 'black' ? borderDark :
      rgb(0.10, 0.40, 0.85); // LOONIST aerospace blue

    for (const char of characteristics) {
      const pageIndex = char.sheetNumber - 1;
      if (pageIndex < 0 || pageIndex >= numPages) continue;

      // Clean Canvas Rule: Skip burning balloons for secondary sub-characteristics and general notes
      if (char.skipBalloonRender && (char.parentCharacteristicId || !appearance?.balloonGeneralNotes)) {
        continue;
      }

      const page = pdfDoc.getPage(pageIndex);
      const { height: pageHeight } = page.getSize();
      const viewport = pageViewports[pageIndex];

      const box = char.boundingBox || (char as any).calloutBoundingBox || { x: 50, y: 50, width: 40, height: 20 };

      // Viewport coordinates (Top-Left origin)
      const balloonX = char.customBalloonPosition
        ? char.customBalloonPosition.x
        : Math.max(12, box.x - 30);
      const balloonY = char.customBalloonPosition
        ? char.customBalloonPosition.y
        : Math.max(12, box.y + box.height / 2 - 14);

      // Convert from pdf.js viewport space to pdf-lib's native page space. When we have the
      // page's viewport, convertToPdfPoint() handles the rotation-aware transform correctly;
      // otherwise fall back to the old rotation-naive flip (only correct for /Rotate 0 pages).
      let badgeCenterX: number, badgeCenterY: number, calloutCenterX: number, calloutCenterY: number;
      if (viewport) {
        [badgeCenterX, badgeCenterY] = viewport.convertToPdfPoint(balloonX + badgeRadius, balloonY + badgeRadius);
        [calloutCenterX, calloutCenterY] = viewport.convertToPdfPoint(box.x + box.width / 2, box.y + box.height / 2);
      } else {
        badgeCenterX = balloonX + badgeRadius;
        badgeCenterY = pageHeight - (balloonY + badgeRadius);
        calloutCenterX = box.x + box.width / 2;
        calloutCenterY = pageHeight - (box.y + box.height / 2);
      }

      // 1. Draw SVG/Vector Leader Line if balloon was repositioned away from callout
      const dist = Math.hypot(badgeCenterX - calloutCenterX, badgeCenterY - calloutCenterY);
      const showLeader = options.showLeaderLines ?? (appearance?.showLeaderLine ?? true);

      if (showLeader && dist > badgeRadius + 10) {
        // Compute edge intersection of balloon circle to prevent line piercing through badge
        const angle = Math.atan2(calloutCenterY - badgeCenterY, calloutCenterX - badgeCenterX);
        const lineStartX = badgeCenterX + Math.cos(angle) * badgeRadius;
        const lineStartY = badgeCenterY + Math.sin(angle) * badgeRadius;

        page.drawLine({
          start: { x: lineStartX, y: lineStartY },
          end: { x: calloutCenterX, y: calloutCenterY },
          thickness: 1.2,
          color: primaryBlue,
          opacity: 0.85
        });

        // Small anchor dot on the dimension callout
        page.drawCircle({
          x: calloutCenterX,
          y: calloutCenterY,
          size: 2.0,
          color: primaryBlue
        });
      }

      // 2. Determine badge border & fill colors based on inspection status
      let badgeStrokeColor = primaryBlue;
      if (options.highlightNonConformance) {
        if (char.conformanceStatus === 'FAIL') {
          badgeStrokeColor = failRed;
        } else if (char.conformanceStatus === 'MARGINAL') {
          badgeStrokeColor = marginalAmber;
        } else if (char.conformanceStatus === 'PASS') {
          badgeStrokeColor = passGreen;
        }
      }

      // Badge shape resolution — must mirror ViewportCanvas exactly (same precedence: per-balloon
      // override, then an explicit non-circle global shape forces every balloon to it, then the
      // circle default auto-varies by characteristic type) or the marked PDF silently diverges
      // from what the user configured and sees on screen.
      const isFlagNote = char.subType === 'FlagNote';
      const isBasic = char.isBasic;
      const resolvedShape: BalloonShape = char.customBalloonShape || (appearance?.shape
        ? (appearance.shape === 'circle'
            ? (isFlagNote ? 'triangle' : isBasic ? 'square' : 'circle')
            : appearance.shape)
        : (isFlagNote ? 'triangle' : isBasic ? 'square' : 'circle'));

      // White solid background badge (masks out drawing background under it)
      drawBadgeShape(page, resolvedShape, badgeCenterX, badgeCenterY, badgeRadius, whiteColor, badgeStrokeColor, 1.8);

      // 3. Draw Centered Characteristic / Balloon Number
      const itemLabel = formatBalloonNumber(char.itemNumber, char.subNumber, options.balloonPrefix);
      const textWidth = font.widthOfTextAtSize(itemLabel, badgeFontSize);
      const textHeight = font.heightAtSize(badgeFontSize);

      page.drawText(itemLabel, {
        x: badgeCenterX - textWidth / 2,
        y: badgeCenterY - textHeight / 3 + badgeTextYOffset(resolvedShape, badgeRadius),
        size: badgeFontSize,
        font: font,
        color: char.conformanceStatus === 'FAIL' ? failRed : borderDark
      });
    }

    // 2. Draw Diagonal Security Watermark across all pages if configured
    if (options.watermark && options.watermark !== 'NONE') {
      const wmText = options.watermark;
      for (let p = 0; p < numPages; p++) {
        const page = pdfDoc.getPage(p);
        const { width: pw, height: ph } = page.getSize();
        const wmSize = Math.max(18, Math.min(pw, ph) * 0.05);
        const textWidth = font.widthOfTextAtSize(wmText, wmSize);
        page.drawText(wmText, {
          x: Math.max(20, (pw - textWidth) / 2),
          y: ph / 2,
          size: wmSize,
          font: font,
          color: rgb(0.85, 0.20, 0.20),
          opacity: 0.18,
          rotate: degrees(35)
        });
      }
    }

    return await pdfDoc.save();
  }

  /**
   * Browser file download helper
   */
  public static downloadMarkedPdf(pdfBytes: Uint8Array, fileName: string): void {
    const blob = new Blob([pdfBytes as unknown as BlobPart], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}
