# FAI.EV.ENGINEER — Enterprise Master PRD

| Attribute | Value |
| :--- | :--- |
| **Product Name** | `FAI.EV.ENGINEER` |
| **Version** | v2.0 (Browser-First Enterprise SaaS Platform) |
| **Document Status** | Approved Master Baseline PRD |
| **Last Updated** | 10 August 2026 |
| **Product Owner (POC)** | Harsh Yadav |
| **Architectural Model** | Multi-Tenant Cloud SaaS + Hybrid Desktop Agent Ready |
| **Target Infrastructure** | Containerized Kubernetes (EKS/GKE/AKS), KEDA, Kafka Event Mesh |

---

## 1. Why? (Objective & Business Context)

### 1.1 Business Objectives
* **Primary Differentiation:** Modern, AI-augmented, browser-first First Article Inspection (FAI) ballooning and AS9102 Form generation platform replacing legacy desktop single-user tools (1Factory, Balloonist.io, Discus).
* **Business Model:** Multi-Tenant B2B Subscription SaaS (Tiered Seat Licenses + Usage-based processing credits).
* **Target Audience:** Enterprise Aerospace & Defense Tier 1/2 Suppliers, Automotive Precision Machining, Medical Device Manufacturers, ISO 9001 / AS9100 Certified Machine Shops.
* **Year 1 Business Goals:**
  * Achieve 99.95% system availability.
  * Reduce manual ballooning and AS9102 report generation time by **at least 85%** (under 15 minutes per drawing package).
  * Onboard 150+ enterprise manufacturing accounts across USA, EU, and APAC.

### 1.2 User Objectives
* Eliminate repetitive manual dimension extraction and balloon placement on complex PDF blueprints.
* Eliminate human transcription errors when populating SAE AS9102 Rev B/C reports (Form 1, Form 2, Form 3).
* Deliver a lightning-fast, postman-style interactive browser workspace with 60 FPS vector PDF pan/zoom.
* Maintain explicit human control (*Auto Balloon* executes strictly on user demand, never auto-triggered on upload).
* Real-time team collaboration: Quality Engineers, Shop Floor Inspectors, and QA Managers work within unified tenant projects.

---

## 2. Success Metrics & Guardrail Metrics

### 2.1 Key Performance Indicators (KPIs)
* **AI Extraction Accuracy:** $\ge 95\%$ accuracy for linear, angular, radial, bilateral, limit, and ASME Y14.5 GD&T feature control frames.
* **Drawing Processing Latency:** Average drawing ingestion and AI feature extraction time $< 15$ seconds for standard single-page drawings ($< 45$ seconds for 50-page packages).
* **Export Success Rate:** $\ge 99.9\%$ for SAE AS9102 Form 1, 2, and 3 workbooks (.xlsx), marked-up PDF blueprints, and CSV streams.
* **Monthly Active Users (MAU):** Continuous retention growth across enterprise accounts.

### 2.2 Guardrail / System Reliability Metrics
* **System Uptime SLA:** $\ge 99.95\%$ platform availability backed by Kubernetes multi-AZ deployments.
* **PDF Processing Failure Rate:** $< 0.1\%$ across all vector and scanned raster PDFs up to 300 DPI (200MB limit).
* **Zero Cross-Tenant Data Leakage:** Strict tenant isolation enforced at database level (Prisma + PostgreSQL Row-Level Security) and object storage level (S3 presigned URLs with tenant prefixes).
* **UI Interaction SLA:** Viewport pan/zoom, balloon dragging, and inspector table edits respond in $< 100\text{ ms}$.
* **Audit Compliance:** 100% of user modifications and approvals logged in a SHA-256 hash-chained immutable audit ledger.

---

## 3. User Personas & Target Problems

### 3.1 Target Personas
1. **Primary Daily Users:** Quality Engineers, Manufacturing Engineers, Quality Inspectors.
2. **Reviewers & Approvers:** Quality Assurance Managers, CMM Technicians.
3. **Enterprise Buyers & Admins:** Directors of Quality, IT Infrastructure & Security Administrators.

### 3.2 Key Pain Points Solved
* Manual ballooning is slow, tedious, and highly prone to human copy-paste errors.
* Existing desktop tools lack real-time cloud collaboration, multi-user project sharing, and enterprise RBAC.
* High cost of legacy licensing with zero modern API integrations into ERP/QMS systems (SAP, NetSuite, Plex).
* Defense suppliers need strict security compliance (SOC2 Type II, ISO 27001, ITAR/CMMC ready infrastructure).

---

## 4. Product Flow & Core Feature Specification

### 4.1 End-to-End Customer Journey
1. **Authentication & Tenant Onboarding:** Login via Google SSO, SAML 2.0 / Okta enterprise auth, or Resend magic links. Select or switch Organization Tenant.
2. **Project Hierarchy Navigation:** Navigate `Organization -> Project -> Part -> Revision -> Drawing Package`.
3. **Direct-to-S3 Upload:** Drag and drop vector or scanned PDF drawing blueprints (presigned S3 upload link generated via Node.js API).
4. **Interactive Viewport Render:** Next.js frontend renders high-resolution blueprint using client-side WebGL / PDF.js canvas viewport (60 FPS pan/zoom/rotate).
5. **Explicit Trigger ("Auto Balloon"):** User clicks the prominent **Auto Balloon** button to dispatch an extraction request.
6. **Kafka Event Mesh & AI Workers:** Request published to Kafka topic (`autoballoon.requested`). KEDA autoscales AI worker containers (ONNX Neural OCR + ASME Y14.5 GD&T AST parser + spatial R-Tree balloon collision avoidance).
7. **Real-time Viewport Hydration:** AI worker streams results back via WebSockets/Redis PubSub. Numbered balloons and inspector grid populate dynamically in real time. Items with AI confidence $< 95\%$ are flagged in warning yellow.
8. **Interactive Review & Verification:** Quality Engineer edits balloon placement, adjusts leader lines, modifies nominal/tolerance overrides, or re-sequences balloons.
9. **Shop Floor Inspection (Optional):** CMM/Caliper inspection measurements entered into Form 3 grid; automated PASS/FAIL status evaluated against upper/lower limits.
10. **Automated AS9102 Compliance Export:** One-click generation of certified **SAE AS9102 Form 1, Form 2, and Form 3** Excel packages, CSVs, and marked-up vector blueprint PDFs. Email notifications sent via **Resend**.

