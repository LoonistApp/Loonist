# LOONIST PRD (Product Requirement Document)

| Attribute | Value |
| :--- | :--- |
| **Product Name** | `LOONIST` |
| **Version** | v2.1 (Competitive Disruption Baseline — Desktop Enterprise SaaS) |
| **Document Status** | Approved Master Baseline PRD |
| **Last Updated** | 29 September 2026 |
| **Product Owner (POC)** | Harsh Yadav |
| **Architectural Model** | Offline-First Desktop App with Cloudflare Asymmetric Licensing Control Plane |
| **Target Infrastructure** | Electron + React 19 + Local SQLite + Local ONNX/WASM AI + Cloudflare Workers Edge |

---

## 1. Why? (Objective & Strategic Market Context)

### 1.1 Business Objectives & Competitive Disruption
* **Market Landscape:** The First Article Inspection (FAI) and drawing ballooning software market is monopolized by legacy incumbents: **Ideagen InspectionXpert**, **DISCUS Software**, **High QA (Inspection Manager)**, and **SOLIDWORKS Inspection**.
* **The Incumbents' Fatal Flaws:**
  1. *Exorbitant Pricing & Lock-in:* Charging $1,800 to $3,500+/seat/year (or up to $10,000 for High QA) for software built on 15–20 year old .NET/WinForms or Java codebases.
  2. *Insecure Cloud Push:* Incumbents are aggressively forcing customers to "Cloud OnDemand" SaaS platforms. Prime defense contractors (Lockheed Martin, Boeing, Northrop Grumman, Raytheon) and their Tier 1/2 CNC machine shops **are legally prohibited under ITAR (International Traffic in Arms Regulations) and CMMC Level 2** from uploading classified defense prints to commercial cloud servers.
  3. *Brittle Legacy OCR:* Outdated OCR engines fail on standard drafting symbols, cannot resolve Title Block general tolerances (`.XX = ±.010`), and force inspectors to manually re-type 60%+ of dimensions into Excel.
* **LOONIST Value Proposition:** Deliver a lightning-fast, 100% offline, modern AI-powered desktop platform that reduces manual ballooning and AS9102/PPAP report generation time by **over 85%** at a disruptive price point ($79/mo or $790/yr), while guaranteeing **zero cloud data leakage**.
* **Year 1 Target:** Onboard 150+ AS9100/ISO 9001 machine shops and tier-1 aerospace suppliers.

### 1.2 User Objectives
* Eliminate repetitive manual dimension extraction and balloon placement on complex multi-sheet blueprints.
* Eliminate human transcription errors when populating SAE AS9102 Rev B/C reports (Form 1, Form 2, Form 3) and automotive AIAG PPAP packages.
* Real-time physical measurement entry with instant Pass/Fail visual feedback against computed tolerance limits.
* Deliver an ultra-slick, 60 FPS vector PDF workspace with hardware-accelerated pan, zoom, and dynamic splitting.
* Guarantee complete data sovereignty: engineering drawings, balloons, and dimensional results never leave the local machine.

---

## 2. Success Metrics & Guardrail Metrics

### 2.1 Key Performance Indicators (KPIs)
* **AI Extraction Accuracy:** $\ge 95\%$ accuracy for linear, angular, radial, bilateral, limit, and ASME Y14.5 GD&T feature control frames (Local ONNX Models + Vector AST Engine).
* **Dual-Engine Ingestion Success:** $\ge 98\%$ on native digital vector PDFs; $\ge 90\%$ on scanned paper prints or exploded stroked CAD vector paths (via local client-side raster OCR fallback).
* **Drawing Processing Latency:** Ingestion and characteristic extraction $< 15$ seconds for multi-sheet blueprints on standard workstation hardware.
* **Measurement Input Responsiveness:** Sub-5ms latency for live tolerance evaluation (Green/Red Pass/Fail calculation) per measurement keystroke.
* **Project Session Persistence:** Sub-500ms round-trip save and load latency for native `.loonist` project archives.

