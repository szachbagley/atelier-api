import type { Request, Response, NextFunction } from 'express';
import { authService } from '../services/auth/authService.js';
import { UnauthorizedError } from '../errors/index.js';
import { ErrorCodes } from '../errors/codes.js';

const BEARER_PREFIX = 'Bearer ';

export function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith(BEARER_PREFIX)) {
      throw new UnauthorizedError(
        ErrorCodes.AUTH_TOKEN_MISSING,
        'Authentication required'
      );
    }

    const token = header.slice(BEARER_PREFIX.length).trim();
    if (!token) {
      throw new UnauthorizedError(
        ErrorCodes.AUTH_TOKEN_MISSING,
        'Authentication required'
      );
    }

    req.user = authService.verifyAccessToken(token);
    next();
  } catch (err) {
    next(err);
  }
}
