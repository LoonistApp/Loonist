import { app, BrowserWindow, ipcMain, shell, session, dialog } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { DBManager } from './database';

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

function createWindow() {
  const preloadCandidateMjs = path.join(__dirname, 'preload.mjs');
  const preloadCandidateJs = path.join(__dirname, 'preload.js');
  const preloadPath = fs.existsSync(preloadCandidateMjs) ? preloadCandidateMjs : preloadCandidateJs;

  const mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'LOONIST — Aerospace FAI Platform',
    backgroundColor: '#0f172a',
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
          "default-src 'self' http://localhost:* ws://localhost:*; script-src 'self' 'unsafe-inline' http://localhost:*; worker-src 'self' blob:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob:; connect-src 'self' blob: http://localhost:* ws://localhost:*;"
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

const getProjectSchema = z.object({
  projectId: z.string().min(1, "Project ID is required")
});

ipcMain.handle('ipc-get-project', async (event, payload) => {
  validateSender(event);
  const parsed = getProjectSchema.safeParse(payload);
  if (!parsed.success) {
     console.error('IPC Validation failed:', parsed.error);
     throw new Error('Invalid IPC payload');
  }
  return { id: parsed.data.projectId, name: 'Secure FAI Project', status: 'Approved' };
});

// ==========================================
// SPRINT 2: BLUEPRINT FILE INGESTION IPC
// ==========================================

ipcMain.handle('ipc-open-blueprint-dialog', async (event) => {
  validateSender(event);

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

ipcMain.handle('ipc-load-sample-blueprint', async (event) => {
  validateSender(event);

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