### 2.2 Guardrail / System Reliability Metrics
* **Zero Cloud Data Leakage:** Total local isolation. Customer drawings, IP, and inspection records NEVER touch external cloud infrastructure.
* **Licensing Uptime SLA:** $\ge 99.99\%$ for the Cloudflare activation plane; seamless 30-day offline grace period with air-gapped USB licensing support.
* **IPC Security Invariant:** 100% of inter-process communication between React UI and Node.js backend strictly validated by Zod schemas to block arbitrary code execution (RCE).
* **Cryptographic Trust:** 100% of offline licenses verified locally via Ed25519 asymmetric signature validation.

---

## 3. User Personas & Target Problems

### 3.1 Target Personas
1. **Quality Inspectors & CMM Technicians:** Daily operators measuring physical machined parts with calipers, micrometers, height gages, or CMMs who must record actual dimensions and generate inspection reports.
2. **Quality & Manufacturing Engineers:** Professionals responsible for ballooning engineering blueprints, interpreting ASME Y14.5 GD&T requirements, and compiling AS9102 / PPAP packages for customer submission.
3. **Quality Assurance Directors & Shop Owners:** Executives seeking to eliminate audit non-conformances, slash engineering overhead, and replace exorbitant $3,000/seat legacy software bills.
4. **IT & Enterprise Security Administrators:** Compliance gatekeepers who mandate strict ITAR/NIST SP 800-171/CMMC Level 2 data residency and forbid cloud-hosted blueprint storage.

### 3.2 Key Pain Points Solved
* **The "Cloud Trap":** Legacy SaaS tools require uploading prints to third-party servers. LOONIST runs 100% locally on workstation hardware.
* **Untoleranced Callouts:** Over 60% of blueprint dimensions lack explicit $\pm$ callouts. LOONIST auto-inherits Title Block tolerances based on decimal precision (`.X`, `.XX`, `.XXX`, `.XXXX`) and ISO 2768-m metric presets.
* **Multiplier Nightmares:** Callouts like `4X Ø .375` or `6 PLACES` historically required manual row cloning. LOONIST provides 1-click automatic sub-characteristic expansion (`1.1, 1.2, 1.3, 1.4`).
* **Loss of Work in Progress:** Inspectors previously lost hours if an application crashed. LOONIST provides atomic SQLite transaction history with native Undo/Redo and self-contained `.loonist` project persistence.

---

## 4. Product Flow & Core Feature Specification

### 4.1 End-to-End Customer Workflow
1. **Activation (One-Time / Air-Gapped):**
   * *Connected Mode:* User enters token $\to$ Electron queries Cloudflare Edge API $\to$ receives Ed25519 signed license bound to device public key.
   * *Air-Gapped Mode:* User exports offline activation file via USB $\to$ activates via web portal $\to$ imports cryptographic license certificate.
   * *In-App (Sprint 7):* Activation, refresh, release, and offline certificate export live in **Options → Licensing**. Since Sprint 8 the requests run in the Electron main process and renew/release are signed with the device key.
2. **Document Ingestion (Multi-Tab Workspace):**
   * User opens local PDF blueprints. Multi-document session manager isolates viewports, zoom levels, rotation, and characteristics across active tabs.
3. **Dual-Engine Characteristic Extraction ("Auto Balloon"):**
   * *Primary Engine:* PDF.js vector stream glyph scanner + ASME Y14.5 AST parser + Spatial Proximity Clustering.
   * *Secondary Fallback Engine:* Client-side raster OCR (WebWorker/WASM) for scanned drawings and exploded stroked CAD fonts (`m/l/c` vector paths).
   * *Drafting Standards (Sprint 7):* Drawing units are read from drawing notes before project defaults; integer metric dimensions receive ISO 2768-m size-band tolerances; ASME Y14.5 § 1.8.16 chamfers and compound hole callouts (drill/countersink, counterbore, thread/spotface) are split into individual Form 3 sub-characteristics.
   * *Per-Project Rules (Sprint 7):* Tolerance preset, units, skip reference `( )` / basic `[ ]` dimensions, and balloon numbering (start, step, sub-delimiter) are configured in **Project Settings** and saved inside the `.loonist` archive.
