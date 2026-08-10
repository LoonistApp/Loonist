# Phase 3: FAI.EV.ENGINEER System Architecture Workflow

This document details the five operational stages of the FAI.EV.ENGINEER platform. It covers identity management, file ingestion, event-driven AI processing, dual-layer drawing editing, and compliance export.

## Stage 1: Identity, Auth & Multi-Tenant Edge Ingress

```mermaid
flowchart TD
    subgraph Ingress ["1. Ingress & Edge Tier"]
        Client["Client Workstation (Browser)"]
        WAF["Cloudflare WAF"]
        IngressProxy["NGINX Ingress Controller"]
    end

    subgraph Auth_Tier ["2. Auth & Session Management"]
        EdgeAuth["Next.js Edge Auth Middleware"]
        AuthService["Auth Service (NextAuth / Better-Auth)"]
        RedisSession[("Redis Session Cache")]
        ResendMail["Resend Email API"]
        SAMLProxy["SAML 2.0 Jackson Proxy"]
    end

    subgraph Tenant_DB ["3. Tenant Context & Storage"]
        PrismaMiddleware["Prisma Tenant Middleware"]
        PostgresRLS[("AWS Aurora PostgreSQL (RLS)")]
    end

    Client -->|app.faiev.engineer| WAF --> IngressProxy --> EdgeAuth
    EdgeAuth <-->|JWT Lookup <2ms| RedisSession
    EdgeAuth --> AuthService
    AuthService <-->|Passwordless Magic Link| ResendMail
    AuthService <-->|Okta / Azure AD SSO| SAMLProxy
    AuthService <-->|Session Store| RedisSession
    AuthService --> PrismaMiddleware --> PostgresRLS
```

### Technical Summary

The ingress architecture relies on subdomain routing to accurately identify the target tenant. Edge middleware is employed to validate session JWTs against a Redis cache in under two milliseconds. We support a variety of authentication options including passwordless magic links via the Resend API, OAuth2 providers like Google and Microsoft, and SAML 2.0 integrations through Okta or Azure AD tailored for enterprise clients. Data isolation is strictly enforced at the database level. Our Prisma setup injects the organization ID directly into PostgreSQL session variables, which seamlessly activates Row-Level Security.

## Stage 2: Direct PDF Ingestion & Viewport Rendering

```mermaid
sequenceDiagram
    autonumber
    actor QE as Quality Engineer
    participant WebApp as Next.js WebApp UI
    participant Gateway as Node.js API Gateway
    participant Redis as Redis Cache
    participant S3 as AWS S3 Storage Bucket
    participant Viewport as WebGL Viewport Engine

    QE->>WebApp: 1. Drop Blueprint PDF (Vector/Raster 300 DPI)
    WebApp->>Gateway: 2. Request Presigned Upload URL
    Gateway->>Redis: 3. Verify JWT & Storage Limits
    Gateway-->>WebApp: 4. Return S3 Presigned PUT URL (15-min TTL)
    WebApp->>S3: 5. Direct Binary Upload (Bypasses API Gateway)
    S3-->>WebApp: 6. 200 OK Upload Confirmed
    WebApp->>Viewport: 7. Init PDF.js / Canvas WebGL Renderer
    Viewport-->>QE: 8. Render Blueprint (60 FPS Pan, Zoom, Sheets, Layers)
```

### Technical Summary

To handle large engineering blueprints efficiently, the system utilizes direct presigned S3 URLs. This allows users to upload PDF files up to 200MB directly to storage, completely bypassing the need to route heavy binary streams through our core API servers. Once the document is ingested, our custom Canvas rendering engine takes over. Built on WebGL, the viewport renders complex vector PDF layers at a smooth 60 frames per second. It supports extreme zooming capabilities up to 3200 percent and fluid multi-sheet tab navigation for dense schematics.

## Stage 3: Asynchronous AI Feature Extraction & Phased Autoscaling

```mermaid
flowchart TD
    subgraph Trigger ["1. Explicit User Action"]
        UserClick["User Clicks 'Auto Balloon' Button"]
        API["Node.js API Gateway"]
    end

    subgraph Queue ["2. Messaging & Autoscaling (Phased)"]
        MessageQueue[("Message Queue\n(Beta: SQS / BullMQ | Future: Kafka)")]
        Autoscaler["Autoscaler\n(Beta: ECS / App Service | Future: KEDA)"]
    end

    subgraph Workers ["3. Worker Pool"]
        WorkerPool["AI Extraction Containers"]
        ONNX["ONNX Neural OCR Engine"]
        GDTParser["ASME Y14.5 GD&T AST Parser"]
        RTree["Spatial R-Tree Orbiting Algorithm"]
    end

    subgraph Sync ["4. Persistence & Real-time Update"]
        PgBouncer["PgBouncer Pooler"]
        Postgres[("PostgreSQL + PostGIS DB")]
        RedisWS[("Redis WebSockets PubSub")]
        UI["Next.js WebApp UI"]
    end

    UserClick --> API --> MessageQueue
    MessageQueue <--> Autoscaler
    Autoscaler -->|Autoscale Workers| WorkerPool
    WorkerPool --> ONNX & GDTParser & RTree
    WorkerPool --> PgBouncer --> Postgres
    WorkerPool --> RedisWS --> UI
```

