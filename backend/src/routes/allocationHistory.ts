import { Router } from "express";
import { prisma } from "../server.js";
import { AllocationRecord, AllocationDetail } from "../types.js";
import { findGroupByUsername } from "../services/utils.js";

const router = Router();

// State Mapping: Transforming database states into front-end display states
const STATUS_MAP: Record<string, "completed" | "partial" | "failed"> = {
  proposed: "partial",
  locked: "completed",
  final: "completed",
  default: "failed",
};

// Retrieve historical allocation records
router.get("/", async (req, res) => {
  try {
    const { username } = req.query

    let userGroupIds: string[] = [];

    if (username) {
      const groups = await findGroupByUsername(username as string);
      userGroupIds = groups.map(group => group.id);
    }

    const assignments = await prisma.assignment.findMany({
      where: username ? { groupId: { in: userGroupIds }} : {},
      include: {
        group: {
          include: {
            members: {
              select: { userId: true },
            },
          },
        },
        project: true,
      },
      orderBy: { createTime: "desc" },
    });

    const runMap = new Map<string, Array<any>>();
    assignments.forEach((assignment) => {
      const runId = assignment.runId || `auto_${assignment.id}`;
      const runAssignments = runMap.get(runId) || [];
      runAssignments.push(assignment);
      runMap.set(runId, runAssignments);
    });

    const latestRunEntry = Array.from(runMap.entries())[0];

    if (!latestRunEntry) {
      return res.json([]); // no runs exist
    }

    const [latestRunId, latestRunAssignments] = latestRunEntry;

    if (username) {
      const groups = await findGroupByUsername(username as string);
      const userGroupIds = groups.map(group => group.id);
      
      const studentHasAllocation = latestRunAssignments.some(assignment => 
        userGroupIds.includes(assignment.groupId)
      );

      if (studentHasAllocation) {
        const userIds = new Set<string>();
        latestRunAssignments.forEach((a) => {
          a.group.members.forEach((m: { userId: string }) =>
            userIds.add(m.userId)
          );
        });

        const record: AllocationRecord = {
          id: latestRunId,
          runId: latestRunId,
          create_time: new Date(latestRunAssignments[0].createTime),
          project_count: latestRunAssignments.length,
          user_count: userIds.size,
          status: STATUS_MAP[latestRunAssignments[0].status] || STATUS_MAP.default,
        };
        res.json([record]);

      } else {
        res.json([]);
      }

    } else {
      const records: AllocationRecord[] = Array.from(runMap.entries()).map(
        ([runId, assignments]) => {
          const userIds = new Set<string>();
          // Add parameter type declarations
          assignments.forEach((a) => {
            a.group.members.forEach((m: { userId: string }) =>
              userIds.add(m.userId)
            );
          });

          return {
            id: runId,
            runId,
            create_time: new Date(assignments[0].createTime),
            project_count: assignments.length,
            user_count: userIds.size,
            status: STATUS_MAP[assignments[0].status] || STATUS_MAP.default,
          };
        });

        res.json(records);
      }

    } catch (error) {
      console.error("Error Fetching Allocation History:", error);
      res
        .status(500)
        .json({ ok: false, error: "Failed to fetch allocation history" });
    }
});

// Retrieve details of a single allocation
router.get("/:runId", async (req, res) => {
  try {
    const { runId } = req.params;
    const { username } = req.query;
    
    let userGroupIds: string[] = [];

    if (username) {
      const groups = await findGroupByUsername(username as string);
      userGroupIds = groups.map(group => group.id);
      console.log(groups)
    }

    const assignments = await prisma.assignment.findMany({
      where: { runId, ...(username ? { groupId: { in: userGroupIds } } : {}) },
      include: {
        group: {
          include: {
            members: {
              include: {
                user: { select: { id: true, fullName: true } },
              },
            },
          },
        },
        project: true,
      },
      orderBy: { createTime: "desc" },
    });

    // Statistics
    const groups = await prisma.group.findMany({
      where: username ? { id: { in: userGroupIds } } : {}}
    );

    const projects = await prisma.project.findMany();

    const filledCapacities: Record<string, number> = {};
    (assignments as any[]).forEach((a) => {
      if (["proposed", "locked", "final"].includes(a.status)) {
        filledCapacities[a.projectId] = (filledCapacities[a.projectId] || 0) + 1;
      }
    });

    const projectCapacities = projects.map((p: any) => {
      return {
        projectName: p.title,
        assigned: filledCapacities[p.id] || 0,
        capacity: p.capacitySlots,
      };
    });

    const detail: AllocationDetail = {
      runId,
      timestamp: new Date(assignments[0]?.createTime || new Date()),
      assignments: assignments.map((a: any) => ({
        id: a.id,
        projectId: a.projectId,
        projectName: a.project.title,
        groupId: a.groupId,
        groupName: a.group.name,
        status: STATUS_MAP[a.status] || "failed",
        score: a.score,
        skillFit: a.skillFit,
        prefTerm: a.prefTerm,
        workloadTerm: a.workloadTerm,
        priorityTerm: a.priorityTerm,
        members: a.group.members.map((m: any) => ({
          userId: m.userId,
          userName: m.user?.fullName,
        })),
      })),
      stats: {
        totalGroups: groups.length,
        assignedGroups: assignments.filter(
          (a: any) => ["proposed", "locked", "final"].includes(a.status)
        ).length,
        avgScore:
          assignments.length > 0
            ? assignments.reduce((sum: number, a: any) => sum + (a.score ?? 0), 0) / assignments.length
            : 0,
        totalProjects: projects.length,
        availableProjectSlots: projectCapacities.reduce(
          (sum: number, p: any) => sum + (p.capacity - p.assigned),
          0
        ),
        projectCapacities: projectCapacities,
      }
    };

    res.json(detail);
  } catch (error) {
    console.error("Error fetching allocation details:", error);
    res
      .status(500)
      .json({ ok: false, error: "Failed to fetch allocation details" });
  }
});

export default router;
