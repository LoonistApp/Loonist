import { ed25519 } from '@noble/curves/ed25519';

/**
 * Signs a JSON payload using Ed25519 for offline hardware validation.
 */
export async function signLicensePayload(
  payload: any,
  privateKeyHex: string
): Promise<string> {
  // Convert payload to deterministic string representation
  const payloadStr = JSON.stringify(payload);
  const payloadBytes = new TextEncoder().encode(payloadStr);
  
  // Sign the bytes
  const signature = ed25519.sign(payloadBytes, privateKeyHex);
  
  // Convert signature Uint8Array to hex string for easy transport
  return Array.from(signature)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}
