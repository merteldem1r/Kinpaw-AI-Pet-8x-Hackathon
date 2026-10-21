-- CreateTable
CREATE TABLE "pet_needs" (
    "pet_id" UUID NOT NULL,
    "hunger" INTEGER NOT NULL DEFAULT 60,
    "happiness" INTEGER NOT NULL DEFAULT 80,
    "energy" INTEGER NOT NULL DEFAULT 80,
    "affection" INTEGER NOT NULL DEFAULT 70,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pet_needs_pkey" PRIMARY KEY ("pet_id")
);

-- AddForeignKey
ALTER TABLE "pet_needs" ADD CONSTRAINT "pet_needs_pet_id_fkey" FOREIGN KEY ("pet_id") REFERENCES "pets"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
