import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import type { EngineeringCharacteristic, BalloonAppearance } from '../../types/characteristics';

export interface MarkedPdfExportOptions {
  highlightNonConformance?: boolean; // Color out-of-spec balloons in red
  showLeaderLines?: boolean;
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
    options: MarkedPdfExportOptions = { highlightNonConformance: true, showLeaderLines: true }
  ): Promise<Uint8Array> {
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const numPages = pdfDoc.getPageCount();

    const badgeRadius = 12; // 24px diameter badge
    const badgeFontSize = 8;

    // Color definitions
    const whiteColor = rgb(1, 1, 1);
    const primaryBlue = rgb(0.10, 0.40, 0.85); // LOONIST aerospace blue
    const failRed = rgb(0.85, 0.15, 0.15);      // Reject red
    const marginalAmber = rgb(0.90, 0.55, 0.05); // Marginal amber
    const passGreen = rgb(0.10, 0.65, 0.30);    // Pass green
    const borderDark = rgb(0.15, 0.20, 0.30);

    for (const char of characteristics) {
      const pageIndex = char.sheetNumber - 1;
      if (pageIndex < 0 || pageIndex >= numPages) continue;

      const page = pdfDoc.getPage(pageIndex);
      const { height: pageHeight } = page.getSize();

      const box = char.boundingBox || (char as any).calloutBoundingBox || { x: 50, y: 50, width: 40, height: 20 };

      // Viewport coordinates (Top-Left origin)
      const balloonX = char.customBalloonPosition 
        ? char.customBalloonPosition.x 
        : Math.max(12, box.x - 30);
      const balloonY = char.customBalloonPosition 
        ? char.customBalloonPosition.y 
        : Math.max(12, box.y + box.height / 2 - 14);

      // Convert to PDF coordinates (Bottom-Left origin)
      const badgeCenterX = balloonX + badgeRadius;
      const badgeCenterY = pageHeight - (balloonY + badgeRadius);

      const calloutCenterX = box.x + box.width / 2;
      const calloutCenterY = pageHeight - (box.y + box.height / 2);

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

      // White solid background circle (masks out drawing background under balloon)
      page.drawCircle({
        x: badgeCenterX,
        y: badgeCenterY,
        size: badgeRadius,
        color: whiteColor,
        borderColor: badgeStrokeColor,
        borderWidth: 1.8
      });

      // 3. Draw Centered Characteristic / Balloon Number
      const itemLabel = char.subNumber || String(char.itemNumber);
      const textWidth = font.widthOfTextAtSize(itemLabel, badgeFontSize);
      const textHeight = font.heightAtSize(badgeFontSize);

      page.drawText(itemLabel, {
        x: badgeCenterX - textWidth / 2,
        y: badgeCenterY - textHeight / 3,
        size: badgeFontSize,
        font: font,
        color: char.conformanceStatus === 'FAIL' ? failRed : borderDark
      });
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
