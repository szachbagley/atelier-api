import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app.js';
import { getDb } from './setup.js';
import { createTestUser } from '../fixtures/index.js';

let token: string;

beforeEach(async () => {
  const db = await getDb();
  ({ token } = await createTestUser(db));
});

function auth(req: request.Test): request.Test {
  return req.set('Authorization', `Bearer ${token}`);
}

describe('project CRUD lifecycle', () => {
  it('creates, reads, updates, soft-deletes, and restores a project', async () => {
    // Create
    const created = await auth(
      request(app).post('/api/projects').send({ title: 'My Film' })
    );
    expect(created.status).toBe(201);
    const id = created.body.id as string;
    expect(created.body.title).toBe('My Film');

    // Read (detail)
    const detail = await auth(request(app).get(`/api/projects/${id}`));
    expect(detail.status).toBe(200);
    expect(detail.body.id).toBe(id);

    // List
    const list = await auth(request(app).get('/api/projects'));
    expect(list.status).toBe(200);
    expect(list.body.data.map((p: { id: string }) => p.id)).toContain(id);

    // Update
    const patched = await auth(
      request(app).patch(`/api/projects/${id}`).send({ title: 'Renamed' })
    );
    expect(patched.status).toBe(200);
    expect(patched.body.title).toBe('Renamed');

    // Soft delete
    const deleted = await auth(request(app).delete(`/api/projects/${id}`));
    expect(deleted.status).toBe(204);

    // A deleted project is no longer accessible on the active gate
    const gone = await auth(request(app).get(`/api/projects/${id}`));
    expect(gone.status).toBe(403);

    // Restore brings it back
    const restored = await auth(
      request(app).post(`/api/projects/${id}/restore`)
    );
    expect(restored.status).toBe(200);
    const again = await auth(request(app).get(`/api/projects/${id}`));
    expect(again.status).toBe(200);
  });

  it('rejects a create with no title (400)', async () => {
    const res = await auth(request(app).post('/api/projects').send({}));
    expect(res.status).toBe(400);
  });
});

describe('project authorization', () => {
  it('forbids access to another user\'s project (403)', async () => {
    const created = await auth(
      request(app).post('/api/projects').send({ title: 'Private' })
    );
    const id = created.body.id as string;

    const db = await getDb();
    const { token: otherToken } = await createTestUser(db);

    const res = await request(app)
      .get(`/api/projects/${id}`)
      .set('Authorization', `Bearer ${otherToken}`);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('AUTHZ_PROJECT_ACCESS_DENIED');
  });
});

describe('project sharing', () => {
  it('shares publicly, exposes the shared tree, then revokes', async () => {
    const created = await auth(
      request(app).post('/api/projects').send({ title: 'Shared Film' })
    );
    const id = created.body.id as string;

    // Enable sharing
    const shared = await auth(request(app).post(`/api/projects/${id}/share`));
    expect(shared.status).toBe(200);
    expect(shared.body.isPublic).toBe(true);
    const token = shared.body.shareToken as string;
    expect(shared.body.shareUrl).toContain(token);

    // Public tree — no auth header
    const publicView = await request(app).get(`/api/shared/${token}`);
    expect(publicView.status).toBe(200);

    // Revoke
    const revoked = await auth(request(app).delete(`/api/projects/${id}/share`));
    expect(revoked.status).toBe(200);
    expect(revoked.body.isPublic).toBe(false);

    // Token no longer resolves
    const afterRevoke = await request(app).get(`/api/shared/${token}`);
    expect(afterRevoke.status).toBe(404);
  });
});
