<div align="center">

# ✈️ FAI.EV.ENGINEER
### *Enterprise AI-Powered First Article Inspection Platform*

[![Version](https://img.shields.io/badge/Version-v1.0_Baseline-blue.svg?style=for-the-badge&logo=git)](./FAI.EV.ENGINEER_MASTER_PRD.md)
[![Status](https://img.shields.io/badge/Status-Approved_SSOT-emerald.svg?style=for-the-badge&logo=checkmark)](./FAI.EV.ENGINEER_MASTER_PRD.md)
[![Compliance](https://img.shields.io/badge/Compliance-SAE_AS9102_Rev_B%2FC-orange.svg?style=for-the-badge&logo=shield)](./FAI.EV.ENGINEER_MASTER_PRD.md)
[![Form Factor](https://img.shields.io/badge/Platform-Desktop_B2B_SaaS-purple.svg?style=for-the-badge&logo=electron)](./FAI.EV.ENGINEER_MASTER_PRD.md)
[![Owner](https://img.shields.io/badge/Product_Owner-Harsh_Yadav-black.svg?style=for-the-badge&logo=person)](./FAI.EV.ENGINEER_MASTER_PRD.md)

<p align="center">
  <b>Postman for Engineering Drawings</b> — Automating First Article Inspection (FAI) for Aerospace, Automotive, Medical Devices, and Precision Machine Shops.
</p>

---

</div>

> [!IMPORTANT]
> **SINGLE SOURCE OF TRUTH (SSOT)**  
> This repository contains the official Master Product Requirements Document for **FAI.EV.ENGINEER** (Product Owner: **Harsh Yadav**).  
> All requirements build strictly upon the SAE AS9102 (Rev B/C) standard and ASME Y14.5 GD&T drafting specifications.

---

## 📌 Repository Documentation Index

| File | Purpose | Description |
| :--- | :--- | :--- |
| 📄 [`FAI.EV.ENGINEER_MASTER_PRD.md`](./FAI.EV.ENGINEER_MASTER_PRD.md) | **Master PRD (SSOT)** | Official Product Requirements Document in Harsh Yadav's 7-part executive format. |
| 🧠 [`Phase_1_Business_Domain_Analysis.md`](./Phase_1_Business_Domain_Analysis.md) | **Phase 1: Business Domain Analysis** | Domain Model, Bounded Contexts, Event Storming, Business Rules, ERD, State Machines. |

---

## 🎯 Executive Overview & Core KPIs

```mermaid
flowchart LR
    subgraph Highlights ["Key Platform Highlights"]
        Time["⚡ >85% Reduction in FAI Setup Time (8h -> <20m)"]
        Acc["🎯 ≥95% AI Extraction Accuracy"]
        Proc["⏱️ <30s Average Drawing Processing Time"]
        Sec["🔒 Zero Data Loss & Session Isolation"]
    end
```

### Key Success Metrics
* 🚀 **Reduce Manual Ballooning Time:** By at least **85%** (cutting setup time from 4–12 hours down to $<20$ minutes per drawing sheet).
* 🎯 **AI Extraction Accuracy:** **$\ge 95\%$** across supported vector and scanned engineering blueprints.
* ⚡ **Processing Latency:** Average drawing processing time **$< 30$ seconds**; UI interaction response time **$< 2$ seconds**.
* 🛡️ **Guardrail Uptime:** System Uptime **$\ge 99.9\%$**, PDF Processing Failure Rate **$< 1\%$**, Zero data loss during processing or export.

---

## 🔄 End-to-End Product Flow

```mermaid
flowchart TD
    A["1. Launch FAI.EV.ENGINEER Desktop App"] --> B["2. Auth / Google SSO Login"]
    B --> C["3. Select Hierarchy: Organization → Project → Part → Revision → Drawing"]
    C --> D["4. Upload Blueprint (Vector / Scanned PDF)"]
    D --> E["5. 60 FPS Viewport Rendering & Vector Canvas Initialization"]
    E --> F["6. User Clicks 'Auto Balloon' (Explicit AI Trigger)"]
    
    subgraph Local_AI_Pipeline ["Local AI Processing Engine"]
        F --> F1["Title Block Extraction (AS9102 Form 1 & 2)"]
        F --> F2["Dimension & Tolerance Parsing (Form 3)"]
        F --> F3["ASME Y14.5 GD&T Feature Control Frame AST Parsing"]
    end
    
    F1 & F2 & F3 --> G["7. Spatial R-Tree Collision-Free Balloon Placement"]
    G --> H["8. Postman-Style HITL Verification Grid"]
    
    subgraph HITL_Review ["Human Verification & Editing"]
        H --> H1["Edit Balloon Numbers, Leaders, Visibility & Values"]
        H --> H2["Low-Confidence Visual Crop Callout Inspection (<95%)"]
        H --> H3["Enter Measured Caliper / CMM Results"]
    end
    
    H1 & H2 & H3 --> I["9. Validation & Export (AS9102 Form 1/2/3, Excel, CSV, PDF)"]
    I --> J["10. Encrypted Storage & Audit Logging"]
```

---

## 🖥️ Postman-Style Three-Pane Workspace

```
+-------------------------------------------------------------------------------------------------------+
|  FAI.EV.ENGINEER  [File]  [Edit]  [View]  [Auto Balloon]  [Tools]  [Export]     [Offline Active]      |
+-------------------------------------------------------------------------------------------------------+
|  [Tabs]:  [+] Drawing_Rev_C.afai  |  Turbine_Blade_Form1.afai                                         |
+-------------------+--------------------------------------------------+--------------------------------+
| NAVIGATOR         | DRAWING CANVAS (60 FPS WebGL / SVG Overlay)      | FEATURE INSPECTOR & GRID       |
| ----------------- | ------------------------------------------------ | ------------------------------ |
| > Org: Acme Aerospace                                                | Balloon #14  [Confidence: 99%] |
|  > Project: Turbine                                                 | ------------------------------ |
|   > Part: Blade-7728                                                 | Nominal: 1.500  Unit: INCH     |
|    > Rev: C (Active) |            +-----------------------+             | Tol: +0.005 / -0.005           |
|                     |            |  (14) 1.500 +/- .005  |             | Limits: 1.4950 - 1.5050        |
| LAYERS              |            +-----------------------+             | ------------------------------ |
| [x] Balloons        |                                                  | Measured Value: [ 1.5020 ]     |
| [x] AI Highlight    |                                                  | Status: [ PASS (GREEN) ]       |
| [ ] Geometry        |                                                  | ------------------------------ |
|                     |                                                  | [ Approve ] [ Edit ] [ Delete] |
+-------------------+--------------------------------------------------+--------------------------------+
| FEATURE TABLE GRID (Bottom Dockable)                                                                  |
| #  | Balloon | Zone | Type      | Requirement    | Min    | Max    | Measured | Status  | Confidence |
| ---|---------|------|-----------|----------------|--------|--------|----------|---------|------------|
| 1  | 14      | B4   | LINEAR    | 1.500 +/- .005 | 1.4950 | 1.5050 | 1.5020   | PASS    | 99.4%      |
| 2  | 15      | C2   | GD&T POS  | [Pos|0.002|A|B]| 0.0000 | 0.0020 | 0.0008   | PASS    | 97.1% (Warn|
+-------------------------------------------------------------------------------------------------------+
```

---

## 👥 Personas & Target Industries

* **Primary Daily Users:** Quality Engineers, Manufacturing Engineers, Inspection Engineers, Metrologists.
* **Primary Buyers:** Quality Department Heads, VPs of Manufacturing, Machine Shop Owners.
* **Target Industries:** Aerospace & Defense, Automotive, Medical Devices, Precision Manufacturing, Machine Shops.

---

> [!NOTE]
> **Repository Owner:** Harsh Yadav (Lead Product Owner)  
> **Repository Status:** Single PRD SSOT Baseline Established
