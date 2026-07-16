import { describe, it, expect, beforeEach } from 'vitest';
import { v4 as uuid } from 'uuid';
import request from 'supertest';
import { app } from '../../src/app.js';
import { getDb } from './setup.js';
import {
  createTestUser,
  createTestProject,
  createTestAct,
  createTestScene,
  createTestCharacter,
} from '../fixtures/index.js';

let token: string;
let projectId: string;
let sceneId: string;

beforeEach(async () => {
  const db = await getDb();
  const user = await createTestUser(db);
  token = user.token;
  ({ id: projectId } = await createTestProject(db, user.userId));
  const { id: actId } = await createTestAct(db, projectId);
  ({ id: sceneId } = await createTestScene(db, actId));
});

const authHeader = () => ({ Authorization: `Bearer ${token}` });
const shotsUrl = (sid = sceneId) =>
  `/api/projects/${projectId}/scenes/${sid}/shots`;

async function createShot(body: Record<string, unknown> = {}, sid = sceneId) {
  return request(app).post(shotsUrl(sid)).set(authHeader()).send(body);
}

describe('shot creation & sequencing', () => {
  it('auto-assigns sequence numbers spaced by 1000', async () => {
    const first = await createShot({ description: 'first' });
    const second = await createShot({ description: 'second' });

    expect(first.status).toBe(201);
    expect(first.body.sequenceNumber).toBe(1000);
    expect(second.body.sequenceNumber).toBe(2000);
  });

  it('persists character and prop junctions and returns them on detail', async () => {
    const db = await getDb();
    const { id: characterId } = await createTestCharacter(db, projectId);
    const propId = uuid();
    await db('props').insert({ id: propId, project_id: projectId, name: 'Sword' });

    const created = await createShot({
      description: 'with refs',
      characters: [{ characterId }],
      props: [propId],
    });
    expect(created.status).toBe(201);

    const detail = await request(app)
      .get(`/api/projects/${projectId}/shots/${created.body.id}`)
      .set(authHeader());
    expect(detail.status).toBe(200);
    expect(detail.body.characters.map((c: { characterId: string }) => c.characterId)).toContain(
      characterId
    );
    expect(detail.body.props.map((p: { propId: string }) => p.propId)).toContain(propId);
  });

  it('rejects a character that is not in the project (400)', async () => {
    const created = await createShot({
      description: 'bad ref',
      characters: [{ characterId: uuid() }],
    });
    expect(created.status).toBe(400);
  });
});

describe('shot reordering', () => {
  it('resequences shots to match orderedIds', async () => {
    const a = (await createShot({ description: 'A' })).body.id as string;
    const b = (await createShot({ description: 'B' })).body.id as string;
    const c = (await createShot({ description: 'C' })).body.id as string;

    const res = await request(app)
      .post(`${shotsUrl()}/reorder`)
      .set(authHeader())
      .send({ orderedIds: [c, a, b] });
    expect(res.status).toBe(200);
    expect(res.body.updated).toBe(3);

    const list = await request(app).get(shotsUrl()).set(authHeader());
    expect(list.body.data.map((s: { id: string }) => s.id)).toEqual([c, a, b]);
  });

  it('rejects an orderedIds set that does not match the scene (400)', async () => {
    const a = (await createShot({ description: 'A' })).body.id as string;
    const res = await request(app)
      .post(`${shotsUrl()}/reorder`)
      .set(authHeader())
      .send({ orderedIds: [a, uuid()] });
    expect(res.status).toBe(400);
  });
});

describe('moving a shot between scenes', () => {
  it('moves a shot to another scene in the same project', async () => {
    const db = await getDb();
    const { id: actId2 } = await createTestAct(db, projectId, {
      sequenceNumber: 2000,
    });
    const { id: scene2 } = await createTestScene(db, actId2);

    const shotId = (await createShot({ description: 'movable' })).body.id as string;

    const res = await request(app)
      .post(`/api/projects/${projectId}/shots/${shotId}/move`)
      .set(authHeader())
      .send({ targetSceneId: scene2 });
    expect(res.status).toBe(200);

    const dest = await request(app).get(shotsUrl(scene2)).set(authHeader());
    expect(dest.body.data.map((s: { id: string }) => s.id)).toContain(shotId);

    const origin = await request(app).get(shotsUrl()).set(authHeader());
    expect(origin.body.data.map((s: { id: string }) => s.id)).not.toContain(shotId);
  });
});
