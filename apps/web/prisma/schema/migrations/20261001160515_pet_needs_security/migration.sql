-- The security statement for the pet_needs table created just before this migration, the one
-- every new table gets (docs/rules/migrations.md). The app reaches the needs only through
-- /api/app/v1/pet and /api/app/v1/pet/actions, as the server's Prisma client; RLS on with no
-- policies, never FORCE, and nothing for the API roles that Supabase's default privileges
-- granted it.
ALTER TABLE "pet_needs" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "pet_needs" FROM anon, authenticated;
