-- CreateTable
CREATE TABLE "pets" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "species" TEXT NOT NULL,
    "look" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "preset" TEXT NOT NULL,
    "affection" INTEGER NOT NULL,
    "playfulness" INTEGER NOT NULL,
    "energy" INTEGER NOT NULL,
    "curiosity" INTEGER NOT NULL,
    "loyalty" INTEGER NOT NULL,
    "independence" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pets_user_id_key" ON "pets"("user_id");

-- AddForeignKey
ALTER TABLE "pets" ADD CONSTRAINT "pets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
