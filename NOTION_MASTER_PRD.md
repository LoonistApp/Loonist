# 📄 FAI.EV.ENGINEER — Master Product Requirements Document (PRD)

> 📌 **DOCUMENT DATABASE PROPERTIES**
> 
> * **Status:** 🟢 `Approved / Baseline (Single Source of Truth)`
> * **Product Name:** `FAI.EV.ENGINEER`
> * **Version:** `v1.0 Baseline`
> * **Product Owner (POC):** Harsh Yadav
> * **Target Competitors:** Balloonist.io | 1Factory
> * **Target Compliance:** SAE AS9102 (Rev B & C), ASME Y14.5-2018, CMMC Level 2 / ITAR
> * **Form Factor:** Desktop-First B2B SaaS (Electron + React + Native C++ AI)
> * **Target OS:** Windows 11 Enterprise (64-bit) [Primary] | macOS Apple Silicon [Secondary]

---

> 🎯 **EXECUTIVE SUMMARY & BUSINESS OBJECTIVES**
> 
> **FAI.EV.ENGINEER** is an **affordable B2B SaaS platform** designed as "Postman for Engineering Drawings". It automates the First Article Inspection (FAI) process for aerospace, automotive, medical device, and precision manufacturing machine shops. 
> 
> By extracting characteristics (dimensions, tolerances, GD&T) and generating numbered balloons upon explicit user command (**"Auto Balloon"**), it produces certified **SAE AS9102 Form 1, 2, and 3 reports** in under 5 minutes per sheet.
> 
> ### Key Metrics & Success Benchmarks
> * 🚀 **>85% Reduction in FAI Ballooning Time:** Cuts manual ballooning from 4-12 hours per sheet to $<20$ minutes.
> * 🎯 **≥95% AI Extraction Accuracy:** On supported vector and scanned engineering drawings.
> * ⚡ **<30 Seconds Average Processing Time:** Per drawing sheet.
> * 🔒 **Zero Data Loss & High Reliability:** System uptime $\ge 99.9\%$, PDF processing failure rate $<1\%$, interaction response time $<2$ seconds.

---

## 👥 1. User Personas & Target Industries

| Attribute | Specification |
| :--- | :--- |
| **Primary Daily Users** | Quality Engineers, Manufacturing Engineers, Inspection Engineers |
| **Primary Buyers** | Manufacturing Companies / Quality Departments |
| **Target Industries** | Aerospace, Automotive, Medical Devices, Precision Manufacturing, Machine Shops |
| **Authentication** | Google OAuth 2.0 SSO + Enterprise SAML/OIDC |

---

## 🔄 2. Customer Journey & Product Flow

```
1. Open Application
   ↓
2. Login with Google (SSO)
   ↓
3. Select Organization → Project → Part → Revision → Drawing
   ↓
4. Upload PDF (Vector or Scanned)
   ↓
5. Render Drawing Viewport (60 FPS Pan/Zoom/Rotate)
   ↓
6. User Clicks "Auto Balloon" (Explicit AI Trigger)
   ↓
7. AI Processing (Dimension Detection → Tolerance Detection → GD&T Recognition → Feature Extraction)
   ↓
8. Automatic Balloon Generation + Feature Table Generation
   ↓
9. Postman-Style Manual Review & Editing (Renumber, Move Leaders, Edit Values)
   ↓
10. Validation & Export (AS9102 Form 3, Excel, CSV, PDF)
```

---

## 🚀 3. Functional Requirements (Epics & Stories)

### 📁 Epic 1: Auth & Organization Hierarchy
* `REQ-AUTH-01`: Support Google SSO Login & Enterprise SAML.
* `REQ-AUTH-02`: Hierarchy navigation: `Organization -> Project -> Part -> Revision -> Drawing`.
* `REQ-AUTH-03`: Configurable branding and white-label deployment support.

### 🤖 Epic 2: AI Feature Extraction & "Auto Balloon" Engine
* `REQ-AI-01`: **AI starts ONLY after user clicks "Auto Balloon"** (Explicit Human Control).
* `REQ-AI-02`: Automatic extraction of Linear, Radial, Angular, Limit, and Bilateral Tolerances.
* `REQ-AI-03`: ASME Y14.5 GD&T Feature Control Frame symbol parsing (Position, Flatness, Datums A-Z).
* `REQ-AI-04`: Title Block & Notes extraction for AS9102 Form 1 & 2.

### 🎈 Epic 3: Ballooning & Editing Engine
* `REQ-BAL-01`: Collision-free spatial balloon placement next to extracted dimensions.
* `REQ-BAL-02`: Editing controls: Edit balloon numbers, modify leader lines, hide balloons, re-sequence numbers.

### 📊 Epic 4: AS9102 & Multi-Format Export
* `REQ-EXP-01`: Export to AS9102 Form 3, Native Excel (`.xlsx`), CSV, and Marked-up Ballooned PDF.
* `REQ-EXP-02`: Custom export branding and white-label formatting.

---

## ⚡ 4. Guardrail & Success Metrics

```
+-------------------+---------------------------------------------------------+
| Guardrail Metric  | Target Threshold Specification                          |
+-------------------+---------------------------------------------------------+
| System Uptime     | >= 99.9% availability                                   |
| PDF Fail Rate     | < 1% processing failure rate                            |
| UI Latency        | < 2 seconds for normal user interactions                |
| Data Protection   | Zero data loss during processing or export              |
| Processing Speed  | < 30 seconds average drawing processing time            |
+-------------------+---------------------------------------------------------+
```

---

> 📌 **DEFINITION OF DONE (DoD)**
> 1. All user stories implemented with 0 errors.
> 2. AI model achieves $\ge 95\%$ accuracy on test engineering drawings.
> 3. Verified zero data loss during processing and export.
> 4. Exported files conform strictly to SAE AS9102 standards.
