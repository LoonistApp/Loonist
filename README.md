<div align="center">

# ✈️ FAI.EV.ENGINEER
### *Enterprise AI-Powered First Article Inspection Platform*

[![Version](https://img.shields.io/badge/Version-v2.0_Browser_First-blue.svg?style=for-the-badge&logo=git)](./FAI.EV.ENGINEER_MASTER_PRD.md)
[![Status](https://img.shields.io/badge/Status-Approved_SSOT-emerald.svg?style=for-the-badge&logo=checkmark)](./FAI.EV.ENGINEER_MASTER_PRD.md)
[![Compliance](https://img.shields.io/badge/Compliance-SAE_AS9102_Rev_B%2FC-orange.svg?style=for-the-badge&logo=shield)](./FAI.EV.ENGINEER_MASTER_PRD.md)
[![Platform](https://img.shields.io/badge/Platform-Browser_First_B2B_SaaS-purple.svg?style=for-the-badge&logo=nextdotjs)](./FAI.EV.ENGINEER_MASTER_PRD.md)
[![Owner](https://img.shields.io/badge/Product_Owner-Harsh_Yadav-black.svg?style=for-the-badge&logo=person)](./FAI.EV.ENGINEER_MASTER_PRD.md)

<p align="center">
  <b>Postman for Engineering Drawings</b> — Automating First Article Inspection (FAI) for Aerospace, Automotive, Medical Devices, and Precision Machine Shops.
</p>

---

</div>

> [!IMPORTANT]
> **SINGLE SOURCE OF TRUTH (SSOT)**  
> This repository contains the official Master System Architecture and PRD for **FAI.EV.ENGINEER** (Product Owner: **Harsh Yadav**).  
> Built strictly upon SAE AS9102 (Rev B/C) standards and ASME Y14.5 GD&T drafting specifications.

---

## 📌 Repository Documentation Index

| File | Purpose | Description |
| :--- | :--- | :--- |
| 📄 [`FAI.EV.ENGINEER_MASTER_PRD.md`](./FAI.EV.ENGINEER_MASTER_PRD.md) | **Master PRD (SSOT)** | Master Product Requirements Document in Harsh Yadav's 7-part executive format. |
| 🧠 [`Phase_1_Business_Domain_Analysis.md`](./Phase_1_Business_Domain_Analysis.md) | **Phase 1: Domain Analysis** | DDD Bounded Contexts, Event Storming, Business Rules, ERD, State Machines. |
| 🏗️ [`Phase_2_High_Level_Design.md`](./Phase_2_High_Level_Design.md) | **Phase 2: High-Level System Design** | Full System Architecture: C4 Diagrams, Prisma PostgreSQL Schema, Kafka Event Mesh, Docker, Kubernetes, KEDA Autoscaling, PgBouncer, and Resend Email Automation. |

---

## 🏛️ Master System Architecture Diagram

![FAI.EV.ENGINEER Multi-Tenant System Architecture Blueprint](C:\Users\hy376\.gemini\antigravity\brain\1c296c4b-eef4-4158-ba24-a89523b57488\fai_ev_engineer_system_architecture_1786338488664.png)

---

## 🛠️ Production Technology Stack

```mermaid
flowchart LR
    Frontend["🎨 Next.js (TypeScript / React 19)\nWebGL / Canvas Viewport Engine"]
    API["⚡ Node.js / Express API Gateway"]
    DB[("🐘 AWS Aurora PostgreSQL\nPrisma ORM + PostGIS + RLS")]
    Pooler["🔄 PgBouncer Pooler"]
    Cache["🚀 Redis Enterprise Cluster"]
    Mesh["📩 Apache Kafka Event Mesh"]
    Workers["🤖 AI Vision Workers\nKEDA Autoscaled"]
    Mail["📬 Resend Email API"]
    Store["☁️ AWS S3 Presigned Uploads"]

    Frontend <--> API
    API <--> Cache & Mesh & Pooler & Mail & Store
    Mesh <--> Workers
    Workers <--> Pooler & Store & Cache
    Pooler <--> DB
```

| Architecture Tier | Technology Selected | Rationale |
| :--- | :--- | :--- |
| **Frontend UI** | **Next.js (React 19, TypeScript)** | SSR, App Router, WebGL/Canvas 60 FPS vector blueprint viewport engine. |
| **API Gateway** | **Node.js + Express (TypeScript)** | Modular REST/GraphQL microservices, JWT/OAuth2 RBAC authentication. |
| **Database & ORM** | **Prisma ORM + AWS Aurora PostgreSQL** | Type-safe queries, PostGIS 2D spatial indexing, Row Level Security (RLS). |
| **DB Pooler** | **PgBouncer** | Connection multiplexing during KEDA AI worker scaling bursts. |
| **Caching & PubSub**| **Redis Enterprise Cluster** | Session management, API response cache, rate-limiting, socket connection state. |
| **Event Mesh** | **Apache Kafka (KRaft)** | Durable event backbone (`autoballoon.requested`, `autoballoon.completed`). |
| **Worker Scaling** | **KEDA (Kubernetes Event Autoscaler)** | Dynamic pod scaling driven by Kafka Consumer Group Lag. |
| **Mail Automation** | **Resend API** | Passwordless magic links, team invitations, export alerts. |
| **Object Storage** | **AWS S3 / MinIO** | Direct presigned client uploads for vector PDF blueprints (200MB limit). |

---

## 🎯 Executive Overview & Core KPIs

```mermaid
flowchart LR
    subgraph Highlights ["Key Platform Highlights"]
        Time["⚡ >85% Reduction in FAI Setup Time (8h -> <15m)"]
        Acc["🎯 ≥95% AI Extraction Accuracy"]
        Proc["⏱️ <15s Average Drawing Processing Time"]
        Sec["🔒 Strict Multi-Tenant Isolation & SOC2 Readiness"]
    end
```

---

## 🔄 End-to-End Event-Driven Flow

```mermaid
flowchart TD
    A["1. Launch WebApp in Browser (Next.js)"] --> B["2. Auth / SAML 2.0 / Resend Magic Link Login"]
    B --> C["3. Select Hierarchy: Organization → Project → Part → Revision → Drawing"]
    C --> D["4. Direct Upload Drawing to AWS S3 (Presigned PUT URL)"]
    D --> E["5. WebGL / Canvas Viewport Initialization (60 FPS Pan/Zoom)"]
    E --> F["6. User Clicks 'Auto Balloon' (Explicit AI Trigger)"]
    
    subgraph Async_Event_Mesh ["Kafka Event Mesh & KEDA Worker Pool"]
        F --> F1["Publish Event to 'autoballoon.requested' Kafka Topic"]
        F1 --> F2["KEDA Autoscale AI Workers on Kafka Consumer Lag"]
        F2 --> F3["ONNX Neural OCR + ASME Y14.5 GD&T AST Parsing"]
        F3 --> F4["Spatial R-Tree Collision-Avoidance Balloon Placement"]
        F4 --> F5["Batch Save to PostgreSQL via Prisma + PgBouncer"]
    end
    
    F5 --> G["7. Stream Live Results via WebSockets to Next.js Viewport"]
    G --> H["8. Postman-Style HITL Verification Grid (<95% Flagged Yellow)"]
    H --> I["9. Export Certified AS9102 Form 1/2/3 Workbooks (.xlsx, .pdf, .csv)"]
    I --> J["10. Dispatch Email Notifications via Resend & Append SHA-256 Audit Log"]
```

---

> [!NOTE]
> **Repository Owner:** Harsh Yadav (Lead Product Owner)  
> **Repository Status:** Master System Architecture Approved Baseline
