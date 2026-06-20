import {Router} from "express";
import axios from "axios";
import {prisma} from "../server.js";

const router = Router();
const ALLOCATOR_URL = process.env.ALLOCATOR_URL || "http://localhost:8000/v1/allocate";

router.post("/", async (req, res) => {
  try {
    const runId = req.body.runId ?? `run_${Date.now()}`;

    const [groups, members, gPrefs, gAvails, gSkills, projects, reqSkills, weights] =
      await Promise.all([
        prisma.group.findMany(),
        prisma.groupMember.findMany(),
        prisma.groupPreference.findMany(),
        prisma.groupAvailability.findMany(),
        prisma.groupSkill.findMany(),
        prisma.project.findMany(),
        prisma.projectRequiredSkill.findMany(),
        prisma.criteriaWeights.findUnique({where: {id: "default"}}),
      ]);

    const groupsPayload = groups.map((g) => ({
      id: g.id,
      members: members.filter((m) => m.groupId === g.id).map((m) => m.userId),
      skills: gSkills
        .filter((s) => s.groupId === g.id)
        .map((s) => ({ skillId: s.skillId, level: s.level })),
      availability: gAvails
        .filter((a) => a.groupId === g.id)
        .map((a) => ({
          fromWeek: a.fromWeek,
          toWeek: a.toWeek,
          hoursPerWeek: a.hoursPerWeek,
        })),
      preferences: gPrefs
        .filter((p) => p.groupId === g.id)
        .map((p) => ({projectId: p.projectId, rank: p.rank ?? undefined})),
    }));

    const projectsPayload = projects.map((p) => ({
      id: p.id,
      title: p.title,
      capacitySlots: p.capacitySlots,
      estimatedHoursPerWeek: p.estimatedHoursPerWeek,
      priority: p.priority,
      requiredSkills: reqSkills
        .filter((rs) => rs.projectId === p.id)
        .map((rs) => ({
          skillId: rs.skillId,
          minLevel: rs.minLevel,
          importance: rs.importance,
        })),
    }));

    const criteria = {
      weight_skill: weights?.weightSkill ?? 0.5,
      weight_preference: weights?.weightPreference ?? 0.25,
      weight_workload: weights?.weightWorkload ?? 0.15,
      weight_priority: weights?.weightPriority ?? 0.1,
      avoid_penalty: weights?.avoidPenalty ?? -1,
    };

    const payload = {
      runId,
      criteria,
      groups: groupsPayload,
      projects: projectsPayload,
    };

    const {data} = await axios.post(
      `${ALLOCATOR_URL}/v1/allocate`,
      payload,
      {timeout: 60000}
    ).catch(err => {
      console.error("Allocator API Error:", err.response?.data || err.message);
      throw err;
    });

    await prisma.$transaction(async (tx) => {
      await tx.assignment.deleteMany({where: {runId}});

      for (const a of data.allocations ?? []) {
        await tx.assignment.create({
          data: {
            runId,
            groupId: a.groupId,
            projectId: a.projectId,
            status: a.status,
            score: a.score,
            skillFit: a.skill_fit,
            prefTerm: a.pref_term,
            workloadTerm: a.workload_term,
            priorityTerm: a.priority_term,
          },
        });
      }
    });

    res.json({
      ok: true,
      runId,
      ...data
    });

    // await prisma.$transaction(async (tx) => {
    //   await tx.assignment.deleteMany({});
    //   await tx.groupPreference.deleteMany({});
    //   await tx.groupAvailability.deleteMany({});
    //   await tx.groupMember.deleteMany({});
    //   await tx.group.deleteMany({});
    //   await tx.projectRequiredSkill.deleteMany({});
    //   await tx.project.deleteMany({});
    //   await tx.groupSkill.deleteMany({});
    //   await tx.skill.deleteMany({});
    //   await tx.user.deleteMany({});
    //   await tx.criteriaWeights.deleteMany({});
    //   await tx.lock.deleteMany({});
    // });
    // console.log("Deleted Transactions")

  } catch (err: any) {
    console.error("Allocation Failed:", err.message);
    res.status(502).json({
      ok: false,
      message: "Allocation Service Unavailable",
      error: err.message,
    });
  }
});

export default router;
