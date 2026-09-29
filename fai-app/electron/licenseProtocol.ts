import { z } from 'zod';

/**
 * Licensing protocol pieces shared by the main process and the test suite
 * (kept free of Electron imports).
 */

/**
 * Message signed for renew / revoke. Must match `verifyDeviceRequest()` in the
 * Cloudflare Worker (cloudflare-licensing-api/src/index.ts).
 */
export function deviceRequestMessage(action: 'renew' | 'revoke', deviceId: string, timestamp: string): string {
  return `LOONIST:${action}:${deviceId}:${timestamp}`;
}

/** HTTPS only, except http://localhost for a local `wrangler dev` Worker. */
export const licenseApiUrlSchema = z
  .string()
  .trim()
  .max(2048)
  .refine(value => {
    try {
      const url = new URL(value);
      return url.protocol === 'https:' ||
        (url.protocol === 'http:' && (url.hostname === 'localhost' || url.hostname === '127.0.0.1'));
    } catch {
      return false;
    }
  }, 'Licensing server URL must use https:// (or http://localhost for testing)')
  .transform(value => value.replace(/\/+$/, ''));

export const licenseActivateSchema = z.object({
  apiUrl: licenseApiUrlSchema,
  token: z.string().trim().min(1).max(512)
});

export const licenseDeviceSchema = z.object({
  apiUrl: licenseApiUrlSchema,
  deviceId: z.string().trim().min(1).max(128)
});
