import { describe, it, expect, vi, beforeAll } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { getServer, getUtils } from './helpers';

type UtilsModule = Awaited<ReturnType<typeof getUtils>>;

let prisma: PrismaClient;
let utilsModule: UtilsModule;
let fetchRecords: UtilsModule['fetchRecords'];
let clearDatabase: UtilsModule['clearDatabase'];

beforeAll(async () => {
  ({ prisma } = await getServer());
  utilsModule = await getUtils();
  fetchRecords = utilsModule.fetchRecords;
  clearDatabase = utilsModule.clearDatabase;
});

describe('services/utils', () => {
  it('throws for invalid table in fetchRecords', () => {
    // @ts-expect-error invalid table on purpose
    expect(() => fetchRecords('nope')).toThrow(/Invalid table/);
  });

  it('adds _count include for list relations (skill)', async () => {
    const spy = vi.spyOn(prisma.skill, 'findMany').mockResolvedValue([] as any);
    await fetchRecords('skill');
    expect(spy).toHaveBeenCalledTimes(1);
    const args = spy.mock.calls[0]?.[0] as any;
    expect(args?.include?._count?.select?.groupSkills).toBe(true);
    expect(args?.include?._count?.select?.requiredBy).toBe(true);
  });

  it('adds extra include for relations (group_preference)', async () => {
    const spy = vi.spyOn(prisma.groupPreference, 'findMany').mockResolvedValue([] as any);
    await fetchRecords('group_preference');
    const args = spy.mock.calls[0]?.[0] as any;
    expect(args?.include?.group?.select?.name).toBe(true);
    expect(args?.include?.project?.select?.title).toBe(true);
  });

  it('clearDatabase issues expected delete operations inside a transaction', async () => {
    const mkDel = () => vi.fn().mockResolvedValue({});
    const tx = {
      groupPreference: { deleteMany: mkDel() },
      groupAvailability: { deleteMany: mkDel() },
      groupMember: { deleteMany: mkDel() },
      groupTag: { deleteMany: mkDel() },
      group: { deleteMany: mkDel() },
      projectRequiredSkill: { deleteMany: mkDel() },
      project: { deleteMany: mkDel() },
      groupSkill: { deleteMany: mkDel() },
      skill: { deleteMany: mkDel() },
      user: { deleteMany: mkDel() },
      criteriaWeights: { deleteMany: mkDel() },
      lock: { deleteMany: mkDel() },
    } as any;

    const trxSpy = vi
      .spyOn(prisma, '$transaction')
      .mockImplementation(async (cb: any) => cb(tx));

    await clearDatabase();

    expect(trxSpy).toHaveBeenCalledTimes(1);
    // spot check a few critical calls
    expect(tx.groupPreference.deleteMany).toHaveBeenCalled();
    expect(tx.group.deleteMany).toHaveBeenCalled();
    expect(tx.project.deleteMany).toHaveBeenCalled();
    expect(tx.skill.deleteMany).toHaveBeenCalled();
  });
});
