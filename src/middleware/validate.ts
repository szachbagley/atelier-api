import type { Request, RequestHandler } from 'express';
import type { Schema, ValidationErrorItem } from 'joi';
import { ValidationError } from '../errors/index.js';

type Source = 'body' | 'params' | 'query';

function assignValidated(req: Request, source: Source, value: unknown): void {
  if (source === 'query') {
    // Express 5 exposes req.query as a non-writable getter; redefine to overwrite.
    Object.defineProperty(req, 'query', {
      value,
      writable: true,
      configurable: true,
      enumerable: true,
    });
    return;
  }
  (req as Request & Record<Source, unknown>)[source] = value;
}

function makeValidator(source: Source) {
  return (schema: Schema): RequestHandler => {
    return (req, _res, next) => {
      const { error, value } = schema.validate(req[source], {
        abortEarly: false,
        stripUnknown: true,
      });

      if (error) {
        const fields = error.details.map((d: ValidationErrorItem) => ({
          field: d.path.join('.'),
          message: d.message,
          type: d.type,
        }));
        return next(new ValidationError('Validation failed', { fields }));
      }

      assignValidated(req, source, value);
      next();
    };
  };
}

export const validate = makeValidator('body');
export const validateParams = makeValidator('params');
export const validateQuery = makeValidator('query');
