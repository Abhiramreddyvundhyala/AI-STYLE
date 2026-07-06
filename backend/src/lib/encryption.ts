/**
 * AES-256-GCM encryption utilities (Node.js crypto module)
 * Mirrors the Deno Web Crypto version used in edge functions.
 */
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

function getKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY ?? '';
  if (!key) throw new Error('ENCRYPTION_KEY not set');
  // Pad/truncate to exactly 32 bytes (AES-256)
  return Buffer.from(key.padEnd(32, '0').slice(0, 32), 'utf8');
}

/**
 * Encrypt plaintext using AES-256-GCM.
 * Returns base64-encoded IV + authTag + ciphertext.
 */
export function encryptPrompt(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(12); // 96-bit IV for GCM
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const combined = Buffer.concat([iv, authTag, encrypted]);
  return combined.toString('base64');
}

/**
 * Decrypt a base64 AES-256-GCM ciphertext.
 */
export function decryptPrompt(encrypted: string): string {
  const key = getKey();
  const combined = Buffer.from(encrypted, 'base64');
  const iv = combined.slice(0, 12);
  const authTag = combined.slice(12, 28);
  const ciphertext = combined.slice(28);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  return decipher.update(ciphertext).toString('utf8') + decipher.final('utf8');
}
