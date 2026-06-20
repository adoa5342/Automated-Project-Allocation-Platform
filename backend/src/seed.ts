import {PrismaClient, AccountRole} from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient()

async function main() {
  const saltRounds = 12
  const adminPassword = await bcrypt.hash('admin', saltRounds)

  const adminAccount = await prisma.account.create({
    data: {
      username: 'admin',
      password: adminPassword,
      role: AccountRole.admin,
    }
  })

  const studentUser1 = await prisma.user.create({
    data: {
      id: 'some_unikey1',
      fullName: 'some_name1',
      email: 'some_unikey1@uni.sydney.edu.au',
      cohort: '2025',
      role: 'Leader',
      seniority: '3'
    }
  })

  const studentUser2 = await prisma.user.create({
    data: {
      id: 'some_unikey2',
      fullName: 'some_name2',
      email: 'some_unikey2@uni.sydney.edu.au',
      cohort: '2025',
      role: 'Member',
      seniority: '3'
    }
  })

  const studentUser3 = await prisma.user.create({
    data: {
      id: 'some_unikey3',
      fullName: 'some_name3',
      email: 'some_unikey3@uni.sydney.edu.au',
      cohort: '2025',
      role: 'Member',
      seniority: '3'
    }
  })

  const studentUser4 = await prisma.user.create({
    data: {
      id: 'some_unikey4',
      fullName: 'some_name4',
      email: 'some_unikey4@uni.sydney.edu.au',
      cohort: '2025',
      role: 'Member',
      seniority: '3'
    }
  })

  const studentUser5 = await prisma.user.create({
    data: {
      id: 'some_unikey5',
      fullName: 'some_name5',
      email: 'some_unikey5@uni.sydney.edu.au',
      cohort: '2025',
      role: 'Member',
      seniority: '3'
    }
  })

  const groupTag = await prisma.groupTag.create({
    data: {
      groupTag: 'ISYS3888_T13_03'
    }
  })

  const group = await prisma.group.create({
    data: {
      id: groupTag.groupTag,
      name: 'ISYS3888_T13_03',
    }
  })

  await prisma.groupMember.createMany({
    data: [
      {
        groupId: group.id,
        userId: studentUser1.id,
        memberRole: 'Leader'
      },
      {
        groupId: group.id,
        userId: studentUser2.id,
        memberRole: 'Member'
      },
      {
        groupId: group.id,
        userId: studentUser3.id,
        memberRole: 'Member'
      },
      {
        groupId: group.id,
        userId: studentUser4.id,
        memberRole: 'Member'
      },
      {
        groupId: group.id,
        userId: studentUser5.id,
        memberRole: 'Member'
      }
    ]
  })

  const skill1 = await prisma.skill.create({
    data: {
      id: 'S001',
      name: 'JavaScript',
      category: 'Programming',
      description: 'Frontend and backend JavaScript development'
    }
  })

  const skill2 = await prisma.skill.create({
    data: {
      id: 'S002',
      name: 'Python',
      category: 'Programming',
      description: 'Data analysis and backend development'
    }
  })

  await prisma.groupSkill.createMany({
    data: [
      {
        groupId: group.id,
        skillId: skill1.id,
        level: 4
      },
      {
        groupId: group.id,
        skillId: skill2.id,
        level: 5
      }
    ]
  })

  await prisma.groupAvailability.create({
    data: {
      groupId: group.id,
      fromWeek: 2,
      toWeek: 11,
      hoursPerWeek: 15
    }
  })

  const project = await prisma.project.create({
    data: {
      id: 'P001',
      title: 'E-commerce Platform',
      client_org: 'TechCorp',
      supervisor: 'SUP001',
      capacitySlots: 1,
      estimatedHoursPerWeek: 15,
      priority: 0.9,
      cohort: '2025',
      dueWeek: 11,
      tags: 'web development',
      description: 'Build a modern e-commerce platform with React and Node.js'
    }
  })

  await prisma.projectRequiredSkill.create({
    data: {
      projectId: project.id,
      skillId: skill1.id,
      minLevel: 3,
      importance: 0.9
    }
  })

  await prisma.groupPreference.create({
    data: {
      groupId: group.id,
      projectId: project.id,
      rank: 1
    }
  })

  const studentPassword = await bcrypt.hash('student', saltRounds)
  const studentAccount = await prisma.account.create({
    data: {
      username: 'student',
      password: studentPassword,
      role: AccountRole.student,
      user: {
        connect: {
          id: studentUser1.id
        }
      }
    }
  })

  console.log('Seed Completed Successfully.')
  console.log('Admin Account Created:', adminAccount.username)
  console.log('Student Account Created:', studentAccount.username)
  console.log('Group Created:', group.name)
  console.log('Sample Project Created:', project.title)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())