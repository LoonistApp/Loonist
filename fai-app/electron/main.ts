import { app, BrowserWindow, ipcMain, shell, session, dialog } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { DBManager } from './database';
import { activateLicense, renewLicense, revokeLicense, verifyStoredLicense } from './licensing';
import { licenseActivateSchema, licenseDeviceSchema, licenseVerifySchema } from './licenseProtocol';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ==========================================
// SECTION 25: FILESYSTEM SECURITY
// ==========================================

/**
 * Resolves and canonicalizes a path, throwing an error if it attempts to traverse
 * outside the allowed base directory.
 */
export function resolveSecurePath(baseDir: string, targetPath: string): string {
  const resolvedPath = path.resolve(baseDir, targetPath);
  if (!resolvedPath.startsWith(path.resolve(baseDir))) {
    throw new Error('Security Exception: Directory traversal attempt detected');
  }
  return resolvedPath;
}

// Define the environment
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
const devServerUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';
let mainWindowRef: BrowserWindow | null = null;

// Prevent Windows disk cache permission conflicts in multi-process dev
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');
app.setName('LOONIST');

function createWindow() {
  // The preload is built as CommonJS (.cjs): sandboxed preload scripts cannot be ES modules
  const preloadPath = path.join(__dirname, 'preload.cjs');

  const mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'LOONIST — Aerospace FAI Platform',
    backgroundColor: '#f8fafc',
    show: false,
    webPreferences: {
      // SECTION 23: Strict Security Policies
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: preloadPath,
    },
  });

  mainWindowRef = mainWindow;

  mainWindow.once('ready-to-show', () => {
    console.log('LOONIST Window Ready To Show — Bringing to front');
    mainWindow.show();
    mainWindow.focus();
    mainWindow.setAlwaysOnTop(true);
    mainWindow.setAlwaysOnTop(false);
  });

  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL).catch(() => {
      console.warn('Dev server URL unreachable, loading local dist bundle');
      mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Block arbitrary navigation
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (devServerUrl && url.startsWith(devServerUrl)) {
      return;
    }
    event.preventDefault();
    console.warn(`Blocked navigation to ${url}`);
  });

  // Open external links in OS default browser
  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindowRef = null;
  });
}

app.whenReady().then(() => {
  // Initialize Database in the user data directory
  const dbPath = path.join(app.getPath('userData'), 'fai_local.db');
  const _db = new DBManager(dbPath);

  // Enforce Strict Content Security Policy (CSP) allowing inline workers for PDF.js
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self' http://localhost:* ws://localhost:*; script-src 'self' 'unsafe-inline' http://localhost:*; worker-src 'self' blob:; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' data: blob:; connect-src 'self' blob: http://localhost:* ws://localhost:*;"
        ]
      }
    });
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// ==========================================
// SECTION 24: STRICT IPC BRIDGE & VALIDATION
// ==========================================

function validateSender(event: Electron.IpcMainInvokeEvent) {
  const senderUrl = event.senderFrame?.url;
  const currentDevUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';
  if (
    !senderUrl?.startsWith(currentDevUrl) &&
    !senderUrl?.startsWith('http://localhost:') &&
    !senderUrl?.startsWith('file://')
  ) {
     throw new Error('Unauthorized sender context');
  }
}

/**
 * Registers an allowlisted IPC channel: checks the sender, then validates the payload
 * with a Zod schema before the handler runs.
 */
function handleIpc<S extends z.ZodType>(
  channel: string,
  schema: S,
  handler: (data: z.infer<S>) => unknown
) {
  ipcMain.handle(channel, async (event, payload) => {
    validateSender(event);
    const parsed = schema.safeParse(payload);
    if (!parsed.success) {
      console.error(`IPC validation failed on ${channel}:`, parsed.error.issues);
      throw new Error('Invalid IPC payload');
    }
    return handler(parsed.data);
  });
}

const noPayload = z.undefined();

const getProjectSchema = z.object({
  projectId: z.string().min(1, "Project ID is required")
});

handleIpc('ipc-get-project', getProjectSchema, ({ projectId }) => {
  return { id: projectId, name: 'Secure FAI Project', status: 'Approved' };
});

// ==========================================
// SPRINT 2: BLUEPRINT FILE INGESTION IPC
// ==========================================

handleIpc('ipc-open-blueprint-dialog', noPayload, async () => {
  if (!mainWindowRef) {
    throw new Error('No active window');
  }

  const result = await dialog.showOpenDialog(mainWindowRef, {
    title: 'Open Aerospace Blueprint (PDF)',
    properties: ['openFile'],
    filters: [
      { name: 'Blueprint PDF Documents', extensions: ['pdf'] }
    ]
  });

  if (result.canceled || result.filePaths.length === 0) {
    return { cancelled: true };
  }

  const filePath = result.filePaths[0];
  const fileBuffer = await fs.promises.readFile(filePath);
  const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
  const stats = await fs.promises.stat(filePath);

  return {
    cancelled: false,
    fileName: path.basename(filePath),
    filePath: filePath,
    fileSize: stats.size,
    fileHash: hash,
    buffer: fileBuffer.buffer.slice(fileBuffer.byteOffset, fileBuffer.byteOffset + fileBuffer.byteLength)
  };
});

handleIpc('ipc-load-sample-blueprint', noPayload, async () => {
  // Look for sample in app directory or resources
  const samplePath = path.join(__dirname, '../public/sample_blueprint.pdf');
  if (fs.existsSync(samplePath)) {
    const fileBuffer = await fs.promises.readFile(samplePath);
    const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
    const stats = await fs.promises.stat(samplePath);
    return {
      cancelled: false,
      fileName: 'AS9102_Sample_Turbine_Bracket_RevC.pdf',
      filePath: samplePath,
      fileSize: stats.size,
      fileHash: hash,
      buffer: fileBuffer.buffer.slice(fileBuffer.byteOffset, fileBuffer.byteOffset + fileBuffer.byteLength)
    };
  }

  return { cancelled: true, error: 'Sample blueprint file not found' };
});

