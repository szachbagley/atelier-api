import { describe, it, expect } from 'vitest';
import { registerSchema, loginSchema } from '../../../src/schemas/auth.js';

describe('registerSchema', () => {
  it('accepts a valid email and complex password', () => {
    const { error } = registerSchema.validate({
      email: 'user@example.com',
      password: 'Abcdef12',
    });
    expect(error).toBeUndefined();
  });

  it('rejects passwords shorter than 8 characters', () => {
    const { error } = registerSchema.validate({
      email: 'user@example.com',
      password: 'Ab1xyz',
    });
    expect(error?.details[0]?.path).toEqual(['password']);
  });

  it('rejects passwords longer than 128 characters', () => {
    const { error } = registerSchema.validate({
      email: 'user@example.com',
      password: 'A1' + 'a'.repeat(130),
    });
    expect(error?.details[0]?.path).toEqual(['password']);
  });

  it('rejects passwords missing an uppercase letter', () => {
    const { error } = registerSchema.validate({
      email: 'user@example.com',
      password: 'abcdef12',
    });
    expect(error?.details[0]?.path).toEqual(['password']);
  });

  it('rejects passwords missing a lowercase letter', () => {
    const { error } = registerSchema.validate({
      email: 'user@example.com',
      password: 'ABCDEF12',
    });
    expect(error?.details[0]?.path).toEqual(['password']);
  });

  it('rejects passwords missing a number', () => {
    const { error } = registerSchema.validate({
      email: 'user@example.com',
      password: 'Abcdefgh',
    });
    expect(error?.details[0]?.path).toEqual(['password']);
  });

  it('rejects invalid email formats', () => {
    const { error } = registerSchema.validate({
      email: 'not-an-email',
      password: 'Abcdef12',
    });
    expect(error?.details[0]?.path).toEqual(['email']);
  });

  it('rejects emails longer than 255 characters', () => {
    const longLocal = 'a'.repeat(250);
    const { error } = registerSchema.validate({
      email: `${longLocal}@example.com`,
      password: 'Abcdef12',
    });
    expect(error?.details[0]?.path).toEqual(['email']);
  });

  it('reports all field errors at once (abortEarly: false default override)', () => {
    const { error } = registerSchema.validate(
      { email: 'bad', password: 'short' },
      { abortEarly: false }
    );
    expect(error?.details.length).toBeGreaterThanOrEqual(2);
  });

  it('requires email and password', () => {
    const { error } = registerSchema.validate({}, { abortEarly: false });
    const paths = error?.details.map((d) => d.path.join('.')) ?? [];
    expect(paths).toContain('email');
    expect(paths).toContain('password');
  });
});

describe('loginSchema', () => {
  it('accepts any valid email and any non-empty password', () => {
    const { error } = loginSchema.validate({
      email: 'user@example.com',
      password: 'whatever',
    });
    expect(error).toBeUndefined();
  });

  it('does not enforce password complexity rules', () => {
    const { error } = loginSchema.validate({
      email: 'user@example.com',
      password: 'short',
    });
    expect(error).toBeUndefined();
  });

  it('requires both fields', () => {
    const { error } = loginSchema.validate({}, { abortEarly: false });
    const paths = error?.details.map((d) => d.path.join('.')) ?? [];
    expect(paths).toContain('email');
    expect(paths).toContain('password');
  });
});
