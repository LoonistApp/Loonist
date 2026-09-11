import { contextBridge, ipcRenderer } from 'electron';

// Expose a typed API to the renderer process
// This enforces Context Isolation (React cannot access Node APIs directly)
contextBridge.exposeInMainWorld('api', {
  getProject: (projectId: string) => ipcRenderer.invoke('ipc-get-project', { projectId }),
  openBlueprintDialog: () => ipcRenderer.invoke('ipc-open-blueprint-dialog'),
  loadSampleBlueprint: () => ipcRenderer.invoke('ipc-load-sample-blueprint'),
});
