import {
	VOICE_DAILY_ALL,
	VOICE_DAILY_FREE,
	VOICE_DAILY_PLUS,
	VOICE_WINDOW_MINUTES,
	type Intent,
	type PresetId,
	type Species,
	type VoiceSource
} from '@app/contract'
import { TALK_EVENTS } from '@/lib/analytics/events'
import { recordUserEvent } from '@/lib/analytics/record'
import { aiUsageStore } from '@/server/db/ai-usage'
import { profileStore } from '@/server/db/profiles'
import { log } from '@/server/lib/logger'
import { claimOnce, releaseClaim } from './once'
import type { VoiceProvider } from './provider'
import { emotionFor } from './voices'

// Making the pet's voice for words the server just answered (docs/application/features/
// v2-voice-requirements.md, R2–R5, R13), for the voice route and, started early, for the talk
// route. The limits, the once-only claim, the call, `ai_usage` and `talk_reply_voiced`; never the
// words in a log, an event or `ai_usage` (which keeps their length).
//
// Started early (2026-10-06, Mert: "make them come at the same time"): the talk route starts the
// voice the moment its reply exists and answers with the text at once; the phone's voice request
// then picks the running job up here instead of starting from nothing, which saves its round trip.
// Kept in this server's memory for the window. On several instances the phone's request may land
// on another one, which finds no job and makes the voice itself, after the same checks.

const PATH = '/api/app/v1/pet/voice'
const WINDOW_MS = VOICE_WINDOW_MINUTES * 60_000

export type VoiceOutcome =
	| { kind: 'spoken'; audioUrl: string; durationMs: number; playbackRate: number }
	| { kind: 'limited' }
	/** Already spoken (or being spoken) under this message id. */
	| { kind: 'taken' }
	| { kind: 'unavailable' }

export type VoiceRequest = {
	userId: string
	messageId: string
	text: string
	from: VoiceSource
	species: Species
	preset: PresetId
	/** The intent a talk reply counted with; null for an intro answer (warm: happy). */
	intent: Intent | null
	provider: VoiceProvider
	now?: Date
}

const startOfUtcDay = (now: Date) => {
	const day = new Date(now)
	day.setUTCHours(0, 0, 0, 0)
	return day
}

/**
 * Makes the voice, once per message id, within the daily limits (R4–R5): the person's by their
 * plan (the server's premium check, never the phone's word), and the whole app's.
 */
export async function makeVoice({
	userId,
	messageId,
	text,
	from,
	species,
	preset,
	intent,
	provider,
	now = new Date()
}: VoiceRequest): Promise<VoiceOutcome> {
	const today = startOfUtcDay(now)
	const [mine, everyone, plus] = await Promise.all([
		aiUsageStore.countSince('voice', today, userId),
		aiUsageStore.countSince('voice', today),
		profileStore.isPremium(userId)
	])
	const allowed = plus ? VOICE_DAILY_PLUS : VOICE_DAILY_FREE
	if (mine >= allowed || everyone >= VOICE_DAILY_ALL) return { kind: 'limited' }
	if (!claimOnce(messageId, now.getTime())) return { kind: 'taken' }

	const result = await provider.speak({
		text,
		species,
		preset,
		emotion: emotionFor(intent ?? 'kind')
	})
	await aiUsageStore.record({
		userId,
		provider: provider.name,
		model: provider.model,
		inputTokens: text.length,
		outputTokens: null,
		latencyMs: result.latencyMs,
		outcome: result.ok ? 'replied' : result.failure,
		intent,
		purpose: 'voice'
	})
	if (!result.ok) {
		releaseClaim(messageId)
		return { kind: 'unavailable' }
	}
	await recordUserEvent(userId, TALK_EVENTS.talkReplyVoiced, {
		path: PATH,
		metadata: { voice: preset, from },
		dedupeMatch: { from }
	})
	return {
		kind: 'spoken',
		audioUrl: result.audioUrl,
		durationMs: result.durationMs,
		playbackRate: result.playbackRate
	}
}

type Job = { userId: string; startedAt: number; outcome: Promise<VoiceOutcome> }
const jobs = new Map<string, Job>()

/**
 * Starts making the voice now, without waiting, for the phone to pick up (`takeVoiceJob`). Never
 * rejects: a failure is an `unavailable` outcome, logged without the words.
 */
export function startVoice(request: VoiceRequest): void {
	const now = Date.now()
	for (const [id, job] of jobs) if (now - job.startedAt > WINDOW_MS) jobs.delete(id)
	const outcome = makeVoice(request).catch((err: unknown) => {
		log.error('voice failed to start', { source: 'voice', err })
		return { kind: 'unavailable' } as const
	})
	jobs.set(request.messageId, { userId: request.userId, startedAt: now, outcome })
}

/** The voice the talk route started for this person's message, once; null when there is none. */
export function takeVoiceJob(userId: string, messageId: string): Promise<VoiceOutcome> | null {
	const job = jobs.get(messageId)
	if (!job || job.userId !== userId) return null
	jobs.delete(messageId)
	return job.outcome
}
