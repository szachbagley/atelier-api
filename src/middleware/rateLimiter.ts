import type { Request, Response } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { ErrorCodes } from '../errors/index.js';

function rateLimitedResponse(req: Request, res: Response, message: string): void {
  const requestId = (req as Request & { requestId?: string }).requestId;
  res.status(429).json({
    error: {
      code: ErrorCodes.SYS_RATE_LIMITED,
      message,
      requestId,
    },
  });
}

// Integration tests drive many requests from a single IP; disable throttling
// under NODE_ENV=test so limiter counters never cause cross-test flakiness.
const skipInTest = (): boolean => process.env.NODE_ENV === 'test';

export const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 100,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTest,
  handler: (req, res) => {
    rateLimitedResponse(req, res, 'Too many requests. Please try again shortly.');
  },
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTest,
  keyGenerator: (req) => {
    const email =
      typeof req.body === 'object' && req.body !== null && 'email' in req.body
        ? String((req.body as { email?: unknown }).email ?? 'unknown')
        : 'unknown';
    return `${ipKeyGenerator(req.ip ?? '')}-${email}`;
  },
  handler: (req, res) => {
    rateLimitedResponse(req, res, 'Too many attempts. Please try again in 15 minutes.');
  },
});
