import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app.js';

// Pull the refresh_token value out of a Set-Cookie header array.
function refreshCookie(res: request.Response): string {
  const raw = res.headers['set-cookie'] as unknown as string[] | undefined;
  const cookie = (raw ?? []).find((c) => c.startsWith('refresh_token='));
  if (!cookie) throw new Error('no refresh_token cookie set');
  return cookie.split(';')[0]; // "refresh_token=<jwt>"
}

const strongPassword = 'Password123';

describe('POST /api/auth/register', () => {
  it('registers a new user (201) with an access token and refresh cookie', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'new@example.com', password: strongPassword });

    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ email: 'new@example.com' });
    expect(res.body.user.id).toBeTruthy();
    expect(typeof res.body.accessToken).toBe('string');
    expect(() => refreshCookie(res)).not.toThrow();
  });

  it('rejects a duplicate email (409)', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ email: 'dupe@example.com', password: strongPassword });
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'dupe@example.com', password: strongPassword });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('AUTH_EMAIL_IN_USE');
  });

  it('rejects a weak password (400)', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'weak@example.com', password: 'short' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VAL_REQUIRED_FIELD');
  });
});

describe('POST /api/auth/login', () => {
  it('logs in with correct credentials (200)', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ email: 'login@example.com', password: strongPassword });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'login@example.com', password: strongPassword });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeTruthy();
  });

  it('rejects a wrong password (401)', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ email: 'wrong@example.com', password: strongPassword });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'wrong@example.com', password: 'WrongPass123' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('AUTH_INVALID_CREDENTIALS');
  });
});

describe('POST /api/auth/refresh', () => {
  it('rotates a valid refresh token (200) and detects replay (401)', async () => {
    const reg = await request(app)
      .post('/api/auth/register')
      .send({ email: 'refresh@example.com', password: strongPassword });
    const original = refreshCookie(reg);

    const first = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', original);
    expect(first.status).toBe(200);
    expect(first.body.accessToken).toBeTruthy();

    // Reusing the now-rotated token is a replay → rejected.
    const replay = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', original);
    expect(replay.status).toBe(401);
    expect(replay.body.error.code).toBe('AUTH_TOKEN_INVALID');
  });

  it('rejects a missing refresh token (401)', async () => {
    const res = await request(app).post('/api/auth/refresh');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/auth/me', () => {
  it('returns the current user with a valid token (200)', async () => {
    const reg = await request(app)
      .post('/api/auth/register')
      .send({ email: 'me@example.com', password: strongPassword });
    const token = reg.body.accessToken as string;

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ email: 'me@example.com' });
  });

  it('rejects a request with no token (401)', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('AUTH_TOKEN_MISSING');
  });
});
