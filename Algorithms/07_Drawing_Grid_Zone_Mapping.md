# Algorithm 07: Blueprint Border Grid Zone Mapping

**Modules:** [`gridZoneCalculator.ts`](file:///c:/Users/hy376/OneDrive/Desktop/Startup/fai-app/src/services/ai/gridZoneCalculator.ts) & [`drawingExtractionService.ts`](file:///c:/Users/hy376/OneDrive/Desktop/Startup/fai-app/src/services/ai/drawingExtractionService.ts)  
**Methods:** `GridZoneCalculator.calculateZone()`, `DrawingExtractionService.findBorderGridLabels()`  
**Domain:** ASME Y14.1 / ISO 5457 Blueprint Coordinate Normalization  
**Complexity:** Time: $O(1)$ coordinate projection or $O(k)$ nearest-label scan over $k$ detected ruler entries; Space: $O(k)$.
**Rewritten Sprint 9** — primary path now interpolates against the drawing's own printed zone ruler; the pixel-size grid guess below is demoted to a fallback. (`aiExtractionService.ts` was renamed `drawingExtractionService.ts` in Sprint 9.)

---

## 1. Problem Statement & Motivation
AS9102 Form 3 Column 7 requires the exact **Drawing Zone** for every characteristic (e.g. `Zone C-4, Sheet 1`). In standard engineering drawings (ASME Y14.1 / ISO 5457), blueprints feature alpha-numeric coordinates printed along the border margins:
- Letters vertically: `A, B, C, D, E, F, G, H` (top-to-bottom or bottom-to-top)
- Numbers horizontally: `1, 2, 3, 4, 5, 6, 7, 8` (right-to-left or left-to-right)

Manually finding and typing the grid zone for 100+ characteristics is one of the most tedious tasks in aerospace quality control. LOONIST automates this.

**(Sprint 9) Why the pixel-grid guess below isn't enough on its own:** a drawing's zone count is a company/drafting-standard choice — commonly 4, 6, 8, 12, or 16 zones per side — that cannot be reliably inferred from rendered pixel dimensions alone. The original implementation always guessed a fixed grid density from sheet size, which produced systematically wrong Form 3 "Reference Location" values whenever a drawing's actual printed zone grid didn't match the guessed density. The fix: read the drawing's own printed ruler labels and their real positions, and interpolate against those directly — falling back to the pixel-size guess only when no ruler can be detected (e.g. a scanned sheet with no extractable ruler text).

---

## 2. Mathematical Formulation

Let drawing sheet dimensions be width $W$ and height $H$. A blueprint characteristic is centered at Cartesian coordinates $(x, y)$.

### 2.0 Primary Path: Ruler-Based Nearest-Label Interpolation (Sprint 9)
When `findBorderGridLabels()` detects a `DetectedZoneRuler` with at least 3 column labels and 3 row labels — each a real `{ label, position }` pair read from the drawing's own border text — `GridZoneCalculator.calculateZone()` skips the pixel-grid guess entirely:
$$\text{RowLabel} = \underset{r \,\in\, \text{ruler.rows}}{\arg\min} \left| r.\text{position} - y \right|, \qquad \text{ColLabel} = \underset{c \,\in\, \text{ruler.columns}}{\arg\min} \left| c.\text{position} - x \right|$$
$$\text{Zone} = \text{"Zone "} + \text{RowLabel} + \text{"-"} + \text{ColLabel}$$
A feature drawn beyond the outermost detected tick clamps to the nearest (first or last) ruler entry rather than extrapolating. This matches whatever zone scheme the drawing actually uses (4, 6, 8, 12, 16 zones per side, any label alphabet) instead of assuming one.

### 2.1 Fallback Path: Sheet-Size-Based Grid Resolution
Used only when no ruler (or fewer than 3 columns/rows) is detected — e.g. a scanned sheet with no extractable ruler text. **(Sprint 9)** No margin offset is applied (an earlier 3%-margin formulation was dropped — it was never load-bearing once ruler detection became primary), and columns are numbered left-to-right, not right-to-left:
$$\hat{x} = \max\left(0, \min\left(1, \frac{x}{W}\right)\right), \qquad \hat{y} = \max\left(0, \min\left(1, \frac{y}{H}\right)\right)$$
$$N_y = \begin{cases} 8, & H > 1500 \\ 6, & 800 < H \le 1500 \\ 4, & H \le 800 \end{cases} \qquad N_x = \begin{cases} 8, & W > 2000 \\ 6, & 1000 < W \le 2000 \\ 4, & W \le 1000 \end{cases}$$
$$r = \min(N_y - 1, \lfloor \hat{y} \times N_y \rfloor), \qquad \text{RowLabel} = \text{RowLabels}[r]$$
$$c = \min(N_x, \lfloor \hat{x} \times N_x \rfloor + 1)$$
$$\text{Zone} = \text{"Zone "} + \text{RowLabel} + \text{"-"} + c$$
where `RowLabels` is `A`..`Z` (26 entries, not just `A`..`H` — supports up to 26 rows for unusually fine zone grids). Both normalized-coordinate paths clamp to `[0, 1]` so a feature outside the page bounds still resolves to an edge zone rather than throwing.

---

## 3. Automated Border Grid Label Detection & Exclusion (`findBorderGridLabels`, rewritten Sprint 9)

`findBorderGridLabels()` serves two purposes at once: it builds the exclusion set that keeps margin ruler labels out of the characteristic pipeline, **and** (new in Sprint 9) it returns the validated labels themselves with their real sheet positions — the `DetectedZoneRuler` that §2.0 interpolates against. Previously this ruler data was computed only to build the exclusion set, then discarded; an audit on a real 16-column/12-row drawing (`CINH91CDB11-B.pdf`) found every Form 3 zone wrong because the fallback grid assumed 8×8.

1. **Candidacy:** a string is a grid-label candidate if `/^[A-Z]$|^[1-9]$|^1[0-6]$/` matches (single letters A–Z, or numbers 1–16) — wide enough to cover real drafting conventions beyond `A–H` / `1–8`.
2. **No fixed edge-proximity gate:** border grids sit anywhere from a few points to several hundred points inside the sheet edge on large D/E-size sheets (the title block can eat 150–700pt of margin), so candidates are **not** filtered by distance from the paper edge. Instead, candidates are grouped by alignment (same `y` within 4pt for a horizontal group, same `x` for a vertical group).
3. **Structural validation:** a group is accepted as a real ruler only if it has ≥3 labels, spans ≥35% of the sheet's width/height, and contains ≥3 distinct label values — these three checks are what distinguish an actual grid row/column from real part dimensions that happen to share an axis, now that edge proximity no longer does that filtering.
4. **Reconciliation:** a ruler printed on both the top and bottom margins (or both the left and right) yields one validated group per occurrence; their positions are averaged per label rather than just keeping whichever occurrence was found last.
5. Accepted labels are registered in `excludedKeys` (filtered out of `candidateStrings` before the characteristic pipeline runs) and returned as `columns` / `rows` for `GridZoneCalculator.calculateZone()`.

---

## 4. Source Code Reference

Implemented in [`gridZoneCalculator.ts`](file:///c:/Users/hy376/OneDrive/Desktop/Startup/fai-app/src/services/ai/gridZoneCalculator.ts) (current, Sprint 9):

```typescript
export interface DetectedZoneRuler {
  columns: Array<{ label: string; position: number }>;
  rows: Array<{ label: string; position: number }>;
}

export class GridZoneCalculator {
  private static readonly ROW_LABELS = [
    'A','B','C','D','E','F','G','H','I','J','K','L','M',
    'N','O','P','Q','R','S','T','U','V','W','X','Y','Z'
  ];

  private static nearestLabel(entries: Array<{ label: string; position: number }>, position: number): string {
    let best = entries[0];
    let bestDist = Math.abs(entries[0].position - position);
    for (let i = 1; i < entries.length; i++) {
      const dist = Math.abs(entries[i].position - position);
      if (dist < bestDist) { best = entries[i]; bestDist = dist; }
    }
    return best.label;
  }

  public static calculateZone(
    x: number, y: number,
    sheetWidth: number, sheetHeight: number,
    ruler?: DetectedZoneRuler | null
  ): string {
    if (sheetWidth <= 0 || sheetHeight <= 0) return 'Zone A-1';

    // Primary path: the drawing's own printed ruler.
    if (ruler && ruler.columns.length >= 3 && ruler.rows.length >= 3) {
      const colLabel = this.nearestLabel(ruler.columns, x);
      const rowLabel = this.nearestLabel(ruler.rows, y);
      return `Zone ${rowLabel}-${colLabel}`;
    }

    // Fallback: normalized pixel-size grid guess.
    const normX = Math.max(0, Math.min(1, x / sheetWidth));
    const normY = Math.max(0, Math.min(1, y / sheetHeight));
    const numRows = sheetHeight > 1500 ? 8 : (sheetHeight > 800 ? 6 : 4);
    const rowIndex = Math.min(numRows - 1, Math.floor(normY * numRows));
    const numCols = sheetWidth > 2000 ? 8 : (sheetWidth > 1000 ? 6 : 4);
    const colIndex = Math.min(numCols, Math.floor(normX * numCols) + 1);

    return `Zone ${this.ROW_LABELS[rowIndex] || 'A'}-${colIndex}`;
  }
}
```

`DetectedZoneRuler` is produced by `DrawingExtractionService.findBorderGridLabels()`, which reads the drawing's actual border text (real label + position pairs) rather than assuming a fixed alphabet or density.

---

## 5. Verification & Test Suite
* Unit tested in [`test_extraction_pipeline.ts`](file:///c:/Users/hy376/OneDrive/Desktop/Startup/fai-app/scripts/test_extraction_pipeline.ts).
* All extracted characteristics populate Form 3 Column 7 (`drawingZone`) automatically.
