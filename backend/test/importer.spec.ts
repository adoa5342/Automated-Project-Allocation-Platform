import { describe, it, expect, vi, beforeAll } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import type { PrismaClient } from '@prisma/client';
import { getServer } from './helpers';

let prisma: PrismaClient;
let runImport: (files: Record<string, string>, isBatch: boolean) => Promise<any>;

beforeAll(async () => {
  ({ prisma } = await getServer());
  ({ runImport } = await import('../src/services/importer'));
});

function writeCsv(tmp: string, name: string, content: string) {
  const p = path.join(tmp, name);
  fs.writeFileSync(p, content, 'utf8');
  return p;
}

describe('services/importer', () => {
  it('returns errors and writes error CSVs on header mismatch', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'import-test-'));
    const usersPath = writeCsv(
      tmp,
      'users.csv',
      // wrong header: missing full_name
      'user_id,email,cohort,role,seniority\nuid1,u1@example.com,2025,student,ug\n'
    );

    const report = await runImport({ 'users.csv': usersPath }, true);
    expect(report.ok).toBe(false);
    expect(report.errors.length).toBeGreaterThan(0);
    // For header-level errors importer currently aggregates under a global file key
    expect(report.errorFiles.length).toBeGreaterThan(0);
    expect(report.errorFiles.some(f => f.path.includes('/tmp/'))).toBe(true);
  });

  it('imports minimal sets with isBatch=true and counts records', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'import-ok-'));
    const usersPath = writeCsv(
      tmp,
      'users.csv',
      'user_id,full_name,email,cohort,role,seniority\nuid1,User One,u1@example.com,2025,student,ug\n'
    );
    const skillsPath = writeCsv(
      tmp,
      'skills.csv',
      'skill_id,skill_name,category,description\ns1,Skill One,Cat,Desc\n'
    );

    // Mock the transaction to avoid real DB writes
    const tx = {
      user: { create: vi.fn().mockResolvedValue({}) },
      skill: { create: vi.fn().mockResolvedValue({}) },
      project: { create: vi.fn().mockResolvedValue({}) },
      projectRequiredSkill: { create: vi.fn().mockResolvedValue({}) },
      groupTag: { create: vi.fn().mockResolvedValue({}) },
      group: { create: vi.fn().mockResolvedValue({}) },
      groupMember: { create: vi.fn().mockResolvedValue({}) },
      groupSkill: { create: vi.fn().mockResolvedValue({}) },
      groupPreference: { create: vi.fn().mockResolvedValue({}) },
      groupAvailability: { create: vi.fn().mockResolvedValue({}) },
      criteriaWeights: { create: vi.fn().mockResolvedValue({}) },
      lock: { create: vi.fn().mockResolvedValue({}) },
    } as any;

    vi.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => cb(tx));

    const report = await runImport({ 'users.csv': usersPath, 'skills.csv': skillsPath }, true);
    expect(report.ok).toBe(true);
    expect(report.counts.users).toBe(1);
    expect(report.counts.skills).toBe(1);
    expect(tx.user.create).toHaveBeenCalledTimes(1);
    expect(tx.skill.create).toHaveBeenCalledTimes(1);

    vi.restoreAllMocks();
  });

  it('allows multiple imports to process in parallel without conflicts', async () => {
    const dirs = Array.from({ length: 3 }, (_, idx) => {
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), `import-concurrent-${idx}-`));
      const usersPath = writeCsv(
        tmp,
        'users.csv',
        `user_id,full_name,email,cohort,role,seniority\nuid${idx},User ${idx},u${idx}@example.com,2025,student,ug\n`
      );
      const skillsPath = writeCsv(
        tmp,
        'skills.csv',
        `skill_id,skill_name,category,description\ns${idx},Skill ${idx},Cat,Desc\n`
      );
      return { tmp, files: { 'users.csv': usersPath, 'skills.csv': skillsPath } };
    });

    const txMocks: Array<Record<string, any>> = [];

    const transactionSpy = vi
      .spyOn(prisma, '$transaction')
      .mockImplementation(async (cb: any) => {
        const tx = {
          user: { create: vi.fn().mockResolvedValue({}) },
          skill: { create: vi.fn().mockResolvedValue({}) },
          project: { create: vi.fn().mockResolvedValue({}) },
          projectRequiredSkill: { create: vi.fn().mockResolvedValue({}) },
          groupTag: { create: vi.fn().mockResolvedValue({}) },
          group: { create: vi.fn().mockResolvedValue({}) },
          groupMember: { create: vi.fn().mockResolvedValue({}) },
          groupSkill: { create: vi.fn().mockResolvedValue({}) },
          groupPreference: { create: vi.fn().mockResolvedValue({}) },
          groupAvailability: { create: vi.fn().mockResolvedValue({}) },
          criteriaWeights: { create: vi.fn().mockResolvedValue({}) },
          lock: { create: vi.fn().mockResolvedValue({}) },
        } as any;
        txMocks.push(tx);
        // simulate longer running transactions to surface concurrency issues
        await new Promise((resolve) => setTimeout(resolve, 10));
        return cb(tx);
      });

    const results = await Promise.all(
      dirs.map(({ files }) => runImport(files, true))
    );

    results.forEach((report, idx) => {
      expect(report.ok).toBe(true);
      expect(report.counts.users).toBe(1);
      expect(report.counts.skills).toBe(1);
    });

    expect(transactionSpy).toHaveBeenCalledTimes(3);
    const createdUserIds = txMocks
      .map((tx) => tx.user.create.mock.calls[0]?.[0]?.data?.id)
      .filter(Boolean)
      .sort();
    expect(createdUserIds).toEqual(['uid0', 'uid1', 'uid2']);

    const createdSkillIds = txMocks
      .map((tx) => tx.skill.create.mock.calls[0]?.[0]?.data?.id)
      .filter(Boolean)
      .sort();
    expect(createdSkillIds).toEqual(['s0', 's1', 's2']);

    vi.restoreAllMocks();
  });
});
