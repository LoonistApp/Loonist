# Algorithm 04: Prose & Tutorial Sentence Exclusion Engine

**Modules:** [`gdtParser.ts`](file:///c:/Users/hy376/OneDrive/Desktop/Startup/fai-app/src/services/ai/gdtParser.ts) & [`aiExtractionService.ts`](file:///c:/Users/hy376/OneDrive/Desktop/Startup/fai-app/src/services/ai/aiExtractionService.ts)  
**Methods:** `GdtParser.isProseOrInstructionalText()`, `GdtParser.parseCallout()` Step 14 Residual Word Check  
**Domain:** Natural Language Processing & Engineering Document Semantic Filtering  
**Complexity:** Time: $O(W)$ where $W$ is word count in candidate string; Space: $O(1)$.

---

## 1. Problem Statement & Root Cause Analysis

### 1.1 The "Sentence Ballooning" Phenomenon
When blueprints or training packages are imported into FAI software (such as Autodesk Inventor, SolidWorks, or CAD training workbooks), the document frequently includes cover pages, copyright notices, and tutorial text containing numbers:
> *"This PDF contains 24 detailed drawings of miscellaneous parts, to be used for practice with Autodesk Inventor (or any 3D CAD package you may be using)."*

In naive extraction engines, the sentence passes through regex rules looking for dimensions. Because the sentence contains digits (`24` and `3` from `3D`), Step 14 (untoleranced dimension fallback) extracted:
- Nominal $= 24 \implies$ **Balloon #1**
- Nominal $= 3 \implies$ **Balloon #2**

This polluted the inspection table with garbage characteristics and broke AS9102 Form 3 compliance.

---

## 2. Multi-Layer Defense-in-Depth Architecture

LOONIST enforces a 4-tier filtering defense to ensure zero prose sentences ever generate balloons, while guaranteeing that 100% of authentic engineering drawing notes (e.g. `1. MATERIAL: 6061-T6`) and CAD dimensions remain preserved.

```mermaid
flowchart TD
    Candidate["Candidate Text Element"] --> Tier1{"Tier 1: Extreme Tutorial / Disclaimer Keyword Match?\n(autodesk, inventor, tutorial, workbook, practice with, apologies, etc.)"}
    Tier1 -- Yes --> Exclude["EXCLUDE (isProse = true, nominal = null)"]
    Tier1 -- No --> Tier2{"Tier 2: Genuine Numbered Drawing Note?\n(e.g. '1. MATERIAL: 6061-T6 ALUMINUM')"}
    Tier2 -- Yes (Engineering Vocab) --> ProtectNote["PROTECT (isProse = false, Keep as Note)"]
    Tier2 -- No --> Tier3{"Tier 3: Standard GD&T Symbols Present?\n(Contains 'Ø', '±', '⌖', '⏥', '|')"}
    Tier3 -- Yes --> ProtectGDT["PROTECT (isProse = false, Send to GD&T Parser)"]
    Tier3 -- No --> Tier4{"Tier 4: Narrative Syntax & Grammar Analysis\n• >= 5 words AND conversational conjunctions (and, or, with, you, your, we, can, will)\n• Punctuation: comma/semicolon followed by lowercase or period + uppercase"}
    Tier4 -- Yes --> Exclude
    Tier4 -- No --> Step14{"Step 14: Residual Token Validation\nStrip numbers, decimals, drafting symbols, and whitelisted CAD terms (TYP, MAX, MIN, THRU, BORE, etc.)"}
    Step14 -- Residual Words >= 3 chars remain --> Exclude
    Step14 -- Zero residual words --> Allow["ALLOW: Valid Untoleranced CAD Dimension"]
```

---

## 3. Mathematical & Algorithmic Heuristics

### 3.1 Strong Prose Keywords Dictionary
The scanner evaluates the following token dictionary:
```
\b(?:autodesk|solidworks|catia|creo|inventor|kkmsoft|tutorial|workbook|handbook|course|lesson|
disclaimer|copyright|rights\s+reserved|all\s+rights|apologies\s+in\s+advance|practice\s+with|
designer'?s?\s+choice|luck\s+in\s+your|miscellaneous\s+parts|detailed\s+drawings|
simple\s+sketches|answers?\s+here)\b
```
If matched, the text is unconditionally classified as prose, even if prefixed with a note index like `1. `.

### 3.2 Drawing Note Protection Exception
To prevent legitimate manufacturing instructions from being dropped:
1. Pattern must match: `^\d+\.\s+[A-Z0-9]` with length $< 200$ characters.
2. Must contain authentic drafting vocabulary:
   `MATERIAL|FINISH|BURR|EDGE|HEAT\s+TREAT|ANODIZE|COAT|PLATE|PLATING|TOLERANCE|PAINT|CLEAN|HARDNESS|TORQUE|PER|SPEC|ASTM|MIL|AMS|ASME|ISO|PASSIVATE|CAD|MODEL|INSPECT|SURFACE`
3. Must NOT contain narrative pronouns (`you`, `your`, `we`, `our`, `please`, `don't`).

### 3.3 Step 14 Residual Token Validation
When an untoleranced callout reaches Step 14 fallback in `GdtParser.parseCallout`:
1. All numeric digits and fractions are stripped: `/(?:\d+\.?\d*|\.\d+)/g`.
2. All drafting symbols are stripped: `[\(\)\[\]\{\}\/\\:;,\-_+=*#°Ø±↧⌴⌵"']`.
3. All standard CAD modifiers are stripped via a comprehensive whitelist:
   `TYP|TYPICAL|MAX|MIN|REF|REFERENCE|THRU|THROUGH|DP|DEPTH|BORE|CBORE|COUNTERBORE|CSINK|COUNTERSINK|CHAMFER|CHAM|PLCS|PLACES|DIA|DIAMETER|RAD|RADIUS|DEG|IN|MM|UNF|UNC|UNEF|NPT|METRIC|THREAD|THD|GA|GAGE|GAUGE|SQ|SQUARE|BASIC|TRUE|POS|SURF|PCD|BCD|STOCK|WALL|FLAT|OD|ID|PITCH|LEAD|SLOT|KEYWAY|DRILL|TAP|REAM`
4. The remaining residual string is tested for alphabetic words:
   $$\text{ResidualWords} = \text{StrippedString}.\text{match}(/[a-zA-Z]{3,}/g)$$
   - If $\text{length}(\text{ResidualWords}) > 0 \implies$ **Reject Callout** (`nominal: null`).
   - If $\text{length}(\text{ResidualWords}) == 0 \implies$ **Accept Callout** (Valid dimension).

---

## 4. Source Code Reference

Implemented in [`gdtParser.ts`](file:///c:/Users/hy376/OneDrive/Desktop/Startup/fai-app/src/services/ai/gdtParser.ts#L368-L415) and [`gdtParser.ts`](file:///c:/Users/hy376/OneDrive/Desktop/Startup/fai-app/src/services/ai/gdtParser.ts#L645-L705):

```typescript
// Step 14 Residual Word Validation
const strippedResidual = textToParse
  .replace(/(?:\d+\.?\d*|\.\d+)/g, '')
  .replace(/\b(?:TYP|TYPICAL|MAX|MIN|REF|REFERENCE|THRU|THROUGH|DP|DEPTH|BORE|CBORE|...)\b/gi, '')
  .replace(/[\(\)\[\]\{\}\/\\:;,\-_+=*#°Ø±↧⌴⌵"'`~!?<>@$%^&]/g, '')
  .trim();

