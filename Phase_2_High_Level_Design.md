# Phase 2: High-Level System Architecture (HLD)

**Product Name:** FAI.EV.ENGINEER  
**Product Owner:** Harsh Yadav  
**Platform:** Standalone Desktop Python Application (PySide6 / Qt 6)  
**Domain:** Aerospace & High-Precision Manufacturing FAI (SAE AS9102 Rev B/C, ASME Y14.5 GD&T)  
**Security Standard:** ITAR / CMMC Level 2 Air-Gapped Deployment (Zero Cloud AI Leakage)  
**Document Status:** Baseline Approved HLD Architecture  

---

## 1. Business Problem, Functional Scope & Architectural Principles

### 1.1 Business Problem & Functional Scope
In aerospace and high-precision manufacturing, Quality Engineers spend between 4 to 12 hours manually ballooning engineering drawings and populating SAE AS9102 Form 1, Form 2, and Form 3 characteristic inspection sheets.

FAI.EV.ENGINEER automates drawing ballooning, feature extraction, and report compilation through local AI processing, reducing setup time by over 85% (under 20 minutes per drawing package).

### 1.2 Core Architectural Principles
- **Local-First & Air-Gapped Architecture:** All AI inference, neural OCR, drawing rendering, and database storage execute locally on the user's host machine. Zero data is transmitted over external networks, maintaining strict compliance with defense ITAR and CMMC Level 2 security regulations.
- **Explicit Human Control:** Automated feature extraction does not auto-run upon file upload. AI execution requires an explicit user trigger by clicking the "Auto Balloon" button.
- **Responsive Viewport Rendering:** Delivers interactive 60 FPS panning, zooming, and vector layer manipulation on large engineering drawing blueprints via PySide6 hardware acceleration.
- **Tamper-Proof Audit Traceability:** All inspection activities, manual overrides, and balloon edits are recorded in a cryptographic SHA-256 hash-chained audit ledger.

---

## 2. Architectural Views & C4 Diagrams

### 2.1 C4 Context Diagram (Level 1)

The Context Diagram defines the system boundary of FAI.EV.ENGINEER within its operating environment.

```mermaid
flowchart TD
    User["Quality / Manufacturing Engineer"]
    
    subgraph System_Boundary ["System Boundary"]
        App["FAI.EV.ENGINEER Desktop Platform (Standalone Python App)"]
    end
    
    subgraph Environment ["Local Operating Environment"]
        LocalFiles["Local Workstation Disk (.afai Projects, Blueprints)"]
        Exports["Export Targets (AS9102 Excel Workbooks & Ballooned PDFs)"]
        CMM["Shop Floor Tools (Caliper / CMM Measurement Input)"]
    end

    User <--> App
    App <--> LocalFiles
    App --> Exports
    CMM --> App
```

---

### 2.2 C4 Container Diagram (Level 2)

The Container Diagram details the high-level technical containers that make up the desktop application.

```mermaid
flowchart TD
    subgraph Presentation_Container ["1. Presentation Container (PySide6 / Qt 6)"]
        UI_Shell["QMainWindow Workspace Shell"]
        UI_Canvas["QGraphicsView Viewport Engine (60 FPS)"]
        UI_Grid["QTableView Feature Inspector Grid"]
    end

    subgraph Core_Container ["2. Application Core Container"]
        Services["Application Services (ProjectSvc, DrawingSvc, CharSvc, ExportSvc)"]
        Orchestrator["AIOrchestrator & BackgroundJobManager"]
    end

    subgraph Local_AI_Container ["3. Local AI Engine Container"]
        OCR_Engine["Local Neural OCR Engine (ONNX Runtime)"]
        GDT_Engine["ASME Y14.5 GD&T AST Parser"]
        Orbit_Engine["Spatial R-Tree Balloon Orbiting Engine"]
    end

    subgraph Storage_Security_Container ["4. Storage & Security Container"]
        SQLCipher["SQLCipher Encrypted Database (AES-256)"]
        AuditLedger["Cryptographic SHA-256 Audit Ledger"]
        PackageMgr[".afai File Package Serializer"]
    end

    subgraph Export_Container ["5. Compliance & Export Container"]
        ExcelComp["OpenPyXL AS9102 Form 1/2/3 Compiler"]
        PDFStamper["PyMuPDF Vector PDF Overlay Stamper"]
    end

    Presentation_Container <--> Core_Container
    Core_Container <--> Local_AI_Container
    Core_Container <--> Storage_Security_Container
    Core_Container --> Export_Container
```

---

### 2.3 Deployment Diagram

The Deployment Diagram illustrates how the executable application runs on an air-gapped Windows workstation.

