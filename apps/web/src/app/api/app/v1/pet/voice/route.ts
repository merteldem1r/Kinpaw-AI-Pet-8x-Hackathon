import {
	DEFAULT_PRESET,
	endpoints,
	intentSchema,
	presetIdSchema,
	speciesSchema,
	VOICE_WINDOW_MINUTES,
	type VoiceBody
} from '@app/contract'
import { ApiError } from '@/server/api/app-errors'
import { createAppRoute } from '@/server/api/app-route'
import { introStore } from '@/server/db/intro'
import { talkStore } from '@/server/db/talk'
import { makeVoice, takeVoiceJob, type VoiceOutcome } from '@/server/voice/make-voice'
import { voiceProvider, type VoiceProvider } from '@/server/voice/provider'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/app/v1/pet/voice: the pet's reply, spoken in its voice (docs/application/features/
 * v2-voice-requirements.md, R1–R6, R13). The phone asks after showing the text, with the message
 * id the reply counted under and the reply's words.
 *
 * Only words the server just answered for this person, within VOICE_WINDOW_MINUTES, once: a
 * talk reply it counted, or (`from: 'intro'`) "Tell me about you"'s answer it recorded. The
 * voice is picked from the pet's species and preset, and its emotion from the intent the reply
 * counted with (an intro answer is warm: happy): never from the request. The words go to fal and nowhere else: not a log,
 * not an event, not `ai_usage` (which keeps their length).
 *
 * - 200 `spoken`: play `audio_url` at `playback_rate`. `talk_reply_voiced` is recorded first-party (daily).
 * - 200 `limited`: a daily limit is reached (R5); nothing to play, nothing to show.
 * - 400: a body the contract refuses (no message id, empty or too-long words).
 * - 404: nothing answered under this message id for this person in the window, or already spoken.
 * - 503 `voice_unavailable`: fal couldn't make it; the text stands (R6).
 * - 503 `not_configured`: no FAL_KEY.
 */
export const POST = createAppRoute(endpoints.petVoice, async ({ user, body }) => {
	const provider = voiceProvider()
	if (!provider) throw new ApiError('not_configured', "Your pet's voice isn't set up.")

	// Started by the talk route as its reply was made: pick it up.
	const started = takeVoiceJob(user.id, body.message_id)
	const outcome = started ? await started : await speakNow(user.id, body, provider)

	switch (outcome.kind) {
		case 'limited':
			return { body: { outcome: 'limited' as const } }
		case 'taken':
			throw new ApiError('not_found', 'There is no reply to speak.')
		case 'unavailable':
			throw new ApiError('voice_unavailable', "Your pet's voice didn't come through this time.")
		case 'spoken':
			return {
				body: {
					outcome: 'spoken' as const,
					audio_url: outcome.audioUrl,
					duration_ms: outcome.durationMs,
					playback_rate: outcome.playbackRate
				}
			}
	}
})

/** No job: check the words were just answered for this person, then make the voice. */
async function speakNow(
	userId: string,
	body: VoiceBody,
	provider: VoiceProvider
): Promise<VoiceOutcome> {
	const now = new Date()
	const since = new Date(now.getTime() - VOICE_WINDOW_MINUTES * 60_000)
	const from = body.from ?? 'talk'
	const reply =
		from === 'intro'
			? await introStore.answeredAttempt(userId, body.message_id, since)
			: await talkStore.countedReply(userId, body.message_id, since)
	if (!reply) throw new ApiError('not_found', 'There is no reply to speak.')

	return makeVoice({
		userId,
		messageId: body.message_id,
		text: body.text,
		from,
		species: speciesSchema.safeParse(reply.species).data ?? 'cat',
		preset: presetIdSchema.safeParse(reply.preset).data ?? DEFAULT_PRESET,
		intent: 'intent' in reply ? (intentSchema.safeParse(reply.intent).data ?? 'neutral') : null,
		provider,
		now
	})
}
