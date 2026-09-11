import { app, BrowserWindow, ipcMain, shell, session, dialog } from 'electron';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { z } from 'zod';
import { DBManager } from './database';

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
let mainWindowRef: BrowserWindow | null = null;

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'LOONIST — Aerospace FAI Platform',
    backgroundColor: '#0f172a',
    webPreferences: {
      // SECTION 23: Strict Security Policies
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: path.join(__dirname, 'preload.mjs'),
    },
  });

  mainWindowRef = mainWindow;

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Block arbitrary navigation
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (url !== 'http://localhost:5173/') {
       event.preventDefault();
       console.warn(`Blocked navigation to ${url}`);
    }
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
          "default-src 'self'; script-src 'self' 'unsafe-inline'; worker-src 'self' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' blob:;"
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
  if (senderUrl !== 'http://localhost:5173/' && !senderUrl?.startsWith('file://')) {
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

