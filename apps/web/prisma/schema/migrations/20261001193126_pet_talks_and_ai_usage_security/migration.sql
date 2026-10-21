-- The security statement for the pet_talks and ai_usage tables created just before this
-- migration, the one every new table gets (docs/rules/migrations.md). Only the talk route writes
-- them (POST /api/app/v1/pet/talk), as the server's Prisma client; the app never reads them. RLS
-- on with no policies, never FORCE, and nothing for the API roles that Supabase's default
-- privileges granted them.
ALTER TABLE "pet_talks" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "pet_talks" FROM anon, authenticated;

ALTER TABLE "ai_usage" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "ai_usage" FROM anon, authenticated;
