import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { appearanceSchema, LOOKS } from '@app/contract'

// The pet_appearance migration fills each existing pet from its look's recipe with a VALUES
// table written by hand. This holds it to the catalog: every look, each with exactly the recipe
// @app/contract gives it, so a saved Ginger is never redrawn as someone else. The migration is
// history: it wrote the six attributes of the time, Tuxedo and Pepper with the old Socks and bib
// pattern, so each row is read the way the app reads an old pet (appearanceSchema), into today's
// recipe (features/v2-pet-looks-requirements.md, R12).
const SQL = readFileSync(
	new URL(
		'../../../prisma/schema/migrations/20261001130000_pet_appearance/migration.sql',
		import.meta.url
	),
	'utf8'
)

test('the appearance backfill gives every ready-made look its exact recipe', () => {
	const rows = [...SQL.matchAll(/\(\s*'([a-z]+)'((?:\s*,\s*'[a-z]+'){6})\s*\)/g)].map((match) => [
		match[1]!,
		[...match[2]!.matchAll(/'([a-z]+)'/g)].map((value) => value[1]!)
	])
	const backfill = Object.fromEntries(rows) as Record<string, string[]>
	assert.deepEqual(Object.keys(backfill).sort(), LOOKS.map((look) => look.id).sort())
	for (const look of LOOKS) {
		const [fur, pattern, eyes, ears, body, tail] = backfill[look.id]!
		const read = appearanceSchema.parse({
			species: look.species,
			fur,
			pattern,
			eyes,
			ears,
			body,
			tail
		})
		assert.deepEqual(read, look.appearance, look.id)
	}
})
