# FAI.EV.ENGINEER — PRD

| Attribute | Value |
| :--- | :--- |
| **Product Name** | `FAI.EV.ENGINEER` |
| **Version** | v1.0 |
| **Document Status** | Draft |
| **Last Updated** | 23 July 2026 |
| **Product Owner (POC)** | Harsh Yadav |
| **Design POC** | To Be Decided |
| **Engineering POC** | To Be Decided |
| **Marketing POC** | To Be Decided |
| **QA POC** | To Be Decided |

---

## Why? (Objective)

### 1. Business Objectives
* **Primary differentiation:** Affordable alternative to existing FAI ballooning solutions (Balloonist.io, 1Factory).
* **Business model:** Subscription SaaS.
* **Pricing:** To be decided after product development. *Call for details.*
* **Year 1 business goals:** (To Be Decided)

### 2. User Objectives
* Reduce manual ballooning effort and repetitive feature extraction.
* Reduce transcription errors in AS9102 report creation (Form 1, Form 2, and Form 3).
* Deliver a faster workflow with explicit human control (Auto Balloon is user-triggered).

---

## How do we measure success?

### 1. Associated OKR/Goal
* Reduce manual FAI ballooning time by **at least 85%**.
* Deliver an affordable SaaS for manufacturing companies.
* Validate the product through weekly beta releases and continuous customer feedback.

### 2. Success Metrics
* AI extraction accuracy $\ge 95\%$ for supported engineering drawings.
* Average drawing processing time $< 30$ seconds.
* Export success rate $\ge 99\%$.
* Weekly active beta users continue to increase over each release.
* Positive customer feedback from pilot users.

### 3. Guardrail/Do not disturb metrics (These metrics shouldn’t be negatively affected)
* System uptime $\ge 99.9\%$.
* PDF processing failure rate $< 1\%$.
* Zero data loss during processing or export.
* No degradation in AI extraction accuracy while introducing new features.
* Average application response time remains $< 2$ seconds for normal user interactions.
* User drawings are processed only during the active session and are not permanently stored.
* Unauthorized users must never be able to access another organization's drawings or reports.

---

## Who are the users:

### 1. Persona
* **Primary daily users:** Quality Engineers, Manufacturing Engineers, Inspection Engineers
* **Primary buyers:** Manufacturing companies / Quality departments
* **Industries:** Aerospace, Automotive, Medical Devices, Precision Manufacturing, Machine Shops

### 2. Problems we are solving
* Existing FAI ballooning solutions can be costly for many manufacturers, particularly small and mid sized organizations.
* Manual ballooning is slow.
* Manual feature extraction is repetitive.
* Creating AS9102 reports consumes hours.
* Human transcription errors occur frequently.
* Need a faster, simpler, more affordable workflow.

### 3. How do we know these problems exist?
* Competitive analysis (Balloonist.io, 1Factory, etc.)
* Customer interviews & stakeholder discussions
* Industry workflows (AS9102 / FAI process)
* Market research
* Customer testimonials from existing FAI solutions

---

## Solution:

