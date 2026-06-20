import fs from "fs";
import path from "path";
import {parse} from "csv-parse/sync";
import {prisma} from "../server.js";

type ImportError = {file: string; row: number; message: string};

const isInt = (v: any) => /^\d+$/.test(String(v));
const inRange = (n: number, lo: number, hi: number) => n >= lo && n <= hi;

function assertHeaders(actual: string[], expected: string[], file: string) {
  const missing = expected.filter(h => !actual.includes(h));
  const extra = actual.filter(h => !expected.includes(h));
  if (missing.length || extra.length) {
    throw new Error(`[${file}] header mismatch. Missing: ${missing.join(", ")}; Extra: ${extra.join(", ")}`);
  }
}

function writeErrorCsv(file: string, errors: ImportError[]): string {
  const out = ["file, row, message", ...errors.map(e => `${e.file}, ${e.row}, "${e.message.replace(/"/g,'""')}"`)].join("\n");
  const p = path.join("/tmp", `errors_${path.basename(file)}.csv`);
  fs.writeFileSync(p, out, "utf8");
  return p;
}

export type ImportReport = {
  ok: boolean;
  errors: ImportError[];
  errorFiles: {file: string; path: string}[];
  counts: Record<string, number>;
  fileCount: number;
};

export async function runImport(files: Record<string, string>, isBatch: boolean = false): Promise<ImportReport> {
  const errors: ImportError[] = [];
  const errorFiles: {file: string; path: string}[] = [];
  const counts: Record<string, number> = {};
  let fileCount: number = 0;

  const order = [
    "users.csv", "skills.csv", "projects.csv", "project_required_skills.csv",
    "groups.csv", "group_members.csv", "group_skills.csv", "group_preferences.csv",
    "group_availability.csv", "criteria_weights.csv", "locks.csv", "group_tags.csv"
  ];

  console.log("Files received:", Object.keys(files));

  const data: Record<string, any[]> = {};
  for (const f of order) {
    if (!files[f]) continue;
    const raw = fs.readFileSync(files[f], "utf8");
    const records = parse(raw, {columns: true, skip_empty_lines: true, trim: true});
    data[f] = records;
  }

    console.log("Data loaded:", Object.keys(data));
    for (const [file, records] of Object.entries(data)) {
      console.log(`${file}: ${records.length} records`);
      if (records.length > 0) {
        console.log(`  First record:`, JSON.stringify(records[0]));
      }
    }

  try {
    if (data["users.csv"]?.length) {
      const expected = ["user_id", "full_name", "email", "cohort", "role", "seniority"];
      assertHeaders(Object.keys(data["users.csv"][0]), expected, "users.csv");
      data["users.csv"].forEach((r, i) => {
        if (!r.user_id) errors.push({file:"users.csv", row:i + 2, message: "user_id required"});
        if (!r.full_name) errors.push({file:"users.csv", row:i + 2, message: "full_name required"});
      });
    }

    if (data["skills.csv"]?.length) {
      const headers = Object.keys(data["skills.csv"][0]);
      if (headers.includes("skill_name")) {
        assertHeaders(headers, ["skill_id", "skill_name", "category", "description"], "skills.csv");
      } else {
        assertHeaders(headers, ["skill_id", "name", "category", "description"], "skills.csv");
      }
      fileCount += 1;
    }

    if (data["projects.csv"]?.length) {
      const expected = ["project_id", "title", "client_org", "supervisor", "capacity_slots", "estimated_hours_per_week", "priority", "cohort", "due_week", "tags", "description"];
      assertHeaders(Object.keys(data["projects.csv"][0]), expected, "projects.csv");
      data["projects.csv"].forEach((r, i) => {
        if (!isInt(r.capacity_slots) || Number(r.capacity_slots) < 1)
          errors.push({file: "projects.csv", row: i + 2, message: "capacity_slots must be >=1"});
        const pr = Number(r.priority ?? 0);
        if (isNaN(pr) || pr < 0 || pr > 1)
          errors.push({file: "projects.csv", row: i + 2, message: "priority must be 0..1"});
      });
      fileCount += 1;
    }

    if (data["project_required_skills.csv"]?.length) {
      const expected = ["project_id", "skill_id", "min_level", "importance"];
      assertHeaders(Object.keys(data["project_required_skills.csv"][0]), expected, "project_required_skills.csv");

      let projIds: Set<string> = new Set();
      let skillIds: Set<string> = new Set();

      if (isBatch) {
        projIds = new Set((data["projects.csv"]??[]).map(r=>r.project_id));
        skillIds = new Set((data["skills.csv"]??[]).map(r=>r.skill_id));
      }

      const dbProjIds = new Set(
        (await prisma.project.findMany({select: {id: true}})).map(p => p.id)
      );
      const dbSkillIds = new Set(
        (await prisma.skill.findMany({select: {id: true}})).map(s => s.id)
      );

      const allProjIds = new Set([...projIds, ...dbProjIds]);
      const allSkillIds = new Set([...skillIds, ...dbSkillIds]);

      data["project_required_skills.csv"].forEach((r, i) => {
        if (!allProjIds.has(r.project_id))
          errors.push({file: "project_required_skills.csv", row: i + 2, message: `FK project_id ${r.project_id} not found`});
        if (!allSkillIds.has(r.skill_id))
          errors.push({file: "project_required_skills.csv", row: i + 2, message: `FK skill_id ${r.skill_id} not found`});
        const lvl = Number(r.min_level); if (!inRange(lvl,1,5))
          errors.push({file: "project_required_skills.csv", row: i + 2, message: "min_level must be 1..5"});
        const imp = Number(r.importance);
        if (isNaN(imp) || imp < 0 || imp > 1)
          errors.push({file: "project_required_skills.csv", row: i + 2, message: "importance must be 0..1"});
      });

      fileCount += 1;
    }

    if (data["group_tags.csv"]?.length) {
      const expected = ["group_tag"];
      assertHeaders(Object.keys(data["group_tags.csv"][0]), expected, "group_tags.csv");
      fileCount += 1;
    }

    if (data["groups.csv"]?.length) {
      const expected = ["group_id", "group_name"];
      assertHeaders(Object.keys(data["groups.csv"][0]), expected, "groups.csv");
    }

    if (data["group_members.csv"]?.length) {
      const expected = ["group_id", "user_id", "member_role"];
      assertHeaders(Object.keys(data["group_members.csv"][0]), expected, "group_members.csv");
      const groupIds = new Set((data["groups.csv"]??[]).map(r=>r.group_id));
      const userIds  = new Set((data["users.csv"]??[]).map(r=>r.user_id));
      data["group_members.csv"].forEach((r, i) => {
        if (!groupIds.has(r.group_id))
          errors.push({file: "group_members.csv", row: i + 2, message: `FK group_id ${r.group_id} not found`});
        if (!userIds.has(r.user_id))
          errors.push({file: "group_members.csv", row: i + 2, message: `FK user_id ${r.user_id} not found`});
      });
    }

    if (data["group_skills.csv"]?.length) {
      const expected = ["group_id", "skill_id", "level"];
      assertHeaders(Object.keys(data["group_skills.csv"][0]), expected, "group_skills.csv");
      const groupIds = new Set((data["groups.csv"] ?? []).map(r => r.group_id));
      const skillIds = new Set((data["skills.csv"] ?? []).map(r => r.skill_id));
      data["group_skills.csv"].forEach((r, i) => {
        if (!groupIds.has(r.group_id))
          errors.push({file: "group_skills.csv", row: i + 2, message: `FK group_id ${r.group_id} not found`});
        if (!skillIds.has(r.skill_id))
          errors.push({file: "group_skills.csv", row: i + 2, message: `FK skill_id ${r.skill_id} not found`});
        const lvl = Number(r.level); if (!inRange(lvl,1,5))
          errors.push({file: "group_skills.csv", row: i + 2, message: "level must be 1..5"});
      });
    }

    if (data["group_preferences.csv"]?.length) {
      const expected = ["group_id", "project_id", "rank"];
      assertHeaders(Object.keys(data["group_preferences.csv"][0]), expected, "group_preferences.csv");
      const groupIds = new Set((data["groups.csv"]??[]).map(r => r.group_id));
      const projIds  = new Set((data["projects.csv"]??[]).map(r => r.project_id));
      data["group_preferences.csv"].forEach((r, i) => {
        if (!groupIds.has(r.group_id))
          errors.push({file: "group_preferences.csv", row: i + 2, message: `FK group_id ${r.group_id} not found`});
        if (!projIds.has(r.project_id))
          errors.push({file: "group_preferences.csv", row: i + 2, message: `FK project_id ${r.project_id} not found`});
        if (!r.rank || !isInt(r.rank) || Number(r.rank) < 1)
          errors.push({file: "group_preferences.csv", row: i + 2, message: "rank must be integer >=1 if provided"});
      });
    }

    if (data["group_availability.csv"]?.length) {
      const expected = ["group_id", "from_week", "to_week", "hours_per_week"];
      assertHeaders(Object.keys(data["group_availability.csv"][0]), expected, "group_availability.csv");
      const groupIds = new Set((data["groups.csv"]??[]).map(r => r.group_id));
      data["group_availability.csv"].forEach((r, i) => {
        if (!groupIds.has(r.group_id))
          errors.push({file: "group_availability.csv", row: i + 2, message: `FK group_id ${r.group_id} not found`});
        const from = Number(r.from_week), to = Number(r.to_week);
        if (!inRange(from, 2, 12) || !inRange(to, 2, 12))
          errors.push({file: "group_availability.csv", row: i + 2, message: "weeks must be 2..12"});
        if (from > to)
          errors.push({file: "group_availability.csv", row: i + 2, message: "from_week must be <= to_week"});
      });
    }

    if (data["criteria_weights.csv"]?.length) {
      const expected = ["weight_skill", "weight_preference", "weight_workload", "weight_priority", "avoid_penalty"];
      assertHeaders(Object.keys(data["criteria_weights.csv"][0]), expected, "criteria_weights.csv");
      data["criteria_weights.csv"].forEach((r, i) => {
        ["weight_skill", "weight_preference", "weight_workload", "weight_priority"].forEach(k => {
          const v = Number(r[k]); if (isNaN(v) || v < 0 || v > 1)
            errors.push({file: "criteria_weights.csv", row: i + 2, message: `${k} must be 0..1`});
        });
        const ap = Number(r.avoid_penalty);
        if (!(ap <= 0)) errors.push({file: "criteria_weights.csv", row: i + 2, message: "avoid_penalty must be <= 0"});
      });

      fileCount += 1;
    }

    if (data["locks.csv"]?.length) { // optional
      const expected = ["project_id", "group_id", "status"];
      assertHeaders(Object.keys(data["locks.csv"][0]), expected, "locks.csv");
    }

  } catch (e: any) {
    errors.push({ file: "global", row: 0, message: e.message });
  }

  if (errors.length) {
    const byFile = new Map<string, ImportError[]>();
    errors.forEach(e => {
      const list = byFile.get(e.file) ?? [];
      list.push(e);
      byFile.set(e.file, list);
    });

    for (const [file, list] of byFile) {
      errorFiles.push({file, path: writeErrorCsv(file, list)});
    }
    return {ok: false, errors, errorFiles, counts, fileCount};
  }

  await prisma.$transaction(async (tx) => {
    // await tx.assignment.deleteMany({});
    // await tx.groupPreference.deleteMany({});
    // await tx.groupAvailability.deleteMany({});
    // await tx.groupMember.deleteMany({});
    // await tx.group.deleteMany({});
    // await tx.projectRequiredSkill.deleteMany({});
    // await tx.project.deleteMany({});
    // await tx.userSkill.deleteMany({});
    // await tx.skill.deleteMany({});
    // await tx.user.deleteMany({});
    // await tx.criteriaWeights.deleteMany({});
    // await tx.lock.deleteMany({});

    for (const r of (data["users.csv"] ?? [])) {
      await tx.user.create({data: {
        id: r.user_id,
        fullName: r.full_name,
        email: r.email,
        cohort: r.cohort || null,
        role: r.role || null,
        seniority: r.seniority || null
      }});
    }
    counts.users = (data["users.csv"] ?? []).length;

    const skillRows = data["skills.csv"] ?? [];
    for (const r of skillRows) {
      await tx.skill.create({data: {
        id: r.skill_id,
        name: r.name ?? r.skill_name,
        category: r.category || null,
        description: r.description || null
      }});
    }
    counts.skills = skillRows.length;

    for (const r of (data["projects.csv"] ?? [])) {
    const data: any = {
        id: r.project_id,
        title: r.title,
        client_org: r.client_org || null,
        supervisor: r.supervisor || null,
        capacitySlots: Number(r.capacity_slots),
        estimatedHoursPerWeek: Number(r.estimated_hours_per_week),
        priority: Number(r.priority ?? 0),
        cohort: r.cohort || null,
        tags: r.tags || null,
        description: r.description || null,
    };

    if (r.due_week) { // check if actually optional
        data.dueWeek = Number(r.due_week);
    }

    await tx.project.create({data});
    }
    counts.projects = (data["projects.csv"] ?? []).length;

    for (const r of (data["project_required_skills.csv"] ?? [])) {
      await tx.projectRequiredSkill.create({data: {
        projectId: r.project_id, skillId: r.skill_id,
        minLevel: Number(r.min_level),
        importance: Number(r.importance)
      }});
    }

    for (const r of (data["group_tags.csv"] ?? [])) {
      await tx.groupTag.create({data: {groupTag: r.group_tag}});
    }

    for (const r of (data["groups.csv"] ?? [])) {
      await tx.group.create({data: {id: r.group_id, name: r.group_name}});
    }
    
    for (const r of (data["group_members.csv"] ?? [])) {
      await tx.groupMember.create({data: {groupId: r.group_id, userId: r.user_id, memberRole: r.member_role}});
    }

    for (const r of (data["group_skills.csv"] ?? [])) {
      await tx.groupSkill.create({data: {
        groupId: r.group_id, skillId: r.skill_id, level: Number(r.level)
      }});
    }

    for (const r of (data["group_preferences.csv"] ?? [])) {
      await tx.groupPreference.create({data: {
        groupId: r.group_id, projectId: r.project_id, rank: Number(r.rank)
      }});
    }

    for (const r of (data["group_availability.csv"] ?? [])) {
      await tx.groupAvailability.create({data: {
        groupId: r.group_id,
        fromWeek: Number(r.from_week),
        toWeek: Number(r.to_week),
        hoursPerWeek: Number(r.hours_per_week)
      }});
    }

    if ((data["criteria_weights.csv"] ?? []).length) {
      const w = data["criteria_weights.csv"][0];

      const weights = {
        weightSkill: Number(w.weight_skill),
        weightPreference: Number(w.weight_preference),
        weightWorkload: Number(w.weight_workload),
        weightPriority: Number(w.weight_priority),
        avoidPenalty: Number(w.avoid_penalty)
      };

      await prisma.criteriaWeights.upsert({
        where: { id: "default" },
        create: { id: "default", ...weights },
        update: { ...weights },
      });

      // await tx.criteriaWeights.create({data: {
      //   id: "default",
      //   weightSkill: Number(w.weight_skill),
      //   weightPreference: Number(w.weight_preference),
      //   weightWorkload: Number(w.weight_workload),
      //   weightPriority: Number(w.weight_priority),
      //   avoidPenalty: Number(w.avoid_penalty)
      // }});
    }

    for (const r of (data["locks.csv"] ?? [])) {
      await tx.lock.create({data: {
        projectId: r.project_id, groupId: r.group_id, status: r.status
      }});
    }
  });

  return {ok: true, errors: [], errorFiles: [], counts, fileCount};
  
}
