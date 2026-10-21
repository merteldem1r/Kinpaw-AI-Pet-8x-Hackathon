-- CreateTable
CREATE TABLE "pet_photo_reads" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "device_hash" TEXT,
    "ip_hash" TEXT NOT NULL,
    "user_id" UUID,
    "context" TEXT NOT NULL,
    "local_day" DATE NOT NULL,
    "outcome" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pet_photo_reads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pet_photo_reads_device_hash_idx" ON "pet_photo_reads"("device_hash");

-- CreateIndex
CREATE INDEX "pet_photo_reads_ip_hash_created_at_idx" ON "pet_photo_reads"("ip_hash", "created_at");

-- CreateIndex
CREATE INDEX "pet_photo_reads_user_id_local_day_idx" ON "pet_photo_reads"("user_id", "local_day");

-- CreateIndex
CREATE INDEX "pet_photo_reads_created_at_idx" ON "pet_photo_reads"("created_at");

-- AddForeignKey
ALTER TABLE "pet_photo_reads" ADD CONSTRAINT "pet_photo_reads_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
