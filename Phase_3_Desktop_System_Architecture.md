# Phase 3: FAI.EV.ENGINEER Desktop System Architecture Workflow

This document defines the production baseline architecture for the **FAI.EV.ENGINEER Desktop Application**. Rather than a disconnected checklist of technical constraints, this architecture is presented as a cohesive, visual workflow across five operational stages. It combines the offline-first Electron/React/SQLite stack with rigorous production hardening (tamper-evident audits, cryptographic licensing, and persistent job states).

---

## Stage 0: Secure CI/CD & Distribution

This stage handles the secure building, code-signing, and serverless delivery of the application to the customer.

```mermaid
flowchart TD
    subgraph CI_CD ["1. GitHub Actions Pipeline"]
        Source["GitHub Repository"]
        Build["Build Electron App"]
        Installer["Generate Windows Installer (.exe)"]
        Sign["Sign with Sectigo Certificate"]
    end

    subgraph CDN ["2. Cloudflare Edge Delivery"]
        R2[(Cloudflare R2 Storage)]
        Download["fai.ev.engineer/download"]
    end

    subgraph Customer ["3. End User"]
        Install["Install Application"]
        Activate["Activate License Token"]
    end
    
    subgraph Activation ["4. Serverless Activation"]
        Worker["Cloudflare Worker (Auth API)"]
        D1[(Cloudflare D1 - License DB)]
    end

    Source --> Build
    Build --> Installer
    Installer --> Sign
    Sign --> R2
    R2 --> Download
    Download --> Install
    Install --> Activate
    Activate <--> Worker
    Worker <--> D1
```

### Technical Summary
By leveraging the Cloudflare ecosystem, the infrastructure operates at near-zero cost while maintaining enterprise-grade security. When code is pushed to GitHub, a CI/CD pipeline builds the Electron application and generates a Windows installer. Crucially, the `.exe` is digitally signed using a Sectigo Code Signing Certificate to bypass Windows Defender warnings. 

The signed binary is uploaded to Cloudflare R2 object storage and distributed globally via the Cloudflare Edge network. When a customer downloads and installs the application, their initial token activation is routed to a serverless Cloudflare Worker. This Worker queries a free Cloudflare D1 SQL database to verify the token, drastically reducing backend hosting costs to zero for the initial tier of usage.

---

## Stage 1: Token Activation, Boot & Licensing Workflow

This stage handles the one-time online token verification for new employees and the subsequent secure offline initialization of the local application.

```mermaid
flowchart TD
    subgraph SaaS_Cloud ["1. FAI SaaS Cloud (Online Only)"]
        AuthAPI["Token Verification API"]
    end

    subgraph OS_Layer ["2. OS & Hardware Layer"]
        AppIcon["User Launches App (.exe)"]
        TPM["Windows DPAPI / Mac Keychain"]
    end

    subgraph App_Core ["3. Electron Main Process"]
        TokenInput["License File Exists?"]
        OnlineActivation["Online Token Activation"]
        LicenseCheck["Offline Cryptographic Validator"]
        SQLiteInit["Initialize SQLite (WAL Mode)"]
    end

    subgraph UI_Layer ["4. React Renderer UI"]
        Dashboard["Workspace Dashboard"]
        ActivationScreen["Enter License Token"]
    end

    AppIcon --> TokenInput
    TokenInput -->|No - First Install| ActivationScreen
    ActivationScreen -->|Submits Token| OnlineActivation
    OnlineActivation <-->|Verify Payment and Issue License| AuthAPI
    OnlineActivation -->|Store Device Key| TPM
    OnlineActivation -->|Save License| LicenseCheck
    TokenInput -->|Yes| LicenseCheck
    TPM -->|Fetch Device Private Key| LicenseCheck
    LicenseCheck -->|Valid Signature| SQLiteInit
    SQLiteInit --> Dashboard
```

### Technical Summary
To ensure only paid and authorized company employees can access the software, the initialization enforces a hybrid activation model. When an employee first installs the `.exe`, the application checks for a valid local license. If none exists, they are routed to a local React UI to enter their corporate verification token. The Electron Main Process securely transmits this token to the FAI SaaS Cloud for online payment and authorization verification. 

Once the SaaS confirms the token, it issues a cryptographic license file explicitly bound to that specific machine. The hardware-bound private key is safely stored in the OS secure storage (Windows DPAPI or Mac Keychain). For all subsequent boots, the system operates entirely offline using the local `Offline Cryptographic Validator`. Once the signature is verified, the system boots SQLite with Write-Ahead Logging (WAL) enabled to guarantee atomic transactions, all within a zero-trust local boundary.

