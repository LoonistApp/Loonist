# 🧠 LOONIST Architecture & Technology Study Guide

This document is a comprehensive, deep-dive revision guide covering every core architectural concept, library choice, and security mechanism driving the LOONIST application.

---

## 1. The Core Problem: Why Offline-First?
Most modern software (like Google Docs) is a **SaaS Web App** where data is processed on remote cloud servers (AWS/Azure). 
*   **The ITAR Constraint:** Aerospace and Defense companies (Tier 1/2 Suppliers) are strictly bound by **ITAR** (International Traffic in Arms Regulations). It is legally prohibited to upload classified weapon or aerospace blueprints to random cloud servers.
*   **The LOONIST Solution:** We built an **Offline-First Desktop App**. The software is downloaded to the engineer's local machine (`.exe`). The AI extraction, the PDF rendering, and the database storage happen **100% locally**. The blueprints never cross the internet boundary, ensuring complete ITAR compliance.

---

## 2. The Desktop App Architecture (`/fai-app`)

We use **Electron** to build the desktop app. Electron acts as a customized Google Chrome browser strapped to a Node.js server. This creates two distinct "worlds" that must communicate securely:

### A. The Renderer Process (The Frontend / UI)
*   **Location:** `/src`
*   **Role:** Draws the UI, the buttons, and the WebGL Canvas for the PDF. It acts exactly like a sandboxed web page. It has **no access** to the computer's hard drive to prevent malicious PDF scripts (XSS) from destroying the user's computer.
*   **Libraries:**
    *   **`react` & `react-dom` (v19):** Manages the complex state of the UI and redraws the screen at 60 FPS when a user drags balloons.
    *   **`vite`:** The modern bundler. Older tools (like Webpack) were notoriously slow. Vite uses native ES modules to instantly update the React UI on your screen the exact millisecond you hit "Save" in your code editor.

### B. The Main Process (The Backend / Node.js)
*   **Location:** `/electron`
*   **Role:** The heavy lifter. It has full OS privileges. It reads the local PDF file, runs the heavy ONNX AI models, and saves data to the hard drive.
*   **Libraries:**
    *   **`better-sqlite3`:** Our database engine. Standard databases (PostgreSQL) require heavy servers. SQLite saves the entire database as one local file (e.g., `loonist.db`). 
        *   *Why this specific library?* Most Node.js database libraries are "asynchronous" (they wait). `better-sqlite3` is written with C++ bindings and is **synchronous**. It executes queries instantly without blocking.
        *   *The WAL Magic:* We enable `PRAGMA journal_mode = WAL` (Write-Ahead Logging). This keeps a continuous ledger of every change, allowing us to build an **atomic Undo/Redo system** (saving previous states) that won't corrupt the file if the computer loses power mid-save.

### C. The IPC Bridge (`preload.ts`)
Because the Renderer (React) cannot touch the hard drive, it must ask the Main Process (Node.js) to do it via **Inter-Process Communication (IPC)**.
*   **Library:** **`zod`**
*   **Role:** Zod is a schema validation library that acts as a bouncer at the bridge. If React says *"Save this text"*, Zod mathematically verifies that the payload is actually text, preventing hackers from sneaking executable code across the bridge into the Node.js backend.

### D. The Developer Tooling
*   **`typescript`:** Enforces strict types (e.g., ensuring a coordinate is a number, not a string), catching 80% of bugs before runtime.
*   **`oxlint`:** An ultra-fast code linter. 
    *   *Why is it fast?* Traditional linters (like ESLint) are written in JavaScript and run on the slow V8 engine. Oxlint is written from the ground up in **Rust**. Rust compiles directly to machine code and utilizes multi-threading across all your CPU cores, making Oxlint up to 50x-100x faster than ESLint.

---

## 3. The Cloud Licensing Control Plane (`/cloudflare-licensing-api`)

If the desktop app is offline, how do we prevent piracy? We built a lightweight Cloud API that acts as a licensing bouncer.

### A. Serverless Edge Computing
Instead of renting a $50/month AWS server that runs 24/7, we use **Cloudflare Workers**. The code only wakes up for 2 milliseconds when a user activates the app, runs the logic, and goes back to sleep.
*   **Library:** **`hono`** - A ridiculously fast web framework (like Express.js) but specifically optimized for Edge computing networks.

### B. The Local Simulator (`.wrangler`)
When you type `npx wrangler dev`, Cloudflare spins up a local simulator engine called **Miniflare**. 
*   **The `.wrangler` folder:** This is the matrix. It is an auto-generated dummy folder where Miniflare pretends to be the global cloud on your laptop.
*   **`state/v3/d1`:** This folder contains the fake SQLite file representing **Cloudflare D1** (their serverless SQL database). This is where your local test Tenants, Devices, and Licenses are stored during development.
*   **`tmp/dev-egsjEC/index.js`:** Cloudflare requires your entire app to be uploaded as **one single file**. Wrangler uses a tool called `esbuild` to grab your TypeScript code, grab the source code of all your libraries (Hono, crypto), and glue them together into a massive 4,000+ line bundle (`index.js`) so it can run independently in the cloud.

*(Note: If you delete the `.wrangler` folder, it regenerates instantly on the next run, but you lose your local test database entries).*

### C. The `.gitignore` File
This file protects your GitHub repository by instructing `git` to ignore specific files:
1.  `node_modules/`: Prevent uploading gigabytes of downloaded libraries.
2.  `.wrangler/`: Prevent uploading fake local simulation databases.
3.  `.dev.vars`: **Security critical.** Prevents uploading your top-secret API passwords to the public internet where hackers scan for them.

---

## 4. The Cryptographic Handshake (Ed25519)

**The Threat:** If we just gave the user a license file that says `{"expires": "2027"}`, they could open it in Notepad and change it to `"2099"` to steal the software forever.
**The Solution:** We mathematically sign the file using cryptography (`crypto.ts`).

### How it Works (The Workflow)
1.  **Preparation:** The API takes the JSON license data and converts it into raw binary 1s and 0s (`Uint8Array`) because cryptography algorithms only understand raw bytes.
2.  **The Signature:** We use **Ed25519** (via `@noble/curves`), a military-grade elliptic-curve cryptography algorithm. The Cloudflare API feeds the raw bytes and its **Top-Secret Private Key** into the algorithm to generate a unique signature.
3.  **Hexadecimal Conversion:** The signature comes out as raw binary, which is messy. We convert it to a Hexadecimal string (e.g., `a1b2c3d4...`) so it is easy to send over the internet.
4.  **The Validation:** The Desktop App receives the license and the Hex signature. The Desktop App has the corresponding **Public Key** hardcoded into it. It uses math to ask: *"Did the server holding the secret Private Key actually sign this exact data?"*

If the user changes `"2027"` to `"2099"` in Notepad, the math instantly breaks. The signature becomes invalid, the Desktop app detects the forgery, and it completely locks them out of the software.