```mermaid
flowchart TD
    subgraph Workstation ["Air-Gapped Windows Workstation Host"]
        
        subgraph Bundle ["Executable Application Bundle (FAI_EV_ENGINEER.exe)"]
            PyRuntime["Python 3.11 Embedded Runtime"]
            QtDLLs["PySide6 / Qt 6 Dynamic Libraries"]
            ONNXDLLs["ONNX Runtime Engine DLLs"]
            AppCode["Nuitka / PyInstaller Compiled Core Modules"]
        end

        subgraph LocalDisk ["Workstation Local Disk"]
            ProjectFiles["Project Archives (*.afai Files)"]
            EncryptedDB["Encrypted SQLite Database (*.sqlite.enc)"]
            Reports["AS9102 Output Workbooks (.xlsx & .pdf)"]
            Logs["Quad-Channel Logs (App, Audit, Crash, Perf)"]
        end
    end

    Bundle <--> LocalDisk
```

---

## 3. Subsystem Architecture & 5-Layer Clean Model

### 3.1 5-Layer Clean Architecture

```mermaid
flowchart TD
    Layer1["1. Presentation Layer (PySide6 UI)"]
    Layer2["2. Application Services Layer (Workflows & Orchestration)"]
    Layer3["3. Core Domain Layer (Pure Business Entities & Rules)"]
    Layer4["4. Repository Layer (Data Access Abstractions)"]
    Layer5["5. Infrastructure Layer (Drivers, Encryption, Storage)"]

    Layer1 --> Layer2
    Layer2 --> Layer3
    Layer3 --> Layer4
    Layer4 --> Layer5
```

### 3.2 Architectural Dependency Rules
- **Unidirectional Downward Dependency:** Presentation Layer -> Application Services Layer -> Domain Layer -> Repository Layer -> Infrastructure Layer.
- **Domain Layer Independence:** The Domain Layer contains zero dependencies on PySide6 UI, SQLCipher databases, or third-party drivers.
- **UI Isolation:** The Presentation Layer accesses system logic exclusively through Application Services.
- **Infrastructure Decoupling:** Third-party libraries (PyMuPDF, ONNX Runtime, SQLCipher) are encapsulated behind abstract interfaces.

---

## 4. Data Architecture, Security & Storage Strategy

### 4.1 Encrypted Local Storage (SQLCipher)
- **Encryption Standard:** AES-256 database encryption at rest (`PRAGMA key`).
- **Cryptographic Audit Ledger:** Append-only `audit_log` table protected by a SHA-256 hash chain: `Hash_n = SHA256(Hash_{n-1} + Timestamp + UserID + Payload)`.

### 4.2 Single-File Package Format (`.afai`)
Projects are saved as single, self-contained `.afai` (Automated First Article Inspection) containers containing:
- `metadata.json` — Project information and header metadata.
- `database.sqlite.enc` — Encrypted SQLCipher database payload.
- `raw_drawing.pdf` — Original vector PDF blueprint file.
- `audit_chain.sig` — Cryptographic signature verifying file integrity.

---

## 5. Processing Pipelines & Cross-Component Interactions

### 5.1 AI Processing Pipeline Diagram

The AI Processing Pipeline transforms raw drawing pages into structured engineering characteristics and collision-free balloon coordinates.

```mermaid
flowchart LR
    PDF["1. Vector / Scanned PDF Page Stream"] --> PyMuPDF["2. PyMuPDF Vector & Image Layer Extractor"]
    PyMuPDF --> OCR["3. ONNX Neural OCR Engine (Text Detection & Recognition)"]
    OCR --> Classifier["4. Feature Detector (Linear, Angular, Radial Callouts)"]
    OCR --> GDTP["5. ASME Y14.5 GD&T AST Parser"]
    Classifier & GDTP --> Orbit["6. Spatial R-Tree Balloon Orbiting Engine"]
    Orbit --> Output["7. Extracted Characteristics & Collision-Free Balloons"]
```

---

### 5.2 Cross-Component Interaction Diagram (Auto-Balloon Sequence)

This key sequence diagram details how requests flow across layers during explicit "Auto Ballooning".

```mermaid
sequenceDiagram
    autonumber
    actor Engineer as Quality Engineer
    participant UI as PySide6 Viewport & Grid
    participant Svc as AIOrchestrator
    participant AI as Local AI Pipeline
    participant Val as Validation Engine
    participant Repo as CharacteristicRepo
    participant DB as SQLCipher Database

    Engineer->>UI: 1. Click "Auto Balloon" Button
    UI->>Svc: 2. Trigger Extraction Request (drawing_id)
    Svc->>AI: 3. Dispatch Job to Local AI Pipeline (Background QThread)
    AI->>AI: 4. Execute Neural OCR, GD&T AST Parsing & R-Tree Orbiting
    AI-->>Svc: 5. Return Extracted Characteristics & Balloon Coordinates
    Svc->>Val: 6. Audit Balloon Sequences & Limit Boundaries
    Val-->>Svc: 7. Validation Gate Passed
    Svc->>Repo: 8. Save Characteristics & Balloons
    Repo->>DB: 9. Write AES-256 Encrypted DB Transaction
    Svc-->>UI: 10. Hydrate Viewport Overlays & Inspector Grid
    UI-->>Engineer: 11. Display Numbered Balloons on Drawing Sheet
```

---

## 6. High-Level Error Handling & Recovery Strategy