---

## Stage 2: Direct File Ingestion & Provenance Workflow

This stage handles the secure local importing of aerospace blueprints and establishes an immutable cryptographic chain of custody.

```mermaid
sequenceDiagram
    autonumber
    actor QE as Quality Engineer
    participant UI as React UI (Sandboxed)
    participant Preload as IPC Bridge
    participant Main as Electron Main Process
    participant FS as Local Filesystem
    participant DB as SQLite DB
    participant Viewport as WebGL Engine

    QE->>UI: 1. Drag & Drop PDF
    UI->>Preload: 2. Invoke 'import-document' (Sanitized ID)
    Preload->>Main: 3. Pass to Node.js
    Main->>FS: 4. Stream Raw Binary
    Main->>Main: 5. Generate Immutable SHA-256 Hash
    Main->>DB: 6. Transaction: Store Hash & Provenance
    Main-->>UI: 7. Import Success
    UI->>Viewport: 8. Init WebAssembly Parser
    Viewport-->>QE: 9. Render Blueprint (Target: 60 FPS)
```

### Technical Summary
Ingestion bypasses network latency by relying on direct OS-level file streams. When a user drags a blueprint into the application, the renderer passes a sanitized identifier to the Main Process. The Node.js `fs` module reads the binary stream and instantly calculates a SHA-256 hash. This hash serves as the absolute root of document provenance—all subsequent AI extractions and human edits are cryptographically linked to this exact version of the source document. The file is handed off to a WebAssembly optimized canvas, enabling fluid panning and zooming for massive aerospace schematics.

**Failure Handling:** If the local disk is critically full, the OS stream throws an `FS-001` error. The Main Process catches this, cleanly aborts the database transaction, and alerts the UI without corrupting any state.

---

## Stage 3: Persistent AI Job Execution Workflow

This stage replaces fragile in-memory queues with a durable, restartable SQLite-backed AI pipeline.

```mermaid
flowchart TD
    subgraph Trigger ["1. Explicit User Action"]
        UserClick["User Clicks 'Auto Balloon'"]
        UI["React Renderer UI"]
    end

    subgraph Queue ["2. Durable Job Management (SQLite)"]
        JobManager["Persistent Job Manager"]
        StateDB[(ai_jobs Table - status, heartbeat)]
    end

    subgraph Workers ["3. Worker Pool (Node Threads)"]
        WorkerPool["Background Threads"]
        HardwareCheck{"GPU Detected?"}
        GPU["CUDA / DirectML"]
        CPU["CPU Fallback"]
        ONNX["ONNX Neural OCR"]
        GDTParser["ASME GD&T Parser"]
    end

    subgraph Sync ["4. UI Real-time Updates"]
        IPC["Electron IPC Stream"]
    end

    UserClick --> UI -->|IPC Request| JobManager
    JobManager <-->|Queued / Heartbeat| StateDB
    JobManager --> WorkerPool
    WorkerPool --> HardwareCheck
    HardwareCheck -->|Yes| GPU --> ONNX
    HardwareCheck -->|No| CPU --> ONNX
    ONNX --> GDTParser
    GDTParser --> IPC --> UI
```

### Technical Summary
AI extraction is explicitly triggered by the user and managed through a durable SQLite `ai_jobs` table. Background Node.js Worker Threads claim jobs and maintain a 5-second heartbeat. The extraction stack leverages the ONNX Runtime, dynamically detecting local hardware acceleration (CUDA/DirectML) and gracefully falling back to CPU execution if the GPU is unsupported or throws an Out-of-Memory (OOM) error. The pipeline executes neural OCR, parses ASME Y14.5 GD&T syntax, and streams coordinates back to the UI.

**Crash Recovery & Idempotency:** If the application crashes mid-extraction, the worker's heartbeat goes stale. Upon application restart, the Job Manager detects the stale heartbeat, idempotently marks the job `RECOVERABLE`, and safely requeues it without duplicating features in the database.

---

## Stage 4: Interactive Validation & Bounded State Workflow

This stage enforces human oversight over AI extractions and manages local undo/redo states transactionally.

