/**
 * Credential Encryption for Repository Access
 * Epic 011: Git Repository Tracking for Scans
 *
 * Encrypts repository credentials (PAT tokens and SSH keys) using AES-256-GCM
 * Reuses existing encryption infrastructure patterns
 */

import * as crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16; // 128 bits for GCM
const AUTH_TAG_LENGTH = 16; // 128 bits for GCM

/**
 * Get or generate master encryption key from environment
 * Master key should be a 64-character hex string (32 bytes)
 */
function getMasterKey(): Buffer {
  const masterKeyHex = process.env.ENCRYPTION_MASTER_KEY;

  if (!masterKeyHex) {
    throw new Error(
      'ENCRYPTION_MASTER_KEY environment variable is required. ' +
        'Generate with: openssl rand -hex 32'
    );
  }

  if (masterKeyHex.length !== 64) {
    throw new Error(
      'ENCRYPTION_MASTER_KEY must be 64 hex characters (32 bytes)'
    );
  }

  return Buffer.from(masterKeyHex, 'hex');
}

/**
 * Derive organization-specific encryption key from master key
 * Uses HMAC-SHA256 for key derivation
 *
 * @param organizationId - Organization ID for key derivation
 * @returns Derived 256-bit encryption key
 */
function deriveOrganizationKey(organizationId: string): Buffer {
  const masterKey = getMasterKey();

  // Use HMAC-SHA256 to derive org-specific key
  const hmac = crypto.createHmac('sha256', masterKey);
  hmac.update(organizationId);
  return hmac.digest();
}

/**
 * Encrypt credential using AES-256-GCM
 * Returns format: iv:authTag:ciphertext (all base64 encoded)
 *
 * @param plaintext - Credential to encrypt (PAT token or SSH key)
 * @param organizationId - Organization ID for key derivation
 * @returns Encrypted credential in format "iv:authTag:ciphertext"
 */
export function encryptCredential(
  plaintext: string,
  organizationId: string
): string {
  if (!plaintext) {
    throw new Error('Plaintext credential is required');
  }

  if (!organizationId) {
    throw new Error('Organization ID is required for encryption');
  }

  try {
    // Derive organization-specific key
    const key = deriveOrganizationKey(organizationId);

    // Generate random IV
    const iv = crypto.randomBytes(IV_LENGTH);

    // Create cipher
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    // Encrypt
    let ciphertext = cipher.update(plaintext, 'utf8', 'base64');
    ciphertext += cipher.final('base64');

    // Get authentication tag
    const authTag = cipher.getAuthTag();

    // Format: iv:authTag:ciphertext (all base64)
    const encrypted = [
      iv.toString('base64'),
      authTag.toString('base64'),
      ciphertext,
    ].join(':');

    return encrypted;
  } catch (error) {
    throw new Error(
      `Failed to encrypt credential: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Decrypt credential using AES-256-GCM
 * Expects format: iv:authTag:ciphertext (all base64 encoded)
 *
 * @param encrypted - Encrypted credential in format "iv:authTag:ciphertext"
 * @param organizationId - Organization ID for key derivation
 * @returns Decrypted plaintext credential
 */
export function decryptCredential(
  encrypted: string,
  organizationId: string
): string {
  if (!encrypted) {
    throw new Error('Encrypted credential is required');
  }

  if (!organizationId) {
    throw new Error('Organization ID is required for decryption');
  }

  try {
    // Parse encrypted format: iv:authTag:ciphertext
    const parts = encrypted.split(':');
    if (parts.length !== 3) {
      throw new Error(
        'Invalid encrypted credential format. Expected: iv:authTag:ciphertext'
      );
    }

    const [ivBase64, authTagBase64, ciphertext] = parts;

    // Decode components
    const iv = Buffer.from(ivBase64, 'base64');
    const authTag = Buffer.from(authTagBase64, 'base64');

    // Derive organization-specific key
    const key = deriveOrganizationKey(organizationId);

    // Create decipher
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    // Decrypt
    let plaintext = decipher.update(ciphertext, 'base64', 'utf8');
    plaintext += decipher.final('utf8');

    return plaintext;
  } catch (error) {
    throw new Error(
      `Failed to decrypt credential: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Test encryption/decryption roundtrip
 * Useful for validating encryption setup
 */
export function testEncryption(
  testString: string = 'test-credential',
  organizationId: string = 'test-org'
): boolean {
  try {
    const encrypted = encryptCredential(testString, organizationId);
    const decrypted = decryptCredential(encrypted, organizationId);
    return decrypted === testString;
  } catch {
    return false;
  }
}

/**
 * Redact credential from logs and error messages
 * Replaces sensitive parts with asterisks
 *
 * @param credential - Credential to redact
 * @param visibleChars - Number of characters to show (default: 4)
 * @returns Redacted credential (e.g., "ghp_****")
 */
export function redactCredential(
  credential: string,
  visibleChars: number = 4
): string {
  if (!credential || credential.length <= visibleChars) {
    return '***';
  }

  const prefix = credential.slice(0, visibleChars);
  return `${prefix}${'*'.repeat(Math.max(8, credential.length - visibleChars))}`;
}

/**
 * Sanitize URL by removing credentials
 * Useful for logging repository URLs without exposing tokens
 *
 * @param url - URL that may contain credentials
 * @returns Sanitized URL with credentials removed
 */
export function sanitizeUrl(url: string): string {
  if (!url) return '';

  try {
    // Remove credentials from HTTPS URLs
    // https://token@github.com/... → https://github.com/...
    return url.replace(
      /https:\/\/[^@]+@/,
      'https://'
    );
  } catch {
    return url;
  }
}
