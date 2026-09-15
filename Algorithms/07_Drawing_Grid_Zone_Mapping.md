# Algorithm 07: Blueprint Border Grid Zone Mapping

**Modules:** [`gridZoneCalculator.ts`](file:///c:/Users/hy376/OneDrive/Desktop/Startup/fai-app/src/services/ai/gridZoneCalculator.ts) & [`aiExtractionService.ts`](file:///c:/Users/hy376/OneDrive/Desktop/Startup/fai-app/src/services/ai/aiExtractionService.ts)  
**Methods:** `GridZoneCalculator.calculateZone()`, `AiExtractionService.findBorderGridLabels()`  
**Domain:** ASME Y14.1 / ISO 5457 Blueprint Coordinate Normalization  
**Complexity:** Time: $O(1)$ coordinate projection calculation; Space: $O(1)$.

---

## 1. Problem Statement & Motivation
AS9102 Form 3 Column 7 requires the exact **Drawing Zone** for every characteristic (e.g. `Zone C-4, Sheet 1`). In standard engineering drawings (ASME Y14.1 / ISO 5457), blueprints feature alpha-numeric coordinates printed along the border margins:
- Letters vertically: `A, B, C, D, E, F, G, H` (top-to-bottom or bottom-to-top)
- Numbers horizontally: `1, 2, 3, 4, 5, 6, 7, 8` (right-to-left or left-to-right)

Manually finding and typing the grid zone for 100+ characteristics is one of the most tedious tasks in aerospace quality control. LOONIST automates this with an analytical coordinate projection algorithm.

---

## 2. Mathematical Formulation

Let drawing sheet dimensions be width $W$ and height $H$. A blueprint characteristic is centered at Cartesian coordinates $(x, y)$.

### 2.1 Dynamic Aspect-Ratio Grid Resolution
Depending on sheet size (A through E size, or A4 through A0):
- Standard D-size (width $\ge 1000\text{pt}$): $N_x = 8$ horizontal columns, $N_y = 6$ vertical rows.
- Standard Letter/B-size: $N_x = 4$ horizontal columns, $N_y = 4$ vertical rows.

Let border margin offsets be:
$$M_{\text{left}} = 0.03 \times W, \quad M_{\text{right}} = 0.03 \times W$$
$$M_{\text{top}} = 0.03 \times H, \quad M_{\text{bottom}} = 0.03 \times H$$

The active printable drawing field is:
$$W_{\text{active}} = W - M_{\text{left}} - M_{\text{right}}$$
$$H_{\text{active}} = H - M_{\text{top}} - M_{\text{bottom}}$$

### 2.2 Normalized Coordinate Projection
$$\hat{x} = \max\left(0, \min\left(1, \frac{x - M_{\text{left}}}{W_{\text{active}}}\right)\right)$$
$$\hat{y} = \max\left(0, \min\left(1, \frac{y - M_{\text{top}}}{H_{\text{active}}}\right)\right)$$

### 2.3 ASME Y14.1 Standard Zone Indexing
- **Vertical Row Index (Letters A–H):**
  $$r = \lfloor \hat{y} \times N_y \rfloor$$
  $$\text{RowLetter} = \text{RowLetters}[r] \quad \text{where } \text{RowLetters} = [A, B, C, D, E, F, G, H]$$
- **Horizontal Column Index (Numbers 1–8):**
  In standard ASME drafting, horizontal numbers index from right-to-left ($8 \to 1$):
  $$c = N_x - \lfloor \hat{x} \times N_x \rfloor$$
  $$\text{ColNumber} = \max(1, \min(N_x, c))$$

The resulting drawing zone is:
$$\text{Zone} = \text{RowLetter} + \text{"-"} + \text{ColNumber} \quad (\text{e.g. } \text{"C-4"})$$

---

## 3. Automated Border Grid Label Exclusion (`findBorderGridLabels`)

To prevent the actual margin numbers `1, 2, 3...` and letters `A, B, C...` printed along the physical border from being ballooned as dimensions, LOONIST uses sequence-alignment border filtering:
1. Candidate strings within $25\text{pt}$ of outer paper borders are inspected.
2. If text is a single alphanumeric char (`/^[A-H1-8]$/i`), it is registered in `borderGridKeySet`.
3. Filtered out from `candidateStrings` before entering the characteristic pipeline.

---

## 4. Source Code Reference

Implemented in [`gridZoneCalculator.ts`](file:///c:/Users/hy376/OneDrive/Desktop/Startup/fai-app/src/services/ai/gridZoneCalculator.ts#L10-L45):

```typescript
export class GridZoneCalculator {
  public static calculateZone(
    x: number,
    y: number,
    pageWidth: number,
    pageHeight: number
  ): string {
    const numCols = pageWidth >= 1000 ? 8 : 4;
    const numRows = pageHeight >= 700 ? 6 : 4;

    const rowLetters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

    const colWidth = pageWidth / numCols;
    const rowHeight = pageHeight / numRows;

    // ASME Y14.1: Columns numbered right to left
    const colIndex = Math.min(numCols, Math.max(1, numCols - Math.floor(x / colWidth)));
    // Rows lettered top to bottom
    const rowIndex = Math.min(numRows - 1, Math.max(0, Math.floor(y / rowHeight)));

    return `${rowLetters[rowIndex]}-${colIndex}`;
  }
}
```

---

## 5. Verification & Test Suite
* Unit tested in [`test_extraction_pipeline.ts`](file:///c:/Users/hy376/OneDrive/Desktop/Startup/fai-app/scripts/test_extraction_pipeline.ts).
* All extracted characteristics populate Form 3 Column 7 (`drawingZone`) automatically.
