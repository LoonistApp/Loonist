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

/**
 * Verifies a desktop device's Ed25519 signature over a request message.
 */
export function verifyDeviceSignature(message: string, signatureHex: string, publicKeyHex: string): boolean {
  try {
    if (!/^[0-9a-f]{128}$/i.test(signatureHex) || !/^[0-9a-f]{64}$/i.test(publicKeyHex)) {
      return false;
    }
    return ed25519.verify(signatureHex, new TextEncoder().encode(message), publicKeyHex);
  } catch {
    return false;
  }
}
