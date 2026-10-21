import {
	formatFriendCode,
	normalizeFriendCode,
	type Friend,
	type FriendPet,
	type FriendPreview,
	type Need
} from '@app/contract'
import { APP_SCHEME } from '@/lib/constants'

// Friends on the phone (docs/application/features/v2-friends-requirements.md): the link a QR code
// holds, how a friend is named, and the line under their pet. The server decides who is a friend
// and what their pet may show; this only words it.

/** The path a friend link opens: app/friends/add.tsx. */
const FRIEND_ADD_PATH = 'friends/add'

/** The link a friend code's QR holds and the share sheet sends (R6, R8). */
export function friendLink(code: string): string {
	return `${APP_SCHEME}://${FRIEND_ADD_PATH}?code=${code}`
}

/** The message the share sheet sends: the code first, since a custom link may not be tappable. */
export function friendShareMessage(code: string, petName: string): string {
	return `Be friends with ${petName} on Kinpaw! My friend code is ${formatFriendCode(code)}.\n${friendLink(code)}`
}

/** A code out of a scanned or tapped link (`?code=`), or null when it holds none. */
export function codeFromParam(param: string | string[] | undefined): string | null {
	const raw = Array.isArray(param) ? param[0] : param
	return raw ? normalizeFriendCode(raw) : null
}

/** "Ece", or "Luna's human" when they haven't set a name (R13). */
export function friendName(friend: Pick<Friend | FriendPreview, 'display_name' | 'pet'>): string {
	if (friend.display_name) return friend.display_name
	return friend.pet ? `${friend.pet.name}'s human` : 'A friend'
}

/** "Ece's cat". */
export function friendPetCaption(
	friend: Pick<Friend | FriendPreview, 'display_name' | 'pet'>
): string {
	const species = friend.pet?.appearance.species ?? 'pet'
	return friend.display_name ? `${friend.display_name}'s ${species}` : `A friend's ${species}`
}

/** Which low need a line speaks about first: the same order Home's bubble uses for ties. */
const LINE_ORDER: readonly Need[] = ['affection', 'hunger', 'energy', 'happiness']

const LOW_LINE: Record<Need, (name: string) => string> = {
	affection: (name) => `${name} could use a cuddle.`,
	hunger: (name) => `${name}'s a bit hungry.`,
	energy: (name) => `${name}'s getting sleepy.`,
	happiness: (name) => `${name} could use some fun.`
}

/** One line about how a friend's pet is doing, from its bands (R11): never a number. */
export function friendPetLine(pet: FriendPet): string {
	const low = LINE_ORDER.find((need) => pet.needs[need] === 'low')
	if (low) return LOW_LINE[low](pet.name)
	if (Object.values(pet.needs).every((band) => band === 'good')) return `${pet.name}'s doing great.`
	return `${pet.name}'s doing fine.`
}

/** How each need reads on a friend's pet page. */
export const NEED_LABEL: Record<Need, string> = {
	hunger: 'Hunger',
	happiness: 'Happiness',
	energy: 'Energy',
	affection: 'Affection'
}