4. **Interactive Spatial Ballooning (Sprint 4):**
   * Canvas overlays numbered vector balloons avoiding drawing lines using R-Tree spatial collision detection.
   * Drag-and-drop interactive balloon positioning with dynamic leader lines.
   * Cascade renumbering: deleting or moving a balloon auto-updates the sequence while preserving multiplier sub-indices.
   * *Balloon Actions (Sprint 7):* Per-balloon shape and colour, split, reset, and quick delete (canvas, HUD, list, `Delete` key); one balloon per leader on the canvas while all sub-characteristics stay in the table.
   * *Manual Marquee (Sprint 7):* Boxes drawn over prose or administrative notes (e.g. `DO NOT SCALE DRAWING`) are rejected with an ASME Y14.5 / AS9102 explanation.
5. **Human-in-the-Loop (HITL) Verification:**
   * Inspector reviews extracted characteristics in the bottom data table or side drawer.
   * Ambiguous items display a 300 DPI high-resolution magnified crop of the raw drawing alongside parsed nominals for 2-second visual sign-off.
6. **Physical Measurement Entry & Pass/Fail Tracking:**
   * Inspector types measured dimensions (or inputs from digital gages).
   * System evaluates values instantly: $\text{MinLimit} \le \text{Actual} \le \text{MaxLimit} \implies$ **Green (Pass)**; Out of Spec $\implies$ **Red (Non-Conformance)**.
7. **Multi-Artifact Export Pipeline (Sprint 5):**
   * **Marked Blueprint PDF:** High-resolution vector synthesis burning balloon badges and leader lines directly into the customer's drawing PDF for shop-floor distribution.
   * **SAE AS9102 Rev B/C Excel Package:** Form 1 (Part Accountability), Form 2 (Product Accountability), and Form 3 (Characteristic Accountability & Results) compiled into a fully formatted `.xlsx` workbook.
   * **Customer Excel Templates (Sprint 7):** Upload the customer's own FAIR workbook with `{{placeholders}}` in Options → Templates; LOONIST fills it on export and keeps all formatting.
   * **Form 3 CSV (Sprint 7):** Flat characteristic export selectable alongside `.xlsx` in the unified Export dialog.
   * **Security Watermark (Sprint 7):** Optional `ITAR RESTRICTED` / `COMPANY CONFIDENTIAL` / `PRELIMINARY FAIR` / `CUSTOMER APPROVED` watermark on the viewport and every page of the marked PDF.
   * **Net-Inspect Portal CSV (Planned):** Field mapping is configurable in Options; the exporter itself is not yet implemented.
   * **Automotive AIAG PPAP Package (Phase 2):** Form 18 Dimensional Results mapping.
8. **Project File Archiving (`.loonist` format):**
   * Single-click save of the complete inspection state into a portable, versioned `.loonist` file for offline archival and team collaboration.
9. **Configuration & In-App Help (Sprint 7):**
   * **Application Options:** Workspace ergonomics, factory Master Data (inspection methods, operations, classifications, custom fields), AS9102 templates, Net-Inspect mapping, ITAR/Privacy, and Licensing.
   * **Help Center:** Quick Start workflow, 14-symbol ASME Y14.5 GD&T library, AS9102 Form 1/2/3 field guide, keyboard shortcuts, diagnostics, and About.

---

## 5. Technology Stack & Production System Architecture

