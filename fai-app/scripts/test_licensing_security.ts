/**
 * Test Suite: Licensing Security Hardening (Sprint 8)
 * Verifies:
 * 1. Renew / revoke signatures made by the desktop app verify in the Cloudflare Worker,
 *    and tampered or foreign-key requests are rejected.
 * 2. The licensing server URL rule allows https:// and http://localhost only.
 * 3. The device private key never exists in renderer code or saved options, and the old
 *    demo license is cleared on load.
 * 4. The renderer makes no network calls to the licensing server and its CSP stays closed.
 * 5. Every IPC channel is registered through the validated handler with a Zod schema,
 *    and every preload channel has a handler.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ed25519 } from '@noble/curves/ed25519.js';
import { deviceRequestMessage, licenseApiUrlSchema, licenseActivateSchema } from '../electron/licenseProtocol';
import { verifyLicense, trustedServerKeys, DEVELOPMENT_LICENSE_PUBLIC_KEY, PRODUCTION_LICENSE_PUBLIC_KEY } from '../electron/licenseTrust';
import { verifyDeviceSignature } from '../../cloudflare-licensing-api/src/crypto';
import { sanitizeLicensing } from '../src/stores/useApplicationOptionsStore';
import { DEFAULT_APPLICATION_OPTIONS } from '../src/types/applicationOptions';

let passed = 0;
let total = 0;
function assert(condition: boolean, message: string) {
  total++;
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    process.exitCode = 1;
  }
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel: string) => fs.readFileSync(path.join(root, rel), 'utf-8');
const toHex = (b: Uint8Array) => Buffer.from(b).toString('hex');

function listFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? listFiles(full) : /\.(ts|tsx)$/.test(entry.name) ? [full] : [];
  });
}

console.log('================================================================');
console.log('          TEST: Licensing Security Hardening                    ');
console.log('================================================================\n');

// 1. Signed device requests
console.log('► [1] Signed renew / revoke requests');
const secret = ed25519.utils.randomSecretKey();
const publicKeyHex = toHex(ed25519.getPublicKey(secret));
const timestamp = new Date().toISOString();
const message = deviceRequestMessage('revoke', 'device-abc', timestamp);
const signatureHex = toHex(ed25519.sign(new TextEncoder().encode(message), secret));

assert(message === `LOONIST:revoke:device-abc:${timestamp}`, 'Message format matches the Worker');
assert(verifyDeviceSignature(message, signatureHex, publicKeyHex), 'Worker accepts a signature from the registered device key');
assert(
  !verifyDeviceSignature(deviceRequestMessage('revoke', 'device-xyz', timestamp), signatureHex, publicKeyHex),
  'Worker rejects the signature when replayed for another device'
);
assert(
  !verifyDeviceSignature(deviceRequestMessage('renew', 'device-abc', timestamp), signatureHex, publicKeyHex),
  'Worker rejects the signature when replayed for another action'
);
const otherKey = toHex(ed25519.getPublicKey(ed25519.utils.randomSecretKey()));
assert(!verifyDeviceSignature(message, signatureHex, otherKey), 'Worker rejects a signature from a different key');
assert(!verifyDeviceSignature(message, 'not-hex', publicKeyHex), 'Worker rejects a malformed signature');

// 2. URL rule
console.log('\n► [2] Licensing server URL rule');
const ok = (u: string) => licenseApiUrlSchema.safeParse(u).success;
assert(ok('https://licensing.loonist.com'), 'https:// accepted');
assert(ok('http://localhost:8787') && ok('http://127.0.0.1:8787'), 'http://localhost accepted for local testing');
assert(!ok('http://licensing.loonist.com'), 'Plain http to a remote host rejected');
assert(!ok('file:///C:/secrets') && !ok('javascript:alert(1)') && !ok('not a url'), 'Non-web URLs rejected');
assert(licenseApiUrlSchema.parse('https://licensing.loonist.com///') === 'https://licensing.loonist.com', 'Trailing slashes removed');
assert(!licenseActivateSchema.safeParse({ apiUrl: 'https://x.com', token: '   ' }).success, 'Blank activation token rejected');

// 3. Private key storage
console.log('\n► [3] Private key never stored by the renderer');
const rendererFiles = listFiles(path.join(root, 'src'));
const rendererWithKey = rendererFiles.filter(f => /devicePrivateKeyHex|randomSecretKey|ed25519\.sign\(/.test(fs.readFileSync(f, 'utf-8')));
const allowed = rendererWithKey.every(f => f.endsWith('useApplicationOptionsStore.ts'));
assert(allowed, 'Only the store migration mentions the old private key field');
assert(!('devicePrivateKeyHex' in DEFAULT_APPLICATION_OPTIONS.licensing), 'Default options have no private key field');

const legacy = {
  ...DEFAULT_APPLICATION_OPTIONS.licensing,
  status: 'ACTIVE' as const,
  deviceId: 'real-device',
  signature: 'a'.repeat(128),
  devicePrivateKeyHex: 'b'.repeat(64)
};
const cleaned = sanitizeLicensing(legacy);
assert(!('devicePrivateKeyHex' in cleaned), 'Stored plain-text private key is dropped on load');
assert(cleaned.deviceId === 'real-device' && cleaned.status === 'ACTIVE', 'A real license survives the migration');

const demo = sanitizeLicensing({
  ...DEFAULT_APPLICATION_OPTIONS.licensing,
  status: 'ACTIVE',
  apiUrl: 'http://localhost:8787',
  signature: '7f9a8b1c4d2e3f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a'
});
assert(demo.status === 'UNLICENSED' && demo.signature === '', 'Old demo license is cleared');
assert(demo.apiUrl === 'http://localhost:8787', 'Configured server URL is kept when clearing the demo license');
assert(DEFAULT_APPLICATION_OPTIONS.licensing.status === 'UNLICENSED', 'New installs start unlicensed');

const licensingMain = read('electron/licensing.ts');
assert(/safeStorage\.encryptString/.test(licensingMain) && /safeStorage\.isEncryptionAvailable/.test(licensingMain), 'Main process encrypts the key with safeStorage');
const keyWrites = licensingMain.match(/writeFileSync\([^,]+,\s*[^,)]+/g) ?? [];
assert(keyWrites.length > 0 && keyWrites.every(w => /safeStorage\.encryptString\(/.test(w)), 'Every key write goes through safeStorage.encryptString');

// 4. No renderer network calls
console.log('\n► [4] Renderer isolation');
const clientSrc = read('src/services/license/licenseClient.ts');
assert(!/\bfetch\(/.test(clientSrc), 'Renderer license client makes no fetch() calls');
const mainSrc = read('electron/main.ts');
const csp = mainSrc.match(/connect-src ([^;"]*)/)?.[1] ?? '';
assert(csp.length > 0 && !/https:/.test(csp), 'Renderer CSP connect-src does not allow external hosts');

// 5. IPC validation coverage
console.log('\n► [5] IPC validation coverage');
assert((mainSrc.match(/ipcMain\.handle\(/g) ?? []).length === 1, 'ipcMain.handle is only used inside the validated helper');
const registered = [...mainSrc.matchAll(/handleIpc\('([^']+)',\s*([A-Za-z]+)/g)];

assert(registered.every(([, , schema]) => /Schema$|^noPayload$/.test(schema)), 'Every channel has a Zod schema');
const preloadChannels = [...read('electron/preload.ts').matchAll(/invoke\('([^']+)'/g)].map(m => m[1]);
const registeredNames = new Set(registered.map(([, name]) => name));
const missing = preloadChannels.filter(c => !registeredNames.has(c));
assert(registered.length === preloadChannels.length, `Handler count matches the preload bridge (${registered.length})`);
assert(missing.length === 0, `Every preload channel has a validated handler${missing.length ? ` (missing: ${missing.join(', ')})` : ''}`);

// 6. Offline license verification
console.log('\n► [6] Offline license verification');
const serverSecret = ed25519.utils.randomSecretKey();
const serverPub = toHex(ed25519.getPublicKey(serverSecret));
const deviceSecret = ed25519.utils.randomSecretKey();
const devicePub = toHex(ed25519.getPublicKey(deviceSecret));
const now = Date.parse('2026-09-29T00:00:00Z');
const sign = (payload: object, key = serverSecret) =>
  toHex(ed25519.sign(new TextEncoder().encode(JSON.stringify(payload)), key));
const goodPayload = {
  licenseId: 'lic-1', deviceId: 'dev-1', tenantId: 'tenant-1',
  expiresAt: '2030-01-01T00:00:00.000Z', features: ['ALL'], devicePublicKey: devicePub
};
const good = { payload: goodPayload, signature: sign(goodPayload) };

assert(verifyLicense(good, [serverPub], devicePub, now).verdict === 'ACTIVE', 'Valid license bound to this device is ACTIVE');
assert(
  verifyLicense({ payload: { ...goodPayload, expiresAt: '2099-01-01T00:00:00.000Z' }, signature: good.signature }, [serverPub], devicePub, now).verdict === 'INVALID',
  'Editing the expiry breaks the signature'
);
assert(
  verifyLicense({ payload: { ...goodPayload, features: ['ALL', 'EXTRA'] }, signature: good.signature }, [serverPub], devicePub, now).verdict === 'INVALID',
  'Adding features breaks the signature'
);
const forgedPayload = { ...goodPayload };
assert(
  verifyLicense({ payload: forgedPayload, signature: sign(forgedPayload, ed25519.utils.randomSecretKey()) }, [serverPub], devicePub, now).verdict === 'INVALID',
  'License signed by an untrusted key is rejected'
);
const otherDevice = toHex(ed25519.getPublicKey(ed25519.utils.randomSecretKey()));
const copied = verifyLicense(good, [serverPub], otherDevice, now);
assert(copied.verdict === 'INVALID' && /different workstation/.test(copied.message), 'License copied to another workstation is rejected');
const expiredPayload = { ...goodPayload, expiresAt: '2026-01-01T00:00:00.000Z' };
assert(verifyLicense({ payload: expiredPayload, signature: sign(expiredPayload) }, [serverPub], devicePub, now).verdict === 'EXPIRED', 'Past expiry reports EXPIRED');
const { devicePublicKey: _omit, ...legacyPayload } = goodPayload;
const legacy2 = verifyLicense({ payload: legacyPayload, signature: sign(legacyPayload) }, [serverPub], devicePub, now);
assert(legacy2.verdict === 'INVALID' && /Refresh License/.test(legacy2.message), 'License without device binding asks for a refresh');
assert(verifyLicense({ payload: null, signature: '' }, [serverPub], devicePub, now).verdict === 'NOT_ACTIVATED', 'Nothing stored reports NOT_ACTIVATED');
assert(verifyLicense({ payload: 'garbage', signature: 'zz' }, [serverPub], devicePub, now).verdict === 'INVALID', 'Malformed license is INVALID');
assert(verifyLicense(good, [], devicePub, now).verdict === 'UNVERIFIABLE', 'No trusted key means UNVERIFIABLE, never ACTIVE');

assert(!trustedServerKeys(true).includes(DEVELOPMENT_LICENSE_PUBLIC_KEY), 'Packaged builds never trust the development key');
assert(trustedServerKeys(false).includes(DEVELOPMENT_LICENSE_PUBLIC_KEY), 'Development builds trust the development key');
assert(
  PRODUCTION_LICENSE_PUBLIC_KEY === '' ? trustedServerKeys(true).length === 0 : trustedServerKeys(true).length === 1,
  'Packaged builds trust exactly the production key (none while unset)'
);
const licensingMainSrc = read('electron/licensing.ts');
assert(/trustedKeys\(\)\.length === 0/.test(licensingMainSrc.slice(licensingMainSrc.indexOf('activateLicense'))), 'Activation is refused before the token is spent when no key is configured');

console.log(`\n${passed}/${total} checks passed`);
if (passed !== total) {
  process.exitCode = 1;
}
