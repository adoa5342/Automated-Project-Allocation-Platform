import request from 'supertest';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import jwt from 'jsonwebtoken';
import axios from 'axios';
import type { Express } from 'express';
import type { PrismaClient } from '@prisma/client';
import { getServer } from './helpers';

let app: Express;
let prisma: PrismaClient;

beforeAll(async () => {
  ({ app, prisma } = await getServer());
});

describe('POST /api/v1/allocate', () => {
  it('saves assignments from allocator response', async () => {
    const token = jwt.sign({ userId: 'u1', username: 'admin' }, process.env.JWT_SECRET || 'test-secret');

    // Mock DB reads
    vi.spyOn(prisma.group, 'findMany').mockResolvedValue([{ id: 'g1', name: 'G1' }] as any);
    vi.spyOn(prisma.groupMember, 'findMany').mockResolvedValue([{ groupId: 'g1', userId: 'u1' }] as any);
    vi.spyOn(prisma.groupPreference, 'findMany').mockResolvedValue([] as any);
    vi.spyOn(prisma.groupAvailability, 'findMany').mockResolvedValue([] as any);
    vi.spyOn(prisma.groupSkill, 'findMany').mockResolvedValue([] as any);
    vi.spyOn(prisma.project, 'findMany').mockResolvedValue([{ id: 'p1', title: 'P1', capacitySlots: 1, estimatedHoursPerWeek: 5, priority: 0.5 }] as any);
    vi.spyOn(prisma.projectRequiredSkill, 'findMany').mockResolvedValue([] as any);
    vi.spyOn(prisma.criteriaWeights, 'findUnique').mockResolvedValue({
      id: 'default', weightSkill: 0.5, weightPreference: 0.25, weightWorkload: 0.15, weightPriority: 0.1, avoidPenalty: -1,
    } as any);

    // Mock allocator
    const postSpy = vi.spyOn(axios, 'post').mockResolvedValue({
      data: {
        allocations: [
          {
            groupId: 'g1',
            projectId: 'p1',
            status: 'proposed',
            score: 0.9,
            skill_fit: 0.8,
            pref_term: 0.7,
            workload_term: 0.6,
            priority_term: 0.5,
          },
        ],
      },
    } as any);

    // Mock writes
    const tx = {
      assignment: {
        deleteMany: vi.fn().mockResolvedValue({}),
        create: vi.fn().mockResolvedValue({}),
      },
    } as any;
    vi.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => cb(tx));

    const res = await request(app)
      .post('/api/v1/allocate')
      .set('Authorization', `Bearer ${token}`)
      .send({ runId: 'runX' });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.runId).toBe('runX');
    expect(postSpy).toHaveBeenCalled();
    expect(tx.assignment.deleteMany).toHaveBeenCalledWith({ where: { runId: 'runX' } });
    expect(tx.assignment.create).toHaveBeenCalledTimes(1);
  });
});
