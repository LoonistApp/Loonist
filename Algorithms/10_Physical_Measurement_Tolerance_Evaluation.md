# Algorithm 10: Physical Measurement Conformance & Tolerance Evaluation

**Module:** [`measurementEngine.ts`](file:///c:/Users/hy376/OneDrive/Desktop/Startup/fai-app/src/services/compliance/measurementEngine.ts)  
**Method:** `MeasurementEngine.evaluate()`  
**Domain:** ASME Y14.5 Quality Conformance & Statistical Process Control  
**Complexity:** Time: $O(1)$ constant time per measurement check; Space: $O(1)$.

---

## 1. Problem Statement & Motivation
In aerospace First Article Inspection (SAE AS9102 Form 3 Column 9/10/11), quality inspectors physically measure parts with digital calipers, micrometers, height gages, or CMMs. The software must instantly evaluate whether a measured actual dimension satisfies the drawing limits, but also provide early warning when a dimension is **marginally close** to the tolerance limit (warning the CNC machinist of imminent tool wear before out-of-spec scrap is produced).

---

## 2. Mathematical Formulation

Let the specification define:
- Upper Limit: $L_{\max}$
- Lower Limit: $L_{\min}$
- Measured Actual: $A \in \mathbb{R}$

### 2.1 Bilateral Tolerance Band & 10% Marginal Warning Threshold
The total tolerance bandwidth is:
$$\text{Band} = L_{\max} - L_{\min}$$

LOONIST defines a standard aerospace $10\%$ marginal buffer threshold:
$$\delta_{\text{marginal}} = 0.10 \times \text{Band}$$

### 2.2 Conformance Classification Function
$$\text{Status}(A) = \begin{cases} 
\mathbf{FAIL} \text{ (Red)}, & \text{if } A < L_{\min} \text{ or } A > L_{\max} \\
\mathbf{MARGINAL} \text{ (Amber)}, & \text{if } (A - L_{\min} \le \delta_{\text{marginal}}) \text{ or } (L_{\max} - A \le \delta_{\text{marginal}}) \\
\mathbf{PASS} \text{ (Green)}, & \text{otherwise (Safe Nominal Zone)}
\end{cases}$$

```
                L_min                                           L_max
---|--------------[=======|===============================|=======]--------------|--->
        FAIL           MARGINAL              PASS              MARGINAL     FAIL
     (Out of spec)  (Within 10%)       (Safe Center)        (Within 10%) (Out of spec)
```

### 2.3 Deviation from Nominal
Given nominal dimension $N$:
$$\text{Deviation} = \text{round}(A - N, \text{decimals})$$

### 2.4 Unilateral & Limit Dimensions
- **Maximum Limit Only (`MAX`):**
  $$\text{Status}(A) = \begin{cases} \mathbf{FAIL}, & \text{if } A > L_{\max} \\ \mathbf{MARGINAL}, & \text{if } L_{\max} - A \le 0.10 \times L_{\max} \\ \mathbf{PASS}, & \text{otherwise} \end{cases}$$
- **Minimum Limit Only (`MIN`):**
  $$\text{Status}(A) = \begin{cases} \mathbf{FAIL}, & \text{if } A < L_{\min} \\ \mathbf{MARGINAL}, & \text{if } A - L_{\min} \le 0.10 \times L_{\min} \\ \mathbf{PASS}, & \text{otherwise} \end{cases}$$
- **Reference Dimensions `( 1.500 )`:** Informational only per ASME Y14.5; automatically evaluated as `PASS` without out-of-spec rejection.

---

## 3. Statistical Lot Conformance Aggregation

Across an inspection package of $M$ characteristics, the engine dynamically calculates:
$$\text{MeasuredCount} = \sum_{i=1}^M \mathbb{I}(A_i \ne \text{null})$$
$$\text{PassCount} = \sum_{i=1}^M \mathbb{I}(\text{Status}_i == \text{'PASS'})$$
$$\text{MarginalCount} = \sum_{i=1}^M \mathbb{I}(\text{Status}_i == \text{'MARGINAL'})$$
$$\text{FailCount} = \sum_{i=1}^M \mathbb{I}(\text{Status}_i == \text{'FAIL'})$$
$$\text{ConformanceRate} = \left( \frac{\text{PassCount} + \text{MarginalCount}}{\text{MeasuredCount}} \right) \times 100\%$$

---

## 4. Source Code Reference

Implemented in [`measurementEngine.ts`](file:///c:/Users/hy376/OneDrive/Desktop/Startup/fai-app/src/services/compliance/measurementEngine.ts#L25-L95):

```typescript
export class MeasurementEngine {
  public static evaluate(
    actual: number,
    nominal: number | null,
    minLimit: number | null,
    maxLimit: number | null,
    isRef: boolean = false
  ): MeasurementEvaluationResult {
    if (isRef) {
      return { status: 'PASS', deviation: 0, isWithinLimits: true, isMarginal: false };
    }

    if (minLimit === null || maxLimit === null) {
      return { status: 'PASS', deviation: 0, isWithinLimits: true, isMarginal: false };
    }

    const band = maxLimit - minLimit;
    const marginalThreshold = band * 0.10;

    if (actual < minLimit || actual > maxLimit) {
      return { status: 'FAIL', deviation: actual - (nominal ?? minLimit), isWithinLimits: false, isMarginal: false };
    }

    const nearLower = (actual - minLimit) <= marginalThreshold;
    const nearUpper = (maxLimit - actual) <= marginalThreshold;

    if (nearLower || nearUpper) {
      return { status: 'MARGINAL', deviation: actual - (nominal ?? minLimit), isWithinLimits: true, isMarginal: true };
    }

    return { status: 'PASS', deviation: actual - (nominal ?? minLimit), isWithinLimits: true, isMarginal: false };
  }
}
```

---

## 5. Verification & Test Suite
* Verified in [`test_measurement_engine.ts`](file:///c:/Users/hy376/OneDrive/Desktop/Startup/fai-app/scripts/test_measurement_engine.ts):
  * Test: Bilateral limits $[0.495, 0.505]$, Actual $= 0.5042 \implies$ `MARGINAL` (Amber).
  * Test: Actual $= 0.5000 \implies$ `PASS` (Green).
  * Test: Actual $= 0.5060 \implies$ `FAIL` (Red).
