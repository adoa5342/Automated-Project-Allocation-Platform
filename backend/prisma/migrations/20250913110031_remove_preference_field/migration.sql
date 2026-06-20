/*
  Warnings:

  - You are about to drop the column `preference` on the `group_preferences` table. All the data in the column will be lost.
  - Made the column `rank` on table `group_preferences` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "public"."assignments" ALTER COLUMN "create_time" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "public"."group_preferences" DROP COLUMN "preference",
ALTER COLUMN "rank" SET NOT NULL;

-- DropEnum
DROP TYPE "public"."Preference";
