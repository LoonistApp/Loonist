/**
 * LOONIST — Aerospace First Article Inspection Platform
 * Cloudflare Edge Licensing & Ed25519 Cryptographic Client
 * 
 * Interacts with Cloudflare Workers (Hono) & D1 Database.
 * Verifies Ed25519 signatures locally for 30-day offline SCIF air-gapped operation.
 */

import { ed25519 } from '@noble/curves/ed25519.js';
import type { CloudflareLicensePayload, LicenseStatus } from '../../types/applicationOptions';

export interface LicenseActivationResult {
  success: boolean;
  message: string;
  status: LicenseStatus;
  payload?: CloudflareLicensePayload;
  signature?: string;
  tenantName?: string;
}

export interface LicenseValidationResult {
  isValid: boolean;
  isExpired: boolean;
  daysRemaining: number;
  message: string;
}

export class CloudflareLicenseClient {
  /**
   * Generates a persistent random Ed25519 device keypair for hardware-bound licensing.
   */
  public static generateDeviceKeyPair(): { publicKeyHex: string; privateKeyHex: string } {
    const privKey = ed25519.utils.randomSecretKey();
    const pubKey = ed25519.getPublicKey(privKey);

    const toHex = (bytes: Uint8Array) =>
      Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');

    return {
      publicKeyHex: toHex(pubKey),
      privateKeyHex: toHex(privKey)
    };
  }

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
   * ACTIVATE: Calls Cloudflare Worker `/activate` endpoint to bind token to D1.
   */
  public static async activateToken(
    apiUrl: string,
    token: string,
    publicKey: string
  ): Promise<LicenseActivationResult> {
    const cleanUrl = apiUrl.replace(/\/+$/, '');
    
    try {
      const response = await fetch(`${cleanUrl}/activate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: token.trim(), publicKey: publicKey.trim() })
      });

      if (!response.ok) {
        const errorJson = await response.json().catch(() => ({ error: 'Activation failed' }));
        return {
          success: false,
          status: 'UNLICENSED',
          message: errorJson.error || `HTTP ${response.status}: Failed to activate token`
        };
      }

      const data = await response.json();
      return {
        success: true,
        status: 'ACTIVE',
        message: 'License successfully activated and bound via Cloudflare D1',
        payload: data.payload,
        signature: data.signature,
        tenantName: data.payload?.tenantId || 'Aerospace Tenant'
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        status: 'UNLICENSED',
        message: `Network error reaching Cloudflare edge at ${cleanUrl}: ${message}`
      };
    }
  }

  /**
   * RENEW: Calls Cloudflare Worker `/renew` endpoint.
   */
  public static async renewLicense(
    apiUrl: string,
    deviceId: string
  ): Promise<{ success: boolean; expiresAt?: string; message: string }> {
    const cleanUrl = apiUrl.replace(/\/+$/, '');
    
    try {
      const response = await fetch(`${cleanUrl}/renew`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId })
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Renew failed' }));
        return { success: false, message: err.error || 'Failed to renew license' };
      }

      const data = await response.json();
      return {
        success: true,
        expiresAt: data.expiresAt,
        message: 'License lease successfully extended by 30 days'
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, message: `Could not contact Cloudflare API: ${message}` };
    }
  }

  /**
   * REVOKE: Calls Cloudflare Worker `/revoke` endpoint.
   */
  public static async revokeLicense(
    apiUrl: string,
    deviceId: string
  ): Promise<{ success: boolean; message: string }> {
    const cleanUrl = apiUrl.replace(/\/+$/, '');
    
    try {
      const response = await fetch(`${cleanUrl}/revoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId })
      });

      if (!response.ok) {
        return { success: false, message: 'Failed to revoke seat' };
      }

      return { success: true, message: 'Seat revoked successfully. Available for re-assignment.' };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, message: `Could not contact Cloudflare API: ${message}` };
    }
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