### 1. Brief of the solution.
* **FAI.EV.ENGINEER** is a cloud-based & desktop B2B SaaS platform that automates FAI ballooning directly from engineering PDF drawings.
* Users upload engineering drawings (vector PDFs or scanned raster PDFs up to 300 DPI) and the application renders the drawing in a high-performance viewport.
* AI processing begins **only after the user clicks "Auto Balloon"**. The platform follows a human-in-the-loop workflow, where AI performs the initial extraction and ballooning, and users review and validate the results before export.
* The AI engine extracts linear/angular dimensions, symmetric/bilateral tolerances, ASME Y14.5 GD&T symbols & feature control frames (Position, Flatness, Perpendicularity, Datums A-Z, Modifiers MMC/LMC), inspection characteristics, notes, and title block metadata.
* Automatically generates numbered balloons using a spatial R-Tree collision-avoidance placement engine and a structured feature table.
* Users can edit balloon numbers, leaders, visibility, and extracted values before exporting.
* **Supported Export Formats:** Full **SAE AS9102 (Rev B/C)** specification package:
  * **Form 1:** Part Number Accountability (Title Block, Part Name/Number, Revision, Serial/Batch, Cage Code, Org Name).
  * **Form 2:** Product Accountability (Raw Materials, Special Processes, Functional Test Specifications).
  * **Form 3:** Characteristic Accountability (Characteristic #, Zone Location, Requirement, Nominal Value, Upper/Lower Tolerances, GD&T Symbol, Measured Results, Pass/Fail).
  * **Native Excel (.xlsx), CSV, and marked-up PDF blueprints.**
* The platform supports configurable branding and white-label deployments.

### 2. Other alternatives are considered with prioritization metrics.
* Alternative approaches were evaluated through competitive analysis and prioritized based on customer value, implementation effort, and impact.

---

## Product flow (Details of the feature/product):

### 1. Customer Journey
1. Open application
2. Login with Google / SSO
3. Select Organization $\rightarrow$ Project $\rightarrow$ Part $\rightarrow$ Revision $\rightarrow$ Drawing
4. Upload PDF
5. Render drawing
6. User clicks **Auto Balloon**
7. AI processing (dimension detection $\rightarrow$ tolerance detection $\rightarrow$ GD&T recognition $\rightarrow$ title block & feature extraction)
8. Automatic balloon generation + feature table generation
9. Manual review + editing
10. Validation
11. Export (AS9102 Form 1, Form 2, Form 3 / Excel / CSV / PDF)

### 2. Wireframes and Flow diagrams
* **Postman-Style Three-Pane Interface Architecture:**
  * **Left Navigation Sidebar:** Hierarchy Tree (`Organization -> Project -> Part -> Revision -> Drawing`), Sheet Selector, Layer Toggles (Balloons, AI Highlights, Dimensions, Geometry).
  * **Center Viewport:** High-FPS WebGL/Canvas PDF viewer with interactive SVG balloon overlays, pan/zoom ($10\% \to 3200\%$), and rotate controls.
  * **Right/Bottom Dockable Inspector:** Feature Inspector Grid displaying Characteristic #, Requirement, Nominal Value, Upper/Lower Tolerances, GD&T Symbol, Confidence Score ($<95\%$ flagged in warning yellow for human review), and Pass/Fail status.

### 3. User Stories
1. As a Quality Engineer, I want to upload an engineering drawing so that I can begin the FAI process.
2. As a Quality Engineer, I want AI to identify inspection characteristics automatically when I click "Auto Balloon" so that I don't have to create balloons manually.
3. As a Quality Engineer, I want to edit AI-generated balloons before export so that I can ensure accuracy.
4. As a Quality Engineer, I want to export compliant AS9102 Form 1, 2, and 3 reports so that inspection documentation is ready immediately.
5. As an IT Administrator, I want secure tenant isolation and encrypted storage so that proprietary defense drawings remain protected.

### 4. User acceptance criteria
* AI must start **only after user clicks Auto Balloon**.
* Must support vector PDFs and scanned PDFs up to 300 DPI.
* Must provide viewer interactions (zoom/pan/rotate at 60 FPS).
* Must support editing workflows (edit/renumber/delete/hide balloons; modify leaders; correct extracted values).
* Must export complete **SAE AS9102 (Form 1, Form 2, Form 3)** packages, Excel, CSV, PDF.
* Must provide secure storage, local AES-256 encryption, tenant isolation, and audit logs.
* Must be subscription-ready and white-label-ready in architecture.

### 5. Edge cases
* **Maximum PDF file size:** (To Be Decided)
* **Maximum pages:** (To Be Decided)
* **Low-quality scanned PDFs:** Automatic adaptive deskewing and binarization; flags low-confidence OCR text ($<95\%$) in warning yellow for manual verification.
* **Dense drawings with overlapping dimensions:** Spatial R-Tree collision-avoidance algorithm orbits balloons clear of drawing geometry and text.
* **Multi-page drawings:** Preserves continuous global balloon sequence across all pages.
* **Renumber collisions / gaps (rules):** Automatically shifts sequential numbers when balloons are inserted or deleted to eliminate duplicate numbers or gaps.

### 6. Event tracking sheet
* Are users using the feature? (`event_autoballoon_clicked`)
* Where do users drop off? (`event_session_dropoff`)
* Which features are most popular? (`event_feature_used`)
* How long does a workflow take? (`event_workflow_duration`)

---

## Tentative Timelines:

| Task | Date |
| :--- | :--- |
| Leadership approval | To Be Decided |
| Design ready | To Be Decided |
| Prototype testing | To Be Decided |
| Development starts | To Be Decided |
| Beta Launch | To Be Decided |

---

## Dependencies:

### 1. Open Questions
* Pricing model details (architecture must support configurable pricing models for future)
* User roles / RBAC
* Performance targets
* Maximum PDF file size and maximum pages
* Integrations (ERP / QMS export webhooks)
* Success metrics / KPIs

### 2. Infrastructure requirements
* (To Be Decided)

### 3. Budget approvals
* (To Be Decided)

### 4. Partner Support (APIs, Partnerships)
* (To Be Decided)

### 5. Internal Dependencies (Tech, Design, Other Teams)
* (To Be Decided)

---

## Related documents:

1. **Tech planning document**
   * (To Be Decided)
2. **Design planning document**
   * (To Be Decided)
3. **Go to market planning**
   * (To Be Decided)
