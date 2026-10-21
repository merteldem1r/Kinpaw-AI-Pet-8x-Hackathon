'use client'

import { useState } from 'react'
import { ArrowRight, Check } from 'lucide-react'
import { gaEvent } from '@/lib/analytics/client'
import { FUNNEL_EVENTS } from '@/lib/analytics/events'
import { cn } from '@/lib/utils'
import { usePetDraft } from './landing/PetDraft'

type Status = 'idle' | 'loading' | 'done' | 'error'

/**
 * Email capture that POSTs to /api/waitlist. The route upserts into the
 * `waitlist` table (see supabase migrations). Fully functional once Supabase
 * env vars are set; degrades to an error message otherwise.
 *
 * The closing form's button carries the name a visitor gave their pet in the
 * builder ("Save Biscuit a spot"). The name is a label only: it is not sent.
 */
export function WaitlistForm({
	placement,
	isCompact = false
}: {
	placement: 'hero' | 'closing'
	/**
	 * Day 1's form: one row on a phone, so the action stays in the first screen,
	 * and field over button from xl, where it sits in a narrow corner.
	 */
	isCompact?: boolean
}) {
	const petName = usePetDraft()?.name.trim() ?? ''
	const action = placement === 'closing' && petName ? `Save ${petName} a spot` : 'Tell me at launch'
	const [email, setEmail] = useState('')
	const [status, setStatus] = useState<Status>('idle')
	const [message, setMessage] = useState('')

	async function onSubmit(e: React.FormEvent) {
		e.preventDefault()
		if (!email) return
		setStatus('loading')
		try {
			const res = await fetch('/api/waitlist', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email })
			})
			const data = await res.json().catch(() => ({}))
			if (!res.ok) throw new Error(data.error ?? 'Something went wrong')
			// Fired on success only. Firing on submit would count failed attempts as
			// signups and quietly inflate the top of the funnel.
			gaEvent(FUNNEL_EVENTS.waitlistJoined, { placement, named: petName ? 'yes' : 'no' })
			setStatus('done')
			setMessage("You're on the list — we'll be in touch.")
		} catch (err) {
			setStatus('error')
			setMessage(err instanceof Error ? err.message : 'Something went wrong')
		}
	}

	if (status === 'done') {
		return (
			<p
				role="status"
				className="flex items-center gap-2 rounded-[1.75rem] border border-line-soft bg-surface px-5 py-3.5 text-sm font-medium text-ink sm:rounded-pill"
			>
				<Check className="h-4 w-4 text-brand-ink" aria-hidden="true" /> {message}
			</p>
		)
	}

	return (
		<form onSubmit={onSubmit} className="w-full max-w-md">
			<div
				className={cn(
					'flex gap-1.5 border border-line-soft bg-surface p-1.5 text-ink shadow-soft focus-within:ring-2 focus-within:ring-line-focus sm:flex-row sm:rounded-pill',
					isCompact
						? 'flex-row rounded-pill xl:flex-col xl:rounded-[1.75rem]'
						: 'flex-col rounded-[1.75rem]'
				)}
			>
				<input
					type="email"
					required
					autoComplete="email"
					value={email}
					onChange={(e) => setEmail(e.target.value)}
					placeholder="you@email.com"
					aria-label="Email address"
					aria-invalid={status === 'error' || undefined}
					aria-describedby={status === 'error' ? 'waitlist-error' : undefined}
					className="min-h-11 min-w-0 flex-1 rounded-pill bg-transparent px-4 text-ink focus-visible:outline-none"
				/>
				<button
					type="submit"
					disabled={status === 'loading'}
					className={cn(
						'inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap bg-ink px-4 font-semibold text-ink-inverse transition-[transform,background-color] duration-fast hover:bg-ink/90 active:scale-[0.96] disabled:opacity-60 sm:rounded-pill sm:px-5',
						isCompact ? 'rounded-pill text-[15px] xl:rounded-[1.375rem]' : 'rounded-[1.375rem]'
					)}
				>
					{status === 'loading' ? 'Joining…' : action}
					{status !== 'loading' && <ArrowRight className="h-4 w-4" aria-hidden="true" />}
				</button>
			</div>
			{status === 'error' && (
				<p id="waitlist-error" role="alert" className="mt-2 text-sm font-medium">
					{message}
				</p>
			)}
		</form>
	)
}
