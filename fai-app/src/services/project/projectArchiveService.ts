import type { EngineeringCharacteristic, ProjectProperties } from '../../types/characteristics';
import type { BlueprintDocument } from '../../types/blueprint';

export interface LoonistProjectPackage {
  format: 'LOONIST_PROJECT_V1';
  version: string;
  createdAt: string;
  updatedAt: string;
  projectProps: ProjectProperties;
  blueprintDoc: BlueprintDocument | null;
  characteristics: EngineeringCharacteristic[];
  pdfBase64?: string;
  pdfFileName?: string;
  activeSheetIndex: number;
  scale: number;
  rotation: number;
}

export class ProjectArchiveService {
  /**
   * Encodes an ArrayBuffer into a Base64 string for embedding into .loonist packages
   */
  public static arrayBufferToBase64(buffer: ArrayBuffer): string {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Decodes a Base64 string back into an ArrayBuffer
   */
  public static base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  /**
   * Creates a structured LoonistProjectPackage
   */
  public static createPackage(
    projectProps: ProjectProperties,
    characteristics: EngineeringCharacteristic[],
    blueprintDoc: BlueprintDocument | null,
    pdfBuffer?: ArrayBuffer | null,
    pdfFileName?: string,
    activeSheetIndex: number = 0,
    scale: number = 1.0,
    rotation: number = 0
  ): LoonistProjectPackage {
    return {
      format: 'LOONIST_PROJECT_V1',
      version: '2.1.0',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      projectProps,
      blueprintDoc,
      characteristics,
      pdfBase64: pdfBuffer ? ProjectArchiveService.arrayBufferToBase64(pdfBuffer) : undefined,
      pdfFileName: pdfFileName || blueprintDoc?.name || 'blueprint.pdf',
      activeSheetIndex,
      scale,
      rotation
    };
  }

  /**
   * Serializes a project package into a formatted JSON string
   */
  public static serialize(pkg: LoonistProjectPackage): string {
    return JSON.stringify(pkg, null, 2);
  }

  /**
   * Parses and validates a project package from JSON string
   */
  public static deserialize(jsonString: string): LoonistProjectPackage {
    const parsed = JSON.parse(jsonString) as Partial<LoonistProjectPackage>;
    if (parsed.format !== 'LOONIST_PROJECT_V1') {
      throw new Error('Invalid project file format. Expected LOONIST_PROJECT_V1');
    }
    if (!Array.isArray(parsed.characteristics)) {
      throw new Error('Corrupted project package: characteristics array is missing');
    }
    return parsed as LoonistProjectPackage;
  }

  /**
   * Triggers browser download for web environment fallback
   */
  public static downloadProject(pkg: LoonistProjectPackage, filename?: string): void {
    const jsonStr = ProjectArchiveService.serialize(pkg);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || `${pkg.projectProps.partNumber || 'LOONIST_Project'}.loonist`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Opens file picker in browser environment fallback
   */
  public static pickProjectFile(): Promise<LoonistProjectPackage> {
    return new Promise((resolve, reject) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.loonist,application/json';
      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) {
          reject(new Error('No file selected'));
          return;
        }
        try {
          const text = await file.text();
          const pkg = ProjectArchiveService.deserialize(text);
          resolve(pkg);
        } catch (err) {
          reject(err);
        }
      };
      input.click();
    });
  }
}
