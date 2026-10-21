-- The security statement for the pet_memories table created just before this migration, the one
-- every new table gets (docs/rules/migrations.md). Only the server writes it (the talk route, the
-- intro, the memory routes), as the server's Prisma client; the app reads it only through
-- /api/app/v1/pet/memories. RLS on with no policies, never FORCE, and nothing for the API roles
-- that Supabase's default privileges granted them.
ALTER TABLE "pet_memories" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "pet_memories" FROM anon, authenticated;
