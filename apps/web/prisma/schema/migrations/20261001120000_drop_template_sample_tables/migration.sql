-- Drops the template's sample domain: items, their tasks and activity, and notifications,
-- with the enums only they used. Kinpaw removed their code in M2 and nothing reads them; the
-- decision to drop them is 2026-10-01 (docs/memory/sample-tables-dropped.md).
--
-- Hand-written: CI's generator refuses DROP TABLE and DROP TYPE (docs/rules/migrations.md).
-- No data is preserved because none of it is Kinpaw's; every row was template sample data.
-- Children before their parent, then the types, so nothing depends on what is dropped. The
-- triggers, policies and foreign keys on these tables go with them.
DROP TABLE IF EXISTS "activity_feed";
DROP TABLE IF EXISTS "tasks";
DROP TABLE IF EXISTS "notifications";
DROP TABLE IF EXISTS "items";

DROP TYPE IF EXISTS "item_status";
DROP TYPE IF EXISTS "task_state";
DROP TYPE IF EXISTS "task_priority";
DROP TYPE IF EXISTS "activity_kind";
DROP TYPE IF EXISTS "notification_category";
