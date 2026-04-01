import type { Request, Response, NextFunction } from 'express';
import { JsonWebTokenError, TokenExpiredError } from 'jsonwebtoken';
import { AppError, ErrorCodes } from '../errors/index.js';
import { logger } from '../utils/logger.js';

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const requestId = (req as Request & { requestId?: string }).requestId;

  // --- AppError: use its own status and response shape ---
  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logger.error({ err, requestId }, err.message);
    } else {
      logger.warn({ err: { code: err.code, message: err.message }, requestId }, err.message);
    }

    res.status(err.statusCode).json(err.toResponse(requestId));
    return;
  }

  // --- Joi ValidationError ---
  if (err.name === 'ValidationError' && 'details' in err) {
    const joiErr = err as Error & {
      details: Array<{ message: string; path: (string | number)[]; type: string }>;
    };

    const fields = joiErr.details.map((d) => ({
      field: d.path.join('.'),
      message: d.message,
      type: d.type,
    }));

    logger.warn({ requestId, fields }, 'Validation failed');

    res.status(400).json({
      error: {
        code: ErrorCodes.VAL_REQUIRED_FIELD,
        message: 'Validation failed',
        details: { fields },
        requestId,
      },
    });
    return;
  }

  // --- JWT errors ---
  if (err instanceof TokenExpiredError) {
    logger.warn({ requestId }, 'JWT token expired');
    res.status(401).json({
      error: {
        code: ErrorCodes.AUTH_TOKEN_EXPIRED,
        message: 'Token has expired',
        requestId,
      },
    });
    return;
  }

  if (err instanceof JsonWebTokenError) {
    logger.warn({ requestId }, 'JWT token invalid');
    res.status(401).json({
      error: {
        code: ErrorCodes.AUTH_TOKEN_INVALID,
        message: 'Invalid token',
        requestId,
      },
    });
    return;
  }

  // --- Unknown errors: log full details, never expose internals ---
  logger.error({ err, requestId }, 'Unhandled error');

  res.status(500).json({
    error: {
      code: ErrorCodes.SYS_INTERNAL_ERROR,
      message: 'An unexpected error occurred',
      requestId,
    },
  });
}
