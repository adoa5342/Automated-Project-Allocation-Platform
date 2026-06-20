import { Router } from "express";
import { prisma } from "../server.js";
import type { AuthPayload } from "../middleware/auth.js";
import { findGroupByUsername } from "../services/utils.js";

const router = Router();

router.get("/:runId", async (req, res) => {
  const runId = req.params.runId;
  const user = (req as any).user as AuthPayload | undefined;
  const username = user?.username;

  let role = user?.role;
  if (!role && username) {
    const account = await prisma.account.findUnique({
      where: { username },
      select: { role: true },
    });
    role = account?.role;
  }

  let groupIds: string[] | undefined;
  if (username && role !== "admin") {
    const groups = await findGroupByUsername(username);
    groupIds = groups.map((group) => group.id);

    if (groupIds.length === 0) {
      return res.json({ runId, count: 0, byProject: {}, assignments: [] });
    }
  }

  const assignments = await prisma.assignment.findMany({
    where: {
      runId,
      ...(groupIds ? { groupId: { in: groupIds } } : {}),
    },
  });

  const byProject: Record<string, {count: number; groups: string[]}> = {};
  for (const a of assignments) {
    byProject[a.projectId] ??= {count: 0, groups: []};
    byProject[a.projectId].count++;
    byProject[a.projectId].groups.push(a.groupId);
  }

  res.json({runId, count: assignments.length, byProject, assignments});
});

export default router;
