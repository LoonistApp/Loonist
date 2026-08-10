# FAI.EV.ENGINEER - Presentation Script

> **Speaker Note:** This script walks through every single block in our architecture diagrams. It names the exact technologies we use (for the engineers in the room) while instantly explaining their purpose in plain English (for the non-technical stakeholders).

---

## Stage 1: Identity, Auth & Multi-Tenant Edge Ingress

**"Let's start with Stage 1, which acts as the secure front door to our platform.**

When a user visits our site from their **Client Workstation Browser**, their request first hits **Cloudflare WAF**. Think of this as a digital security guard that blocks hackers and malicious bots before they even reach our servers.

Next, the request goes to the **NGINX Ingress Controller**, which is basically a traffic cop routing the user's internet traffic to the correct place. 

From there, we hit our **Next.js Edge Auth Middleware**. This is a super-fast checkpoint that verifies if the user is already logged in. It does this by checking a **Redis Session Cache**—a lightning-fast temporary memory system—meaning we can verify a user's session in under 2 milliseconds.

If they aren't logged in, they are sent to the **Auth Service (NextAuth)**. This service can send a passwordless magic link to their email using the **Resend Email API**, or let them log in with their company's single sign-on (like Okta or Azure AD) using our **SAML 2.0 Jackson Proxy**.

Finally, when the user is authenticated, we use **Prisma Tenant Middleware** to connect to our main database: **AWS Aurora PostgreSQL + PostGIS**. We use a feature called **Row-Level Security (RLS)**, which essentially creates a bank vault for each client. Even though all companies share the same database, this rule ensures a user can mathematically only see their own company's data."

---

## Stage 2: Direct PDF Ingestion & Viewport Rendering

**"Moving to Stage 2, this is how we handle massive engineering blueprints without crashing the system.**

First, a Quality Engineer drops a heavy blueprint PDF into the **Next.js WebApp UI**. 

Instead of sending this huge file directly through our web servers, our **Node.js API Gateway** steps in. The API talks to **Redis** to verify the user has enough storage limits, and then returns a **Presigned PUT URL** from **AWS S3**. S3 is Amazon's massive digital warehouse. 

This presigned URL acts like a VIP ticket, allowing the user's browser to upload the massive PDF directly into Amazon S3, completely bypassing our core API. This keeps our system fast and prevents memory crashes.

Once the PDF is safely in S3, S3 sends a '200 OK' confirmation back to the WebApp. 

To let the user actually see the blueprint on screen, we initialize our **WebGL Viewport Engine** (using PDF.js and HTML5 Canvas). This uses the graphics card in the user's computer to render the image, allowing them to smoothly zoom and pan around incredibly complex, multi-layer schematics at a buttery-smooth 60 frames per second."

---

## Stage 3: Asynchronous AI Feature Extraction & Phased Autoscaling

**"Stage 3 is the brain of the operation, where our AI takes over.**

It starts with an **Explicit User Action**—the user clicks the 'Auto Balloon' button. We enforce this rule so we don't waste computer power analyzing files that don't need it yet.

This request hits the **Node.js API Gateway**, which immediately drops a message into our **Message Queue**. For our initial Beta, we are keeping it cost-effective with a simpler queue like **SQS or BullMQ**. In the future as we scale to enterprise workloads, this drops into **Apache Kafka**. Think of this queue as a robust 'to-do list' for our AI.

Next, we have the **Autoscaler** (using **ECS** for Beta, and later **KEDA**). The Autoscaler constantly watches the to-do list. If 50 drawings are queued up at once, the Autoscaler automatically boots up up to 50 **AI Extraction Containers** (our Worker Pool) to handle the heavy lifting, then scales them back down to zero to save costs.

We track every single job carefully through a series of states: **QUEUED → PROCESSING → SUCCESS or FAILED**. If the AI hits a snag, it safely retries without duplicating work (we call this **Idempotent Execution**), and if it completely fails, it gets moved to a Dead Letter Queue (DLQ) for human review.

Inside that Worker Pool, we run three specific AI engines in sequence:
1. The **ONNX Neural OCR Engine** uses machine learning to read the visual text and dimensions on the drawing.
2. The **ASME Y14.5 GD&T AST Parser** acts as a translator, decoding complex aerospace tolerance symbols into structured data.
3. The **Spatial R-Tree Orbiting Algorithm** acts as the layout designer, calculating exactly where to draw the balloon on the screen so it doesn't overlap or hide text.

Once the AI finishes, it saves the data. It talks to **PgBouncer** (a traffic manager that handles thousands of database connections efficiently) and saves it to **PostgreSQL + PostGIS** (our database, which has specialized tools for storing visual coordinates). 

Finally, it uses **Redis WebSockets PubSub** to instantly push the results back to the **Next.js WebApp UI** in real-time. The engineer sees the balloons pop up on their screen without ever hitting refresh."

---

## Stage 4: Interactive Dual-Layer Blueprint Editor

**"Stage 4 is the workbench where engineers review and adjust the AI's work.**

The editor is split into four interacting layers:

1. **The Visual Balloon Canvas Layer:** This is what the engineer sees on the drawing. They can drag balloons around (which tracks exact X/Y coordinates), use **Smart Bending Leaders** to draw arrow lines that curve around obstacles (straight, curved, or elbow), choose different **Shape Options** (circles, boxes, flag triangles), and if they delete a balloon, the **Auto Sequential Renumbering** instantly shifts all the remaining numbers to fill the gap.

2. **The Extracted Data Inspector Grid (Table Layer):** This is the spreadsheet view. Engineers can edit the nominal values, tolerances, and datums extracted by the AI. The system also uses a **Zone Grid Calculation** to automatically note where on the page (like zone B4 or C2) the measurement is located, just like finding a city on a map.

3. **The Review Layer:** If the AI is ever less than 95% confident in its reading, it triggers a **Mandatory Validation Workflow**. It blocks final approval and shows the engineer a **Magnified Raw Bitmap Crop** of the original PDF right next to what the AI *thinks* it says. The human must make the final call, ensuring no unverified data slips through.

4. **The Multi-User Lock Manager:** Because multiple people might edit the same drawing, we use **WebSockets** to manage locks in real-time. If I click a balloon, it highlights in orange on my coworker's screen, physically preventing them from editing the exact same item at the same time."

---

## Stage 5: Persistence, SHA-256 Audit Ledger & AS9102 Export

**"The final stage handles strict aerospace compliance and reporting.**

When the engineer clicks 'Approve' on the **Validated Package**, the work is finished. 

It routes through **PgBouncer** back into **AWS Aurora PostgreSQL + PostGIS**. But crucially, we write this to a **Tamper-Evident SHA-256 Hash Chain Ledger**. In technical terms, every edit is mathematically linked to the previous one like a digital chain. In business terms, it means every single edit is permanently recorded, and if anyone tries to secretly alter a past record, the entire chain breaks. This guarantees 100% legally binding traceability for aerospace audits.

At the same time, the approved package hits our **Compliance Compiler**. This engine takes all the data and automatically generates the massive, legally required **AS9102 Form 1, Form 2, and Form 3** Excel spreadsheets, along with a final **Marked-Up PDF** containing all the balloons.

These massive files are securely saved back into **AWS S3**. Finally, the **Resend API** generates a secure download link and emails it directly to the **User Inbox**, completing the entire workflow without ever bogging down our core application servers. 

**And that is the complete architecture of FAI.EV.ENGINEER.**"
