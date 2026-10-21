import {
	freeVersionOf,
	localDay,
	PHOTO_REDOS_PER_DAY,
	PHOTO_TRIES_SIGNED_OUT,
	type PetAppearance,
	type PhotoLimit,
	type PhotoMiss,
	type PhotoSwap
} from '@app/contract'
import { aiUsageStore } from '@/server/db/ai-usage'
import { photoReadStore, utcDay, type PhotoReadClaim } from '@/server/db/photo-reads'
import { log } from '@/server/lib/logger'
import type { PhotoConfig } from './config'
import { hashSecret, keyedHash } from './hash'
import { preparePhoto } from './prepare-image'
import type { PhotoReader, PhotoReadFailure } from './reader'

// One photo read, from the limits to a drawable pet (v2-pet-from-photo-requirements.md, R7–R12,
// R17–R25). The order matters:
//
//   1. the limits, before anything costs: a read is reserved, or the limit is named (R19–R22)
//   2. the photo decoded, shrunk and stripped (R7, R24); a bad one releases the read
//   3. the model asked, and the call logged in ai_usage (never the photo or the answer)
//   4. our failure releases the read (R17); an answer settles it, so it counts (R20)
//   5. a read for anyone not Plus has its Plus options swapped for the nearest free ones (R11)

/** Counted reads per network per UTC day while creating (R21). */
const PHOTO_READS_PER_NETWORK = 6

export type PhotoRequest =
	| {
			context: 'create'
			/** The phone's install id, from its Keychain. Hashed before it is stored. */
			installId: string
			ip: string
			/** Set when someone signed in is creating; the limit is still the phone's. */
			userId: string | null
	  }
	| {
			context: 'redo'
			ip: string
			userId: string
			timeZone: string
			/** From the profile's plan_type, read by the route (non-negotiable 3). */
			plus: boolean
	  }

export type PhotoFlowResult =
	| { kind: 'not_configured' }
	| { kind: 'plus_required' }
	| { kind: 'limit'; limit: PhotoLimit; left: number }
	| { kind: 'bad_image'; reason: string }
	| { kind: 'failed'; failure: PhotoReadFailure }
	| {
			kind: 'answered'
			/** The counted read's id: the anonymous event's session id, never a person's. */
			readId: string
			left: number
			answer:
				| { outcome: 'read'; appearance: PetAppearance; swapped: PhotoSwap[] }
				| { outcome: PhotoMiss }
	  }

export async function readPetPhoto(
	request: PhotoRequest,
	image: string,
	{
		reader,
		config,
		now = new Date()
	}: { reader: PhotoReader | null; config: PhotoConfig; now?: Date }
): Promise<PhotoFlowResult> {
	const secret = hashSecret(config.hashSecret)
	if (!reader || !secret) return { kind: 'not_configured' }
	if (request.context === 'redo' && !request.plus) return { kind: 'plus_required' }

	const ipHash = keyedHash(secret, 'ip', request.ip)
	const claim: PhotoReadClaim =
		request.context === 'create'
			? {
					context: 'create',
					deviceHash: keyedHash(secret, 'device', request.installId),
					ipHash,
					userId: request.userId,
					day: utcDay(now)
				}
			: {
					context: 'redo',
					ipHash,
					userId: request.userId,
					day: localDay(now, request.timeZone)
				}
	const reserved = await photoReadStore.reserve(
		claim,
		{
			perDevice: PHOTO_TRIES_SIGNED_OUT,
			perNetwork: PHOTO_READS_PER_NETWORK,
			perAccountDay: PHOTO_REDOS_PER_DAY,
			perAppDay: config.dailyCap
		},
		now
	)
	if (reserved.kind === 'limit') {
		return { kind: 'limit', limit: reserved.limit, left: reserved.left }
	}

	const prepared = await preparePhoto(image)
	if (!prepared.ok) {
		await photoReadStore.release(reserved.id)
		return { kind: 'bad_image', reason: prepared.reason }
	}

	const result = await reader.read(prepared.photo)
	await recordUsage(request.userId, reader, result)
	if (!result.ok) {
		await photoReadStore.release(reserved.id)
		return { kind: 'failed', failure: result.failure }
	}

	const { answer } = result
	await photoReadStore.settle(reserved.id, answer.verdict === 'ok' ? 'read' : answer.verdict)
	const base = { kind: 'answered' as const, readId: reserved.id, left: reserved.left }
	if (answer.verdict !== 'ok') return { ...base, answer: { outcome: answer.verdict } }

	const keepsPlus = request.context === 'redo' && request.plus
	const { appearance, swapped } = keepsPlus
		? { appearance: answer.appearance, swapped: [] }
		: freeVersionOf(answer.appearance)
	return { ...base, answer: { outcome: 'read', appearance, swapped } }
}

/** A usage log only: a failure to write it never fails the read. */
async function recordUsage(
	userId: string | null,
	reader: PhotoReader,
	result: Awaited<ReturnType<PhotoReader['read']>>
): Promise<void> {
	try {
		await aiUsageStore.record({
			userId,
			provider: reader.name,
			model: reader.model,
			inputTokens: result.usage.inputTokens,
			outputTokens: result.usage.outputTokens,
			latencyMs: result.latencyMs,
			outcome: result.ok
				? result.answer.verdict === 'ok'
					? 'read'
					: result.answer.verdict
				: result.failure,
			intent: null,
			purpose: 'photo'
		})
	} catch (err) {
		log.error('photo read usage not recorded', { source: 'photo', err })
	}
}