### 6.1 Resilience & Error Fallback Flowchart

```mermaid
flowchart TD
    Fault["System Error Event"] --> Choice{"Error Category"}
    
    Choice -- "OCR / AI Timeout" --> Fallback1["Fallback to Manual Crop Inspector Grid & Notify User"]
    Choice -- "Corrupt / Invalid PDF" --> Fallback2["Abort Ingestion, Log Crash Event & Prompt Re-upload"]
    Choice -- "DB Lock / Encryption Error" --> Fallback3["Trigger RecoveryManager Backup Restore & Log Error"]
    Choice -- "Export Validation Error" --> Fallback4["Block Export & Highlight Failing Items in Inspector Grid"]
```

### 6.2 Error Handling & Recovery Strategy Matrix

| Error Condition | Subsystem Responsible | Detection & Fallback Strategy | User & System Impact |
| :--- | :--- | :--- | :--- |
| **OCR / AI Extraction Failure** | Local AI Engine | ONNX timeout handler catches failure; falls back to raw vector text extraction. | User receives toast alert; features highlighted for manual audit in Inspector Grid. |
| **Corrupt / Unsupported PDF** | Infrastructure Tier | PyMuPDF exception handler catches invalid stream; aborts job safely. | Drawing ingestion stops; user prompted to supply a valid PDF file. |
| **Database Encryption / Lock Error** | Storage & Security | SQLCipher lock handler catches exception; `RecoveryManager` restores auto-save snapshot. | Unsaved changes restored from local auto-save backup; zero data corruption. |
| **AS9102 Export Validation Gate Failure** | Validation Engine | `ValidationEngine` checks completeness; blocks export if mandatory fields or measurements are missing. | Export button disabled; incomplete items highlighted in yellow/red on the grid. |
| **Application Crash** | Infrastructure Tier | Crash handler captures stack trace to `crash.log`; saves emergency project recovery snapshot. | Upon restart, `RecoveryManager` prompts user to restore last session state. |

---

## 7. Core Technology Stack & Architecture Trade-Off Matrix

### 7.1 Core Technology Stack

| Architecture Layer | Selected Technology | Purpose & Role |
| :--- | :--- | :--- |
| **GUI Framework** | PySide6 (Qt 6.6+) | Postman-style desktop interface and 60 FPS viewport rendering. |
| **PDF Processing Engine** | PyMuPDF (`fitz`) | Sub-millisecond vector blueprint parsing and raster tile rendering. |
| **Local AI Engine** | ONNX Runtime | CPU-optimized local neural OCR and feature extraction. |
| **Encrypted Storage** | PySQLCipher | Encrypted local SQLite database (AES-256). |
| **Excel Exporter** | OpenPyXL / XlsxWriter | Multi-tab SAE AS9102 Form 1, Form 2, and Form 3 report generation. |
| **Packaging & Distribution** | Nuitka / PyInstaller | Standalone zero-dependency executable (`.exe`) bundling for air-gapped workstations. |

---

### 7.2 Architecture Trade-Off Matrix

| Design Area | Option Selected | Alternative Considered | Engineering Trade-off Rationale |
| :--- | :--- | :--- | :--- |
| **System Architecture** | **5-Layer Clean Architecture** | Monolithic Model-View | Enforces domain isolation, repository decoupling, and testability across independent layers. |
| **GUI Shell** | **PySide6 (Qt 6)** | Electron / Tauri | Native C++ graphics performance (`QGraphicsView`), lower memory footprint, direct native Python AI integration. |
| **AI Inference Engine** | **ONNX Runtime** | PyTorch / TensorFlow | Efficient CPU inference and reduced deployment footprint without CUDA GPU hardware requirements. |
| **PDF Engine** | **PyMuPDF (`fitz`)** | PDFMiner / pdfplumber | High-speed vector parsing and raster rendering speeds essential for responsive UI viewport performance. |
| **Deployment Packaging** | **Nuitka / PyInstaller** | Web App / Docker Container | Single standalone `.exe` zero-installer binary suitable for air-gapped defense machine shops without IT overhead. |

---

## 8. Non-Functional Requirements & Architecture Sign-Off

### 8.1 Performance & Reliability Targets
- **Viewport Rendering:** Responsive interactive rendering optimized for large engineering drawings on supported hardware.
- **AI Extraction Latency:** Performance target defined for reference hardware and representative drawing sets.
- **UI Responsiveness:** Under 2 seconds user interaction response time across all editing workflows.
- **Data Security & Air-Gap:** 100% local processing with zero external network connectivity.

### 8.2 Architecture Sign-Off Checklist
- [x] C4 Context Diagram (Level 1) included.
- [x] C4 Container Diagram (Level 2) included.
- [x] Deployment Diagram included.
- [x] Cross-Component Interaction Diagram (Auto-Balloon Sequence) included.
- [x] AI Processing Pipeline Diagram included.
- [x] High-Level Error Handling & Recovery Strategy included.
- [x] Document approved for detailed Low-Level Design (LLD).
