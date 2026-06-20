import request from 'supertest';
import jwt from 'jsonwebtoken';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import type { Express } from 'express';
import { getServer, getUtils } from './helpers';

type UtilsModule = Awaited<ReturnType<typeof getUtils>>;

let app: Express;
let utilsModule: UtilsModule;

beforeAll(async () => {
  ({ app } = await getServer());
  utilsModule = await getUtils();
});

const makeAuthHeader = () =>
  `Bearer ${jwt.sign({ userId: 'admin', username: 'admin' }, process.env.JWT_SECRET || 'test-secret')}`;

describe('/api/v1/database endpoints', () => {
  it('requires authentication for database reset', async () => {
    const res = await request(app).post('/api/v1/database');
    expect(res.status).toBe(401);
    expect(res.body.ok).toBe(false);
  });

  it('POST /api/v1/database invokes clearDatabase and returns ok', async () => {
    const clearSpy = vi.spyOn(utilsModule, 'clearDatabase').mockResolvedValue(undefined as any);

    const res = await request(app)
      .post('/api/v1/database')
      .set('Authorization', makeAuthHeader());

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(clearSpy).toHaveBeenCalledTimes(1);
  });

  it('POST /api/v1/database surfaces clearDatabase failures', async () => {
    vi.spyOn(utilsModule, 'clearDatabase').mockRejectedValue(new Error('boom'));

    const res = await request(app)
      .post('/api/v1/database')
      .set('Authorization', makeAuthHeader());

    expect(res.status).toBe(500);
    expect(res.body.ok).toBe(false);
    expect(res.body.error).toBe('boom');
  });

  it('POST /api/v1/database/records returns fetched data', async () => {
    const records = [{ id: 'g1', name: 'Group 1' }];
    vi.spyOn(utilsModule, 'fetchRecords').mockResolvedValue(records as any);

    const res = await request(app)
      .post('/api/v1/database/records')
      .set('Authorization', makeAuthHeader())
      .send({ table: 'group' });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data).toEqual(records);
  });

  it('POST /api/v1/database/records returns 500 when fetchRecords throws', async () => {
    vi.spyOn(utilsModule, 'fetchRecords').mockRejectedValue(new Error('nope'));

    const res = await request(app)
      .post('/api/v1/database/records')
      .set('Authorization', makeAuthHeader())
      .send({ table: 'group' });

    expect(res.status).toBe(500);
    expect(res.body.ok).toBe(false);
    expect(res.body.error).toBe('nope');
  });
});
