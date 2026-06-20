/*
  Warnings:

  - You are about to drop the column `name` on the `groups` table. All the data in the column will be lost.
  - Added the required column `member_role` to the `group_members` table without a default value. This is not possible if the table is not empty.
  - Added the required column `group_name` to the `groups` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."group_members" ADD COLUMN     "member_role" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "public"."groups" DROP COLUMN "name",
ADD COLUMN     "group_name" TEXT NOT NULL;
