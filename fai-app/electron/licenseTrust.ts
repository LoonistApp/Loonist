import { ed25519 } from '@noble/curves/ed25519.js';

/**
 * Offline license verification (no network, no Electron imports).
 *
 * The licensing Worker signs `JSON.stringify(payload)` with its Ed25519 private key.
 * The desktop app trusts only the public keys below, so a license cannot be forged or
 * edited without that private key, and `devicePublicKey` binds it to one workstation.
 */

/**
 * Public key of the production licensing Worker (`LICENSE_PRIVATE_KEY` secret).
 * Packaged builds trust only this key. Generated 29 September 2026; the private half is
 * in the git-ignored `cloudflare-licensing-api/.license-production-private-key`.
 */
export const PRODUCTION_LICENSE_PUBLIC_KEY = '9bca5120dbb7c87b42a2d537e2896c69420603ded51d34d9089e05c6f2f61d33';

/**
 * Public key matching `cloudflare-licensing-api/.dev.vars`. Trusted only in
 * development (unpackaged) builds.
 */
export const DEVELOPMENT_LICENSE_PUBLIC_KEY = '3ccd241cffc9b3618044b97d036d8614593d8b017c340f1dee8773385517654b';

export interface SignedLicensePayload {
  licenseId: string;
  deviceId: string;
  tenantId: string;
  expiresAt: string;
  features: string[];
  devicePublicKey?: string;
}

export type LicenseVerdict =
  | 'ACTIVE'          // valid signature, bound to this device, not expired
  | 'EXPIRED'         // valid and bound, but past expiresAt
  | 'NOT_ACTIVATED'   // nothing stored
  | 'INVALID'         // bad signature, wrong device, or malformed
  | 'UNVERIFIABLE';   // this build has no trusted server key

export interface LicenseVerification {
  verdict: LicenseVerdict;
  message: string;
  expiresAt: string | null;
}

const HEX_64 = /^[0-9a-f]{64}$/i;
const HEX_128 = /^[0-9a-f]{128}$/i;

export function trustedServerKeys(isPackaged: boolean): string[] {
  const keys = isPackaged
    ? [PRODUCTION_LICENSE_PUBLIC_KEY]
    : [PRODUCTION_LICENSE_PUBLIC_KEY, DEVELOPMENT_LICENSE_PUBLIC_KEY];
  return keys.filter(k => HEX_64.test(k));
}

function isPayload(value: unknown): value is SignedLicensePayload {
  const v = value as SignedLicensePayload;
  return !!v && typeof v === 'object' &&
    typeof v.licenseId === 'string' && typeof v.deviceId === 'string' &&
    typeof v.tenantId === 'string' && typeof v.expiresAt === 'string' &&
    Array.isArray(v.features) && v.features.every(f => typeof f === 'string') &&
    (v.devicePublicKey === undefined || typeof v.devicePublicKey === 'string');
}

/**
 * Verifies a stored license entirely offline.
 */
export function verifyLicense(
  license: { payload: unknown; signature: unknown } | null,
  trustedKeys: string[],
  devicePublicKey: string,
  now: number = Date.now()
): LicenseVerification {
  if (!license || (!license.payload && !license.signature)) {
    return { verdict: 'NOT_ACTIVATED', message: 'This workstation is not activated.', expiresAt: null };
  }
  if (trustedKeys.length === 0) {
    return {
      verdict: 'UNVERIFIABLE',
      message: 'This build has no licensing server key configured, so licenses cannot be verified.',
      expiresAt: null
    };
  }

  const { payload, signature } = license;
  if (!isPayload(payload) || typeof signature !== 'string' || !HEX_128.test(signature)) {
    return { verdict: 'INVALID', message: 'The stored license is damaged. Refresh or re-activate it.', expiresAt: null };
  }

  const message = new TextEncoder().encode(JSON.stringify(payload));
  const signatureBytes = Buffer.from(signature, 'hex');
  const signedByTrustedServer = trustedKeys.some(key => {
    try {
      return ed25519.verify(signatureBytes, message, Buffer.from(key, 'hex'));
    } catch {
      return false;
    }
  });
  if (!signedByTrustedServer) {
    return { verdict: 'INVALID', message: 'The license signature is not valid for this licensing server.', expiresAt: null };
  }

  if (!payload.devicePublicKey) {
    return {
      verdict: 'INVALID',
      message: 'This license was issued before device binding. Click Refresh License to update it.',
      expiresAt: payload.expiresAt
    };
  }
  if (payload.devicePublicKey.toLowerCase() !== devicePublicKey.toLowerCase()) {
    return { verdict: 'INVALID', message: 'This license belongs to a different workstation.', expiresAt: payload.expiresAt };
  }

  const expires = Date.parse(payload.expiresAt);
  if (!Number.isFinite(expires)) {
    return { verdict: 'INVALID', message: 'The license has an invalid expiry date.', expiresAt: null };
  }
  if (expires <= now) {
    return { verdict: 'EXPIRED', message: 'The license has expired. Refresh it or contact your administrator.', expiresAt: payload.expiresAt };
  }

  const days = Math.floor((expires - now) / 86_400_000);
  return { verdict: 'ACTIVE', message: `License verified offline — ${days} day${days === 1 ? '' : 's'} remaining.`, expiresAt: payload.expiresAt };
}
