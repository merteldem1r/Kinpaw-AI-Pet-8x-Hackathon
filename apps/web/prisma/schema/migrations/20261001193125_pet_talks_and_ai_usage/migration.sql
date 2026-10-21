-- CreateTable
CREATE TABLE "pet_talks" (
    "message_id" UUID NOT NULL,
    "pet_id" UUID NOT NULL,
    "local_day" DATE NOT NULL,
    "intent" TEXT NOT NULL,
    "input" TEXT NOT NULL,
    "happiness_added" INTEGER NOT NULL,
    "affection_added" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pet_talks_pkey" PRIMARY KEY ("message_id")
);

-- CreateTable
CREATE TABLE "ai_usage" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "input_tokens" INTEGER,
    "output_tokens" INTEGER,
    "latency_ms" INTEGER NOT NULL,
    "outcome" TEXT NOT NULL,
    "intent" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_usage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pet_talks_pet_id_local_day_idx" ON "pet_talks"("pet_id", "local_day");

-- CreateIndex
CREATE INDEX "ai_usage_user_id_idx" ON "ai_usage"("user_id");

-- CreateIndex
CREATE INDEX "ai_usage_created_at_idx" ON "ai_usage"("created_at");

-- AddForeignKey
ALTER TABLE "pet_talks" ADD CONSTRAINT "pet_talks_pet_id_fkey" FOREIGN KEY ("pet_id") REFERENCES "pets"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ai_usage" ADD CONSTRAINT "ai_usage_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
