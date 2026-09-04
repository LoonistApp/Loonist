import { app, BrowserWindow, ipcMain, shell, session } from 'electron';
import path from 'path';
import fs from 'fs';
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

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      // SECTION 23: Strict Security Policies
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: path.join(__dirname, 'preload.mjs'),
    },
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
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
}

app.whenReady().then(() => {
  // Initialize Database in the user data directory
  const dbPath = path.join(app.getPath('userData'), 'fai_local.db');
  const db = new DBManager(dbPath);

  // Enforce Strict Content Security Policy (CSP)
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': ["default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:"]
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

const getProjectSchema = z.object({
  projectId: z.string().min(1, "Project ID is required")
});

ipcMain.handle('ipc-get-project', async (event, payload) => {
  // 1. Validate Sender (Prevent malicious iframes from spoofing IPC)
  const senderUrl = event.senderFrame?.url;
  if (senderUrl !== 'http://localhost:5173/' && !senderUrl?.startsWith('file://')) {
     throw new Error('Unauthorized sender context');
  }

  // 2. Validate Payload with Zod
  const parsed = getProjectSchema.safeParse(payload);
  if (!parsed.success) {
     console.error('IPC Validation failed:', parsed.error);
     throw new Error('Invalid IPC payload');
  }

  // 3. Execute privileged operation safely
  return { id: parsed.data.projectId, name: 'Secure FAI Project', status: 'Approved' };
});
