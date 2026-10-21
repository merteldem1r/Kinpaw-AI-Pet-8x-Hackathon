import { z } from 'zod'
import type { MemoryCursor } from '@/server/db/memory'

// Where a page of "Mochi remembers…" starts (GET /api/app/v1/pet/memories): "ISO time|uuid",
// base64url. Opaque to the app, which only hands back what it was given; checked here before
// it reaches a query, so a made-up cursor is a 400, never a query on anything else.

const cursorSchema = z.object({ createdAt: z.iso.datetime(), id: z.uuid() })

export function encodeCursor({ createdAt, id }: MemoryCursor): string {
	return Buffer.from(`${createdAt.toISOString()}|${id}`).toString('base64url')
}

/** The place a cursor names, or null when it isn't one this server handed out. */
export function decodeCursor(cursor: string): MemoryCursor | null {
	const [createdAt, id, ...rest] = Buffer.from(cursor, 'base64url').toString('utf8').split('|')
	if (rest.length > 0) return null
	const parsed = cursorSchema.safeParse({ createdAt, id })
	return parsed.success ? { createdAt: new Date(parsed.data.createdAt), id: parsed.data.id } : null
}
