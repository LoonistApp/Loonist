# LOONIST PRD (Product Requirement Document)

| Attribute | Value |
| :--- | :--- |
| **Product Name** | `LOONIST` |
| **Version** | v2.0 (Desktop-First Enterprise SaaS Platform) |
| **Document Status** | Approved Master Baseline PRD |
| **Last Updated** | 5 September 2026 |
| **Product Owner (POC)** | Harsh Yadav |
| **Architectural Model** | Offline-First Desktop App with Cloud Licensing Control Plane |
| **Target Infrastructure** | Electron + Local SQLite + Cloudflare Workers edge network |

---

## 1. Why? (Objective & Business Context)

### 1.1 Business Objectives
* **Primary Differentiation:** Modern, AI-augmented, strictly secure offline-first First Article Inspection (FAI) ballooning and AS9102 Form generation platform replacing legacy tools.
* **Business Model:** Multi-Tenant B2B Subscription SaaS, distributed as a desktop application with cryptographic hardware-bound licensing.
* **Target Audience:** Enterprise Aerospace & Defense Tier 1/2 Suppliers, Automotive Precision Machining, Medical Device Manufacturers, ISO 9001 / AS9100 Certified Machine Shops.
* **Year 1 Business Goals:**
  * Deliver a highly secure, ITAR-compliant offline environment.
  * Reduce manual ballooning and AS9102 report generation time by **at least 85%** (under 15 minutes per drawing package).
  * Onboard 150+ enterprise manufacturing accounts.

### 1.2 User Objectives
* Eliminate repetitive manual dimension extraction and balloon placement on complex PDF blueprints.
* Eliminate human transcription errors when populating SAE AS9102 Rev B/C reports (Form 1, Form 2, Form 3).
* Deliver a lightning-fast interactive desktop workspace with 60 FPS vector PDF pan/zoom.
* Ensure absolute data privacy: Blueprints never leave the user's hard drive unless explicitly exported.

---

## 2. Success Metrics & Guardrail Metrics

### 2.1 Key Performance Indicators (KPIs)
* **AI Extraction Accuracy:** $\ge 95\%$ accuracy for linear, angular, radial, bilateral, limit, and ASME Y14.5 GD&T feature control frames (Local ONNX Models).
* **Drawing Processing Latency:** Average drawing ingestion and AI feature extraction time $< 15$ seconds processed purely on local hardware.
* **UI Responsiveness:** Sub-millisecond Undo/Redo database transactions via `better-sqlite3` WAL mode.

### 2.2 Guardrail / System Reliability Metrics
* **Licensing Uptime SLA:** $\ge 99.99\%$ for the Cloudflare activation plane.
* **Zero Cloud Data Leakage:** Total local isolation. Engineering drawings and IP never touch the cloud.
* **IPC Security:** 100% of inter-process communication between React UI and Node.js backend strictly validated by Zod schemas to prevent arbitrary code execution (RCE).
* **Cryptographic Trust:** 100% of offline licenses verified locally via Ed25519 signature validation.

---

## 3. User Personas & Target Problems

### 3.1 Target Personas
1. **Primary Daily Users:** Quality Engineers, Manufacturing Engineers, Quality Inspectors.
2. **Reviewers & Approvers:** Quality Assurance Managers, CMM Technicians.
3. **Enterprise Buyers & Admins:** Directors of Quality, IT Infrastructure & Security Administrators (who demand local-only file processing).

### 3.2 Key Pain Points Solved
* Defense suppliers cannot legally upload ITAR-restricted blueprints to random cloud SaaS platforms. This architecture solves that by processing AI locally.
* Manual ballooning is slow, tedious, and highly prone to human copy-paste errors.
* Existing desktop tools have clunky, outdated UIs from the 1990s.

---

## 4. Product Flow & Core Feature Specification

