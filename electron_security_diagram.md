# FAI.EV.ENGINEER — Electron Security Visual Architecture

```mermaid
flowchart TD
    User(["USER 👤<br>clicks / interacts"])

    Renderer1["RENDERER / UI 🌐<br>React • Editor • Dashboard<br>❌ No Node.js<br>❌ No direct Files<br>❌ No direct SQLite<br>❌ No direct OS access"]

    User --> Renderer1

    subgraph SecurityContext ["Security Boundaries"]
        direction LR
        Sandbox["Sandbox 🔒"]
        ContextIso["Context Isolation 🔐<br>UI separated from<br>Electron internals"]
        CSP["CSP 🛡️"]
    end

    Renderer1 --> Sandbox
    Renderer1 --> ContextIso
    Renderer1 --> CSP

    Preload1["PRELOAD 🚪<br>Exposes only<br>approved APIs"]

    Sandbox --> Preload1
    ContextIso --> Preload1
    CSP --> Preload1

    Main["MAIN PROCESS 🔐<br>Security / Validation<br>App lifecycle<br>IPC handling"]

    Preload1 -- "Controlled IPC" --> Main

    subgraph NativeResources ["Native Resources"]
        direction LR
        SQLite["SQLite 🗄️<br>Projects<br>Drawings<br>Features<br>Balloons"]
        Files["Files 📁<br>PDF input<br>Exports<br>Backups<br>License"]
        ONNX["ONNX 🧠<br>AI inference<br>GPU / CPU<br>Models"]
    end

    Main --> SQLite
    Main --> Files
    Main --> ONNX

    Preload2["PRELOAD 🚪"]

    SQLite -- "Result" --> Preload2
    Files -- "Result" --> Preload2
    ONNX -- "Result" --> Preload2

    Renderer2["RENDERER 🌐<br>Shows result"]

    Preload2 --> Renderer2
```

## Security Policies
- `contextIsolation: true` is strictly enforced.
- `nodeIntegration: false` in all renderer processes.
- `sandbox: true` enabled for all renderers.
- **Navigation:** The app overrides `webContents.setWindowOpenHandler` to block arbitrary URL navigation. External links (e.g., Help docs) open exclusively in the OS default browser.
- **CSP:** A strict Content Security Policy blocks inline scripts and limits image/worker sources to `self`.
