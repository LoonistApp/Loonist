import { Hono } from 'hono';
import { signLicensePayload } from './crypto';

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

/**
 * RENEW: Extends the expiration date for an existing active device license.
 */
app.post('/renew', async (c) => {
  const { deviceId } = await c.req.json();
  
  if (!deviceId) return c.json({ error: 'Missing deviceId' }, 400);

  const device = await c.env.DB.prepare('SELECT * FROM Devices WHERE id = ? AND status = "ACTIVE"').bind(deviceId).first();
  if (!device) return c.json({ error: 'Device not active or not found' }, 403);

  // Example: Extend by 30 days
  const newExpiration = new Date();
  newExpiration.setDate(newExpiration.getDate() + 30);
  const isoExpiration = newExpiration.toISOString();

  // Scaffolded: In reality, we'd update the DB here
  return c.json({ message: 'Renew successful', expiresAt: isoExpiration });
});

/**
 * REVOKE: Manually revokes a device and its licenses.
 */
app.post('/revoke', async (c) => {
  const { deviceId } = await c.req.json();
  
  if (!deviceId) return c.json({ error: 'Missing deviceId' }, 400);

  await c.env.DB.batch([
    c.env.DB.prepare('UPDATE Devices SET status = "REVOKED" WHERE id = ?').bind(deviceId),
    c.env.DB.prepare('UPDATE Licenses SET status = "REVOKED" WHERE device_id = ?').bind(deviceId),
    c.env.DB.prepare('INSERT INTO AuditLogs (id, action, payload) VALUES (?, "REVOKE", ?)').bind(crypto.randomUUID(), JSON.stringify({ deviceId }))
  ]);

  return c.json({ message: 'Device revoked successfully' });
});

export default app;
