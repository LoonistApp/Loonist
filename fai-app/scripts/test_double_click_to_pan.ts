/**
 * TEST SUITE: Double-Click-To-Pan in Blueprint Drawing Viewer
 * Verifies:
 * 1. Double-clicking activates pan mode (sets tool to 'pan' and enables pan interaction)
 * 2. Second mousedown of double click (detail >= 2) immediately starts pan drag
 * 3. Clicking and dragging in pan mode pans freely in all directions (+X, -X, +Y, -Y, diagonals)
 * 4. Subsequent single-click and drag continues to pan freely in any direction
 * 5. State preservation and transform updates are mathematically accurate
 */

interface MockTransform {
  x: number;
  y: number;
}

interface MockEvent {
  button: number;
  clientX: number;
  clientY: number;
  detail: number;
}

class MockDrawingViewerController {
  public scale: number = 1.0;
  public rotation: number = 0;
  public activeTool: 'pan' | 'select' | 'box-capture' = 'select';
  public internalPanMode: boolean = false;
  public transform: MockTransform = { x: 100, y: 100 };
  public cursor: string = 'default';

  // Internal drag state
  public isDragging: boolean = false;
  public isPanning: boolean = false;
  public dragStart: { x: number; y: number; originX: number; originY: number } = {
    x: 0,
    y: 0,
    originX: 0,
    originY: 0
  };

  public onToolChange(tool: 'pan' | 'select' | 'box-capture') {
    this.activeTool = tool;
  }

  public applyTransform(x: number, y: number, _scale: number) {
    this.transform = { x, y };
  }

  public handleMouseDown(e: MockEvent) {
    this.isPanning = false;

    // Double-click to pan detection directly on 2nd mousedown (detail === 2 only - see note below)
    if (e.button === 0 && e.detail === 2) {
      this.internalPanMode = true;
      this.onToolChange('pan');
      this.isDragging = true;
      this.dragStart = {
        x: e.clientX,
        y: e.clientY,
        originX: this.transform.x,
        originY: this.transform.y
      };
      this.cursor = 'grabbing';
      return;
    }

    // Pan action
    const isPanModeActive = this.activeTool === 'pan' || this.internalPanMode;
    const isPanAction = e.button === 1 || isPanModeActive || (this.activeTool !== 'box-capture' && e.button === 0);
    if (!isPanAction) return;

    this.isDragging = true;
    this.dragStart = {
      x: e.clientX,
      y: e.clientY,
      originX: this.transform.x,
      originY: this.transform.y
    };
    this.cursor = 'grabbing';
  }

  public handleDoubleClick(e: MockEvent) {
    if (e.button !== 0) return;
    // The real dblclick event re-fires for every click beyond the first in a fast run (same
    // click-count/detail logic as click), not just a strict pair, so this needs the same guard
    // as handleMouseDown or continuous tapping forces pan through this path too.
    if (e.detail !== 2) return;
    this.internalPanMode = true;
    this.onToolChange('pan');
    this.cursor = 'grab';
  }

  public handleMouseMove(e: MockEvent) {
    if (!this.isDragging) return;

    const dx = e.clientX - this.dragStart.x;
    const dy = e.clientY - this.dragStart.y;
    if (Math.hypot(dx, dy) > 4) {
      this.isPanning = true;
    }

    const newX = Math.round(this.dragStart.originX + dx);
    const newY = Math.round(this.dragStart.originY + dy);

    this.applyTransform(newX, newY, this.scale);
  }

  public handleMouseUp() {
    this.isDragging = false;
    const isPanModeActive = this.activeTool === 'pan' || this.internalPanMode;
    this.cursor = isPanModeActive ? 'grab' : 'default';
    // Clear the double-click override once the drag ends, so it doesn't silently force pan
    // behavior (and disable Box Capture) forever after the first double-click of the session.
    this.internalPanMode = false;
  }
}

