export interface BlueprintFileResult {
  cancelled: boolean;
  fileName?: string;
  filePath?: string;
  fileSize?: number;
  fileHash?: string;
  buffer?: ArrayBuffer;
  error?: string;
}

export interface ProjectFileResult {
  cancelled: boolean;
  fileName?: string;
  filePath?: string;
  content?: string;
  error?: string;
}

export interface IElectronAPI {
  getProject: (projectId: string) => Promise<{ id: string; name: string; status: string }>;
  openBlueprintDialog: () => Promise<BlueprintFileResult>;
  loadSampleBlueprint: () => Promise<BlueprintFileResult>;
  loadBlueprintPath: (filePath: string) => Promise<BlueprintFileResult>;
  saveProjectFile: (fileName?: string, content?: string) => Promise<{ cancelled: boolean; filePath?: string; error?: string }>;
  loadProjectFile: () => Promise<ProjectFileResult>;
}

declare global {
  interface Window {
    api?: IElectronAPI;
  }
}
