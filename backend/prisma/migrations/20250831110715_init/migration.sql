-- CreateEnum
CREATE TYPE "public"."Preference" AS ENUM ('like', 'neutral', 'avoid');

-- CreateEnum
CREATE TYPE "public"."AllocStatus" AS ENUM ('proposed', 'locked', 'final');

-- CreateTable
CREATE TABLE "public"."users" (
    "user_id" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "cohort" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "seniority" TEXT NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "public"."skills" (
    "skill_id" TEXT NOT NULL,
    "skill_name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,

    CONSTRAINT "skills_pkey" PRIMARY KEY ("skill_id")
);

-- CreateTable
CREATE TABLE "public"."user_skills" (
    "user_id" TEXT NOT NULL,
    "skill_id" TEXT NOT NULL,
    "level" INTEGER NOT NULL,

    CONSTRAINT "user_skills_pkey" PRIMARY KEY ("user_id","skill_id")
);

-- CreateTable
CREATE TABLE "public"."groups" (
    "group_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "groups_pkey" PRIMARY KEY ("group_id")
);

-- CreateTable
CREATE TABLE "public"."group_members" (
    "group_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,

    CONSTRAINT "group_members_pkey" PRIMARY KEY ("group_id","user_id")
);

-- CreateTable
CREATE TABLE "public"."projects" (
    "project_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "client_org" TEXT NOT NULL,
    "supervisor" TEXT NOT NULL,
    "capacity_slots" INTEGER NOT NULL,
    "estimated_hours_per_week" INTEGER NOT NULL,
    "priority" DOUBLE PRECISION NOT NULL,
    "cohort" TEXT NOT NULL,
    "due_week" INTEGER NOT NULL,
    "tags" TEXT NOT NULL,
    "description" TEXT NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("project_id")
);

-- CreateTable
CREATE TABLE "public"."project_required_skills" (
    "project_id" TEXT NOT NULL,
    "skill_id" TEXT NOT NULL,
    "min_level" INTEGER NOT NULL,
    "importance" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "project_required_skills_pkey" PRIMARY KEY ("project_id","skill_id")
);

-- CreateTable
CREATE TABLE "public"."group_preferences" (
    "group_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "preference" "public"."Preference" NOT NULL,
    "rank" INTEGER,

    CONSTRAINT "group_preferences_pkey" PRIMARY KEY ("group_id","project_id")
);

-- CreateTable
CREATE TABLE "public"."group_availability" (
    "id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "from_week" INTEGER NOT NULL,
    "to_week" INTEGER NOT NULL,
    "hours_per_week" INTEGER NOT NULL,

    CONSTRAINT "group_availability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."criteria_weights" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "weight_skill" DOUBLE PRECISION NOT NULL,
    "weight_preference" DOUBLE PRECISION NOT NULL,
    "weight_workload" DOUBLE PRECISION NOT NULL,
    "weight_priority" DOUBLE PRECISION NOT NULL,
    "avoid_penalty" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "criteria_weights_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."locks" (
    "project_id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "status" TEXT NOT NULL,

    CONSTRAINT "locks_pkey" PRIMARY KEY ("project_id","group_id")
);

-- CreateTable
CREATE TABLE "public"."assignments" (
    "id" TEXT NOT NULL,
    "run_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "status" "public"."AllocStatus" NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "skill_fit" DOUBLE PRECISION NOT NULL,
    "pref_term" DOUBLE PRECISION NOT NULL,
    "workload_term" DOUBLE PRECISION NOT NULL,
    "priority_term" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "public"."users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "group_availability_group_id_from_week_to_week_hours_per_wee_key" ON "public"."group_availability"("group_id", "from_week", "to_week", "hours_per_week");

-- CreateIndex
CREATE INDEX "assignments_run_id_idx" ON "public"."assignments"("run_id");

-- AddForeignKey
ALTER TABLE "public"."user_skills" ADD CONSTRAINT "user_skills_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_skills" ADD CONSTRAINT "user_skills_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "public"."skills"("skill_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."group_members" ADD CONSTRAINT "group_members_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("group_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."group_members" ADD CONSTRAINT "group_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."project_required_skills" ADD CONSTRAINT "project_required_skills_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("project_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."project_required_skills" ADD CONSTRAINT "project_required_skills_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "public"."skills"("skill_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."group_preferences" ADD CONSTRAINT "group_preferences_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("group_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."group_preferences" ADD CONSTRAINT "group_preferences_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("project_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."group_availability" ADD CONSTRAINT "group_availability_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("group_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."locks" ADD CONSTRAINT "locks_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("project_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."locks" ADD CONSTRAINT "locks_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("group_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."assignments" ADD CONSTRAINT "assignments_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("group_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."assignments" ADD CONSTRAINT "assignments_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("project_id") ON DELETE CASCADE ON UPDATE CASCADE;