const loadBlueprintPathSchema = z.object({
  filePath: z.string().min(1).max(4096)
});

handleIpc('ipc-load-blueprint-path', loadBlueprintPathSchema, async ({ filePath }) => {
  if (!fs.existsSync(filePath)) {
    return { cancelled: true, error: 'File not found on disk' };
  }

  try {
    const fileBuffer = await fs.promises.readFile(filePath);
    const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
    const stats = await fs.promises.stat(filePath);

    return {
      cancelled: false,
      fileName: path.basename(filePath),
      filePath: filePath,
      fileSize: stats.size,
      fileHash: hash,
      buffer: fileBuffer.buffer.slice(fileBuffer.byteOffset, fileBuffer.byteOffset + fileBuffer.byteLength)
    };
  } catch (err: any) {
    return { cancelled: true, error: err?.message || 'Failed to read file from disk' };
  }
});

// ==========================================
// SPRINT 4: LOONIST PROJECT PERSISTENCE IPC
// ==========================================

const saveProjectFileSchema = z.object({
  fileName: z.string().max(255).optional(),
  content: z.string()
});

handleIpc('ipc-save-project-file', saveProjectFileSchema, async ({ fileName, content }) => {
  if (!mainWindowRef) {
    throw new Error('No active window');
  }

  const result = await dialog.showSaveDialog(mainWindowRef, {
    title: 'Save LOONIST Inspection Project',
    defaultPath: fileName || 'inspection_project.loonist',
    filters: [
      { name: 'LOONIST Project Package (*.loonist)', extensions: ['loonist'] },
      { name: 'JSON Document (*.json)', extensions: ['json'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });

  if (result.canceled || !result.filePath) {
    return { cancelled: true };
  }

  await fs.promises.writeFile(result.filePath, content, 'utf-8');
  return { cancelled: false, filePath: result.filePath };
});

handleIpc('ipc-load-project-file', noPayload, async () => {
  if (!mainWindowRef) {
    throw new Error('No active window');
  }

  const result = await dialog.showOpenDialog(mainWindowRef, {
    title: 'Open LOONIST Inspection Project',
    properties: ['openFile'],
    filters: [
      { name: 'LOONIST Project Package (*.loonist)', extensions: ['loonist'] },
      { name: 'JSON Document (*.json)', extensions: ['json'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });

  if (result.canceled || result.filePaths.length === 0) {
    return { cancelled: true };
  }

  const filePath = result.filePaths[0];
  const content = await fs.promises.readFile(filePath, 'utf-8');

  return {
    cancelled: false,
    fileName: path.basename(filePath),
    filePath,
    content
  };
});

// ==========================================
// SPRINT 7: WINDOW CONTROLS & DIALOGS
// ==========================================

const messageBoxSchema = z.object({
  message: z.string().max(4000),
  title: z.string().max(200).optional()
});

handleIpc('ipc-show-message-box', messageBoxSchema, async ({ message, title }) => {
  const options = {
    type: 'none' as const,
    title: title || 'LOONIST',
    message,
    buttons: ['OK'],
    noLink: true,
  };
  const win = mainWindowRef || BrowserWindow.getFocusedWindow();
  if (win) {
    await dialog.showMessageBox(win, options);
  } else {
    await dialog.showMessageBox(options);
  }
  return { success: true };
});

handleIpc('ipc-exit-app', noPayload, () => {
  app.quit();
  return { success: true };
});

handleIpc('ipc-window-minimize', noPayload, () => {
  const win = mainWindowRef || BrowserWindow.getFocusedWindow();
  win?.minimize();
  return { success: true };
});

handleIpc('ipc-window-maximize', noPayload, () => {
  const win = mainWindowRef || BrowserWindow.getFocusedWindow();
  if (win?.isMaximized()) {
    win.unmaximize();
  } else {
    win?.maximize();
  }
  return { isMaximized: Boolean(win?.isMaximized()) };
});

handleIpc('ipc-window-restore', noPayload, () => {
  const win = mainWindowRef || BrowserWindow.getFocusedWindow();
  win?.unmaximize();
  return { isMaximized: false };
});

handleIpc('ipc-window-is-maximized', noPayload, () => {
  const win = mainWindowRef || BrowserWindow.getFocusedWindow();
  return { isMaximized: Boolean(win?.isMaximized()) };
});

/** Real runtime versions for Options → Privacy & About. */
handleIpc('ipc-app-info', noPayload, () => ({
  version: app.getVersion(),
  electron: process.versions.electron,
  chrome: process.versions.chrome,
  node: process.versions.node,
  platform: `${process.platform} ${process.arch}`,
  packaged: app.isPackaged
}));

handleIpc('ipc-window-close', noPayload, () => {
  const win = mainWindowRef || BrowserWindow.getFocusedWindow();
  win?.close();
  return { success: true };
});

// ==========================================
// SPRINT 8: LICENSING (MAIN PROCESS ONLY)
// ==========================================

handleIpc('ipc-license-activate', licenseActivateSchema, ({ apiUrl, token }) => activateLicense(apiUrl, token));
handleIpc('ipc-license-renew', licenseDeviceSchema, ({ apiUrl, deviceId }) => renewLicense(apiUrl, deviceId));
handleIpc('ipc-license-revoke', licenseDeviceSchema, ({ apiUrl, deviceId }) => revokeLicense(apiUrl, deviceId));
handleIpc('ipc-license-verify', licenseVerifySchema, ({ payload, signature }) => verifyStoredLicense(payload, signature));
