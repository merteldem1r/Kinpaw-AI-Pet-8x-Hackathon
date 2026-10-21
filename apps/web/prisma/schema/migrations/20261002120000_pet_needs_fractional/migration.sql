-- The pet's needs become fractional (docs/application/features/needs-rhythm-requirements.md,
-- R9, 2026-10-02): stored as whole numbers, every change threw away any decay under half a
-- point since the last one, and at the faster rates frequent taps would stop decay altogether.
-- People still see whole numbers; the app rounds where it shows them.
--
-- Hand-written: CI's generator refuses SET DATA TYPE (docs/rules/migrations.md). This is the SQL
-- `prisma migrate diff` produced, unchanged. Integer to double precision is exact for 0–100, so
-- every stored value is preserved as it is; the defaults are the starting needs, as before.
ALTER TABLE "pet_needs" ALTER COLUMN "hunger" SET DEFAULT 60,
ALTER COLUMN "hunger" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "happiness" SET DEFAULT 80,
ALTER COLUMN "happiness" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "energy" SET DEFAULT 80,
ALTER COLUMN "energy" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "affection" SET DEFAULT 70,
ALTER COLUMN "affection" SET DATA TYPE DOUBLE PRECISION;
