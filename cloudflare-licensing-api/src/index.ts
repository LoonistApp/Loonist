import { Hono } from 'hono';
import { signLicensePayload, verifyDeviceSignature } from './crypto';

type Bindings = {
  DB: D1Database;
  LICENSE_PRIVATE_KEY: string; // Ed25519 Private Key injected via Cloudflare Secrets
};

const app = new Hono<{ Bindings: Bindings }>();

/**
 * ACTIVATE: Exchanges a single-use token for a device-bound Ed25519 license.
 */
app.post('/activate', async (c) => {
  const { token, publicKey } = await c.req.json();
  
  if (!token || !publicKey) {
    return c.json({ error: 'Missing token or publicKey' }, 400);
  }

  // 1. Verify token exists and is pending
  const stmt = c.env.DB.prepare('SELECT * FROM Licenses WHERE token = ? AND status = "PENDING"').bind(token);
  const license = await stmt.first();

  if (!license) {
    return c.json({ error: 'Invalid, used, or expired token' }, 403);
  }

  const deviceId = crypto.randomUUID();

  // 2. Register Device and Burn Token (Atomic Batch)
  await c.env.DB.batch([
    c.env.DB.prepare(
      'INSERT INTO Devices (id, tenant_id, public_key, status) VALUES (?, ?, ?, "ACTIVE")'
    ).bind(deviceId, license.tenant_id, publicKey),
    
    c.env.DB.prepare(
      'UPDATE Licenses SET device_id = ?, status = "ACTIVATED" WHERE id = ?'
    ).bind(deviceId, license.id),
    
    c.env.DB.prepare(
      'INSERT INTO AuditLogs (id, action, payload) VALUES (?, "ACTIVATE", ?)'
    ).bind(crypto.randomUUID(), JSON.stringify({ deviceId, licenseId: license.id, tenantId: license.tenant_id }))
  ]);

  // 3. Generate offline license payload
  const payload = {
    licenseId: license.id,
    deviceId: deviceId,
    tenantId: license.tenant_id,
    expiresAt: license.expires_at,
    features: ['ALL']
  };

  // Ensure we have a private key in the environment
  const privateKey = c.env.LICENSE_PRIVATE_KEY;
  if (!privateKey) {
    return c.json({ error: 'Server misconfiguration: missing private key' }, 500);
  }

  const signature = await signLicensePayload(payload, privateKey);

  return c.json({
    payload,
    signature
  });
});

const MAX_REQUEST_AGE_MS = 5 * 60 * 1000;

/**
 * Checks that a renew / revoke request was signed by the device key registered at activation.
 * The message format must match `deviceRequestMessage()` in the desktop app (electron/licensing.ts).
 */
async function verifyDeviceRequest(
  db: D1Database,
  action: 'renew' | 'revoke',
  body: { deviceId?: unknown; timestamp?: unknown; signature?: unknown }
): Promise<{ ok: true; device: Record<string, unknown> } | { ok: false; status: 400 | 401 | 403; error: string }> {
  const { deviceId, timestamp, signature } = body;
  if (typeof deviceId !== 'string' || typeof timestamp !== 'string' || typeof signature !== 'string') {
    return { ok: false, status: 400, error: 'Missing deviceId, timestamp or signature' };
  }

  const age = Date.now() - Date.parse(timestamp);
  if (!Number.isFinite(age) || Math.abs(age) > MAX_REQUEST_AGE_MS) {
    return { ok: false, status: 401, error: 'Request timestamp is too old or invalid. Check the workstation clock.' };
  }

  const device = await db.prepare('SELECT * FROM Devices WHERE id = ? AND status = "ACTIVE"').bind(deviceId).first();
  if (!device) {
    return { ok: false, status: 403, error: 'Device not active or not found' };
  }

  if (!verifyDeviceSignature(`LOONIST:${action}:${deviceId}:${timestamp}`, signature, String(device.public_key))) {
    return { ok: false, status: 401, error: 'Device signature is invalid' };
  }

  return { ok: true, device };
}

/**
 * RENEW: Returns a freshly signed license for an active, authenticated device, carrying the
 * current expiry recorded in D1 (extend `Licenses.expires_at` to extend a subscription).
 */
app.post('/renew', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const check = await verifyDeviceRequest(c.env.DB, 'renew', body);
  if (!check.ok) return c.json({ error: check.error }, check.status);

  const license = await c.env.DB
    .prepare('SELECT * FROM Licenses WHERE device_id = ? AND status = "ACTIVATED"')
    .bind(check.device.id)
    .first();
  if (!license) return c.json({ error: 'No active license for this device' }, 403);

  if (Date.parse(String(license.expires_at)) <= Date.now()) {
    return c.json({ error: 'License has expired. Contact your administrator to extend it.' }, 403);
  }

  const privateKey = c.env.LICENSE_PRIVATE_KEY;
  if (!privateKey) {
    return c.json({ error: 'Server misconfiguration: missing private key' }, 500);
  }

  const payload = {
    licenseId: license.id,
    deviceId: check.device.id,
    tenantId: license.tenant_id,
    expiresAt: license.expires_at,
    features: ['ALL']
  };
  const signature = await signLicensePayload(payload, privateKey);

  await c.env.DB.prepare('INSERT INTO AuditLogs (id, action, payload) VALUES (?, "RENEW", ?)')
    .bind(crypto.randomUUID(), JSON.stringify({ deviceId: check.device.id, licenseId: license.id }))
    .run();

  return c.json({ payload, signature, expiresAt: license.expires_at });
});

/**
 * REVOKE: Releases the seat. Only the device itself (proven by its signature) can release it.
 */
app.post('/revoke', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const check = await verifyDeviceRequest(c.env.DB, 'revoke', body);
  if (!check.ok) return c.json({ error: check.error }, check.status);

  const deviceId = check.device.id;
  await c.env.DB.batch([
    c.env.DB.prepare('UPDATE Devices SET status = "REVOKED" WHERE id = ?').bind(deviceId),
    c.env.DB.prepare('UPDATE Licenses SET status = "REVOKED" WHERE device_id = ?').bind(deviceId),
    c.env.DB.prepare('INSERT INTO AuditLogs (id, action, payload) VALUES (?, "REVOKE", ?)').bind(crypto.randomUUID(), JSON.stringify({ deviceId }))
  ]);

  return c.json({ message: 'Device revoked successfully' });
});

export default app;
