/**
 * LOONIST — Aerospace First Article Inspection Platform
 * Cloudflare Edge Licensing & Ed25519 Cryptographic Client (renderer side)
 *
 * Network calls and the device private key live in the Electron main process
 * (electron/licensing.ts). This module forwards requests over the validated IPC
 * bridge and keeps the offline checks that need no secrets.
 */

import { ed25519 } from '@noble/curves/ed25519.js';
import type { CloudflareLicensePayload } from '../../types/applicationOptions';
import type { LicenseCallResult } from '../../types/electron';

export interface LicenseValidationResult {
  isValid: boolean;
  isExpired: boolean;
  daysRemaining: number;
  message: string;
}

const DESKTOP_ONLY: LicenseCallResult = {
  success: false,
  message: 'Licensing is only available in the LOONIST desktop app.'
};

/** Mirrors the main-process URL rule so the user gets a clear message before any request. */
export function checkLicenseApiUrl(apiUrl: string): string | null {
  try {
    const url = new URL(apiUrl.trim());
    if (url.protocol === 'https:') return null;
    if (url.protocol === 'http:' && (url.hostname === 'localhost' || url.hostname === '127.0.0.1')) return null;
  } catch {
    // fall through
  }
  return 'The licensing server URL must start with https:// (http://localhost is allowed for testing).';
}

async function callMain(
  call: ((...args: string[]) => Promise<LicenseCallResult>) | undefined,
  apiUrl: string,
  arg: string
): Promise<LicenseCallResult> {
  if (!call) return DESKTOP_ONLY;
  const urlError = checkLicenseApiUrl(apiUrl);
  if (urlError) return { success: false, message: urlError };
  try {
    return await call(apiUrl.trim(), arg.trim());
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, message: `Licensing request failed: ${message}` };
  }
}

export class CloudflareLicenseClient {
  /**
   * Verifies an Ed25519 license signature offline with zero network requests.
   * Ensures absolute ITAR compliance in air-gapped defense cleanrooms.
   */
  public static verifySignatureOffline(
    payload: CloudflareLicensePayload,
    signatureHex: string,
    publicKeyHex: string
  ): boolean {
    try {
      if (!signatureHex || !publicKeyHex) return false;
      
      const payloadStr = JSON.stringify(payload);
      const payloadBytes = new TextEncoder().encode(payloadStr);

      const fromHex = (hex: string) => {
        const cleanHex = hex.trim();
        const matches = cleanHex.match(/.{1,2}/g) || [];
        return new Uint8Array(matches.map(byte => parseInt(byte, 16)));
      };

      const sigBytes = fromHex(signatureHex);
      const pubBytes = fromHex(publicKeyHex);

      if (sigBytes.length !== 64 || pubBytes.length !== 32) {
        return false;
      }

      return ed25519.verify(sigBytes, payloadBytes, pubBytes);
    } catch {
      return false;
    }
  }

  /**
   * Validates local expiration time and offline grace period.
   */
  public static validateExpiry(expiresAt: string | null): LicenseValidationResult {
    if (!expiresAt) {
      return { isValid: false, isExpired: true, daysRemaining: 0, message: 'No expiration date recorded' };
    }

    const expTime = new Date(expiresAt).getTime();
    const now = Date.now();
    const msRemaining = expTime - now;
    const daysRemaining = Math.max(0, Math.floor(msRemaining / (1000 * 60 * 60 * 24)));

    if (msRemaining <= 0) {
      return { isValid: false, isExpired: true, daysRemaining: 0, message: 'License has expired. Please renew.' };
    }

    return {
      isValid: true,
      isExpired: false,
      daysRemaining,
      message: `${daysRemaining} days remaining in active lease`
    };
  }

  /**
   * ACTIVATE: binds a single-use token to this workstation's device key (main process).
   */
  public static activateToken(apiUrl: string, token: string): Promise<LicenseCallResult> {
    return callMain(window.api?.licenseActivate, apiUrl, token);
  }

  /**
   * RENEW: extends the lease; the request is signed with the device key (main process).
   */
  public static renewLicense(apiUrl: string, deviceId: string): Promise<LicenseCallResult> {
    return callMain(window.api?.licenseRenew, apiUrl, deviceId);
  }

  /**
   * REVOKE: releases this seat; the request is signed with the device key (main process).
   */
  public static revokeLicense(apiUrl: string, deviceId: string): Promise<LicenseCallResult> {
    return callMain(window.api?.licenseRevoke, apiUrl, deviceId);
  }

  /**
   * Export Air-Gapped Offline Certificate (.lic file) for SCIF cleanroom transfer via USB.
   */
  public static exportOfflineCertificate(
    payload: CloudflareLicensePayload,
    signature: string,
    tenantName: string
  ): void {
    const certData = {
      standard: 'LOONIST_ED25519_AIRGAP_V1',
      exportedAt: new Date().toISOString(),
      tenantName,
      payload,
      signature
    };

    const blob = new Blob([JSON.stringify(certData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `LOONIST_Offline_License_${payload.deviceId.substring(0, 8)}.lic`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}
