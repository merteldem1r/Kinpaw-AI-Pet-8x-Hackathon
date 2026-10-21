import type { MemoryItem } from '@app/contract'
import type { MemoryRecord } from '@/server/db/memory'

/**
 * A kept fact as the app sees it (v2-memory-requirements.md, R16, R23): its words and labels,
 * never its tags, scores or follow-up question.
 */
export function toWireMemory(fact: MemoryRecord): MemoryItem {
	return {
		id: fact.id,
		text: fact.text,
		category: fact.category,
		kind: fact.kind,
		follow_up_on: fact.followUpOn,
		source: fact.source,
		created_at: fact.createdAt.toISOString()
	}
}
