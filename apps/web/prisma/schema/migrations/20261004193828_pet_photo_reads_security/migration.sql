-- The security statement for the pet_photo_reads table created just before this migration, the
-- one every new table gets (docs/rules/migrations.md). Only the server writes it (the photo read
-- and redo routes), as the server's Prisma client; the app never reads it. RLS on with no
-- policies, never FORCE, and nothing for the API roles that Supabase's default privileges
-- granted them.
ALTER TABLE "pet_photo_reads" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "pet_photo_reads" FROM anon, authenticated;
