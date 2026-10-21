import {
	decayNeeds,
	moodFor,
	needBands,
	type Friend,
	type FriendPet,
	type FriendPreview
} from '@app/contract'
import { needsOf, type PetRecord } from '@/server/db/pets'
import type { CodeOwner, FriendRecord } from '@/server/db/friends'

// A friend as /api/app/v1/friends sends it (docs/application/features/v2-friends-requirements.md,
// R13): only what a friend may see. Never `toWirePet`, which carries the pet's id, traits, preset
// and exact needs. The contract's schemas are strict, so a field added here by mistake is a
// logged 500, never a leak.

/** A friend's pet, decayed to `now` in the viewer's time zone: its look, name, mood and bands. */
function toWireFriendPet(row: PetRecord, timeZone: string, now = new Date()): FriendPet {
	const { needs, storedAt } = needsOf(row)
	const current = decayNeeds(needs, storedAt, now, timeZone)
	return {
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
		} as FriendPet['appearance'],
		name: row.name,
		mood: moodFor(current),
		needs: needBands(current)
	}
}

export function toWireFriend(friend: FriendRecord, timeZone: string): Friend {
	return {
		id: friend.id,
		display_name: friend.displayName,
		since: friend.createdAt.toISOString(),
		pet: friend.pet ? toWireFriendPet(friend.pet, timeZone) : null
	}
}

export function toWireFriendPreview(owner: CodeOwner, timeZone: string): FriendPreview {
	return {
		display_name: owner.displayName,
		pet: owner.pet ? toWireFriendPet(owner.pet, timeZone) : null
	}
}
