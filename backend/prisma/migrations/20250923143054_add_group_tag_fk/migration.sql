-- CreateTable
CREATE TABLE "public"."group_tags" (
    "group_tag" TEXT NOT NULL,

    CONSTRAINT "group_tags_pkey" PRIMARY KEY ("group_tag")
);

-- AddForeignKey
ALTER TABLE "public"."groups" ADD CONSTRAINT "groups_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."group_tags"("group_tag") ON DELETE CASCADE ON UPDATE CASCADE;
