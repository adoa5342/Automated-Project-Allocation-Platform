import request from 'supertest';
import jwt from 'jsonwebtoken';
import { describe, it, expect, vi, beforeAll } from 'vitest';
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

const makeAuthHeader = () =>
  `Bearer ${jwt.sign({ userId: 'tester', username: 'tester' }, process.env.JWT_SECRET || 'test-secret')}`;

describe('/api/v1/allocation/history endpoints', () => {
  it('summarises allocation runs', async () => {
    const assignments = [
      {
        id: 'a1',
        runId: 'run-1',
        groupId: 'g1',
        projectId: 'p1',
        status: 'locked',
        createTime: new Date('2024-01-01T00:00:00Z'),
        group: { members: [{ userId: 'u1' }] },
        project: { id: 'p1', title: 'Project 1' },
      },
      {
        id: 'a2',
        runId: 'run-1',
        groupId: 'g2',
        projectId: 'p2',
        status: 'locked',
        createTime: new Date('2024-01-01T00:00:10Z'),
        group: { members: [{ userId: 'u2' }] },
        project: { id: 'p2', title: 'Project 2' },
      },
    ] as any;

    vi.spyOn(prisma.assignment, 'findMany').mockResolvedValue(assignments);

    const res = await request(app)
      .get('/api/v1/allocation/history')
      .set('Authorization', makeAuthHeader());

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].runId).toBe('run-1');
    expect(res.body[0].project_count).toBe(2);
    expect(res.body[0].user_count).toBe(2);
    expect(res.body[0].status).toBe('completed');
    expect(new Date(res.body[0].create_time).toISOString()).toBe('2024-01-01T00:00:00.000Z');
  });

  it('returns empty array when no allocations exist', async () => {
    vi.spyOn(prisma.assignment, 'findMany').mockResolvedValue([] as any);

    const res = await request(app)
      .get('/api/v1/allocation/history')
      .set('Authorization', makeAuthHeader());

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns 500 when history lookup fails', async () => {
    vi.spyOn(prisma.assignment, 'findMany').mockRejectedValue(new Error('db down'));

    const res = await request(app)
      .get('/api/v1/allocation/history')
      .set('Authorization', makeAuthHeader());

    expect(res.status).toBe(500);
    expect(res.body.ok).toBe(false);
    expect(res.body.error).toMatch(/failed/i);
  });

  it('returns detailed allocation info for a run', async () => {
    const assignments = [
      {
        id: 'a1',
        runId: 'run-1',
        groupId: 'g1',
        projectId: 'p1',
        status: 'locked',
        score: 0.9,
        skillFit: 0.8,
        prefTerm: 0.7,
        workloadTerm: 0.6,
        priorityTerm: 0.5,
        createTime: new Date('2024-01-01T00:00:00Z'),
        group: {
          id: 'g1',
          name: 'Group 1',
          members: [
            {
              userId: 'u1',
              user: { id: 'u1', fullName: 'Alice Example' },
            },
          ],
        },
        project: { id: 'p1', title: 'Project 1', capacitySlots: 2 },
      },
    ] as any;

    vi.spyOn(prisma.assignment, 'findMany').mockResolvedValue(assignments);
    vi.spyOn(prisma.group, 'findMany').mockResolvedValue([
      { id: 'g1', name: 'Group 1' },
      { id: 'g2', name: 'Group 2' },
    ] as any);
    vi.spyOn(prisma.project, 'findMany').mockResolvedValue([
      { id: 'p1', title: 'Project 1', capacitySlots: 2 },
      { id: 'p2', title: 'Project 2', capacitySlots: 1 },
    ] as any);
    vi.spyOn(utilsModule, 'findGroupByUsername').mockResolvedValue([] as any);

    const res = await request(app)
      .get('/api/v1/allocation/history/run-1')
      .set('Authorization', makeAuthHeader());

    expect(res.status).toBe(200);
    expect(res.body.runId).toBe('run-1');
    expect(res.body.assignments).toHaveLength(1);
    expect(res.body.assignments[0].members[0].userName).toBe('Alice Example');
    expect(res.body.stats.totalGroups).toBe(2);
    expect(res.body.stats.totalProjects).toBe(2);
    expect(res.body.stats.projectCapacities).toEqual([
      { projectName: 'Project 1', assigned: 1, capacity: 2 },
      { projectName: 'Project 2', assigned: 0, capacity: 1 },
    ]);
  });

  it('filters allocation detail by username when provided', async () => {
    const groupsForUser = [
      {
        id: 'g2',
        members: [{ userId: 'u2', user: { id: 'u2', fullName: 'Bob' } }],
      },
    ];
    vi.spyOn(utilsModule, 'findGroupByUsername').mockResolvedValue(groupsForUser as any);

    const assignments = [
      {
        id: 'a2',
        runId: 'run-1',
        groupId: 'g2',
        projectId: 'p2',
        status: 'locked',
        score: 0.82,
        skillFit: 0.7,
        prefTerm: 0.6,
        workloadTerm: 0.5,
        priorityTerm: 0.4,
        createTime: new Date('2024-02-01T00:00:00Z'),
        group: {
          id: 'g2',
          name: 'Group 2',
          members: [
            {
              userId: 'u2',
              user: { id: 'u2', fullName: 'Bob Example' },
            },
          ],
        },
        project: { id: 'p2', title: 'Project 2', capacitySlots: 1 },
      },
    ] as any;

    const assignmentSpy = vi.spyOn(prisma.assignment, 'findMany').mockResolvedValue(assignments);
    vi.spyOn(prisma.group, 'findMany').mockResolvedValue([{ id: 'g2', name: 'Group 2' }] as any);
    vi.spyOn(prisma.project, 'findMany').mockResolvedValue([
      { id: 'p2', title: 'Project 2', capacitySlots: 1 },
    ] as any);

    const res = await request(app)
      .get('/api/v1/allocation/history/run-1')
      .query({ username: 'bob' })
      .set('Authorization', makeAuthHeader());

    expect(assignmentSpy).toHaveBeenCalledWith(expect.objectContaining({
      where: { runId: 'run-1', groupId: { in: ['g2'] } },
    }));
    expect(res.status).toBe(200);
    expect(res.body.assignments).toHaveLength(1);
    expect(res.body.assignments[0].groupId).toBe('g2');
  });

  it('returns 500 when detail lookup fails', async () => {
    vi.spyOn(utilsModule, 'findGroupByUsername').mockResolvedValue([] as any);
    vi.spyOn(prisma.assignment, 'findMany').mockRejectedValue(new Error('boom'));

    const res = await request(app)
      .get('/api/v1/allocation/history/run-1')
      .set('Authorization', makeAuthHeader());

    expect(res.status).toBe(500);
    expect(res.body.ok).toBe(false);
    expect(res.body.error).toMatch(/failed/i);
  });
});
