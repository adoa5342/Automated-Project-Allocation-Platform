import request from 'supertest';
import { describe, it, expect, beforeAll } from 'vitest';
import type { Express } from 'express';
import { getServer } from './helpers';

let app: Express;

beforeAll(async () => {
  ({ app } = await getServer());
});

describe('server bootstrap', () => {
  it('serves openapi spec at /api-docs.yaml', async () => {
    const res = await request(app).get('/api-docs.yaml');
    expect(res.status).toBe(200);
    // Should serve YAML content
    expect(res.text).toContain('openapi');
  });
});