| Tier / Domain | Selected Technology | Competitive Rationale vs. Legacy Incumbents |
| :--- | :--- | :--- |
| **Desktop Shell** | **Electron (Node.js)** | Cross-platform, hardware-accelerated container with native OS access (replaces locked Windows-only .NET WPF). |
| **Frontend UI** | **React 19 + TypeScript + Vite** | 10x faster feature iteration, modern reactive state, fluid splitters and dockable panels. |
| **Blueprint Viewport** | **HTML5 Canvas / WebGL (PDF.js)** | 60 FPS sub-pixel pan and zoom (up to 3200%) on dense E-size 300 DPI drawings with memory culling (<1.5GB RAM). |
| **Local Persistence** | **SQLite (`better-sqlite3`) + WAL** | Synchronous C++ native bindings. Sub-millisecond queries, crash-proof WAL mode, and persistent atomic Undo/Redo. |
| **Project Archiver** | **`.loonist` Archive (ZIP + JSON + SQLite)** | Self-contained project package bundling PDF, characteristics, balloons, and measurements for 100% offline portability. |
| **AI Extraction Engine** | **TypeScript AST + Local ONNX Runtime** | 100% local, air-gapped ASME Y14.5 geometric parser with hardware acceleration (DirectML/CUDA) and CPU fallback. |
| **Scanned OCR Fallback**| **Client-Side WASM / WebWorker OCR** | Local raster OCR fallback for scanned paper blueprints and CAD stroked vector paths without external API calls. |
| **Marked PDF Exporter** | **`pdf-lib` / Canvas Vector Burner** | Burns vector SVG balloons and leader lines onto native PDF vector streams without raster degradation. |
| **Licensing Control** | **Cloudflare Workers (Hono) + D1** | Serverless edge API issuing cryptographically signed Ed25519 licenses with zero server maintenance costs. |
| **Cryptography** | **Ed25519 (`@noble/curves`)** | State-of-the-art elliptic curve cryptography verifying offline licenses and audit chain integrity mathematically. |

---

## 6. Non-Functional & Enterprise Compliance Requirements

### 6.1 Security & Threat Mitigation
* **Context Isolation:** Enforced in Electron `main.ts` so renderer processes cannot access Node.js filesystem APIs.
* **Sandbox Mode:** Restricts the Chromium renderer process at the operating system level.
* **Zero Cloud Data Leakage:** 100% air-gapped drawing analysis natively compliant with **ITAR (22 CFR § 120-130)**, **EAR (15 CFR § 730-774)**, and **CMMC Level 2 (NIST SP 800-171)**.
* **Tamper-Evident Audit Ledger:** Cryptographic SHA-256 hash chaining on all SQLite characteristic edits and approval checkpoints.

### 6.2 Regulatory Quality Standards
* **SAE AS9102 Rev B & Rev C:** Exact compliance for aerospace First Article Inspection reports (Forms 1, 2, and 3).
* **ASME Y14.5-2018 / 2009:** Full syntax support for geometric tolerancing, basic dimensions, datums, and material modifiers.
* **ISO 2768-m / ISO 2768-f:** Metric general tolerance standards for European and international manufacturing prints.
* **AIAG PPAP (4th Edition):** Dimensional results reporting for automotive supplier audits.

---

## 7. Competitor Kill Matrix (LOONIST vs. Legacy Incumbents)

