/**
 * Encryption Utilities
 * Handles prompt encryption/decryption for secure storage
 */



/**
 * Encrypt a prompt using AES-256-GCM
 */
export async function encryptPrompt(plaintext: string): Promise<string> {
  const encryptionKey = Deno.env.get('ENCRYPTION_KEY');
  
  if (!encryptionKey) {
    // In development, return as-is (implement proper encryption in production)
    console.warn('ENCRYPTION_KEY not set, returning plaintext');
    return plaintext;
  }

  try {
    // Convert key to CryptoKey
    const keyData = new TextEncoder().encode(encryptionKey);
    const key = await crypto.subtle.importKey(
      'raw',
      keyData.slice(0, 32), // Use first 32 bytes for AES-256
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt']
    );

    // Generate random IV
    const iv = crypto.getRandomValues(new Uint8Array(12));

    // Encrypt the plaintext
    const encodedText = new TextEncoder().encode(plaintext);
    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      encodedText
    );

    // Combine IV and ciphertext
    const combined = new Uint8Array(iv.length + ciphertext.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(ciphertext), iv.length);

    // Convert to base64
    return btoa(String.fromCharCode(...combined));
  } catch (error: unknown) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt prompt');
  }
}

/**
 * Decrypt an encrypted prompt
 */
export async function decryptPrompt(encrypted: string): Promise<string> {
  const encryptionKey = Deno.env.get('ENCRYPTION_KEY');
  
  if (!encryptionKey) {
    // In development, return as-is (implement proper encryption in production)
    console.warn('ENCRYPTION_KEY not set, returning encrypted text as plaintext');
    return encrypted;
  }

  try {
    // Convert key to CryptoKey
    const keyData = new TextEncoder().encode(encryptionKey);
    const key = await crypto.subtle.importKey(
      'raw',
      keyData.slice(0, 32), // Use first 32 bytes for AES-256
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    );

    // Decode base64
    const combined = Uint8Array.from(atob(encrypted), c => c.charCodeAt(0));

    // Extract IV and ciphertext
    const iv = combined.slice(0, 12);
    const ciphertext = combined.slice(12);

    // Decrypt
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ciphertext
    );

    // Convert to string
    return new TextDecoder().decode(decrypted);
  } catch (error: unknown) {
    console.error('Decryption error:', error);
    // Fallback: return as-is if decryption fails (might be unencrypted)
    return encrypted;
  }
}

/**
 * Minimal prompt passthrough — generate-universal builds its own surgical prompts.
 * Kept only for backward compatibility with any legacy callers.
 */
export function enhancePromptForFaceMatching(originalPrompt: string): string {
  return originalPrompt;
}

/**
 * Validate encryption key format
 */
export function validateEncryptionKey(): boolean {
  const key = Deno.env.get('ENCRYPTION_KEY');
  if (!key) return false;
  
  // Key should be at least 32 characters for AES-256
  return key.length >= 32;
}
