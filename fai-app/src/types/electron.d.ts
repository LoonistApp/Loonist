export interface BlueprintFileResult {
  cancelled: boolean;
  fileName?: string;
  filePath?: string;
  fileSize?: number;
  fileHash?: string;
  buffer?: ArrayBuffer;
  error?: string;
}

export interface IElectronAPI {
  getProject: (projectId: string) => Promise<{ id: string; name: string; status: string }>;
  openBlueprintDialog: () => Promise<BlueprintFileResult>;
  loadSampleBlueprint: () => Promise<BlueprintFileResult>;
}

declare global {
  interface Window {
    api?: IElectronAPI;
  }
}