| Capability / Dimension | **LOONIST** | **InspectionXpert** | **DISCUS Software** | **High QA** |
| :--- | :---: | :---: | :---: | :---: |
| **Starting Price** | **$79 / month** ($790/yr) | $1,800 – $2,500 / year | $2,500 – $4,500 upfront | $4,000 – $10,000 / seat |
| **ITAR / Air-Gapped Security** | ✅ **100% Local (Zero Cloud Leakage)** | ❌ Pushes Cloud OnDemand | ⚠️ Local but clunky | ⚠️ Complex local SQL Server |
| **Modern UI / Ergonomics** | ✅ **React 19, 60 FPS Canvas** | ❌ .NET / WPF (2010s UI) | ❌ Java Swing (1990s UI) | ❌ Heavy Windows Desktop |
| **Title Block Auto-Tolerance** | ✅ **Automatic (.X, .XX, ISO 2768)** | ❌ Manual Title Block Re-entry | ❌ Brittle rule sets | ⚠️ Partial database lookup |
| **ASME Y14.5 AST Parser** | ✅ **14 GD&T Symbols + Composite FCF** | ⚠️ Basic OCR symbol capture | ⚠️ Manual symbol picker | ⚠️ Manual feature builder |
| **1-Click Multiplier Expander** | ✅ **Auto (`4X` $\to$ `1.1, 1.2, 1.3, 1.4`)** | ❌ Manual row cloning | ❌ Manual row cloning | ⚠️ Partial multi-cavity |
| **Drawing Grid Zone Mapping** | ✅ **Automatic (e.g. Zone C-4)** | ⚠️ Manual margin mapping | ⚠️ Manual coordinate config | ⚠️ Manual zone setup |
| **Hybrid Dual-Path Vision & OCR** | ✅ **Vector (<50ms) + Canvas Otsu/Deskew + WASM OCR** | ⚠️ Brittle cloud OCR | ⚠️ Brittle local OCR | ⚠️ Add-on module |
| **Sentence & Prose Exclusion** | ✅ **Multi-Layer Heuristics + Residual Token Check** | ❌ Balloons text/cover sentences | ❌ Balloons text sentences | ❌ Manual exclusion |
| **Native Project Archiving** | ✅ **`.loonist` Portable Package** | ⚠️ Proprietary database | ⚠️ Proprietary `.tdp` file | ❌ Enterprise DB locked |
| **Measurement Pass/Fail Tracking**| ✅ **Live Real-Time Green/Red Calc** | ⚠️ Add-on CMM module | ⚠️ Add-on module | ✅ Built-in SPC |
| **Marked PDF Drawing Export** | ✅ **High-Res Vector SVG Burner** | ✅ Included | ✅ Included | ✅ Included |
| **AS9102 Form 1, 2, 3 Export** | ✅ **Automated Multi-Tab Excel** | ✅ Included | ✅ Included | ✅ Included |
| **Cross-Platform Readiness** | ✅ **Windows & macOS Native** | ❌ Windows Only | ❌ Windows Only | ❌ Windows Only |

---

## 8. Master Acceptance Criteria

