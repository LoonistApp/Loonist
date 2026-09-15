# Algorithm 06: Title Block Tolerance Precision Matrix

**Module:** [`toleranceEngine.ts`](file:///c:/Users/hy376/OneDrive/Desktop/Startup/fai-app/src/services/ai/toleranceEngine.ts)  
**Method:** `ToleranceEngine.resolveTitleBlockTolerance()`  
**Domain:** ASME Y14.5 / ISO 2768 Precision Engineering Tolerancing  
**Complexity:** Time: $O(1)$ constant-time matrix lookup; Space: $O(1)$.

---

## 1. Problem Statement & Motivation
Over $60\%$ of dimensions on aerospace and precision machine shop blueprints do NOT display an explicit tolerance (such as $\pm .005$). In standard drafting practice (ASME Y14.1 / ASME Y14.5 / ISO 2768), untoleranced dimensions inherit general tolerances defined in the drawing's Title Block based strictly on their **decimal precision**:
- `1.2` $\implies 1$ decimal place
- `1.25` $\implies 2$ decimal places
- `1.250` $\implies 3$ decimal places
- `1.2500` $\implies 4$ decimal places

If an FAI tool fails to resolve Title Block tolerances, inspectors are forced to manually enter upper and lower limits for dozens of characteristics, wasting hours.

---

## 2. Mathematical Formulation & Precision Resolution

### 2.1 Decimal Place Counting
Given a numeric dimension string $S$ (e.g. `"1.250"`):
1. Test if string contains a decimal point `.`.
2. Extract the fractional substring following `.`:
   $$D(S) = \text{length}(S.\text{split}('.')[1])$$
3. If no decimal point exists ($D(S) = 0$), $S$ is treated as an integer whole dimension.

### 2.2 Imperial Aerospace Precision Matrix (ASME Standard)
For inch-based drawings (`unit = 'in'`), LOONIST queries the following standard tolerance mapping:

| Decimal Places $D(S)$ | Format Example | Default Bilateral Tolerance | Source Designation |
| :---: | :---: | :---: | :--- |
| **0** | `1` | $\pm 0.030\text{ in}$ | Title Block (.X) |
| **1** | `.5` or `1.5` | $\pm 0.030\text{ in}$ | Title Block (.X) |
| **2** | `.50` or `1.25` | $\pm 0.010\text{ in}$ | Title Block (.XX) |
| **3** | `.500` or `1.250` | $\pm 0.005\text{ in}$ | Title Block (.XXX) |
| **4** | `.5000` or `1.2500` | $\pm 0.0005\text{ in}$ | Title Block (.XXXX) |
| **Angular** | `45°` or `30 DEG` | $\pm 0.5^\circ$ | Title Block (Angles) |

### 2.3 Metric ISO 2768-m Precision Matrix
For metric drawings (`unit = 'mm'`), ISO 2768-m specifies nominal-range dependent general tolerances:

| Nominal Linear Range ($L\text{ mm}$) | ISO 2768-m Permissible Deviation |
| :---: | :---: |
| $0.5 \le L \le 3$ | $\pm 0.10\text{ mm}$ |
| $3 < L \le 6$ | $\pm 0.10\text{ mm}$ |
| $6 < L \le 30$ | $\pm 0.20\text{ mm}$ |
| $30 < L \le 120$ | $\pm 0.30\text{ mm}$ |
| $120 < L \le 400$ | $\pm 0.50\text{ mm}$ |
| $400 < L \le 1000$ | $\pm 0.80\text{ mm}$ |
| $1000 < L \le 2000$ | $\pm 1.20\text{ mm}$ |

### 2.4 Dynamic Title Block OCR / Vector Detection
LOONIST features an automated regex parser that extracts custom Title Block matrices printed on the drawing:
```typescript
const imperialRegex = /\.X\s*=\s*±?([0-9.]+).*?\.XX\s*=\s*±?([0-9.]+).*?\.XXX\s*=\s*±?([0-9.]+)/is;
```
If present on Sheet 1, the custom matrix dynamically overrides default presets.

---

## 3. Limit Boundary Calculation

Given nominal dimension $N$, upper tolerance $T_u$, and lower tolerance $T_l$:
$$\text{UpperLimit} = \text{round}(N + T_u, \text{decimals})$$
$$\text{LowerLimit} = \text{round}(N - T_l, \text{decimals})$$

---

## 4. Source Code Reference

Implemented in [`toleranceEngine.ts`](file:///c:/Users/hy376/OneDrive/Desktop/Startup/fai-app/src/services/ai/toleranceEngine.ts#L45-L110):

```typescript
export class ToleranceEngine {
  public static resolveTitleBlockTolerance(
    numStr: string,
    isAngular: boolean,
    preset: TitleBlockTolerancePreset = DEFAULT_AEROSPACE_TOLERANCES
  ): { upperTol: number; lowerTol: number; source: string } {
    if (isAngular) {
      return { upperTol: preset.angles, lowerTol: preset.angles, source: 'Title Block (Angles)' };
    }

    const parts = numStr.split('.');
    const decimals = parts.length > 1 ? parts[1].length : 0;

    switch (decimals) {
      case 0:
      case 1:
        return { upperTol: preset.oneDecimal, lowerTol: preset.oneDecimal, source: 'Title Block (.X)' };
      case 2:
        return { upperTol: preset.twoDecimals, lowerTol: preset.twoDecimals, source: 'Title Block (.XX)' };
      case 3:
        return { upperTol: preset.threeDecimals, lowerTol: preset.threeDecimals, source: 'Title Block (.XXX)' };
      case 4:
      default:
        return { upperTol: preset.fourDecimals, lowerTol: preset.fourDecimals, source: 'Title Block (.XXXX)' };
    }
  }
}
```

---

## 5. Verification & Test Suite
* Verified in [`test_extraction_pipeline.ts`](file:///c:/Users/hy376/OneDrive/Desktop/Startup/fai-app/scripts/test_extraction_pipeline.ts):
  * `1.250` automatically inherits $\pm 0.005$, limits $[1.245, 1.255]$.
  * `2.50` automatically inherits $\pm 0.010$, limits $[2.490, 2.510]$.
