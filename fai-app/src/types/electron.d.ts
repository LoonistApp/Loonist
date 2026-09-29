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

export interface LicensePayload {
  licenseId: string;
  deviceId: string;
  tenantId: string;
  expiresAt: string;
  features: string[];
  devicePublicKey?: string;
}

export interface LicenseVerification {
  verdict: 'ACTIVE' | 'EXPIRED' | 'NOT_ACTIVATED' | 'INVALID' | 'UNVERIFIABLE';
  message: string;
  expiresAt: string | null;
}

export type LicenseCallResult =
  | { success: true; payload?: LicensePayload; signature?: string; expiresAt?: string; devicePublicKey: string; verification?: LicenseVerification; message: string }
  | { success: false; message: string };

export interface IElectronAPI {
  getProject: (projectId: string) => Promise<{ id: string; name: string; status: string }>;
  openBlueprintDialog: () => Promise<BlueprintFileResult>;
  loadSampleBlueprint: () => Promise<BlueprintFileResult>;
  loadBlueprintPath: (filePath: string) => Promise<BlueprintFileResult>;
  saveProjectFile: (fileName: string | undefined, content: string) => Promise<{ cancelled: boolean; filePath?: string; error?: string }>;
  loadProjectFile: () => Promise<ProjectFileResult>;
  showMessageBox?: (message: string, title?: string) => Promise<{ success: boolean }>;
  exitApp?: () => Promise<{ success: boolean }>;
  minimizeWindow?: () => Promise<{ success: boolean }>;
  maximizeWindow?: () => Promise<{ isMaximized: boolean }>;
  restoreWindow?: () => Promise<{ isMaximized: boolean }>;
  isWindowMaximized?: () => Promise<{ isMaximized: boolean }>;
  closeWindow?: () => Promise<{ success: boolean }>;
  licenseActivate?: (apiUrl: string, token: string) => Promise<LicenseCallResult>;
  licenseRenew?: (apiUrl: string, deviceId: string) => Promise<LicenseCallResult>;
  licenseRevoke?: (apiUrl: string, deviceId: string) => Promise<LicenseCallResult>;
  licenseVerify?: (payload: unknown, signature: string) => Promise<LicenseVerification>;
}

declare global {
  interface Window {
    api?: IElectronAPI;
  }
}
