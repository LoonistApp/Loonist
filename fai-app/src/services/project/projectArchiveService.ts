import { z } from 'zod';
import type { EngineeringCharacteristic, ProjectProperties } from '../../types/characteristics';
import type { BlueprintDocument } from '../../types/blueprint';
import type { ProjectSettings } from '../../types/settings';

// Validates a *.loonist project file at the point it crosses the trust boundary (a user-supplied
// file on disk, potentially hand-edited, corrupted, or from an older/incompatible app version).
// Deliberately permissive (.passthrough()) on anything beyond the fields the extraction/tolerance/
// measurement pipeline actually depends on, so it stays forward-compatible with new optional
// metadata rather than becoming a brittle mirror of the full TypeScript type.
const engineeringCharacteristicSchema = z.object({
  id: z.string().min(1),
  itemNumber: z.number(),
  sheetNumber: z.number(),
  type: z.string().min(1),
  enclosure: z.string().min(1),
  rawText: z.string(),
  cleanNominal: z.number().nullable(),
  upperTol: z.number(),
  lowerTol: z.number(),
  minLimit: z.number().nullable(),
  maxLimit: z.number().nullable(),
  units: z.enum(['in', 'mm', 'deg']),
  upperLimit: z.number().nullable(),
  lowerLimit: z.number().nullable(),
  quantity: z.number(),
  confidenceScore: z.number(),
  verificationStatus: z.enum(['auto_accepted', 'needs_review', 'verified']),
  boundingBox: z.object({
    x: z.number(),
    y: z.number(),
    width: z.number(),
    height: z.number()
  })
}).passthrough();

const loonistProjectPackageSchema = z.object({
  format: z.literal('LOONIST_PROJECT_V1'),
  version: z.string().min(1),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
  projectProps: z.record(z.string(), z.any()),
  blueprintDoc: z.record(z.string(), z.any()).nullable(),
  characteristics: z.array(engineeringCharacteristicSchema),
  settings: z.record(z.string(), z.any()).optional(),
  pdfBase64: z.string().optional(),
  pdfFileName: z.string().optional(),
  activeSheetIndex: z.number(),
  scale: z.number(),
  rotation: z.number()
}).passthrough();

export interface LoonistProjectPackage {
  format: 'LOONIST_PROJECT_V1';
  version: string;
  createdAt: string;
  updatedAt: string;
  projectProps: ProjectProperties;
  blueprintDoc: BlueprintDocument | null;
  characteristics: EngineeringCharacteristic[];
  settings?: ProjectSettings;
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
    rotation: number = 0,
    settings?: ProjectSettings
  ): LoonistProjectPackage {
    return {
      format: 'LOONIST_PROJECT_V1',
      version: '2.1.0',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      projectProps,
      blueprintDoc,
      characteristics,
      settings,
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
   * Parses and structurally validates a project package from a JSON string. This is a trust
   * boundary — the file comes from disk, may have been hand-edited, corrupted, or produced by
   * an older/incompatible app version — so a malformed file is rejected here with a specific
   * error rather than silently corrupting in-memory state or crashing deeper in the pipeline.
   */
  public static deserialize(jsonString: string): LoonistProjectPackage {
    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonString);
    } catch {
      throw new Error('Corrupted project package: not valid JSON');
    }

    const result = loonistProjectPackageSchema.safeParse(parsed);
    if (!result.success) {
      const firstIssue = result.error.issues[0];
      const path = firstIssue.path.length > 0 ? firstIssue.path.join('.') : '(root)';
      throw new Error(`Corrupted or incompatible project package: ${path} — ${firstIssue.message}`);
    }

    return result.data as unknown as LoonistProjectPackage;
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