- [x] (Sprint 1) Hardened Electron shell with disabled `nodeIntegration`, enabled `contextIsolation`, and strict CSP.
- [x] (Sprint 1) Preload IPC bridge allowlist with Zod runtime payload validation.
- [x] (Sprint 1) Local SQLite (`better-sqlite3`) with `PRAGMA journal_mode=WAL` and atomic Undo/Redo ledger.
- [x] (Sprint 1) Cloudflare Licensing plane generating Ed25519 signatures bound to asymmetric device public keys.
- [x] (Sprint 2) WebGL/Canvas vector viewport rendering dense blueprints at 60 FPS with memory offloading (<1.5GB RAM).
- [x] (Sprint 2) Multi-document session switching preserving zoom, sheet indices, and characteristics across tabs.
- [x] (Sprint 3) Local AI Characteristic Extraction engine processing linear, angular, diameter, radial, and limit dimensions.
- [x] (Sprint 3) ASME Y14.5 GD&T AST parser supporting all 14 geometric characteristics and composite dual-tier frames.
- [x] (Sprint 3) Title Block general tolerance engine auto-applying decimal precision (`.X` to `.XXXX`) and metric ISO 2768-m.
- [x] (Sprint 3) Spatial proximity clustering merging broken multi-line callout stacks into compound characteristics.
- [x] (Sprint 3) Drawing grid zone calculator converting $(x, y)$ coordinates to standard blueprint margin zones (e.g. `Zone C-4`).
- [x] (Sprint 3) 1-Click multiplier expander splitting `4X` callouts into discrete sub-characteristics.
- [x] (Sprint 4) Dual-layer canvas supporting interactive balloon drag-and-drop with dynamic leader lines.
- [x] (Sprint 4) Spatial R-Tree collision-avoidance auto-balloon placement algorithm (`RTreePlacementEngine`).
- [x] (Sprint 4) Magnified 300 DPI drawing crop display in characteristic review drawer for rapid visual sign-off.
- [x] (Sprint 4) Self-contained `.loonist` project package save, auto-save, and load engine.
- [x] (Sprint 5) Live physical measurement entry with real-time Pass/Fail tolerance evaluation (Green/Red indicators).
- [x] (Sprint 5) High-resolution marked blueprint PDF exporter burning vector balloon badges onto drawing sheets (`pdf-lib`).
- [x] (Sprint 5) SAE AS9102 Rev B/C compliant multi-tab Excel compiler for Form 1, Form 2, and Form 3.
- [x] (Sprint 5) Tamper-evident SHA-256 hash-chained audit ledger on all write operations.
- [x] (Sprint 5) Monochromatic industrial CAD dark theme matching AutoCAD, SolidWorks, and Siemens NX (`#121212`, `#181818`, `#222222`).
- [x] (Sprint 6) Hybrid Dual-Path Vision & Vector Ingestion with offline Canvas pre-processing (Otsu adaptive binarization, deskewing, blueprint inversion).
- [x] (Sprint 6) 100% offline WebAssembly Deep Learning OCR engine (`ocrEngineService.ts`) with CAD symbol normalizer (`Ø`, `±`, `°`, `↧`, `⌴`, `⌵`).
- [x] (Sprint 6) Prose & Tutorial Sentence Exclusion Engine with 60+ keyword heuristics and Step 14 residual token validation.
- [x] (Sprint 6) Interactive optical marquee snip-to-capture tool (`box-capture`) and HUD provenance badges (`VECTOR` / `OCR` / `MANUAL`).
- [x] (Sprint 6) SAE AS9102 Form 1 (Part Accountability) Record Validation service with mandatory aerospace CAGE code and sampling plan enforcement.
- [x] (Sprint 6) Unified master test suite expanded to 15 feature test suites with 100% clean pass rate.
- [x] (Sprint 7) Per-project Settings (tolerance presets, mm/in units, skip reference/basic dimensions, numbering start/step/sub-delimiter, AS9102 Rev B/C, ANSI/ASQ Z1.4 sampling, security watermark) persisted in `.loonist` archives.
- [x] (Sprint 7) Application Options with Workspace, Master Data, Templates, Net-Inspect, ITAR/Privacy, and Licensing tabs persisted across sessions.
- [x] (Sprint 7) In-app Ed25519 licensing client (`@noble/curves`): device keypair generation, offline signature verification, activate/renew/revoke, offline certificate export.
- [x] (Sprint 7) Help Center: Quick Start, 14-symbol ASME Y14.5 GD&T library, AS9102 Form 1/2/3 guide, keyboard shortcuts, diagnostics, About.
- [x] (Sprint 7) ASME Y14.5 § 1.8.16 chamfer parsing (depth vs angle, multiplier decoupling) and compound callout deconstruction into AS9102 Form 3 sub-characteristics.
- [x] (Sprint 7) Drawing-note unit detection with ISO 2768-m size-band tolerances for integer metric dimensions.
- [x] (Sprint 7) Manual marquee rejection of non-inspectable prose and administrative notes.
- [x] (Sprint 7) Balloon action popover (shape, colour, split, reset, delete), current/all-sheet scope, quick delete, double-click-to-pan, unified Export dialog (PDF + XLSX/CSV).
- [x] (Sprint 7) Custom Excel FAIR templates: upload a customer `.xlsx` with `{{placeholders}}`; export fills it while preserving formatting.
- [x] (Sprint 7) Unified master test suite expanded to 24 feature test suites with 100% clean pass rate (25 with the Sprint 8 licensing suite).
- [x] (Sprint 8) In-app activation works in the packaged app: licensing calls run in the Electron main process, so the renderer CSP stays closed to external hosts.
- [x] (Sprint 8) Device Ed25519 private key held only in the main process, encrypted with Electron `safeStorage`; legacy plain-text keys removed on load.
- [x] (Sprint 8) Zod payload validation on every IPC channel through a single validated handler (100% IPC validation guardrail restored).
- [x] (Sprint 8) Renew and revoke requests signed with the device key and verified by the Worker; renew re-signs the license from D1.
- [ ] (Sprint 8) Embed the licensing server public key and verify stored licenses offline on start-up.
- [ ] (Sprint 8) Wire remaining Project Settings into engines (balloon prefix, leading zeros, multiplier behaviour, OCR review floor, auto-balloon notes, auto zones, AS9102 revision) and implement the Net-Inspect CSV exporter.
- [ ] (Sprint 8) Automated GitHub Actions build pipeline producing signed Windows `.exe` installers with EV Code Signing and RFC 3161 timestamps.
