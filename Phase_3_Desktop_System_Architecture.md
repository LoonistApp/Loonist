# Phase 3: FAI.EV.ENGINEER Desktop System Architecture Workflow

This document outlines the system architecture for the **FAI.EV.ENGINEER Desktop Application**. It maps out the core data flow across five operational stages. The stack relies on Electron, React, and SQLite (offline-first) while enforcing production standards like tamper-evident logging, cryptographic licensing, and durable job states.

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
The CI/CD pipeline runs on GitHub Actions to build the Electron app and output a Windows `.exe`. We sign the binary with a Sectigo EV Certificate to prevent Windows Defender SmartScreen blocks. 

For distribution, the installer is hosted on Cloudflare R2. When a user runs the app for the first time, a Cloudflare Worker intercepts the activation request and checks the token against a Cloudflare D1 database. This serverless approach eliminates fixed backend costs.

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
The app uses a hybrid activation model to verify users. On first launch, if no local license is found, the React UI prompts the user for a token. The Main Process sends this token to the Cloudflare Worker API to verify payment. 

If valid, the server returns a cryptographic license tied to the hardware. The device's private key is stored in Windows DPAPI or Mac Keychain. After this initial check, the app runs completely offline. The local validator checks the signature on boot. If it passes, it spins up SQLite in WAL mode to handle transactions.

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
File ingestion happens via direct OS file streams to avoid network overhead. The user drops a PDF, and the renderer sends an ID to the Main Process. The Node.js `fs` module reads the file and calculates a SHA-256 hash. This hash becomes the root of document provenance. Every future AI extraction or human edit links back to this exact file version. The UI then loads the document into a WebAssembly-based canvas for high-performance panning and zooming.

**Failure Handling:** If the disk is full, the file stream throws an `FS-001` error. The app catches the exception, rolls back the SQLite transaction, and alerts the user.

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
Users manually trigger AI extraction. Jobs are logged in a durable SQLite `ai_jobs` table. Background Node.js Worker Threads pick up the jobs and emit a 5-second heartbeat. The app uses the ONNX Runtime for inference, checking for GPU support (CUDA/DirectML) and falling back to the CPU if it hits OOM errors. The worker runs neural OCR, parses GD&T syntax, and pipes the bounding boxes to the UI.

**Crash Recovery & Idempotency:** If the app crashes, the worker's heartbeat times out. On the next boot, the Job Manager sees the stale heartbeat, flags the job as `RECOVERABLE`, and restarts it. Database constraints prevent duplicate rows from being inserted.

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
The editor features a visual canvas for balloons and an inspector grid for tabular data. The system requires humans to validate AI outputs. We run OCR confidence scores through a geometric schema checker to flag invalid syntax. The engineer must visually approve flagged items using a magnified crop of the source PDF. 

Every user action triggers an SQLite transaction (`BEGIN ... COMMIT`). This acts as an event log and provides a persistent undo/redo stack across application restarts.

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
Before export, a rule engine checks the data against AS9102 requirements. If required fields are missing, the export throws an `EXP-001` error. If the data is valid, the app builds Form 1, 2, and 3 Excel workbooks and a marked-up PDF.

All edits and the final file hashes are written to a **tamper-evident SHA-256 hash chain** in SQLite. Each audit event hashes the previous event's signature (`hash = SHA256(event + prev_hash)`). If someone manually alters the database file, the chain breaks, and the project is flagged as invalid during compliance audits.

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
