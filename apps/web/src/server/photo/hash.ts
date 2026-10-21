import { createHmac } from 'node:crypto'

// Install ids and IP addresses, never stored as they are (v2-pet-from-photo-requirements.md,
// R23): a keyed hash (HMAC-SHA256 with PHOTO_HASH_SECRET), so the same phone or network gives the
// same value, and nobody holding the table can turn one back into an id or an address (an IP
// address alone has too few possibilities for a plain hash to hide it).

/** Used outside production when PHOTO_HASH_SECRET is unset, so development needs no setup. */
const DEVELOPMENT_SECRET = 'kinpaw-development-only'

/** The key to hash with, or null: production without a secret is closed. */
export function hashSecret(configured: string | null): string | null {
	if (configured) return configured
	return process.env.NODE_ENV === 'production' ? null : DEVELOPMENT_SECRET
}

export function keyedHash(secret: string, kind: 'device' | 'ip', value: string): string {
	return createHmac('sha256', secret).update(`${kind}:${value}`).digest('hex')
}

/**
 * The caller's address: the first hop of `x-forwarded-for` (set by Vercel), else `x-real-ip`,
 * else "local" (development on this Mac, where everything is one network anyway).
 */
export function clientIp(headers: Headers): string {
	const forwarded = headers.get('x-forwarded-for')?.split(',')[0]?.trim()
	return forwarded || headers.get('x-real-ip')?.trim() || 'local'
}
