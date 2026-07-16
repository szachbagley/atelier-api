import { describe, it, expect } from 'vitest';
import {
  encryptApiKey,
  decryptApiKey,
  generateKeyHint,
} from '../../../src/services/encryption/encryptionService.js';

describe('encryptApiKey / decryptApiKey', () => {
  it('round-trips plaintext back to the original', () => {
    const secret = 'sk-test-1234567890-ABCDEFG';
    expect(decryptApiKey(encryptApiKey(secret))).toBe(secret);
  });

  it('handles unicode and empty strings', () => {
    expect(decryptApiKey(encryptApiKey(''))).toBe('');
    expect(decryptApiKey(encryptApiKey('clé-🔐-秘密'))).toBe('clé-🔐-秘密');
  });

  it('produces different ciphertext for the same input (random salt+IV)', () => {
    const secret = 'same-input';
    const a = encryptApiKey(secret);
    const b = encryptApiKey(secret);
    expect(a).not.toBe(b);
    // ...but both still decrypt to the same plaintext.
    expect(decryptApiKey(a)).toBe(secret);
    expect(decryptApiKey(b)).toBe(secret);
  });

  it('rejects a tampered ciphertext (GCM auth tag fails)', () => {
    const encrypted = encryptApiKey('do-not-tamper');
    const payload = JSON.parse(
      Buffer.from(encrypted, 'base64').toString('utf8')
    );
    // Flip a byte in the ciphertext.
    const raw = Buffer.from(payload.ciphertext, 'base64');
    raw[0] ^= 0xff;
    payload.ciphertext = raw.toString('base64');
    const tampered = Buffer.from(JSON.stringify(payload)).toString('base64');

    expect(() => decryptApiKey(tampered)).toThrow();
  });

  it('rejects a payload with a swapped auth tag', () => {
    const a = JSON.parse(
      Buffer.from(encryptApiKey('alpha'), 'base64').toString('utf8')
    );
    const b = JSON.parse(
      Buffer.from(encryptApiKey('bravo'), 'base64').toString('utf8')
    );
    a.authTag = b.authTag; // wrong tag for this ciphertext
    const forged = Buffer.from(JSON.stringify(a)).toString('base64');
    expect(() => decryptApiKey(forged)).toThrow();
  });

  it('throws on malformed input', () => {
    expect(() => decryptApiKey('not-base64-json')).toThrow();
  });
});

describe('generateKeyHint', () => {
  it('masks all but the last four characters', () => {
    expect(generateKeyHint('sk-abcdefgh1234')).toBe('•••••1234');
  });

  it('never reveals the middle of the key', () => {
    const hint = generateKeyHint('super-secret-key-value');
    expect(hint).not.toContain('secret');
    expect(hint.endsWith('alue')).toBe(true);
  });
});
