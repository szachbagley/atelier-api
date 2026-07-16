import { describe, it, expect, vi } from 'vitest';
import type { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { authenticate } from '../../../src/middleware/authenticate.js';
import { AppError, ErrorCodes } from '../../../src/errors/index.js';

const SECRET = process.env.JWT_ACCESS_SECRET as string;

function sign(payload: object, options: jwt.SignOptions = {}) {
  return jwt.sign({ type: 'access', ...payload }, SECRET, {
    algorithm: 'HS256',
    ...options,
  });
}

function run(authorization?: string) {
  const req = { headers: authorization ? { authorization } : {} } as Request;
  const res = {} as Response;
  const next = vi.fn();
  authenticate(req, res, next);
  return { req, next };
}

describe('authenticate middleware', () => {
  it('accepts a valid Bearer token and populates req.user', () => {
    const token = sign({ sub: 'user-1', email: 'a@b.com' });
    const { req, next } = run(`Bearer ${token}`);
    expect(next).toHaveBeenCalledWith();
    expect(req.user).toEqual({ id: 'user-1', email: 'a@b.com' });
  });

  it('rejects a missing Authorization header (401 TOKEN_MISSING)', () => {
    const { next } = run(undefined);
    const err = next.mock.calls[0][0] as AppError;
    expect(err).toBeInstanceOf(AppError);
    expect(err.statusCode).toBe(401);
    expect(err.code).toBe(ErrorCodes.AUTH_TOKEN_MISSING);
  });

  it('rejects a non-Bearer scheme', () => {
    const { next } = run('Basic abc123');
    const err = next.mock.calls[0][0] as AppError;
    expect(err.code).toBe(ErrorCodes.AUTH_TOKEN_MISSING);
  });

  it('rejects an empty Bearer token', () => {
    const { next } = run('Bearer    ');
    const err = next.mock.calls[0][0] as AppError;
    expect(err.code).toBe(ErrorCodes.AUTH_TOKEN_MISSING);
  });

  it('rejects a malformed / bad-signature token (401 TOKEN_INVALID)', () => {
    const forged = jwt.sign({ sub: 'x', type: 'access' }, 'a-different-secret');
    const { next } = run(`Bearer ${forged}`);
    const err = next.mock.calls[0][0] as AppError;
    expect(err.statusCode).toBe(401);
    expect(err.code).toBe(ErrorCodes.AUTH_TOKEN_INVALID);
  });

  it('rejects an expired token (401 TOKEN_EXPIRED)', () => {
    const token = sign({ sub: 'user-1', email: 'a@b.com' }, { expiresIn: '-1s' });
    const { next } = run(`Bearer ${token}`);
    const err = next.mock.calls[0][0] as AppError;
    expect(err.statusCode).toBe(401);
    expect(err.code).toBe(ErrorCodes.AUTH_TOKEN_EXPIRED);
  });
});
