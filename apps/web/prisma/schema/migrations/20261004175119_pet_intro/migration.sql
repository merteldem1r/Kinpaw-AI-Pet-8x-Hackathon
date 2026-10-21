-- AlterTable
ALTER TABLE "ai_usage" ADD COLUMN     "purpose" TEXT NOT NULL DEFAULT 'talk';

-- AlterTable
ALTER TABLE "pets" ADD COLUMN     "intro_finished_at" TIMESTAMPTZ(6);

-- CreateTable
CREATE TABLE "pet_intro_attempts" (
    "id" UUID NOT NULL,
    "pet_id" UUID NOT NULL,
    "facts_saved" SMALLINT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pet_intro_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pet_intro_attempts_pet_id_idx" ON "pet_intro_attempts"("pet_id");

-- AddForeignKey
ALTER TABLE "pet_intro_attempts" ADD CONSTRAINT "pet_intro_attempts_pet_id_fkey" FOREIGN KEY ("pet_id") REFERENCES "pets"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
