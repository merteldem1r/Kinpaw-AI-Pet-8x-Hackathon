import type { PrismaClient } from '@prisma/client'
import type { Intent, PhotoMiss } from '@app/contract'
import { db } from './client'

// One row per call to the pet's voice or the photo reader (prisma/schema/talk.prisma: ai_usage),
// failed or not. A stand-in until template-web's AI usage module is available
// (docs/memory/ai-usage-stand-in.md): a usage log only, never read to decide anything a person
// sees. Never holds what was said or the reply, and never a photo.

/**
 * How a call ended. Talking: `limit_reached` is a reply discarded because the day filled up
 * meanwhile. A photo read: `read`, or what the model found instead of one pet.
 */
export type AiUsageOutcome =
	'replied' | 'retried' | 'limit_reached' | 'read' | PhotoMiss | 'unavailable' | 'invalid'

export type AiUsageEntry = {
	/** Null for a photo read made signed out, while creating a pet. */
	userId: string | null
	provider: string
	model: string
	inputTokens: number | null
	outputTokens: number | null
	latencyMs: number
	outcome: AiUsageOutcome
	/** The intent the model named, when it answered. */
	intent: Intent | null
	/**
	 * What the call was for: a message (the default), "Tell me about you", a photo read, or a
	 * reply spoken aloud. For `voice`, `inputTokens` is the characters spoken (fal bills by them).
	 */
	purpose?: AiUsagePurpose
}

export type AiUsagePurpose = 'talk' | 'intro' | 'photo' | 'voice'

export function createAiUsageStore(client: PrismaClient) {
	return {
		async record(entry: AiUsageEntry): Promise<void> {
			await client.aiUsage.create({ data: entry })
		},

		/**
		 * Calls for `purpose` that answered (`replied`) at or after `since`: one person's when
		 * `userId` is given, everyone's otherwise. For the voice's daily limits (v2-voice R5).
		 */
		async countSince(purpose: AiUsagePurpose, since: Date, userId?: string): Promise<number> {
			return client.aiUsage.count({
				where: { purpose, outcome: 'replied', createdAt: { gte: since }, ...(userId && { userId }) }
			})
		}
	}
}

export type AiUsageStore = ReturnType<typeof createAiUsageStore>

export const aiUsageStore = createAiUsageStore(db)
