import type { Pet } from '@app/contract'
import { needsOf, type PetRecord } from '@/server/db/pets'

// A stored pet as /api/app/v1 sends it: GET and POST /pet and POST /pet/actions answer with the
// same shape (@app/contract, petSchema).

/**
 * Stored text back to the catalog's ids. The casts are safe because createAppRoute parses the
 * response with the contract before sending it: a value outside the catalog is a logged 500,
 * never a malformed pet on the phone.
 */
export function toWirePet(row: PetRecord): Pet {
	return {
		id: row.id,
		appearance: {
			species: row.species,
			fur: row.fur,
			pattern: row.pattern,
			eyes: row.eyes,
			ears: row.ears,
			body: row.body,
			tail: row.tail,
			accent: row.accent,
			white: row.white,
			trim: row.trim
		} as Pet['appearance'],
		look_id: row.look as Pet['look_id'],
		name: row.name,
		preset: row.preset as Pet['preset'],
		traits: {
			affection: row.affection,
			playfulness: row.playfulness,
			energy: row.energy,
			curiosity: row.curiosity,
			loyalty: row.loyalty,
			independence: row.independence
		},
		needs: wireNeeds(row),
		created_at: row.createdAt.toISOString()
	}
}

function wireNeeds(row: PetRecord): Pet['needs'] {
	const { needs, storedAt } = needsOf(row)
	return { ...needs, updated_at: storedAt.toISOString() }
}
