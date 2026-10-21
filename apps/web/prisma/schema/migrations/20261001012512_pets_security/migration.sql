-- The security statement for the pets table created just before this migration, the one every
-- new table gets (docs/rules/migrations.md). The app reaches pets only through
-- /api/app/v1/pet, as the server's Prisma client; RLS on with no policies, never FORCE, and
-- nothing for the API roles that Supabase's default privileges granted it.
ALTER TABLE "pets" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "pets" FROM anon, authenticated;
