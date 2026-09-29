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
  private static readonly BADGE_MARGIN = 22;
  private static readonly SHEET_MARGIN = 14;

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
   * Generates candidate placement positions around a characteristic bounding box.
   * Incorporates drafting geometry:
   * - Horizontal dimensions (dimension line runs W <-> E) favor NW, N, NE, SW, S, SE to avoid line collisions.
   * - Vertical dimensions (dimension line runs N <-> S) favor W, NW, SW, E, NE, SE.
   * - Multi-radius candidate generation allows pulling clear with clean leader lines.
   */
  public static getCandidatePositions(
    box: BoundingBox,
    badgeSize: number = SpatialPlacementService.BADGE_SIZE,
    margin: number = SpatialPlacementService.BADGE_MARGIN,
    isChainNeighbor: boolean = false
  ): CandidatePosition[] {
    const centerX = box.x + box.width / 2;
    const centerY = box.y + box.height / 2;
    const isHorizontal = box.width >= box.height;

    const candidates: CandidatePosition[] = [];

    // Test standard offset and extended pullout offset for crowded regions
    const radii = [
      { m: margin, pBonus: 0 },
      { m: Math.round(margin * 1.6), pBonus: 35 }
    ];

    for (const { m, pBonus } of radii) {
      if (isHorizontal) {
        // Horizontal Dimension: Dimension line and witness arrows run West <-> East.
        // Optimal placement pulls above (NW, N, NE) or below (SW, S, SE) to keep drawing lines crystal clear.
        candidates.push(
          // North-West (Top-Left diagonal) - Standard aerospace clean leader position
          {
            x: Math.round(box.x - badgeSize / 2 - m),
            y: Math.round(box.y - badgeSize - m),
            direction: 'NW',
            penalty: 0 + pBonus
          },
          // North (Top) - Preferred above dimension line
          {
            x: Math.round(centerX - badgeSize / 2),
            y: Math.round(box.y - badgeSize - m),
            direction: 'N',
            penalty: 10 + pBonus
          },
          // North-East (Top-Right diagonal)
          {
            x: Math.round(box.x + box.width - badgeSize / 2 + m),
            y: Math.round(box.y - badgeSize - m),
            direction: 'NE',
            penalty: 15 + pBonus
          },
          // South-West (Bottom-Left diagonal)
          {
            x: Math.round(box.x - badgeSize / 2 - m),
            y: Math.round(box.y + box.height + m),
            direction: 'SW',
            penalty: 35 + pBonus
          },
          // South (Bottom)
          {
            x: Math.round(centerX - badgeSize / 2),
            y: Math.round(box.y + box.height + m),
            direction: 'S',
            penalty: 45 + pBonus
          },
          // South-East (Bottom-Right diagonal)
          {
            x: Math.round(box.x + box.width - badgeSize / 2 + m),
            y: Math.round(box.y + box.height + m),
            direction: 'SE',
            penalty: 55 + pBonus
          },
          // West (Left) - In horizontal line, heavily penalized to avoid extension lines
          {
            x: Math.round(box.x - badgeSize - m),
            y: Math.round(centerY - badgeSize / 2),
            direction: 'W',
            penalty: (isChainNeighbor ? 1200 : 250) + pBonus
          },
          // East (Right) - In horizontal line, heavily penalized
          {
            x: Math.round(box.x + box.width + m),
            y: Math.round(centerY - badgeSize / 2),
            direction: 'E',
            penalty: (isChainNeighbor ? 1200 : 300) + pBonus
          }
        );
      } else {
        // Vertical Dimension: Dimension line runs North <-> South.
        // Optimal placement pulls to West or East with leader line.
        candidates.push(
          // West (Left)
          {
            x: Math.round(box.x - badgeSize - m),
            y: Math.round(centerY - badgeSize / 2),
            direction: 'W',
            penalty: 0 + pBonus
          },
          // North-West (Top-Left diagonal)
          {
            x: Math.round(box.x - badgeSize - m),
            y: Math.round(box.y - badgeSize / 2 - m),
            direction: 'NW',
            penalty: 10 + pBonus
          },
          // South-West (Bottom-Left diagonal)
          {
            x: Math.round(box.x - badgeSize - m),
            y: Math.round(box.y + box.height - badgeSize / 2 + m),
            direction: 'SW',
            penalty: 15 + pBonus
          },
          // East (Right)
          {
            x: Math.round(box.x + box.width + m),
            y: Math.round(centerY - badgeSize / 2),
            direction: 'E',
            penalty: 25 + pBonus
          },
          // North-East (Top-Right diagonal)
          {
            x: Math.round(box.x + box.width + m),
            y: Math.round(box.y - badgeSize / 2 - m),
            direction: 'NE',
            penalty: 35 + pBonus
          },
          // South-East (Bottom-Right diagonal)
          {
            x: Math.round(box.x + box.width + m),
            y: Math.round(box.y + box.height - badgeSize / 2 + m),
            direction: 'SE',
            penalty: 45 + pBonus
          },
          // North (Top) - In vertical line, heavily penalized
          {
            x: Math.round(centerX - badgeSize / 2),
            y: Math.round(box.y - badgeSize - m),
            direction: 'N',
            penalty: 250 + pBonus
          },
          // South (Bottom) - In vertical line, heavily penalized
          {
            x: Math.round(centerX - badgeSize / 2),
            y: Math.round(box.y + box.height + m),
            direction: 'S',
            penalty: 300 + pBonus
          }
        );
      }
    }

    return candidates;
  }

  /**
   * Computes optimal collision-free balloon coordinates for all characteristics on a given sheet.
   */
  public static calculateOptimalPositions(
    characteristics: EngineeringCharacteristic[],
    sheetWidth: number,
    sheetHeight: number,
    sheetNumber: number = 1,
    forceReset: boolean = false,
    drawingTextObstacles?: BoundingRect[]
  ): EngineeringCharacteristic[] {
    const sheetChars = characteristics.filter((c) => c.sheetNumber === sheetNumber);
    const otherChars = characteristics.filter((c) => c.sheetNumber !== sheetNumber);

    // List of placed balloons as bounding rectangles
    const placedBalloons: Array<BoundingRect & { charId: string }> = [];

    // All dimension bounding boxes on this sheet act as obstacles
    const obstacleBoxes: Array<BoundingRect & { isHorizontal: boolean }> = sheetChars.map((c) => ({
      x: c.boundingBox.x,
      y: c.boundingBox.y,
      width: c.boundingBox.width,
      height: c.boundingBox.height,
      isHorizontal: c.boundingBox.width >= c.boundingBox.height
    }));

    const badgeSize = SpatialPlacementService.BADGE_SIZE;
    const sheetMargin = SpatialPlacementService.SHEET_MARGIN;

    const updatedSheetChars = sheetChars.map((char) => {
      // Clean Canvas Rule: Skip balloon placement for characteristics whose canvas balloon is suppressed
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

      // Detect if this characteristic is part of a horizontal dimension chain (e.g. 35 - 40 - 35)
      const isHorizontalChain = sheetChars.some(
        (other) =>
          other.id !== char.id &&
          Math.abs(other.boundingBox.y - char.boundingBox.y) < 24 &&
          Math.abs(other.boundingBox.x - char.boundingBox.x) < 160
      );

      // Generate candidate directions around this callout
      const candidates = SpatialPlacementService.getCandidatePositions(
        char.boundingBox,
        badgeSize,
        SpatialPlacementService.BADGE_MARGIN,
        isHorizontalChain
      );

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

          if (SpatialPlacementService.checkIntersection(balloonRect, obs, 4)) {
            score += isOwnBox ? 4000 : 1200;
          }

          // 2b. Dimension Line Corridor Check: Penalize sitting directly on extension/arrowhead lines
          if (obs.isHorizontal) {
            const horizontalCorridor: BoundingRect = {
              x: obs.x - 35,
              y: obs.y - 4,
              width: obs.width + 70,
              height: obs.height + 8
            };
            if (SpatialPlacementService.checkIntersection(balloonRect, horizontalCorridor, 0)) {
              score += 2500;
            }
          } else {
            const verticalCorridor: BoundingRect = {
              x: obs.x - 4,
              y: obs.y - 35,
              width: obs.width + 8,
              height: obs.height + 70
            };
            if (SpatialPlacementService.checkIntersection(balloonRect, verticalCorridor, 0)) {
              score += 2500;
            }
          }
        }

        // 2c. Drawing Text Obstacle Check: Never place balloons over View Titles (SIDE, FRONT, TOP), Notes, or Labels
        if (drawingTextObstacles && drawingTextObstacles.length > 0) {
          for (const txtObs of drawingTextObstacles) {
            if (SpatialPlacementService.checkIntersection(balloonRect, txtObs, 2)) {
              score += 5000;
            }
          }
        }

        // 3. Balloon Collision Check: Severe penalty for overlapping another balloon
        for (const placed of placedBalloons) {
          if (SpatialPlacementService.checkIntersection(balloonRect, placed, 6)) {
            score += 3000;
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
    forceReset: boolean = false,
    textObstaclesBySheet?: Map<number, BoundingRect[]> | Record<number, BoundingRect[]>
  ): EngineeringCharacteristic[] {
    let result = [...characteristics];
    for (const sheet of sheets) {
      const obstacles = textObstaclesBySheet instanceof Map
        ? textObstaclesBySheet.get(sheet.pageNumber)
        : textObstaclesBySheet?.[sheet.pageNumber];

      result = SpatialPlacementService.calculateOptimalPositions(
        result,
        sheet.width,
        sheet.height,
        sheet.pageNumber,
        forceReset,
        obstacles
      );
    }
    return result;
  }
}
