import { describe, it, expect, vi } from 'vitest';
import type { Request, Response } from 'express';
import Joi from 'joi';
import { validate } from '../../../src/middleware/validate.js';
import { AppError } from '../../../src/errors/index.js';

const schema = Joi.object({
  name: Joi.string().required(),
  age: Joi.number().integer().min(0),
});

function run(body: unknown) {
  const req = { body } as Request;
  const res = {} as Response;
  const next = vi.fn();
  validate(schema)(req, res, next);
  return { req, next };
}

describe('validate middleware', () => {
  it('calls next() with no argument when input is valid', () => {
    const { next } = run({ name: 'Ada', age: 30 });
    expect(next).toHaveBeenCalledWith();
  });

  it('strips unknown fields from the assigned body', () => {
    const { req, next } = run({ name: 'Ada', extra: 'nope' });
    expect(next).toHaveBeenCalledWith();
    expect(req.body).toEqual({ name: 'Ada' });
    expect(req.body).not.toHaveProperty('extra');
  });

  it('passes a ValidationError (400) with field details on invalid input', () => {
    const { next } = run({ age: -1 });
    const err = next.mock.calls[0][0] as AppError;
    expect(err).toBeInstanceOf(AppError);
    expect(err.statusCode).toBe(400);
    const fields = (err.details as { fields: Array<{ field: string }> }).fields;
    const names = fields.map((f) => f.field);
    expect(names).toContain('name'); // required, missing
    expect(names).toContain('age'); // min(0) violated
  });

  it('reports every error at once (abortEarly disabled)', () => {
    const { next } = run({});
    const err = next.mock.calls[0][0] as AppError;
    const fields = (err.details as { fields: unknown[] }).fields;
    expect(fields.length).toBeGreaterThanOrEqual(1);
  });
});
