-- The security statement for the pet_intro_attempts table created just before this migration, the
-- one every new table gets (docs/rules/migrations.md). Only the server writes it (the intro
-- route), as the server's Prisma client; the app never reads it. RLS on with no policies, never
-- FORCE, and nothing for the API roles that Supabase's default privileges granted them.
ALTER TABLE "pet_intro_attempts" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "pet_intro_attempts" FROM anon, authenticated;
