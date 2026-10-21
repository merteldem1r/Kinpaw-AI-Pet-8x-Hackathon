-- CreateTable
CREATE TABLE "friend_codes" (
    "user_id" UUID NOT NULL,
    "code" VARCHAR(8) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "friend_codes_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "friendships" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_low" UUID NOT NULL,
    "user_high" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "friendships_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "friend_codes_code_key" ON "friend_codes"("code");

-- CreateIndex
CREATE INDEX "friendships_user_high_idx" ON "friendships"("user_high");

-- CreateIndex
CREATE UNIQUE INDEX "friendships_user_low_user_high_key" ON "friendships"("user_low", "user_high");

-- AddForeignKey
ALTER TABLE "friend_codes" ADD CONSTRAINT "friend_codes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_user_low_fkey" FOREIGN KEY ("user_low") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_user_high_fkey" FOREIGN KEY ("user_high") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
