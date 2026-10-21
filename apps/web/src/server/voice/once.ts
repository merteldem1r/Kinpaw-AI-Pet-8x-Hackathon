import { VOICE_WINDOW_MINUTES } from '@app/contract'

// Each reply is spoken once (v2-voice-requirements.md, R4): the message ids already voiced, kept
// in this server's memory for the window a reply can be spoken in, then forgotten. Locally there
// is one server. On several instances a repeat is possible but bounded by the window and the
// daily limits (R5), so no table is needed for it.

const WINDOW_MS = VOICE_WINDOW_MINUTES * 60_000
const spoken = new Map<string, number>()

/**
 * Claims a message id for speaking; false when it was claimed within the window. Claimed before
 * the provider is called, so two requests at once can't both pay for it.
 */
export function claimOnce(messageId: string, now: number = Date.now()): boolean {
	for (const [id, at] of spoken) if (now - at > WINDOW_MS) spoken.delete(id)
	if (spoken.has(messageId)) return false
	spoken.set(messageId, now)
	return true
}

/** Gives a claim back when the voice couldn't be made, so a later request may speak it. */
export function releaseClaim(messageId: string): void {
	spoken.delete(messageId)
}
