import { app, safeStorage } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { ed25519 } from '@noble/curves/ed25519.js';
import { deviceRequestMessage } from './licenseProtocol';

/**
 * Main-process licensing client.
 *
 * - The device Ed25519 private key is generated here and stored encrypted with the
 *   OS keystore (Electron safeStorage → DPAPI / Keychain / libsecret). It never
 *   crosses the IPC bridge.
 * - All calls to the Cloudflare licensing Worker are made from the main process, so the
 *   renderer's Content-Security-Policy can stay closed to external hosts.
 * - Renew and revoke requests are signed with the device key; the Worker verifies them
 *   against the public key registered at activation.
 */

export interface LicensePayload {
  licenseId: string;
  deviceId: string;
  tenantId: string;
  expiresAt: string;
  features: string[];
}

export type LicenseCallResult =
  | { success: true; payload?: LicensePayload; signature?: string; expiresAt?: string; devicePublicKey: string; message: string }
  | { success: false; message: string };

const REQUEST_TIMEOUT_MS = 15000;

const toHex = (bytes: Uint8Array) => Buffer.from(bytes).toString('hex');
const fromHex = (hex: string) => new Uint8Array(Buffer.from(hex, 'hex'));

function keyFilePath(): string {
  return path.join(app.getPath('userData'), 'license', 'device-key.bin');
}

/**
 * Loads the device keypair, creating and encrypting a new one on first use.
 */
export function getOrCreateDeviceKey(): { publicKeyHex: string; secretKey: Uint8Array } {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('Secure key storage is not available on this system, so the license key cannot be stored safely.');
  }

  const file = keyFilePath();
  let secretHex: string | null = null;

  if (fs.existsSync(file)) {
    try {
      secretHex = safeStorage.decryptString(fs.readFileSync(file));
    } catch {
      throw new Error('The stored device license key could not be decrypted. It may belong to another Windows user account.');
    }
  }

  if (!secretHex || !/^[0-9a-f]{64}$/i.test(secretHex)) {
    const secret = ed25519.utils.randomSecretKey();
    secretHex = toHex(secret);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, safeStorage.encryptString(secretHex), { mode: 0o600 });
  }

  const secretKey = fromHex(secretHex);
  return { publicKeyHex: toHex(ed25519.getPublicKey(secretKey)), secretKey };
}

async function postJson(url: string, body: unknown): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  });
  const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: response.ok, status: response.status, data };
}

function networkError(apiUrl: string, err: unknown): LicenseCallResult {
  const reason = err instanceof Error ? err.message : String(err);
  return { success: false, message: `Could not reach the licensing server at ${apiUrl}: ${reason}` };
}

function serverError(data: Record<string, unknown>, status: number, fallback: string): LicenseCallResult {
  const error = typeof data.error === 'string' ? data.error : null;
  return { success: false, message: error || `${fallback} (HTTP ${status})` };
}

function isPayload(value: unknown): value is LicensePayload {
  const v = value as LicensePayload;
  return !!v && typeof v.licenseId === 'string' && typeof v.deviceId === 'string' &&
    typeof v.tenantId === 'string' && typeof v.expiresAt === 'string' && Array.isArray(v.features);
}

export async function activateLicense(apiUrl: string, token: string): Promise<LicenseCallResult> {
  const { publicKeyHex } = getOrCreateDeviceKey();
  try {
    const { ok, status, data } = await postJson(`${apiUrl}/activate`, { token, publicKey: publicKeyHex });
    if (!ok) return serverError(data, status, 'Activation failed');
    if (!isPayload(data.payload) || typeof data.signature !== 'string') {
      return { success: false, message: 'The licensing server returned an unexpected response.' };
    }
    return {
      success: true,
      payload: data.payload,
      signature: data.signature,
      devicePublicKey: publicKeyHex,
      message: 'License activated and bound to this workstation.'
    };
  } catch (err) {
    return networkError(apiUrl, err);
  }
}

async function signedDeviceRequest(action: 'renew' | 'revoke', apiUrl: string, deviceId: string) {
  const { publicKeyHex, secretKey } = getOrCreateDeviceKey();
  const timestamp = new Date().toISOString();
  const signature = toHex(ed25519.sign(new TextEncoder().encode(deviceRequestMessage(action, deviceId, timestamp)), secretKey));
  const result = await postJson(`${apiUrl}/${action}`, { deviceId, timestamp, signature });
  return { ...result, publicKeyHex };
}

export async function renewLicense(apiUrl: string, deviceId: string): Promise<LicenseCallResult> {
  try {
    const { ok, status, data, publicKeyHex } = await signedDeviceRequest('renew', apiUrl, deviceId);
    if (!ok) return serverError(data, status, 'Renewal failed');
    return {
      success: true,
      payload: isPayload(data.payload) ? data.payload : undefined,
      signature: typeof data.signature === 'string' ? data.signature : undefined,
      expiresAt: typeof data.expiresAt === 'string' ? data.expiresAt : undefined,
      devicePublicKey: publicKeyHex,
      message: 'License refreshed from the server.'
    };
  } catch (err) {
    return networkError(apiUrl, err);
  }
}

export async function revokeLicense(apiUrl: string, deviceId: string): Promise<LicenseCallResult> {
  try {
    const { ok, status, data, publicKeyHex } = await signedDeviceRequest('revoke', apiUrl, deviceId);
    if (!ok) return serverError(data, status, 'Release failed');
    return { success: true, devicePublicKey: publicKeyHex, message: 'Seat released back to the tenant pool.' };
  } catch (err) {
    return networkError(apiUrl, err);
  }
}
