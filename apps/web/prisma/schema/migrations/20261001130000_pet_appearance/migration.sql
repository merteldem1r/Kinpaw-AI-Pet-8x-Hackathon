-- Every pet is built from six attributes (features/m4b-pet-builder-requirements.md, R4). Adds
-- them to pets, fills each existing pet from its ready-made look's recipe (@app/contract,
-- LOOKS), then makes them required; `look` becomes nullable, null for a pet built or
-- customized.
--
-- Hand-written: CI's generator refuses SET NOT NULL, and a backfill is data
-- (docs/rules/migrations.md). One explicit transaction: a pet the backfill missed (a look not
-- in the list) fails the SET NOT NULL, and nothing is changed.
BEGIN;

ALTER TABLE "pets"
  ADD COLUMN "fur" TEXT,
  ADD COLUMN "pattern" TEXT,
  ADD COLUMN "eyes" TEXT,
  ADD COLUMN "ears" TEXT,
  ADD COLUMN "body" TEXT,
  ADD COLUMN "tail" TEXT;

UPDATE "pets" AS p
SET "fur" = r.fur, "pattern" = r.pattern, "eyes" = r.eyes,
    "ears" = r.ears, "body" = r.body, "tail" = r.tail
FROM (VALUES
  ('ginger',  'ginger',   'stripes', 'brown', 'pointy', 'round',  'long'),
  ('smoke',   'grey',     'stripes', 'green', 'pointy', 'slim',   'long'),
  ('tuxedo',  'charcoal', 'socks',   'amber', 'pointy', 'round',  'long'),
  ('calico',  'cream',    'patches', 'brown', 'pointy', 'round',  'fluffy'),
  ('biscuit', 'golden',   'solid',   'brown', 'floppy', 'round',  'long'),
  ('pepper',  'charcoal', 'socks',   'brown', 'perky',  'slim',   'long'),
  ('snow',    'cream',    'solid',   'brown', 'floppy', 'chonky', 'fluffy'),
  ('merle',   'grey',     'spots',   'blue',  'floppy', 'round',  'long')
) AS r(look, fur, pattern, eyes, ears, body, tail)
WHERE p."look" = r.look;

ALTER TABLE "pets"
  ALTER COLUMN "fur" SET NOT NULL,
  ALTER COLUMN "pattern" SET NOT NULL,
  ALTER COLUMN "eyes" SET NOT NULL,
  ALTER COLUMN "ears" SET NOT NULL,
  ALTER COLUMN "body" SET NOT NULL,
  ALTER COLUMN "tail" SET NOT NULL,
  ALTER COLUMN "look" DROP NOT NULL;

COMMIT;