---

## 5. Technology Stack & Production System Architecture

| Tier / Domain | Selected Technology | Role & Architecture Rationale |
| :--- | :--- | :--- |
| **Frontend Framework** | **Next.js (TypeScript, React 19)** | SSR, App Router, React Server Components, responsive layout, SEO/OpenGraph optimization. |
| **UI Design & Canvas** | **TailwindCSS + WebGL / Canvas / PDF.js** | 60 FPS interactive vector blueprint viewport with custom SVG overlay layers. |
| **Frontend State** | **Zustand + TanStack React Query** | High-performance client-side canvas state and optimistic API data synchronization. |
| **Backend API Gateway** | **Node.js + Express (TypeScript)** | Modular REST/GraphQL API services, request validation, authentication, and routing gateway. |
| **ORM & Database** | **Prisma ORM + PostgreSQL** | Type-safe database queries, schema migrations, and multi-tenant Row Level Security (RLS). |
| **DB Connection Pooler** | **PgBouncer** | Connection pooling managing thousands of concurrent Prisma connections during worker bursts. |
| **Caching & In-Memory State** | **Redis Enterprise Cluster** | API response cache, user sessions, socket connection registry, rate-limiting token bucket. |
| **Message Event Mesh** | **Apache Kafka Cluster (KRaft)** | High-throughput durable event backbone (`pdf.ingested`, `autoballoon.requested`, `audit.logged`). |
| **AI Worker Engine** | **Python / Node.js Containers** | ONNX Runtime, PyMuPDF, OpenCV vision engine, ASME Y14.5 GD&T parser, R-Tree spatial engine. |
| **Mail Automation** | **Resend API** | Passwordless magic links, onboarding emails, export completion alerts, team invites. |
| **Object Storage** | **AWS S3 / MinIO** | Cloud storage for drawing blueprints and generated reports via S3 Direct Presigned URLs. |
| **Containerization** | **Docker Multi-stage Builds** | Lightweight, optimized container images for UI, API services, and AI worker engines. |
| **Orchestration** | **Kubernetes (EKS / GKE / AKS)** | Horizontal Pod Autoscaling (HPA), Helm charts, Ingress NGINX, Cloudflare WAF, Cert-Manager. |
| **Worker Autoscaling** | **KEDA (Event-driven K8s Scaler)** | Dynamic scaling of AI worker pods driven by Kafka Consumer Group Lag metrics. |
| **Secrets & Security** | **HashiCorp Vault + Istio Mesh** | Encrypted secret storage, mTLS zero-trust pod communication, dynamic API key rotation. |
| **Observability** | **OpenTelemetry + Prometheus + Grafana** | End-to-end distributed tracing, application metrics, system health dashboards. |

---

## 6. Non-Functional & Enterprise Compliance Requirements

### 6.1 Multi-Tenant Security & Tenant Isolation
* **Logical Isolation:** Every database table contains a mandatory `tenant_id` foreign key. Prisma middleware injects `WHERE tenant_id = ctx.tenant_id` into all queries.
* **Storage Isolation:** S3 objects partitioned under `s3://bucket/{tenant_id}/{project_id}/{drawing_id}/...`. Access generated exclusively through short-lived presigned URLs (15-minute expiry).
* **Role-Based Access Control (RBAC):** Roles enforced across tenant endpoints: `TenantAdmin`, `QualityEngineer`, `Inspector`, `Viewer`.

### 6.2 Regulatory & Audit Standards
* **SAE AS9102 Rev B/C Compliance:** 100% strict adherence to Form 1, Form 2, and Form 3 drafting standards for aerospace QA audits.
* **ASME Y14.5 GD&T Compliance:** Abstract Syntax Tree (AST) representation for all geometric tolerances (Position, Flatness, Profile, Datums A-Z, MMC/LMC modifiers).
* **SOC2 Type II & ISO 27001 Readiness:** Cryptographic SHA-256 hash-chained audit log recording every user action, AI extraction override, and report generation event.
* **CMMC Level 2 / ITAR Hybrid Ready:** Cloud architecture designed to support eventual private cloud or air-gapped hybrid desktop agents syncing via encrypted mTLS tunnels.

---

## 7. Master Acceptance Criteria

- [x] Web Application must render engineering drawings at 60 FPS in Next.js browser viewport.
- [x] AI extraction must execute **ONLY when user explicitly clicks "Auto Balloon"**.
- [x] Kafka event mesh must decouple HTTP API requests from asynchronous AI vision processing.
- [x] KEDA must autoscale AI Worker pods based on Kafka queue lag.
- [x] All database transactions must pass through Prisma ORM and PgBouncer to PostgreSQL.
- [x] Multi-tenant isolation must prevent any cross-tenant data access.
- [x] Reports must export valid SAE AS9102 Form 1, 2, 3 workbooks (.xlsx), marked-up PDFs, and CSV packages.
- [x] All transactional emails and user invites must be dispatched via Resend.
- [x] Infrastructure must be containerized with Docker and deployable via Kubernetes Helm charts.
