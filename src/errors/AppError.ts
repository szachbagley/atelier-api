import { ErrorCode, ErrorCodes } from './codes.js';

interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    details?: object;
    requestId?: string;
  };
}

export class AppError extends Error {
  constructor(
    public code: ErrorCode,
    public statusCode: number,
    message: string,
    public details?: object
  ) {
    super(message);
    this.name = 'AppError';
  }

  toResponse(requestId?: string): ApiErrorResponse {
    return {
      error: {
        code: this.code,
        message: this.message,
        details: this.details,
        requestId,
      },
    };
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: object) {
    super(ErrorCodes.VAL_REQUIRED_FIELD, 400, message, details);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id: string) {
    super(ErrorCodes.RES_NOT_FOUND, 404, `${resource} not found: ${id}`, {
      resource,
      id,
    });
    this.name = 'NotFoundError';
  }
}

export class UnauthorizedError extends AppError {
  constructor(
    code: ErrorCode = ErrorCodes.AUTH_TOKEN_MISSING,
    message: string = 'Authentication required'
  ) {
    super(code, 401, message);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends AppError {
  constructor(resource: string) {
    super(
      ErrorCodes.AUTHZ_RESOURCE_ACCESS_DENIED,
      403,
      `Access denied to ${resource}`
    );
    this.name = 'ForbiddenError';
  }
}

export class ConflictError extends AppError {
  constructor(code: ErrorCode, message: string) {
    super(code, 409, message);
    this.name = 'ConflictError';
  }
}

export class ApiKeyError extends AppError {
  constructor(code: ErrorCode, provider: string, message: string) {
    super(code, 422, message, { provider });
    this.name = 'ApiKeyError';
  }
}

export class GenerationError extends AppError {
  constructor(code: ErrorCode, message: string, details?: object) {
    super(code, 422, message, details);
    this.name = 'GenerationError';
  }
}

export class ProviderError extends AppError {
  constructor(
    provider: string,
    originalError: string,
    retryable: boolean = false
  ) {
    super(
      ErrorCodes.GEN_PROVIDER_ERROR,
      502,
      `Image generation failed: ${originalError}`,
      { provider, retryable }
    );
    this.name = 'ProviderError';
  }
}