### 4.1 End-to-End Customer Journey
1. **App Installation & Activation:** User installs the Electron app, enters a single-use token, and the app pings the Cloudflare API to register the hardware and receive an Ed25519 signed license.
2. **Offline Mode Engaged:** The app runs completely offline. User loads a PDF from their local hard drive.
3. **Interactive Viewport Render:** React frontend renders high-resolution blueprint (60 FPS pan/zoom/rotate).
4. **Explicit Trigger ("Auto Balloon"):** User clicks the prominent **Auto Balloon** button to dispatch an extraction request.
5. **Local AI Extraction (Sprint 3):** Request passed securely over IPC to a local ONNX Neural Engine + ASME Y14.5 GD&T parser.
6. **Real-time Viewport Hydration:** Numbered balloons and inspector grid populate dynamically in the UI (Sprint 4). 
7. **Interactive Review & Verification:** Quality Engineer edits balloon placement. All changes are saved locally to SQLite with atomic Undo/Redo history.
8. **Automated AS9102 Compliance Export (Sprint 5):** One-click generation of certified **SAE AS9102 Form 1, Form 2, and Form 3** Excel packages saved locally.

---

## 5. Technology Stack & Production System Architecture

| Tier / Domain | Selected Technology | Role & Architecture Rationale |
| :--- | :--- | :--- |
| **Desktop Framework** | **Electron (Node.js)** | Cross-platform container providing high-privilege hardware/filesystem access. |
| **Frontend UI** | **React 19 + TypeScript + Vite** | Extremely fast UI rendering, componentized architecture, modern developer experience. |
| **Frontend Canvas** | **TailwindCSS + HTML5 Canvas** | High performance drawing interaction. |
| **IPC Bridge Security** | **ContextBridge + Zod** | Strict allowlist for frontend-to-backend communication. Blocks malicious XSS payloads. |
| **Local Database** | **SQLite (better-sqlite3)** | Lightning-fast synchronous local storage. PRAGMA WAL enabled for concurrent reads/writes and Undo/Redo logic. |
| **Cloud Licensing API** | **Cloudflare Workers (Hono)** | Global, serverless Edge API for handling activations instantly worldwide with zero server maintenance. |
| **Cloud Database** | **Cloudflare D1** | Serverless SQL ledger storing Tenants, Devices, Licenses, and AuditLogs. |
| **Cryptography** | **Ed25519 (@noble/curves)** | Highly-audited zero-dependency crypto used by Cloudflare to securely sign offline license payloads. |
| **Local AI Engine** | **ONNX Runtime (Planned Sprint 3)**| Will process neural OCR and spatial recognition locally without uploading to the cloud. |

---

## 6. Non-Functional & Enterprise Compliance Requirements

### 6.1 Security & Threat Mitigation
* **Context Isolation:** Enforced in Electron `main.ts` so the React UI cannot run arbitrary Node.js filesystem commands.
* **Sandbox Mode:** Restricts the Chromium renderer process at the operating system level.
* **Offline First:** Blueprint PDFs are never sent over the internet, natively satisfying ITAR and CMMC data residency requirements.

### 6.2 Regulatory Standards
* **SAE AS9102 Rev B/C Compliance:** 100% strict adherence to Form 1, Form 2, and Form 3 drafting standards for aerospace QA audits.
* **ASME Y14.5 GD&T Compliance:** Abstract Syntax Tree (AST) representation for all geometric tolerances.

---

## 7. Master Acceptance Criteria

- [x] (Sprint 1) Web Application must render locally via Vite + React within an Electron shell.
- [x] (Sprint 1) Electron must enforce strict IPC boundaries with Zod schema validation.
- [x] (Sprint 1) SQLite must support transaction wrappers and an atomic Undo/Redo history ledger.
- [x] (Sprint 1) Cloudflare Licensing plane must generate an Ed25519 cryptographic signature binding the license to a device.
- [ ] (Sprint 2) WebGL/Canvas viewport must render dense engineering blueprints at 60 FPS with memory offloading (<1.5GB RAM).
- [ ] (Sprint 3) AI extraction must execute locally via ONNX when user explicitly clicks "Auto Balloon" with CPU/GPU fallbacks.
- [ ] (Sprint 3) ASME Y14.5 GD&T AST parser must correctly interpret geometric tolerances.
- [ ] (Sprint 4) Dual-layer canvas must support interactive dragging, smart leader lines, and R-Tree spatial collision avoidance.
- [ ] (Sprint 5) Audit writes must enforce SHA-256 tamper-evident hash chaining.
- [ ] (Sprint 5) Reports must export valid SAE AS9102 Form 1, 2, 3 workbooks (.xlsx) locally.
- [ ] (Sprint 6) Windows installer (.exe) must build via automated CI/CD and be signed with Sectigo EV Certificate and RFC 3161 timestamping.

