-- The security statement for the friend_codes and friendships tables created just before this
-- migration, the one every new table gets (docs/rules/migrations.md). Only the server writes
-- them (the /api/app/v1/friends routes), as the server's Prisma client; the app never reads
-- them. RLS on with no policies, never FORCE, and nothing for the API roles that Supabase's
-- default privileges granted them.
ALTER TABLE "friend_codes" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "friend_codes" FROM anon, authenticated;
ALTER TABLE "friendships" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "friendships" FROM anon, authenticated;