```mermaid
flowchart TD
    subgraph Canvas_Layer ["1. Visual Balloon Canvas"]
        DragBall["Drag Balloon Position (x, y)"]
        BendingLeader["Smart Bending Leaders"]
        RenumberCascade["Auto Sequential Renumbering"]
    end

    subgraph Table_Layer ["2. Extracted Data Inspector Grid"]
        EditNominal["Edit Nominal Values & Tolerances"]
        EditGDT["Edit ASME Y14.5 GD&T Datums"]
    end

    subgraph Review_Layer ["3. Multi-Layer Validation Logic"]
        OCRCheck["OCR Validation"]
        SchemaCheck["ASME Y14.5 Rule Validation"]
        HumanReview["Mandatory Human Visual Approval"]
    end

    subgraph State_Layer ["4. Local Transaction State"]
        Transaction["BEGIN ... COMMIT"]
        UndoRedo["Bounded Undo/Redo History"]
    end

    Canvas_Layer <--> Table_Layer
    Table_Layer <--> Review_Layer
    Canvas_Layer --> State_Layer
    Table_Layer --> State_Layer
    Review_Layer --> State_Layer
```

### Technical Summary
The dual-layer editor allows engineers to adjust visual balloon paths and modify data within a live inspector grid. Rather than trusting AI confidence blindly, the system enforces a strict validation pipeline: OCR string confidence is combined with a geometric schema checker (e.g., ensuring a position tolerance has proper datums), culminating in a mandatory human review via a magnified bitmap comparison tool. Every user edit triggers a discrete SQLite transaction (`BEGIN ... COMMIT`). This creates a bounded, persistent history log that provides highly reliable undo/redo capabilities, even if the application is restarted.

---

## Stage 5: Tamper-Evident Export & Audit Workflow

This stage handles the secure compilation of compliance reports and cryptographic auditing.

```mermaid
flowchart LR
    Approved["Human Approved Data"]
    
    subgraph Validation ["1. Export Validation Pipeline"]
        AS9102Check["Validate Required Fields"]
        CrossCheck["Cross-Reference Checks"]
    end

    subgraph Compiler ["2. AS9102 Compliance Compiler"]
        Form1["Form 1 (.xlsx)"]
        Form2["Form 2 (.xlsx)"]
        Form3["Form 3 (.xlsx)"]
        PDFMarked["Marked-Up PDF"]
    end
    
    subgraph Audit ["3. Storage & Cryptographic Audit"]
        SQLite[(Local SQLite DB)]
        SHA256["Tamper-Evident Hash Chain"]
    end

    subgraph Output ["4. Local Delivery"]
        LocalFS["User Output Directory"]
        ExportHash["Export Provenance Hashes"]
    end

    Approved --> Validation
    Validation -->|Pass| Compiler
    Validation -->|Fail| Abort[Abort Export]
    Compiler --> Form1 & Form2 & Form3 & PDFMarked
    Form1 & Form2 & Form3 & PDFMarked --> Output
    Output --> ExportHash
    ExportHash --> Audit
```

### Technical Summary
Aerospace compliance requires strict traceability. When a project is exported, the compiler first runs an AS9102 rule engine. If required fields are missing, the export aborts cleanly with an `EXP-001` error to prevent incomplete data generation. Once validated, the system generates Form 1, 2, and 3 Excel workbooks and the marked-up PDF. 

Crucially, every modification leading up to this export—and the final hashes of the exported files themselves—are logged into a **tamper-evident SHA-256 hash chain** stored within SQLite. Each audit event contains a cryptographic link to the previous event (`hash = SHA256(event + prev_hash)`), ensuring that unauthorized database modifications immediately break the chain and flag the project during an audit.

---

## Production Traceability Matrix

To guarantee production readiness, all critical architecture workflows defined in the stages above map directly to verifiable test scenarios:

| Architecture Workflow | Implementation Mechanism | Acceptance Criteria / Verification |
| :--- | :--- | :--- |
| **Persistent AI Job Recovery** (Stage 3) | SQLite `ai_jobs` table + Heartbeat polling | Terminate app mid-job -> Restart -> Job marked `RECOVERABLE` and successfully retries without data duplication. |
| **Tamper-Evident Audit** (Stage 5) | Event hashing: `SHA256(data + prev_hash)` | Manually alter an SQLite record -> Hash verification tool flags the chain as broken. |
| **Database Corruption Protection** (Stage 1) | `PRAGMA integrity_check` on boot | Corrupt DB file -> App boots -> Fails check -> Auto-prompts to restore from local backup. |
| **Electron IPC Security** (Stage 1) | `contextIsolation: true` + Preload scripts | Attempt to run `fs.readFile` from UI devtools -> OS blocks action; security error logged. |
| **Idempotency** (Stage 3) | Unique constraints on `job_id` + `document_hash` | Re-run identical AI job twice -> No duplicate features or balloons are created in SQLite. |
| **Disk Full Handling** (Stage 2) | OS `SQLITE_FULL` exception catching | Fill disk -> Trigger export -> `fs.write` fails -> Emits `FS-001` -> Database state remains clean. |
