# Sprint 2: High-Performance Blueprint Viewport — Technical Walkthrough

**Platform:** LOONIST (Desktop FAI Enterprise Platform)  
**Product Owner:** Harsh Yadav  
**Status:** ✅ **Sprint 2 Complete**  
**Compliance Target:** SAE AS9102 Rev B/C, ASME Y14.5 GD&T  

---

## 1. Executive Summary

Sprint 2 establishes the core visual rendering engine of **LOONIST**. Unlike web SaaS applications that degrade vector blueprints into low-resolution JPEGs or risk data exfiltration by uploading files to cloud buckets, LOONIST renders dense aerospace engineering drawings **100% locally** at **60 FPS** with **sub-pixel precision zoom up to 3200%**.

---

## 2. Sprint 2 Architectural Deliverables

| Deliverable | Implementation Details | Technology | Status |
| :--- | :--- | :--- | :---: |
| **Secure Blueprint Ingestion** | Native OS file picker (`dialog.showOpenDialog`) in Main process, SHA-256 cryptographic provenance hash computation, sandboxed IPC bridge. | Electron Main, Node `crypto` | ✅ Complete |
| **Vector PDF Rendering Service** | Mozilla `pdfjs-dist` integration using isolated Web Workers (`blob:`), high-DPI canvas buffer scaling, and render cancellation tokens. | `pdfjs-dist`, Web Workers | ✅ Complete |
| **60 FPS Sub-Pixel Pan & Zoom** | Wheel zoom centered at mouse cursor (25% to 3200%), spacebar/middle-click panning, hardware-accelerated CSS translate3d matrix. | HTML5 Canvas, React 19 | ✅ Complete |
| **Multi-Sheet Navigation** | Dynamic CAD sheet tab bar, page aspect ratio calculation, and active/inactive sheet switching. | React 19, TypeScript | ✅ Complete |
| **Memory Offloading Engine** | Inactive sheet context disposal, single active canvas buffer, enforcing a strict `<1.5GB` RAM ceiling across multi-page schematics. | Browser Memory Management | ✅ Complete |
| **Interactive CAD HUD Toolbar** | Floating translucent HUD: Zoom presets (Fit Page, Fit Width, 100%, 3200%), Pan/Select tools, 90° rotation, real-time FPS/DPI monitor. | Vanilla CSS, Lucide Icons | ✅ Complete |
| **Bundled Aerospace Blueprint** | Pre-generated 2-sheet AS9102 turbine bracket blueprint with ASME Y14.5 GD&T feature control frames for instant offline testing. | Custom PDF 1.4 Vector Generator | ✅ Complete |

---

## 3. High-Performance Viewport Architecture

```mermaid
flowchart TD
    subgraph UI ["Renderer Process (Chromium Sandbox)"]
        UserMouse["User Mouse / Trackpad\n(Wheel Zoom, Drag Pan, Sheet Tabs)"]
        HUD["Floating CAD HUD Toolbar\n(Presets, Rotate, Fit Width/Page)"]
        CanvasEngine["60 FPS Viewport Engine\n(requestAnimationFrame, Matrix3D)"]
        PDFWorker["PDF.js Web Worker (Isolated)\n(Vector Rasterizer, Font Engine)"]
    end

    subgraph IPC ["Preload ContextBridge (Allowlist Only)"]
        Bridge["window.api.openBlueprintDialog()\nwindow.api.loadSampleBlueprint()"]
    end

    subgraph MainProcess ["Electron Main Process (Node.js)"]
        FilePicker["dialog.showOpenDialog()"]
        FSRead["fs.promises.readFile()"]
        Hasher["SHA-256 Provenance Hasher"]
        SQLite[("Local SQLite WAL DB")]
    end

    UserMouse --> CanvasEngine
    HUD --> CanvasEngine
    CanvasEngine <--> PDFWorker
    UserMouse -->|Open File| Bridge
    Bridge --> FilePicker --> FSRead --> Hasher
    Hasher -->|ArrayBuffer + Metadata| Bridge
    Bridge --> PDFWorker
```

---

## 4. Key Engineering Decisions & Rationale

### A. Wheel Zoom Centered at Cursor (Pinpoint CAD Zoom)
* **The Challenge:** Standard web zooming zooms from the center of the screen, forcing engineers to pan repeatedly when inspecting microscopic tolerance callouts.
* **Our Solution:** We calculate the exact drawing coordinate under the mouse pointer:
  $$\text{docX} = \frac{\text{mouseX} - \text{transform.x}}{\text{scale}}$$
  $$\text{newX} = \text{mouseX} - (\text{docX} \times \text{newScale})$$
* **Outcome:** The feature under the engineer's cursor remains perfectly stationary while the canvas smoothly magnifies up to 3200%.

### B. Memory Offloading (<1.5GB RAM Limit)
* **The Challenge:** High-resolution rendering of a 50-page E-size blueprint at 300 DPI can consume >8GB of VRAM if all pages remain mounted.
* **Our Solution:** Only the currently active sheet is rasterized onto the active canvas. Switching tabs immediately cancels in-flight render tasks, cleans up PDF.js internal page structures, and reallocates a clean canvas for the new page.

---

## 5. Local Development Commands

```bash
# Start local Electron development environment
npm run dev

# Run Oxlint (fast Rust linter)
npm run lint

# Build production bundle
npm run build
```
