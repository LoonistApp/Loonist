import type { EngineeringCharacteristic, BoundingBox } from '../../types/characteristics';

export interface BoundingRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CandidatePosition {
  x: number;
  y: number;
  direction: 'W' | 'NW' | 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW';
  penalty: number;
}

export class SpatialPlacementService {
  private static readonly BADGE_SIZE = 28;
  private static readonly BADGE_MARGIN = 12;
  private static readonly SHEET_MARGIN = 12;

  /**
   * Checks if two rectangles intersect (AABB collision test)
   */
  public static checkIntersection(r1: BoundingRect, r2: BoundingRect, buffer: number = 0): boolean {
    return !(
      r2.x > r1.x + r1.width + buffer ||
      r2.x + r2.width < r1.x - buffer ||
      r2.y > r1.y + r1.height + buffer ||
      r2.y + r2.height < r1.y - buffer
    );
  }

  /**
   * Generates candidate placement positions around a characteristic bounding box
   */
  public static getCandidatePositions(
    box: BoundingBox,
    badgeSize: number = SpatialPlacementService.BADGE_SIZE,
    margin: number = SpatialPlacementService.BADGE_MARGIN
  ): CandidatePosition[] {
    const centerX = box.x + box.width / 2;
    const centerY = box.y + box.height / 2;

    return [
      // West (Left) - Aerospace standard default
      {
        x: Math.round(box.x - badgeSize - margin),
        y: Math.round(centerY - badgeSize / 2),
        direction: 'W',
        penalty: 0 // Baseline preferred
      },
      // North (Top) - Preferred for horizontal baseline dimensions
      {
        x: Math.round(centerX - badgeSize / 2),
        y: Math.round(box.y - badgeSize - margin),
        direction: 'N',
        penalty: 15
      },
      // East (Right)
      {
        x: Math.round(box.x + box.width + margin),
        y: Math.round(centerY - badgeSize / 2),
        direction: 'E',
        penalty: 30
      },
      // South (Bottom)
      {
        x: Math.round(centerX - badgeSize / 2),
        y: Math.round(box.y + box.height + margin),
        direction: 'S',
        penalty: 40
      },
      // North-West (Top-Left diagonal)
      {
        x: Math.round(box.x - badgeSize - margin),
        y: Math.round(box.y - badgeSize - margin),
        direction: 'NW',
        penalty: 50
      },
      // North-East (Top-Right diagonal)
      {
        x: Math.round(box.x + box.width + margin),
        y: Math.round(box.y - badgeSize - margin),
        direction: 'NE',
        penalty: 60
      },
      // South-West (Bottom-Left diagonal)
      {
        x: Math.round(box.x - badgeSize - margin),
        y: Math.round(box.y + box.height + margin),
        direction: 'SW',
        penalty: 70
      },
      // South-East (Bottom-Right diagonal)
      {
        x: Math.round(box.x + box.width + margin),
        y: Math.round(box.y + box.height + margin),
        direction: 'SE',
        penalty: 80
      }
    ];
  }

  /**
   * Computes optimal collision-free balloon coordinates for all characteristics on a given sheet.
   */
  public static calculateOptimalPositions(
    characteristics: EngineeringCharacteristic[],
    sheetWidth: number,
    sheetHeight: number,
    sheetNumber: number = 1,
    forceReset: boolean = false
  ): EngineeringCharacteristic[] {
    const sheetChars = characteristics.filter((c) => c.sheetNumber === sheetNumber);
    const otherChars = characteristics.filter((c) => c.sheetNumber !== sheetNumber);

    // List of placed balloons as bounding rectangles
    const placedBalloons: Array<BoundingRect & { charId: string }> = [];

    // All dimension bounding boxes on this sheet act as obstacle obstacles
    const obstacleBoxes: BoundingRect[] = sheetChars.map((c) => ({
      x: c.boundingBox.x,
      y: c.boundingBox.y,
      width: c.boundingBox.width,
      height: c.boundingBox.height
    }));

    const badgeSize = SpatialPlacementService.BADGE_SIZE;
    const sheetMargin = SpatialPlacementService.SHEET_MARGIN;

    const updatedSheetChars = sheetChars.map((char) => {
      // Clean Canvas Rule: Skip balloon placement for notes whose canvas balloon is suppressed
      if (char.skipBalloonRender) {
        return char;
      }

      // If user has explicitly dragged this balloon, respect their custom position unless forceReset is active
      if (!forceReset && char.customBalloonPosition && char.customBalloonPosition.x > 0) {
        placedBalloons.push({
          x: char.customBalloonPosition.x,
          y: char.customBalloonPosition.y,
          width: badgeSize,
          height: badgeSize,
          charId: char.id
        });
        return char;
      }

      // Generate 8 candidate directions
      const candidates = SpatialPlacementService.getCandidatePositions(char.boundingBox, badgeSize);

      let bestCandidate = candidates[0];
      let lowestScore = Infinity;

      for (const cand of candidates) {
        let score = cand.penalty;
        // Evaluate candidate at its actual sheet-bounded coordinates
        const clampedX = Math.max(sheetMargin, Math.min(sheetWidth - badgeSize - sheetMargin, cand.x));
        const clampedY = Math.max(sheetMargin, Math.min(sheetHeight - badgeSize - sheetMargin, cand.y));

        const balloonRect: BoundingRect = {
          x: clampedX,
          y: clampedY,
          width: badgeSize,
          height: badgeSize
        };

        // 1. Boundary Check: Penalize going out of drawing sheet margins
        if (
          cand.x < sheetMargin ||
          cand.y < sheetMargin ||
          cand.x + badgeSize > sheetWidth - sheetMargin ||
          cand.y + badgeSize > sheetHeight - sheetMargin
        ) {
          score += 10000;
        }

        // 2. Obstacle Check: Penalty for overlapping any dimension text box (never overlap own callout text!)
        for (const obs of obstacleBoxes) {
          const isOwnBox =
            obs.x === char.boundingBox.x &&
            obs.y === char.boundingBox.y &&
            obs.width === char.boundingBox.width;

          if (SpatialPlacementService.checkIntersection(balloonRect, obs, 2)) {
            score += isOwnBox ? 3000 : 800;
          }
        }

        // 3. Balloon Collision Check: Severe penalty for overlapping another balloon
        for (const placed of placedBalloons) {
          if (SpatialPlacementService.checkIntersection(balloonRect, placed, 4)) {
            score += 1500;
          }
        }

        if (score < lowestScore) {
          lowestScore = score;
          bestCandidate = { ...cand, x: clampedX, y: clampedY };
        }
      }

      // Lock in chosen coordinates
      const finalX = bestCandidate.x;
      const finalY = bestCandidate.y;

      placedBalloons.push({
        x: finalX,
        y: finalY,
        width: badgeSize,
        height: badgeSize,
        charId: char.id
      });

      return {
        ...char,
        customBalloonPosition: { x: finalX, y: finalY }
      };
    });

    return [...otherChars, ...updatedSheetChars].sort((a, b) => a.itemNumber - b.itemNumber);
  }

  /**
   * Repositions all balloons on all sheets, clearing previous overlaps.
   */
  public static recalculateAllSheets(
    characteristics: EngineeringCharacteristic[],
    sheets: Array<{ pageNumber: number; width: number; height: number }>,
    forceReset: boolean = false
  ): EngineeringCharacteristic[] {
    let result = [...characteristics];
    for (const sheet of sheets) {
      result = SpatialPlacementService.calculateOptimalPositions(
        result,
        sheet.width,
        sheet.height,
        sheet.pageNumber,
        forceReset
      );
    }
    return result;
  }
}
