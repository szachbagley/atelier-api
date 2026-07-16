import { describe, it, expect } from 'vitest';
import jwt from 'jsonwebtoken';
import { authService } from '../../../src/services/auth/authService.js';
import { AppError, ErrorCodes } from '../../../src/errors/index.js';

const SECRET = process.env.JWT_ACCESS_SECRET as string;

// Note: register/login/refresh/logout exercise the database and are covered by
// the integration suite (tests/integration/auth.test.ts). Here we unit-test the
// pure token surface: verification and expiry handling, plus token hashing.

describe('authService.verifyAccessToken', () => {
  it('returns the subject and email for a valid access token', () => {
    const token = jwt.sign(
      { sub: 'user-42', email: 'ada@example.com', type: 'access' },
      SECRET,
      { algorithm: 'HS256', expiresIn: '15m' }
    );
    expect(authService.verifyAccessToken(token)).toEqual({
      id: 'user-42',
      email: 'ada@example.com',
    });
  });

  it('throws AUTH_TOKEN_EXPIRED for an expired token', () => {
    const token = jwt.sign(
      { sub: 'u', email: 'e', type: 'access' },
      SECRET,
      { algorithm: 'HS256', expiresIn: '-1s' }
    );
    try {
      authService.verifyAccessToken(token);
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).code).toBe(ErrorCodes.AUTH_TOKEN_EXPIRED);
    }
  });

  it('throws AUTH_TOKEN_INVALID for a bad signature', () => {
    const token = jwt.sign({ sub: 'u', type: 'access' }, 'wrong-secret');
    try {
      authService.verifyAccessToken(token);
      expect.unreachable('should have thrown');
    } catch (err) {
      expect((err as AppError).code).toBe(ErrorCodes.AUTH_TOKEN_INVALID);
    }
  });

  it('throws AUTH_TOKEN_INVALID for a non-JWT string', () => {
    expect(() => authService.verifyAccessToken('garbage')).toThrow(AppError);
  });
});

describe('authService.hashToken', () => {
  it('produces a deterministic 64-char sha256 hex digest', () => {
    const a = authService.hashToken('refresh-token-value');
    const b = authService.hashToken('refresh-token-value');
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it('produces different digests for different inputs', () => {
    expect(authService.hashToken('a')).not.toBe(authService.hashToken('b'));
  });
});
