import request from 'supertest';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import * as bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import type { Express } from 'express';
import type { PrismaClient } from '@prisma/client';
import { getServer, getUtils } from './helpers';

type UtilsModule = Awaited<ReturnType<typeof getUtils>>;

let app: Express;
let prisma: PrismaClient;
let utilsModule: UtilsModule;

beforeAll(async () => {
  ({ app, prisma } = await getServer());
  utilsModule = await getUtils();
});

describe('auth and protected routes', () => {
  it('POST /api/v1/login succeeds with valid credentials', async () => {
    const hashed = await bcrypt.hash('pw', 4);
    vi.spyOn(prisma.account, 'findUnique').mockResolvedValue({
      id: 'acc1', username: 'admin', password: hashed, role: 'admin', userId: null,
    } as any);

    const res = await request(app)
      .post('/api/v1/login')
      .send({ username: 'admin', password: 'pw' });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.token).toBeTruthy();
  });

  it('POST /api/v1/login returns 400 when credentials missing', async () => {
    const res = await request(app).post('/api/v1/login').send({});
    expect(res.status).toBe(400);
    expect(res.body.ok).toBe(false);
    expect(res.body.message).toMatch(/required/i);
  });

  it('POST /api/v1/login returns ok=false for invalid password', async () => {
    const hashed = await bcrypt.hash('different', 4);
    vi.spyOn(prisma.account, 'findUnique').mockResolvedValue({
      id: 'acc1',
      username: 'admin',
      password: hashed,
      role: 'admin',
      userId: null,
    } as any);

    const res = await request(app)
      .post('/api/v1/login')
      .send({ username: 'admin', password: 'pw' });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(false);
    expect(res.body.message).toBe('Invalid');
  });

  it('POST /api/v1/login handles server errors', async () => {
    vi.spyOn(prisma.account, 'findUnique').mockRejectedValue(new Error('db down'));

    const res = await request(app)
      .post('/api/v1/login')
      .send({ username: 'admin', password: 'pw' });

    expect(res.status).toBe(500);
    expect(res.body.ok).toBe(false);
    expect(res.body.error).toBe('Failed to find account');
  });

  it('GET /api/v1/results/:runId requires auth and returns data with token', async () => {
    // First make a login to get a token (use a real hash)
    const hashed = await bcrypt.hash('pw', 4);
    vi.spyOn(prisma.account, 'findUnique').mockResolvedValue({
      id: 'acc1', username: 'admin', password: hashed, role: 'admin', userId: null,
    } as any);

    const login = await request(app)
      .post('/api/v1/login')
      .send({ username: 'admin', password: 'pw' });

    const token = login.body.token as string;
    expect(token).toBeTruthy();

    // Mock assignments
    vi.spyOn(prisma.assignment, 'findMany').mockResolvedValue([
      {
        id: 'a1',
        runId: 'run1',
        groupId: 'g1',
        projectId: 'p1',
        status: 'locked',
        score: 0.9,
      },
      {
        id: 'a2',
        runId: 'run1',
        groupId: 'g2',
        projectId: 'p1',
        status: 'locked',
        score: 0.8,
      },
      {
        id: 'a3',
        runId: 'run1',
        groupId: 'g3',
        projectId: 'p2',
        status: 'locked',
        score: 0.75,
      },
    ] as any);

    // Missing auth -> 401
    const unauth = await request(app).get('/api/v1/results/run1');
    expect(unauth.status).toBe(401);

    // With token -> 200
    const ok = await request(app)
      .get('/api/v1/results/run1')
      .set('Authorization', `Bearer ${token}`);
    expect(ok.status).toBe(200);
    expect(ok.body.runId).toBe('run1');
    expect(ok.body.count).toBe(3);
    expect(ok.body.assignments).toHaveLength(3);
    expect(ok.body.byProject.p1.count).toBe(2);
    expect(ok.body.byProject.p1.groups).toEqual(expect.arrayContaining(['g1', 'g2']));
    expect(ok.body.byProject.p2.count).toBe(1);
  });

  it('GET /api/v1/results/:runId filters assignments for student users', async () => {
    const token = jwt.sign(
      { userId: 'student-acc1', username: 'student1', role: 'student' },
      process.env.JWT_SECRET || 'test-secret',
    );

    const findGroupSpy = vi
      .spyOn(utilsModule, 'findGroupByUsername')
      .mockResolvedValue([{ id: 'g1' }] as any);

    const assignmentSpy = vi
      .spyOn(prisma.assignment, 'findMany')
      .mockImplementation(async (args: any) => {
        expect(args?.where).toEqual({ runId: 'run1', groupId: { in: ['g1'] } });
        return [
          {
            id: 'a1',
            runId: 'run1',
            groupId: 'g1',
            projectId: 'p1',
            status: 'locked',
            score: 0.9,
          },
        ] as any;
      });

    const res = await request(app)
      .get('/api/v1/results/run1')
      .set('Authorization', `Bearer ${token}`);

    expect(findGroupSpy).toHaveBeenCalledWith('student1');
    expect(assignmentSpy).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(200);
    expect(res.body.runId).toBe('run1');
    expect(res.body.count).toBe(1);
    expect(res.body.assignments).toHaveLength(1);
    expect(res.body.assignments[0].groupId).toBe('g1');
    expect(res.body.byProject.p1.groups).toEqual(['g1']);
  });

  it('GET /api/v1/results/:runId returns empty payload for students without a group', async () => {
    const token = jwt.sign(
      { userId: 'student-acc2', username: 'student2', role: 'student' },
      process.env.JWT_SECRET || 'test-secret',
    );

    const findGroupSpy = vi
      .spyOn(utilsModule, 'findGroupByUsername')
      .mockResolvedValue([] as any);

    const assignmentSpy = vi.spyOn(prisma.assignment, 'findMany');

    const res = await request(app)
      .get('/api/v1/results/run1')
      .set('Authorization', `Bearer ${token}`);

    expect(findGroupSpy).toHaveBeenCalledWith('student2');
    expect(assignmentSpy).not.toHaveBeenCalled();
    expect(res.status).toBe(200);
    expect(res.body.runId).toBe('run1');
    expect(res.body.count).toBe(0);
    expect(res.body.assignments).toEqual([]);
    expect(res.body.byProject).toEqual({});
  });
});
