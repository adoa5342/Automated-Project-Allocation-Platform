/*
  Warnings:

  - You are about to drop the `user_skills` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."user_skills" DROP CONSTRAINT "user_skills_skill_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."user_skills" DROP CONSTRAINT "user_skills_user_id_fkey";

-- DropTable
DROP TABLE "public"."user_skills";

-- CreateTable
CREATE TABLE "public"."group_skills" (
    "group_id" TEXT NOT NULL,
    "skill_id" TEXT NOT NULL,
    "level" INTEGER NOT NULL,

    CONSTRAINT "group_skills_pkey" PRIMARY KEY ("group_id","skill_id")
);

-- AddForeignKey
ALTER TABLE "public"."group_skills" ADD CONSTRAINT "group_skills_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("group_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."group_skills" ADD CONSTRAINT "group_skills_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "public"."skills"("skill_id") ON DELETE CASCADE ON UPDATE CASCADE;
