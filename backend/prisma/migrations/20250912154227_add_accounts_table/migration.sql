-- CreateEnum
CREATE TYPE "public"."AccountRole" AS ENUM ('admin', 'student');

-- CreateTable
CREATE TABLE "public"."accounts" (
    "account_id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "public"."AccountRole" NOT NULL,
    "user_id" TEXT,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("account_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "accounts_username_key" ON "public"."accounts"("username");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_user_id_key" ON "public"."accounts"("user_id");

-- AddForeignKey
ALTER TABLE "public"."accounts" ADD CONSTRAINT "accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;
