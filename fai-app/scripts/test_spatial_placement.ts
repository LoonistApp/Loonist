import assert from 'node:assert';
import { SpatialPlacementService } from '../src/services/ballooning/spatialPlacementService.ts';
import type { EngineeringCharacteristic } from '../src/types/characteristics.ts';

function createDummyChar(id: string, itemNumber: number, x: number, y: number, w: number = 80, h: number = 20): EngineeringCharacteristic {
  return {
    id,
    itemNumber,
    sheetNumber: 1,
    drawingZone: 'Zone A-1',
    type: 'linear',
    displayType: 'Dimension',
    subType: 'Linear Dimension',
    classification: 'Minor',
    enclosure: 'standard',
    rawText: `1.000 (Char ${id})`,
    cleanNominal: 1.0,
    upperTol: 0.005,
    lowerTol: 0.005,
    minLimit: 0.995,
    maxLimit: 1.005,
    plusTol: 0.005,
    minusTol: -0.005,
    upperLimit: 1.005,
    lowerLimit: 0.995,
    units: 'in',
    isToleranceInherited: false,
    toleranceSource: 'Direct',
    quantity: 1,
    inspectionMethod: 'Caliper',
    confidenceScore: 1.0,
    verificationStatus: 'auto_accepted',
    isBasic: false,
    forReference: false,
    sourceCaptureOrSheet: 'Sheet 1',
    boundingBox: { x, y, width: w, height: h }
  };
}

function runTests() {
  console.log('=== Running Spatial Balloon Collision Avoidance Placement Tests ===\n');

  // Test 1: Multiple characteristics vertically stacked closely (where fixed left offset would overlap)
  console.log('Test 1: Vertically stacked callouts spaced only 15px apart');
  const chars = [
    createDummyChar('c1', 1, 200, 100), // Top callout
    createDummyChar('c2', 2, 200, 125), // Callout only 25px down (height 20, gap 5)
    createDummyChar('c3', 3, 200, 150)  // Callout only 25px down
  ];

  const placed = SpatialPlacementService.calculateOptimalPositions(chars, 1000, 800, 1);

  console.log('  Calculated positions:');
  for (const c of placed) {
    console.log(`    Balloon #${c.itemNumber}: (${c.customBalloonPosition?.x}, ${c.customBalloonPosition?.y})`);
  }

  // Verify none of the 3 balloons intersect with each other
  for (let i = 0; i < placed.length; i++) {
    for (let j = i + 1; j < placed.length; j++) {
      const b1 = {
        x: placed[i].customBalloonPosition!.x,
        y: placed[i].customBalloonPosition!.y,
        width: 28,
        height: 28
      };
      const b2 = {
        x: placed[j].customBalloonPosition!.x,
        y: placed[j].customBalloonPosition!.y,
        width: 28,
        height: 28
      };
      const overlaps = SpatialPlacementService.checkIntersection(b1, b2, 0);
      assert.strictEqual(overlaps, false, `Balloon #${placed[i].itemNumber} overlaps Balloon #${placed[j].itemNumber}`);
    }
  }
  console.log('  [PASS] 0 overlapping balloons across vertically stacked callouts!\n');

  // Test 2: Callout at the very left edge of the sheet (x = 5)
  console.log('Test 2: Callout near the left edge of sheet (x = 10, sheetWidth = 500)');
  const edgeChar = [createDummyChar('c_edge', 10, 10, 200, 50, 20)];
  const placedEdge = SpatialPlacementService.calculateOptimalPositions(edgeChar, 500, 500, 1);
  const pos = placedEdge[0].customBalloonPosition!;
  console.log(`    Edge balloon placed at: (${pos.x}, ${pos.y})`);
  assert.ok(pos.x >= 12, 'Balloon placed within left margin');
  // It shouldn't be placed at x < 12 (which would be cut off). Since left had high penalty, it should place Top, Right, or Bottom!
  assert.ok(pos.x > 10 || pos.y < 190 || pos.y > 210, 'Avoided sheet clipping penalty cleanly');
  console.log('  [PASS] Successfully avoided sheet boundary clipping!\n');

  console.log('=== All Spatial Placement Tests PASSED Successfully! ===');
}

runTests();
