import { z } from 'zod'
import { emailAddress } from '@app/contract'

// The bodies of the website's public routes (/api/waitlist, /api/contact, /api/delete-account,
// /api/track). Anyone can call them, so each body is parsed here before any of it is used.
// Their responses are the website's own, not /api/app/v1's, and the routes keep them.

/** POST /api/waitlist. */
export const waitlistBody = z.object({ email: emailAddress })

/** The longest contact message taken, in characters. */
export const CONTACT_MESSAGE_MAX = 5000
/** The longest name on a contact message. */
const CONTACT_NAME_MAX = 200

/** POST /api/contact. */
export const contactBody = z.object({
	name: z.string().trim().min(1).max(CONTACT_NAME_MAX),
	email: emailAddress,
	message: z.string().trim().min(2).max(CONTACT_MESSAGE_MAX)
})

/** Whether a refused contact body was refused only for being too long, which has its own line. */
export function contactMessageTooLong(error: z.ZodError): boolean {
	return error.issues.some((issue) => issue.path[0] === 'message' && issue.code === 'too_big')
}

/** POST /api/delete-account without a session: a request, by address, from the public page. */
export const deletionRequestBody = z.object({ email: emailAddress, confirm: z.literal(true) })

/** A field the beacon can do without: a wrong type drops the field, never the event. */
const optionalString = z.string().optional().catch(undefined)

/**
 * POST /api/track. Only `name` decides whether anything is recorded (it must be a registered
 * event); `metadata` is filtered per event by the route, so it stays unknown here.
 */
export const trackBody = z.object({
	name: z.string().catch(''),
	path: optionalString,
	sessionId: optionalString,
	metadata: z.unknown().optional()
})
