import {Router} from "express";
import {prisma} from "../server.js";
import { group } from "console";

const router = Router();

router.get("/groups", async (req, res) => {
  try {
    const tags = await prisma.groupTag.findMany({
      select: { groupTag: true },
      orderBy: { groupTag: "asc" },
    });
    res.json({ tags });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// GET /api/v1/student-survey/skills
// Returns a JSON array of skill names
router.get("/skills", async (_req, res) => {
  try {
    const skills = await prisma.skill.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
    res.json({ skills });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// GET /api/v1/student-survey/projects
// Returns a JSON array of projects with id and name (title)
router.get("/projects", async (_req, res) => {
  try {
    const projectsRaw = await prisma.project.findMany({
      select: { id: true, title: true },
      orderBy: { title: "asc" },
    });
    const projects = projectsRaw.map(p => ({ id: p.id, name: p.title }));
    res.json({ projects });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// POST /api/v1/student-survey/submit
// Stores group survey data including students, preferences, availability, and skills
router.post("/submit", async (req: any, res: any) => {
  try {
    console.log(req.body)

    const {
      groupName,
      students,
      topProjects,
      availability,
      skills
    } = req.body;

    console.log(groupName, students, topProjects, availability, skills);

    // Validate required fields
    if (!groupName || !students || !Array.isArray(students) || students.length === 0) {
      return res.status(400).json({ 
        ok: false, 
        error: "Missing required fields: groupName and students array" 
      });
    }

    console.log("1")

    // Use a transaction to ensure data consistency
    const result = await prisma.$transaction(async (tx) => {
      // Create or update the group
      const group = await tx.group.upsert({
        where: { id: groupName },
        update: { name: groupName },
        create: { 
          id: groupName,
          name: groupName 
        }
      });

      console.log("2")

      await tx.groupTag.upsert({
        where: { groupTag: groupName },
        update: {},
        create: {
          groupTag: groupName
        }
      });

      console.log("3")

      // Replace existing members for this group to reflect the submitted survey
      await tx.groupMember.deleteMany({ where: { groupId: group.id } });

      // Process each student
      for (const [idx, student] of students.entries()) {
        if (!student.fullName || !student.email) {
          throw new Error(`Missing required student fields for student ${idx + 1}`);
        }

        const rawEmail = String(student.email).trim();
        if (!rawEmail) {
          throw new Error(`Missing required email for student ${idx + 1}`);
        }
        const normalizedEmail = rawEmail.toLowerCase();

        // Create or update user keyed by email
        const user = await tx.user.upsert({
          where: { email: normalizedEmail },
          update: {
            fullName: student.fullName,
            email: normalizedEmail,
            cohort: (student.cohort ?? '').toString(),
            role: (student.role ?? '').toString(),
            seniority: (student.seniority ?? '1').toString()
          },
          create: {
            id: normalizedEmail,
            fullName: student.fullName,
            email: normalizedEmail,
            cohort: (student.cohort ?? '').toString(),
            role: (student.role ?? '').toString(),
            seniority: (student.seniority ?? '1').toString()
          }
        });

        // Add user to group
        await tx.groupMember.upsert({
          where: {
            groupId_userId: {
              groupId: group.id,
              userId: user.id
            }
          },
          update: {
            memberRole: student.role || 'member'
          },
          create: {
            groupId: group.id,
            userId: user.id,
            memberRole: student.role || 'member'
          }
        });
      }

      // Handle group skills if provided
      if (skills && Array.isArray(skills) && skills.length > 0) {
        // First, ensure all skills exist in the skills table
        for (const skill of skills) {
          if (skill.id && skill.name) {
            await tx.skill.upsert({
              where: { id: skill.id },
              update: {}, // Don't update existing skills
              create: {
                id: skill.id,
                name: skill.name,
                category: 'User Defined',
                description: `User defined skill: ${skill.name}`
              }
            });
          }
        }

        // Remove existing group skills for this group
        await tx.groupSkill.deleteMany({
          where: { groupId: group.id }
        });

        // Add new group skills
        for (const skill of skills) {
          if (skill.id && skill.level != null) {
            const level = Math.max(1, Math.min(5, parseInt(String(skill.level), 10) || 0));
            await tx.groupSkill.create({
              data: {
                groupId: group.id,
                skillId: skill.id,
                level
              }
            });
          }
        }
      }

      // Handle group availability
      if (availability && availability.fromWeek != null && availability.toWeek != null && availability.hoursPerWeek != null) {
        // Replace existing availability records for this group
        await tx.groupAvailability.deleteMany({ where: { groupId: group.id } });
        await tx.groupAvailability.create({
          data: {
            groupId: group.id,
            fromWeek: parseInt(String(availability.fromWeek), 10),
            toWeek: parseInt(String(availability.toWeek), 10),
            hoursPerWeek: parseInt(String(availability.hoursPerWeek), 10)
          }
        });
      }

      // Handle project preferences
      if (topProjects && Array.isArray(topProjects) && topProjects.length > 0) {
        // Remove existing preferences for this group
        await tx.groupPreference.deleteMany({
          where: { groupId: group.id }
        });

        // Add new preferences with ranking
        for (let i = 0; i < topProjects.length; i++) {
          const projectId = topProjects[i];
          await tx.groupPreference.create({
            data: {
              groupId: group.id,
              projectId: projectId,
              rank: i + 1
            }
          });
        }
      }

      console.log("4")

      return { groupId: group.id };
    });

    console.log("3")

    res.json({ 
      ok: true, 
      message: "Group survey data submitted successfully",
      groupId: result.groupId 
    });

  } catch (e: any) {
    console.error("Error submitting group survey:", e);
    res.status(500).json({ 
      ok: false, 
      error: e.message || "Failed to submit group survey data" 
    });
  }
});

export default router;
