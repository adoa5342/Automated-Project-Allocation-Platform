import request from 'supertest';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import type { Express } from 'express';
import type { PrismaClient } from '@prisma/client';
import { getServer } from './helpers';

let app: Express;
let prisma: PrismaClient;

beforeAll(async () => {
  ({ app, prisma } = await getServer());
});

describe('/api/v1/student-survey endpoints', () => {
  it('GET /skills returns list of skills', async () => {
    const skills = [{ id: 's1', name: 'Skill A' }];
    vi.spyOn(prisma.skill, 'findMany').mockResolvedValue(skills as any);

    const res = await request(app).get('/api/v1/student-survey/skills');
    expect(res.status).toBe(200);
    expect(res.body.skills).toEqual(skills);
  });

  it('GET /projects maps project titles to names', async () => {
    vi.spyOn(prisma.project, 'findMany').mockResolvedValue([
      { id: 'p1', title: 'Project One' },
    ] as any);

    const res = await request(app).get('/api/v1/student-survey/projects');
    expect(res.status).toBe(200);
    expect(res.body.projects).toEqual([{ id: 'p1', name: 'Project One' }]);
  });

  it('GET /groups returns sorted group tags', async () => {
    vi.spyOn(prisma.groupTag, 'findMany').mockResolvedValue([
      { groupTag: 'Tag A' },
    ] as any);

    const res = await request(app).get('/api/v1/student-survey/groups');
    expect(res.status).toBe(200);
    expect(res.body.tags).toEqual([{ groupTag: 'Tag A' }]);
  });

  it('POST /submit validates required fields', async () => {
    const res = await request(app)
      .post('/api/v1/student-survey/submit')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.ok).toBe(false);
    expect(res.body.error).toMatch(/groupname/i);
  });

  it('POST /submit persists survey data via transaction', async () => {
    const tx = {
      group: { upsert: vi.fn().mockResolvedValue({ id: 'G1', name: 'Group 1' }) },
      groupTag: { upsert: vi.fn().mockResolvedValue({}) },
      groupMember: {
        deleteMany: vi.fn().mockResolvedValue({}),
        upsert: vi.fn().mockResolvedValue({}),
      },
      user: {
        upsert: vi.fn().mockResolvedValue({ id: 'user-1' }),
      },
      groupSkill: {
        deleteMany: vi.fn().mockResolvedValue({}),
        create: vi.fn().mockResolvedValue({}),
      },
      skill: {
        upsert: vi.fn().mockResolvedValue({}),
      },
      groupAvailability: {
        deleteMany: vi.fn().mockResolvedValue({}),
        create: vi.fn().mockResolvedValue({}),
      },
      groupPreference: {
        deleteMany: vi.fn().mockResolvedValue({}),
        create: vi.fn().mockResolvedValue({}),
      },
    } as any;

    vi.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => cb(tx));

    const payload = {
      groupName: 'G1',
      students: [
        {
          fullName: 'Alice',
          email: 'alice@example.com',
          role: 'leader',
          cohort: '2025',
          seniority: '3',
        },
      ],
      topProjects: ['P1', 'P2'],
      availability: {
        fromWeek: 1,
        toWeek: 12,
        hoursPerWeek: 10,
      },
      skills: [
        {
          id: 'S1',
          name: 'Skill One',
          level: 4,
        },
      ],
    };

    const res = await request(app)
      .post('/api/v1/student-survey/submit')
      .send(payload);

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.groupId).toBe('G1');
    expect(tx.group.upsert).toHaveBeenCalledTimes(1);
    expect(tx.groupTag.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { groupTag: 'G1' },
    }));
    expect(tx.groupMember.deleteMany).toHaveBeenCalledWith({ where: { groupId: 'G1' } });
    expect(tx.groupMember.upsert).toHaveBeenCalledTimes(1);
    expect(tx.user.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { email: 'alice@example.com' },
    }));
    expect(tx.skill.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'S1' },
    }));
    expect(tx.groupPreference.create).toHaveBeenCalledTimes(2);
  });

  it('POST /submit allows resubmission for the same group and keeps the latest data', async () => {
    const groupUpsert = vi.fn().mockResolvedValue({ id: 'G1', name: 'Group 1' });
    const groupTagUpsert = vi.fn().mockResolvedValue({});
    const groupMemberDeleteMany = vi.fn().mockResolvedValue({});
    const groupMemberUpsert = vi.fn().mockResolvedValue({});
    const userUpsert = vi
      .fn()
      .mockImplementation(async (args: any) => ({ id: args?.create?.id ?? 'user-id' }));
    const groupSkillDeleteMany = vi.fn().mockResolvedValue({});
    const groupSkillCreate = vi.fn().mockResolvedValue({});
    const skillUpsert = vi.fn().mockResolvedValue({});
    const groupAvailabilityDeleteMany = vi.fn().mockResolvedValue({});
    const groupAvailabilityCreate = vi.fn().mockResolvedValue({});
    const groupPreferenceDeleteMany = vi.fn().mockResolvedValue({});
    const groupPreferenceCreate = vi.fn().mockResolvedValue({});

    const tx = {
      group: { upsert: groupUpsert },
      groupTag: { upsert: groupTagUpsert },
      groupMember: {
        deleteMany: groupMemberDeleteMany,
        upsert: groupMemberUpsert,
      },
      user: {
        upsert: userUpsert,
      },
      groupSkill: {
        deleteMany: groupSkillDeleteMany,
        create: groupSkillCreate,
      },
      skill: {
        upsert: skillUpsert,
      },
      groupAvailability: {
        deleteMany: groupAvailabilityDeleteMany,
        create: groupAvailabilityCreate,
      },
      groupPreference: {
        deleteMany: groupPreferenceDeleteMany,
        create: groupPreferenceCreate,
      },
    } as any;

    vi.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => cb(tx));

    const initialPayload = {
      groupName: 'G1',
      students: [
        {
          fullName: 'Alice',
          email: 'Alice@Example.com',
          role: 'leader',
          cohort: '2025',
          seniority: '3',
        },
      ],
      topProjects: ['P1'],
      availability: {
        fromWeek: 1,
        toWeek: 12,
        hoursPerWeek: 10,
      },
      skills: [
        {
          id: 'S1',
          name: 'Skill One',
          level: 4,
        },
      ],
    };

    const resFirst = await request(app)
      .post('/api/v1/student-survey/submit')
      .send(initialPayload);

    expect(resFirst.status).toBe(200);
    expect(groupMemberUpsert).toHaveBeenCalledTimes(1);
    expect(groupPreferenceCreate).toHaveBeenCalledTimes(1);
    expect(groupSkillCreate).toHaveBeenCalledTimes(1);

    groupMemberDeleteMany.mockClear();
    groupMemberUpsert.mockClear();
    userUpsert.mockClear();
    groupSkillDeleteMany.mockClear();
    groupSkillCreate.mockClear();
    skillUpsert.mockClear();
    groupAvailabilityDeleteMany.mockClear();
    groupAvailabilityCreate.mockClear();
    groupPreferenceDeleteMany.mockClear();
    groupPreferenceCreate.mockClear();

    const updatedPayload = {
      groupName: 'G1',
      students: [
        {
          fullName: 'Alice Updated',
          email: 'Alice@Example.com',
          role: 'member',
          cohort: '2026',
          seniority: '4',
        },
        {
          fullName: 'Bob',
          email: 'bob@example.com',
          role: 'leader',
          cohort: '2026',
          seniority: '2',
        },
      ],
      topProjects: ['P3', 'P4'],
      availability: {
        fromWeek: 3,
        toWeek: 10,
        hoursPerWeek: 8,
      },
      skills: [
        {
          id: 'S2',
          name: 'Skill Two',
          level: 5,
        },
      ],
    };

    const resSecond = await request(app)
      .post('/api/v1/student-survey/submit')
      .send(updatedPayload);

    expect(resSecond.status).toBe(200);
    expect(resSecond.body.groupId).toBe('G1');

    expect(groupMemberDeleteMany).toHaveBeenCalledWith({ where: { groupId: 'G1' } });
    expect(groupMemberUpsert).toHaveBeenCalledTimes(2);
    expect(groupMemberUpsert).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        create: expect.objectContaining({
          groupId: 'G1',
          userId: 'alice@example.com',
          memberRole: 'member',
        }),
      }),
    );
    expect(groupMemberUpsert).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        create: expect.objectContaining({
          groupId: 'G1',
          userId: 'bob@example.com',
          memberRole: 'leader',
        }),
      }),
    );

    expect(groupPreferenceDeleteMany).toHaveBeenCalledWith({ where: { groupId: 'G1' } });
    expect(groupPreferenceCreate).toHaveBeenCalledTimes(2);
    expect(groupPreferenceCreate).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        data: expect.objectContaining({ groupId: 'G1', projectId: 'P3', rank: 1 }),
      }),
    );
    expect(groupPreferenceCreate).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: expect.objectContaining({ groupId: 'G1', projectId: 'P4', rank: 2 }),
      }),
    );

    expect(groupAvailabilityDeleteMany).toHaveBeenCalledWith({ where: { groupId: 'G1' } });
    expect(groupAvailabilityCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          groupId: 'G1',
          fromWeek: 3,
          toWeek: 10,
          hoursPerWeek: 8,
        }),
      }),
    );

    expect(groupSkillDeleteMany).toHaveBeenCalledWith({ where: { groupId: 'G1' } });
    expect(skillUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'S2' },
        create: expect.objectContaining({ id: 'S2', name: 'Skill Two' }),
      }),
    );
    expect(groupSkillCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          groupId: 'G1',
          skillId: 'S2',
          level: 5,
        }),
      }),
    );
  });

  it('POST /submit returns 500 when transaction fails', async () => {
    vi.spyOn(prisma, '$transaction').mockRejectedValue(new Error('db down'));

    const res = await request(app)
      .post('/api/v1/student-survey/submit')
      .send({
        groupName: 'G1',
        students: [{ fullName: 'Alice', email: 'alice@example.com' }],
      });

    expect(res.status).toBe(500);
    expect(res.body.ok).toBe(false);
    expect(res.body.error).toBe('db down');
  });
});