function runTests() {
  console.log('================================================================');
  console.log('       TEST: Double-Click-To-Pan Omnidirectional Drawing Viewer  ');
  console.log('================================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, message: string) {
    total++;
    if (condition) {
      console.log(`  ✓ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${message}`);
      process.exitCode = 1;
    }
  }

  // TEST 1: Initial state is select tool
  const viewer = new MockDrawingViewerController();
  assert(viewer.activeTool === 'select', 'Initial tool is select tool');
  assert(viewer.transform.x === 100 && viewer.transform.y === 100, 'Initial transform origin is (100, 100)');

  // TEST 2: Double-click event activates Pan mode
  viewer.handleDoubleClick({ button: 0, clientX: 200, clientY: 200, detail: 2 });
  assert(viewer.activeTool === 'pan', 'Double-click switches activeTool to pan');
  assert(viewer.internalPanMode === true, 'Double-click activates internalPanMode');
  assert(viewer.cursor === 'grab', 'Cursor changes to grab');

  // TEST 3: Click and drag freely in +X, +Y direction (Right and Down)
  viewer.handleMouseDown({ button: 0, clientX: 200, clientY: 200, detail: 1 });
  assert(viewer.isDragging === true, 'Mouse down in pan mode initiates dragging');
  assert(viewer.cursor === 'grabbing', 'Cursor changes to grabbing while dragging');

  viewer.handleMouseMove({ button: 0, clientX: 280, clientY: 250, detail: 1 });
  assert(viewer.transform.x === 180, 'Drawing translated +80px horizontally to X=180');
  assert(viewer.transform.y === 150, 'Drawing translated +50px vertically to Y=150');
  assert(viewer.isPanning === true, 'isPanning flag is set to true');

  viewer.handleMouseUp();
  assert(viewer.isDragging === false, 'Mouse up ends dragging');
  assert(viewer.cursor === 'grab', 'Cursor returns to grab');

  // TEST 4: Click and drag freely in -X, -Y direction (Left and Up)
  viewer.handleMouseDown({ button: 0, clientX: 300, clientY: 300, detail: 1 });
  viewer.handleMouseMove({ button: 0, clientX: 220, clientY: 210, detail: 1 }); // dx = -80, dy = -90
  assert(viewer.transform.x === 100, 'Drawing translated -80px horizontally back to X=100');
  assert(viewer.transform.y === 60, 'Drawing translated -90px vertically to Y=60');

  viewer.handleMouseUp();

  // TEST 5: Immediate drag during double-click (detail >= 2 on mousedown)
  const viewer2 = new MockDrawingViewerController();
  viewer2.activeTool = 'box-capture'; // start from box-capture
  viewer2.handleMouseDown({ button: 0, clientX: 150, clientY: 150, detail: 2 });

  assert(viewer2.activeTool === 'pan', 'Double-click mousedown switches tool to pan from box-capture');
  assert(viewer2.isDragging === true, 'Double-click mousedown immediately starts dragging');
  assert(viewer2.cursor === 'grabbing', 'Cursor is grabbing on double-click drag');

  // Drag freely diagonally
  viewer2.handleMouseMove({ button: 0, clientX: 250, clientY: 50, detail: 2 }); // dx = +100, dy = -100
  assert(viewer2.transform.x === 200, 'Double-click drag moved +100px X freely to X=200');
  assert(viewer2.transform.y === 0, 'Double-click drag moved -100px Y freely to Y=0');

  viewer2.handleMouseUp();
  assert(viewer2.activeTool === 'pan', 'Viewer remains in pan tool after double-click drag completes');
  assert(viewer2.cursor === 'grab', 'Cursor is grab ready for next drag');

  // TEST 6: Regression - rapid continuous clicking must NOT keep forcing the tool back to pan.
  // e.detail is the browser's native click counter: it keeps incrementing (2, 3, 4, 5...) for
  // every click in a fast run, not just a genuine double-click pair, and a real dblclick event
  // ALSO re-fires on every one of those clicks (not just strict pairs). Each simulated click below
  // fires mousedown -> mouseup -> dblclick in that order, matching real browser event sequencing,
  // so both code paths that used to force pan are exercised the same way a real rapid tap would.
  const viewer3 = new MockDrawingViewerController();
  viewer3.handleDoubleClick({ button: 0, clientX: 100, clientY: 100, detail: 2 });
  viewer3.handleMouseDown({ button: 0, clientX: 100, clientY: 100, detail: 2 });
  viewer3.handleMouseUp();
  viewer3.onToolChange('select'); // user explicitly picks Select again after the double-click-pan
  assert(viewer3.activeTool === 'select', 'User can switch back to Select after a double-click-pan');

  // Several further rapid single clicks elsewhere (detail climbing 3, 4, 5...) must not re-force pan
  viewer3.handleMouseDown({ button: 0, clientX: 300, clientY: 120, detail: 3 });
  viewer3.handleMouseUp();
  viewer3.handleDoubleClick({ button: 0, clientX: 300, clientY: 120, detail: 3 });
  assert(viewer3.activeTool === 'select', 'A 3rd rapid click (mousedown + dblclick) does not force the tool back to pan');

  viewer3.handleMouseDown({ button: 0, clientX: 310, clientY: 400, detail: 4 });
  viewer3.handleMouseUp();
  viewer3.handleDoubleClick({ button: 0, clientX: 310, clientY: 400, detail: 4 });
  assert(viewer3.activeTool === 'select', 'A 4th rapid click (mousedown + dblclick) does not force the tool back to pan');

  viewer3.handleMouseDown({ button: 0, clientX: 50, clientY: 50, detail: 5 });
  viewer3.handleMouseUp();
  viewer3.handleDoubleClick({ button: 0, clientX: 50, clientY: 50, detail: 5 });
  assert(viewer3.activeTool === 'select', 'Continuous rapid tapping leaves the selected tool alone');
  assert(viewer3.internalPanMode === false, 'internalPanMode is cleared after the double-click drag ends');

  console.log(`\nResults: ${passed}/${total} assertions passed.\n`);
  if (passed === total) {
    console.log('🎉 ALL DOUBLE-CLICK-TO-PAN TESTS PASSED SUCCESSFULLY!');
  }
}

runTests();
