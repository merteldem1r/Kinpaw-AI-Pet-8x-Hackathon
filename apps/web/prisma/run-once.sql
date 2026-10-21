-- Run-once SQL: whatever is below runs ONCE per database, on the next deploy.
--
-- Write the SQL for a one-off change here (fix a value, insert reference rows,
-- backfill a column, replace a view), test it with `npm run db:run-once` against a
-- local database, open the PR, merge. Production applies it once, right after
-- the migrations, and records it in the "_run_once_sql" table so it never runs
-- again. Next time, REPLACE the content below with the new one-off — don't
-- append to the old one, it already ran.
--
-- How "once" works: the runner hashes the executable content (comments and
-- whitespace don't count, so a doc tweak never re-runs anything) and skips any
-- version already in the ledger. The ledger row and your SQL are written in the
-- same transaction: both land or neither does, so a failed run is retried on
-- the next deploy and a successful one cannot repeat.
--
-- Rules:
--   - Data and objects only: UPDATE / INSERT / DELETE, CREATE OR REPLACE VIEW,
--     CREATE EXTENSION, GRANT. Tables, columns, indexes and enums still go in
--     apps/web/prisma/schema/*.prisma: the drift check after this file fails on them.
--   - CI applies this file to an EMPTY database first, so matching nothing must
--     be fine (an UPDATE ... WHERE that finds no rows), and an INSERT that needs
--     rows only production has must be guarded (INSERT ... SELECT ... WHERE EXISTS).
--   - Everything runs inside one transaction: no CREATE INDEX CONCURRENTLY, no VACUUM.
--   - Merge conflict in this file? Keep only your SQL. The other side already ran.
--
-- Full policy: docs/rules/migrations.md, "Run-once SQL".

-- Pet looks v2 (2026-10-03, features/v2-pet-looks-requirements.md, R12): Socks and bib moved
-- from the pattern to the new white markings. Every pet saved with pattern 'socks' becomes a
-- solid coat with white 'socks', drawn exactly the same. Runs after the migration that adds
-- the column; matches nothing on an empty database. The app also reads an old 'socks' pattern
-- this way (appearanceSchema), so a row this misses still draws right. Reversible:
-- update pets set pattern = 'socks', white = 'none' where white = 'socks' and pattern = 'solid'.
update pets
set pattern = 'solid', white = 'socks', updated_at = now()
where pattern = 'socks';
