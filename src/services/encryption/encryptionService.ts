import crypto from 'crypto';
import { config } from '../../config/index.js';

// AES-256-GCM encryption for user API keys with per-encryption PBKDF2 key
// derivation. A fresh random salt + IV are generated for every call, so the
// same plaintext never produces the same ciphertext, and the GCM auth tag
// guards against tampering on decrypt.
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 32;
const KEY_LENGTH = 32;
const ITERATIONS = 100000;
const DIGEST = 'sha256';

// Master key is loaded once via config (validated at startup). It is a 64-char
// hex string => 32 raw bytes, used as the PBKDF2 input keying material.
const MASTER_KEY = Buffer.from(config.encryption.key, 'hex');

interface EncryptedData {
  ciphertext: string; // base64
  iv: string; // base64
  authTag: string; // base64
  salt: string; // base64
}

function deriveKey(salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(MASTER_KEY, salt, ITERATIONS, KEY_LENGTH, DIGEST);
}

/**
 * Encrypt a plaintext API key. Returns a self-contained base64 string holding
 * the ciphertext together with the IV, auth tag, and salt needed to decrypt it.
 */
export function encryptApiKey(plaintext: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const salt = crypto.randomBytes(SALT_LENGTH);
  const derivedKey = deriveKey(salt);

  const cipher = crypto.createCipheriv(ALGORITHM, derivedKey, iv);
  let ciphertext = cipher.update(plaintext, 'utf8', 'base64');
  ciphertext += cipher.final('base64');
  const authTag = cipher.getAuthTag();

  const encrypted: EncryptedData = {
    ciphertext,
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
    salt: salt.toString('base64'),
  };

  return Buffer.from(JSON.stringify(encrypted)).toString('base64');
}

/**
 * Decrypt a string produced by {@link encryptApiKey}. Throws if the payload was
 * tampered with (GCM auth tag verification fails) or is malformed.
 */
export function decryptApiKey(encryptedString: string): string {
  const encrypted: EncryptedData = JSON.parse(
    Buffer.from(encryptedString, 'base64').toString('utf8')
  );

  const iv = Buffer.from(encrypted.iv, 'base64');
  const authTag = Buffer.from(encrypted.authTag, 'base64');
  const salt = Buffer.from(encrypted.salt, 'base64');
  const ciphertext = Buffer.from(encrypted.ciphertext, 'base64');
  const derivedKey = deriveKey(salt);

  const decipher = crypto.createDecipheriv(ALGORITHM, derivedKey, iv);
  decipher.setAuthTag(authTag);

  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return plaintext.toString('utf8');
}

/**
 * Produce a non-sensitive hint for display (e.g. in settings UI): five bullets
 * followed by the last four characters of the key. Never exposes the full key.
 */
export function generateKeyHint(apiKey: string): string {
  return '•••••' + apiKey.slice(-4);
}
