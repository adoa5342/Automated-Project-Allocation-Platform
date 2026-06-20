import { group } from "console";
import {prisma} from "../server.js";

const ALLOWED: ReadonlySet<TableKey> = new Set<TableKey>([
  "user",
  "skill",
  "project",
  "project_required_skill",
  "criteria_weights",
  "group_tag",
  "group",
  "group_preference",
  "group_skill",
  "group_availability",
  "group_member",
  "assignment",
]);

const COUNT_MAP: Record<TableKey, readonly string[]> = {
  user: [],
  skill: ["groupSkills", "requiredBy"],
  project: [],
  project_required_skill: [],
  criteria_weights: [],
  group_tag: [],
  group: ["members", "skills", "availability", "preferences"],
  group_preference: [],
  group_skill: [],
  group_availability: [],
  group_member: [],
  assignment: [],
};

const INCLUDE_MAP: Partial<Record<TableKey, object>> = {
  project_required_skill: {
    project: {select: {id: true, title: true}},
    skill:   {select: {id: true, name: true}},
  },
  group: {
    Assignment: {select: {projectId: true}},
  },
  group_member: {
    group: {select: {name: true}},
    user: {select: {fullName: true}},
  },
  group_skill: {
    group: {select: {name: true}},
    skill: {select: {name: true}},
  },
  group_preference: {
    group: {select: {name: true}},
    project: {select: {title: true}},
  },
  group_availability: {
    group: {select: {name: true}},
  }
};

function getModel() {
  return {
    user: prisma.user,
    skill: prisma.skill,
    project: prisma.project,
    project_required_skill: prisma.projectRequiredSkill,
    criteria_weights: prisma.criteriaWeights,
    group_tag: prisma.groupTag,
    group: prisma.group,
    group_preference: prisma.groupPreference,
    group_skill: prisma.groupSkill,
    group_availability: prisma.groupAvailability,
    group_member: prisma.groupMember,
    assignment: prisma.assignment,
  };
}

export async function clearDatabase() {
    await prisma.$transaction(async (tx) => {
        await tx.groupPreference.deleteMany({ where: { groupId: { not: "ISYS3888_T13_03" } } });
        await tx.groupAvailability.deleteMany({ where: { groupId: { not: "ISYS3888_T13_03" } }});
        await tx.groupMember.deleteMany({ where: { groupId: { not: "ISYS3888_T13_03" } }});
        await tx.groupTag.deleteMany({ where: { groupTag: { not: "ISYS3888_T13_03" } }});
        await tx.group.deleteMany({ where: { id: { not: "ISYS3888_T13_03" } }});
        await tx.projectRequiredSkill.deleteMany({ where: { projectId: { not: { in: ["P001", "P002"] } }}});
        await tx.project.deleteMany({ where: { id: { not: "P001" } }});
        await tx.groupSkill.deleteMany({ where: { groupId: { not: "ISYS3888_T13_03" } }});
        await tx.skill.deleteMany({ where: { id: { not: { in: ["S001", "S002"] } }}});
        await tx.user.deleteMany({ where: { id: { not: { in: ["some_unikey1", "some_unikey2", "some_unikey3", "some_unikey4", "some_unikey5"] } } } });
        await tx.criteriaWeights.deleteMany({});
        await tx.lock.deleteMany({});
    });
}

export async function findGroupByUsername(username: string) {
  try {
    const account = await prisma.account.findUnique({
      where: { username: username },
      select: { userId: true }
    });

    if (!account || !account.userId) {
      return [];
    }

    const groupMember = await prisma.groupMember.findFirst({
      where: { userId: account.userId },
      select: { groupId: true }
    });

    if (!groupMember) {
      return [];
    }

    const group = await prisma.group.findMany({
      where: { id: groupMember.groupId },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                email: true
              }
            }
          }
        }
      }
    });

    return group;

  } catch (error) {
    console.error('Error Finding Group By Username: ', error);
    return [];
  }
}

export type ModelMap = ReturnType<typeof getModel>;
export type TableKey = keyof ModelMap;
type Delegate<K extends TableKey> = ModelMap[K];
export type FindManyArgs<K extends TableKey> = Parameters<Delegate<K>["findMany"]>[0];
export type FindManyReturn<K extends TableKey> = ReturnType<Delegate<K>["findMany"]>;

function withCountInclude<T extends object>(args: T | undefined, relations: readonly string[]): T {
  const base: any = args ? {...args} : {};
  if (base.select) return base;

  const include = {...(base.include ?? {})};
  if (include._count === true) {
    base.include = include;
    return base;
  }

  const existingSelect = include._count?.select ?? {};
  const nextSelect = {...existingSelect};
  for (const r of relations) nextSelect[r] = true;

  include._count = {select: nextSelect};
  base.include = include;
  return base;
}

function withExtraInclude<T extends object>(args: T | undefined, extra?: object): T {
  if (!extra) return (args ?? {}) as T;
  const base: any = args ? { ...args } : {};
  if (base.select) return base;
  base.include = { ...(base.include ?? {}), ...(extra as any) };
  return base;
}

export function fetchRecords<K extends TableKey>(table: K, args?: FindManyArgs<K>): FindManyReturn<K> {
  if (!ALLOWED.has(table)) {
    throw new Error(
      `Invalid table "${String(
        table
      )}". Allowed: ${Array.from(ALLOWED).join(", ")}`
    );
  }
  const model = getModel();
  const listRels = COUNT_MAP[table] ?? [];
  const extraInc = INCLUDE_MAP[table];

  let finalArgs = args ?? ({} as any);
  if (listRels.length) finalArgs = withCountInclude(finalArgs, listRels);
  if (extraInc)        finalArgs = withExtraInclude(finalArgs, extraInc);

//   const relationsToCount = COUNT_MAP[table] ?? [];
//   const finalArgs = relationsToCount.length > 0 ? withCountInclude(args, relationsToCount) : (args ?? ({} as any));

  return (model[table] as any).findMany(finalArgs) as FindManyReturn<K>;
}