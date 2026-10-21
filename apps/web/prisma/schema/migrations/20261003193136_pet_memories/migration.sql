-- CreateTable
CREATE TABLE "pet_memories" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "pet_id" UUID NOT NULL,
    "text" VARCHAR(80) NOT NULL,
    "follow_up" VARCHAR(80),
    "category" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "importance" SMALLINT NOT NULL,
    "tags" TEXT[],
    "follow_up_on" DATE,
    "followed_up_at" TIMESTAMPTZ(6),
    "source" TEXT NOT NULL,
    "last_used_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pet_memories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pet_memories_pet_id_idx" ON "pet_memories"("pet_id");

-- AddForeignKey
ALTER TABLE "pet_memories" ADD CONSTRAINT "pet_memories_pet_id_fkey" FOREIGN KEY ("pet_id") REFERENCES "pets"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