### Technical Summary

We enforce a strict explicit execution rule where AI extraction runs exclusively when the user manually triggers the auto balloon process. This prevents unnecessary compute overhead during initial uploads. To handle variable workloads efficiently from day one while preparing for enterprise scale, we utilize a phased approach to messaging and scaling. The initial beta architecture employs a simpler queue and worker setup (such as AWS SQS or Redis BullMQ coupled with basic container autoscaling) to accelerate time-to-market. The system retains abstracted interfaces so that as workload demands increase, it can seamlessly transition to an enterprise-grade Apache Kafka and Kubernetes Event-driven Autoscaling (KEDA) architecture. The extraction stack itself is highly specialized. It combines an ONNX neural OCR engine for reading linear and angular dimensions with an Abstract Syntax Tree parser dedicated to ASME Y14.5 Feature Control Frames. Finally, spatial R-Tree algorithms calculate the optimal, collision-free placement for all generated balloons.

## Stage 4: Interactive Dual-Layer Blueprint Editor

```mermaid
flowchart TD
    subgraph Canvas_Layer ["1. Visual Balloon Canvas"]
        DragBall["Drag Balloon Position (x, y)"]
        BendingLeader["Smart Bending Leaders (Straight, Curved, Elbow)"]
        RenumberCascade["Auto Sequential Renumbering (#5 -> shifts #6 to #N)"]
        Shapes["Shape Options (Circle, Box, Flag Triangle, Hexagon)"]
    end

    subgraph Table_Layer ["2. Extracted Data Inspector Grid"]
        EditNominal["Edit Nominal Values & Tolerances (Auto Limits)"]
        EditGDT["Edit ASME Y14.5 GD&T Datums (A-Z) & Modifiers"]
        ZoneGrid["Drawing Zone Grid Calculation (Zone B4, C2)"]
    end

    subgraph Review_Layer ["3. Low Confidence (<95%) Review"]
        FlagAlert["Low Confidence Yellow Flag Alert"]
        CropCallout["Magnified Raw Bitmap vs AI Text Snippet"]
    end

    subgraph Lock_Layer ["4. Multi-User Lock Manager"]
        WSLock["WebSockets Lock (Highlights Balloon in Orange for Co-Editors)"]
    end

    Canvas_Layer <--> Table_Layer <--> Review_Layer <--> Lock_Layer
```

### Technical Summary

The editor interface provides extensive visual controls over the blueprint. Users can intuitively drag and drop balloons, adjust bending leader paths, customize shapes, and rely on automatic cascade renumbering when items are inserted or removed. Alongside the visual canvas, a comprehensive data inspector grid allows for live property editing. Engineers can adjust nominal values, toggle symmetric or bilateral tolerances, and modify ASME Y14.5 GD&T datums, which instantly recalculates specification limits. To ensure accuracy, any AI extraction falling below a 95 percent confidence threshold triggers a prominent yellow flag alert. This prompts a human review mode that displays a magnified visual crop comparing the source PDF directly against the extracted text. Furthermore, real-time collaboration is protected by a WebSocket selection locking mechanism that prevents conflicting edits when multiple engineers are actively working on the same drawing sheet.

## Stage 5: Persistence, SHA-256 Audit Ledger & AS9102 Export

```mermaid
flowchart LR
    Approved["Validated Package"]
    
    subgraph Storage ["1. Storage & Audit"]
        PgBouncer["PgBouncer"]
        Postgres[("Aurora PostgreSQL")]
        SHA256["SHA-256 Hash Audit Ledger"]
    end

    subgraph Compiler ["2. Compliance Compiler"]
        Form1["Form 1 (.xlsx)"]
        Form2["Form 2 (.xlsx)"]
        Form3["Form 3 (.xlsx)"]
        PDFMarked["Marked-Up PDF"]
    end

    subgraph Email ["3. Delivery"]
        S3[("AWS S3")]
        Resend["Resend API"]
        Inbox["User Inbox"]
    end

    Approved --> PgBouncer --> Postgres & SHA256
    Approved --> Compiler --> Form1 & Form2 & Form3 & PDFMarked
    Form1 & Form2 & Form3 & PDFMarked --> S3 --> Resend --> Inbox
```

### Technical Summary

Regulatory compliance is built into the foundation of the persistence layer. Every single edit made to a blueprint appends an immutable SHA-256 hash node to our database, guaranteeing full traceability for aerospace audits. When a package is finalized, the compliance compiler automatically generates AS9102 Form 1, Form 2, and Form 3 Excel workbooks along with raw CSV files and the fully marked-up vector PDFs. These finalized artifacts are securely stored in AWS S3, and the system immediately dispatches email notifications containing secure download links directly to the user's inbox via the Resend API.
