import { NextRequest, NextResponse } from 'next/server'
import { trackPlayEvent } from '@/lib/plays/events'
import { getRequestCountry } from '@/lib/geo'
import { waitlistBody } from '@/server/api/public-bodies'
import { leadStore } from '@/server/db/leads'
import { log } from '@/server/lib/logger'

export const runtime = 'nodejs'

/** POST { email } → upsert into the `waitlist` table. */
export async function POST(req: NextRequest) {
	let raw: unknown
	try {
		raw = await req.json()
	} catch {
		return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
	}

	const parsed = waitlistBody.safeParse(raw)
	if (!parsed.success) {
		return NextResponse.json({ error: 'Please enter a valid email address' }, { status: 400 })
	}
	const { email } = parsed.data

	try {
		await leadStore.joinWaitlist({
			email,
			source: 'web',
			userAgent: req.headers.get('user-agent') ?? null
		})

		// Tell the platform, so this address is in the audience that gets the
		// launch announcement when the play ships. A waitlist nobody can email is
		// just a table. `id` is the email here because there is no account yet.
		await trackPlayEvent(
			'waitlist_joined',
			{
				id: email,
				email,
				country: (await getRequestCountry()) ?? undefined,
				plan: 'free',
				// A waitlist signup IS the opt-in — they asked to be told at launch.
				marketing_consent: true
			},
			{ source: 'web' },
			// Stable id: the upsert ignores duplicates, and so should this. Re-submitting
			// the form must not look like a second person joining.
			{ eventId: `waitlist:${email}` }
		)

		return NextResponse.json({ ok: true })
	} catch (err) {
		log.error('waitlist signup failed', { source: 'api/waitlist', err })
		return NextResponse.json(
			{ error: 'Could not join the waitlist right now. Please try again.' },
			{ status: 500 }
		)
	}
}