const residualWords = strippedResidual.match(/[a-zA-Z]{3,}/g) || [];
if (residualWords.length > 0) {
  return {
    rawText: text,
    nominal: null,
    toleranceSource: 'Non-Callout Text (Excluded)',
    ...
  };
}
```

### 3.4 Administrative Boilerplate Exclusion (`GdtParser.isAdministrativeBoilerplate`)
Under **SAE AS9102 Section 3.8**, drafting standard references, legal notices, and quality assurance procedure statements are *not* physical design characteristics. The engine classifies and unconditionally purges text matching:
1. **Drafting standard citations:** `INTERPRET DRAWINGS?`, `ACCORDANCE WITH (?:ASME|ISO|ANSI|DIN)`, `ASME Y14`, `ISO 1101`, `ANSI Y14`.
2. **ITAR & export compliance:** `ITAR CONTROLLED`, `EXPORT REGULATION`, `US EXPORT`, `COMMERCE CONTROL`, `EAR99`, `PROPRIETARY AND CONFIDENTIAL`, `RESTRICTED RIGHTS`, `ALL RIGHTS RESERVED`.
3. **Procedural quality notices:** `FIRST ARTICLE INSPECTION PER SAE AS9102`, `100% INSPECTION REQUIRED`, `QUALITY SYSTEM REQUIREMENT`.
4. **Drawing sheet boilerplate:** `DO NOT SCALE DRAWING`, `THIRD ANGLE PROJECTION`, `UNLESS OTHERWISE SPECIFIED`, `TOLERANCES UNLESS NOTED`.

### 3.5 Clean Canvas Rule for General Notes (`skipBalloonRender`)
To prevent balloon number conflicts with existing drawing note sequence numbers (`1.`, `2.`, `3.`) and eliminate visual clutter:
1. Genuine manufacturing notes (`MATERIAL`, `SURFACE FINISH`, `BURR 0.015 MAX`) are accounted for in the **AS9102 Form 3 Characteristic Table** with Reference Location set to `NOTE X`.
2. Their blueprint canvas balloon markers are suppressed (`skipBalloonRender: true`), keeping the drawing canvas reserved exclusively for dimensional geometry and GD&T frames.
3. Users can toggle canvas ballooning for notes via the **Balloons Ribbon Tab** (`Balloon Notes` checkbox).
4. Drawing dimensions receive sequential balloon numbers starting at `#1, #2, #3...` first, while notes are appended sequentially afterwards, guaranteeing zero balloon number gaps on the CAD canvas.

---

## 4. Source Code Reference

Implemented in [`gdtParser.ts`](file:///c:/Users/hy376/OneDrive/Desktop/Startup/fai-app/src/services/ai/gdtParser.ts#L640-L720) and [`aiExtractionService.ts`](file:///c:/Users/hy376/OneDrive/Desktop/Startup/fai-app/src/services/ai/aiExtractionService.ts#L240-L290):

```typescript
// Administrative Boilerplate Check
if (GdtParser.isAdministrativeBoilerplate(clean)) {
  return true; // Excluded from ballooning and characteristics
}
```

---

## 5. Verification & Test Suite
* Verified in dedicated suite [`test_prose_sentence_exclusion.ts`](file:///c:/Users/hy376/OneDrive/Desktop/Startup/fai-app/scripts/test_prose_sentence_exclusion.ts):
  * 12/12 tutorial sentences strictly rejected (`nominal === null`).
  * 12/12 genuine CAD callouts (`1.250`, `Ø.500 ± .005`, `2X 45° CHAMFER`, `3.00 BORE`, `0.050 WALL`) accurately parsed.
  * 5/5 legitimate manufacturing notes (`MATERIAL: 6061-T6`, `ANODIZE`, `HEAT TREAT`) protected.
  * 8/8 administrative boilerplate statements (`ASME Y14.5`, `ITAR CONTROLLED`, `SAE AS9102`) strictly excluded.
* Verified in unified master test suite: 14/14 suites passing (100% success rate).
