import {
	analyticsIntent,
	DEFAULT_PRESET,
	endpoints,
	presetIdSchema,
	speciesSchema,
	type TalkBody
} from '@app/contract'
import { LIFECYCLE_EVENTS, MEMORY_EVENTS, TALK_EVENTS } from '@/lib/analytics/events'
import { recordUserEvent } from '@/lib/analytics/record'
import { trackPlayEvent } from '@/lib/plays/events'
import { ApiError } from '@/server/api/app-errors'
import { createAppRoute } from '@/server/api/app-route'
import { toWirePet } from '@/server/api/pet-wire'
import { requireTimeZone } from '@/server/api/time-zone'
import type { AppUser } from '@/server/auth/require-user'
import { profileStore } from '@/server/db/profiles'
import { talkProvider } from '@/server/talk/provider'
import { talkToPet, type KeptMemory, type TalkResult } from '@/server/talk/talk-to-pet'
import { startVoice } from '@/server/voice/make-voice'
import { voiceProvider } from '@/server/voice/provider'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const PATH = '/api/app/v1/pet/talk'

/**
 * POST /api/app/v1/pet/talk: say something to the caller's pet; it answers in its personality
 * and what was said moves its needs a little (docs/application/features/
 * m6-talk-requirements.md). The flow is `talkToPet`; this turns its result into a response and
 * records the events. What was said and the reply are never stored, logged or recorded.
 *
 * - 200 `replied`: the pet answered and the reply counted. `talk_reply_received` is recorded
 *   first-party (daily per input) and, on the account's first counted reply, `user_activated`
 *   (once ever, also to the Play Events API).
 *   When the reply kept a fact (v2-memory-requirements.md, R12–R15), the response carries it as
 *   `remembered` and `memory_saved` is recorded first-party (daily per source).
 * - 200 `retried`: this message id had already counted; a fresh reply, nothing changed.
 * - With `voice: true` on a reply, the pet's voice for it starts being made before this answers,
 *   for `POST /pet/voice` to pick up (v2-voice-requirements.md): the text isn't held for it.
 * - 200 `limit_reached`: a free account with nothing left today; no model call.
 * - 400: a time zone that isn't a real IANA zone, or a body the contract refuses.
 * - 404: no pet yet.
 * - 503 `talk_unavailable`: the model can't be reached or is rate-limited (not counted).
 * - 503 `not_configured`: no model in production (no GROQ_API_KEY).
 * - 500: the model answered in a shape we can't use (not counted).
 */
export const POST = createAppRoute(endpoints.petTalk, async ({ user, body }) => {
	requireTimeZone(body.time_zone)
	const provider = talkProvider()
	if (!provider) throw new ApiError('not_configured', "Your pet can't talk right now.")

	const result = await talkToPet({ userId: user.id, body, provider })
	switch (result.kind) {
		case 'no_pet':
			throw new ApiError('not_found', 'There is no pet to talk to yet.')
		case 'failed':
			throw result.failure === 'unavailable'
				? new ApiError('talk_unavailable', 'Your pet is a bit sleepy. Try again in a moment.')
				: new ApiError('internal', 'Your pet lost its train of thought. Try again.', {
						cause: new Error('the model answered in a shape the reply check refused')
					})
		case 'limit_reached':
			return {
				body: {
					outcome: 'limit_reached' as const,
					pet: toWirePet(result.pet),
					messages_left: 0 as const
				}
			}
		case 'answered':
			if (body.voice) startReplyVoice(user, body, result)
			if (result.outcome === 'replied') await recordReply(user, body, result)
			if (result.remembered) await recordMemory(user, result.remembered)
			return {
				body: {
					outcome: result.outcome,
					reply: result.reply.reply,
					intent: result.reply.intent,
					suggested_action: result.reply.suggestedAction,
					need_changed: result.needChanged,
					pet: toWirePet(result.pet),
					messages_left: result.messagesLeft,
					...(result.remembered && {
						remembered: { id: result.remembered.id, text: result.remembered.text }
					}),
					...(result.recalled && { recalled: result.recalled })
				}
			}
	}
})

/** Starts the reply's voice without waiting for it; nothing when there is no voice set up. */
function startReplyVoice(
	user: AppUser,
	body: TalkBody,
	result: Extract<TalkResult, { kind: 'answered' }>
): void {
	const provider = voiceProvider()
	if (!provider) return
	startVoice({
		userId: user.id,
		messageId: body.message_id,
		text: result.reply.reply,
		from: 'talk',
		species: speciesSchema.safeParse(result.pet.species).data ?? 'cat',
		preset: presetIdSchema.safeParse(result.pet.preset).data ?? DEFAULT_PRESET,
		intent: result.reply.intent,
		provider
	})
}

/** A fact kept from talking: its labels only, never its words or tags. */
async function recordMemory(user: AppUser, kept: KeptMemory): Promise<void> {
	await recordUserEvent(user.id, MEMORY_EVENTS.memorySaved, {
		path: PATH,
		metadata: {
			source: 'talk',
			category: kept.category,
			kind: kept.kind,
			replaced: kept.replaced
		},
		dedupeMatch: { source: 'talk' }
	})
}

/** The events for a reply that counted. Never the words, the reply or the pet's name. */
async function recordReply(
	user: AppUser,
	body: TalkBody,
	result: Extract<TalkResult, { kind: 'answered' }>
): Promise<void> {
	await recordUserEvent(user.id, TALK_EVENTS.talkReplyReceived, {
		path: PATH,
		metadata: {
			input: body.input,
			intent: analyticsIntent(result.reply.intent),
			need_changed: result.needChanged
		},
		dedupeMatch: { input: body.input }
	})
	if (!result.first) return

	const activation = { activation_type: 'first_talk_reply' }
	await recordUserEvent(user.id, LIFECYCLE_EVENTS.userActivated, {
		path: PATH,
		metadata: activation,
		dedupeForever: true
	})
	const profile = await profileStore.playEventProfile(user.id)
	await trackPlayEvent(
		'user_activated',
		{
			id: user.id,
			email: user.email ?? undefined,
			country: profile?.region ?? undefined,
			locale: profile?.locale ?? undefined,
			plan: profile?.planType ?? 'free',
			marketing_consent: profile?.marketingConsent === true
		},
		activation,
		// Stable per user: the platform dedupes on it, so activation is sent once.
		{ eventId: `activated:${user.id}` }
	)
}
