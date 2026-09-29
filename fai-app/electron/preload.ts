import { contextBridge, ipcRenderer } from 'electron';

// Expose a typed API to the renderer process
// Enforces Context Isolation (Reload v2)
contextBridge.exposeInMainWorld('api', {
  getProject: (projectId: string) => ipcRenderer.invoke('ipc-get-project', { projectId }),
  openBlueprintDialog: () => ipcRenderer.invoke('ipc-open-blueprint-dialog'),
  loadSampleBlueprint: () => ipcRenderer.invoke('ipc-load-sample-blueprint'),
  loadBlueprintPath: (filePath: string) => ipcRenderer.invoke('ipc-load-blueprint-path', { filePath }),
  saveProjectFile: (fileName: string | undefined, content: string) => ipcRenderer.invoke('ipc-save-project-file', { fileName, content }),
  loadProjectFile: () => ipcRenderer.invoke('ipc-load-project-file'),
  showMessageBox: (message: string, title?: string) => ipcRenderer.invoke('ipc-show-message-box', { message, title }),
  exitApp: () => ipcRenderer.invoke('ipc-exit-app'),
  minimizeWindow: () => ipcRenderer.invoke('ipc-window-minimize'),
  maximizeWindow: () => ipcRenderer.invoke('ipc-window-maximize'),
  restoreWindow: () => ipcRenderer.invoke('ipc-window-restore'),
  isWindowMaximized: () => ipcRenderer.invoke('ipc-window-is-maximized'),
  closeWindow: () => ipcRenderer.invoke('ipc-window-close'),
  // Licensing runs in the main process; the device private key never reaches the renderer
  licenseActivate: (apiUrl: string, token: string) => ipcRenderer.invoke('ipc-license-activate', { apiUrl, token }),
  licenseRenew: (apiUrl: string, deviceId: string) => ipcRenderer.invoke('ipc-license-renew', { apiUrl, deviceId }),
  licenseRevoke: (apiUrl: string, deviceId: string) => ipcRenderer.invoke('ipc-license-revoke', { apiUrl, deviceId }),
});
