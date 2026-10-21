import { NextRequest, NextResponse } from 'next/server'
import { contactBody, contactMessageTooLong } from '@/server/api/public-bodies'
import { leadStore } from '@/server/db/leads'
import { log } from '@/server/lib/logger'

export const runtime = 'nodejs'

/** POST { name, email, message } → insert into `contact_messages`. */
export async function POST(req: NextRequest) {
	let raw: unknown
	try {
		raw = await req.json()
	} catch {
		return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
	}

	const parsed = contactBody.safeParse(raw)
	if (!parsed.success) {
		const error = contactMessageTooLong(parsed.error)
			? 'Message is too long'
			: 'Please fill in your name, a valid email, and a message'
		return NextResponse.json({ error }, { status: 400 })
	}
	const { name, email, message } = parsed.data

	try {
		await leadStore.addContactMessage({ name, email, message, category: 'general' })
		return NextResponse.json({ ok: true })
	} catch (err) {
		log.error('contact message failed', { source: 'api/contact', err })
		return NextResponse.json(
			{ error: 'Could not send your message. Please try again.' },
			{ status: 500 }
		)
	}
}
