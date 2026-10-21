'use client'

import { useState, useTransition } from 'react'
import { grantPlus, revokePlus, type PlanActionResult } from './actions'

type Mode = 'idle' | 'granting' | 'confirmRevoke'

/**
 * One account's Plus controls on the users screen (M7, R1–R4). Free: "Grant Plus" opens a
 * one-line optional reason, then grants. Granted: "Revoke", then a confirm step (operators
 * misclick). Plus from a store subscription: nothing, since it can't be revoked here.
 */
export function PlanControls({ userId, bucket }: { userId: string; bucket: string }) {
	const [mode, setMode] = useState<Mode>('idle')
	const [reason, setReason] = useState('')
	const [result, setResult] = useState<PlanActionResult | null>(null)
	const [pending, startTransition] = useTransition()

	function run(action: () => Promise<PlanActionResult>) {
		startTransition(async () => {
			const next = await action()
			setResult(next)
			setMode('idle')
			setReason('')
		})
	}

	const note = result ? (
		<p className={`mt-1 text-xs ${result.ok ? 'text-ink-mute' : 'text-danger'}`} role="status">
			{result.message}
		</p>
	) : null

	if (bucket === 'free') {
		if (mode === 'granting') {
			return (
				<form
					className="flex items-center gap-2"
					onSubmit={(e) => {
						e.preventDefault()
						run(() => grantPlus(userId, reason))
					}}
				>
					<input
						value={reason}
						onChange={(e) => setReason(e.target.value)}
						placeholder="Reason (optional)"
						maxLength={200}
						aria-label="Reason for the grant (optional)"
						className="w-40 rounded-lg border border-border-soft bg-transparent px-2 py-1 text-xs"
						autoFocus
					/>
					<button type="submit" disabled={pending} className={BUTTON_BRAND}>
						{pending ? 'Granting…' : 'Grant'}
					</button>
					<button type="button" onClick={() => setMode('idle')} className={BUTTON_QUIET}>
						Cancel
					</button>
				</form>
			)
		}
		return (
			<div>
				<button type="button" onClick={() => setMode('granting')} className={BUTTON_QUIET}>
					Grant Plus
				</button>
				{note}
			</div>
		)
	}

	if (bucket === 'granted') {
		if (mode === 'confirmRevoke') {
			return (
				<div className="flex items-center gap-2">
					<span className="text-xs text-ink-soft">Take Plus back?</span>
					<button
						type="button"
						disabled={pending}
						onClick={() => run(() => revokePlus(userId))}
						className={BUTTON_DANGER}
					>
						{pending ? 'Revoking…' : 'Revoke'}
					</button>
					<button type="button" onClick={() => setMode('idle')} className={BUTTON_QUIET}>
						Cancel
					</button>
				</div>
			)
		}
		return (
			<div>
				<button type="button" onClick={() => setMode('confirmRevoke')} className={BUTTON_QUIET}>
					Revoke
				</button>
				{note}
			</div>
		)
	}

	// A store subscription, a trial or a sandbox purchase: managed by the store, not here.
	return <span className="text-xs text-ink-mute">—</span>
}

const BUTTON_BASE =
	'rounded-lg px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-60'
const BUTTON_QUIET = `${BUTTON_BASE} border border-border-soft text-ink-soft hover:bg-surface2 hover:text-ink`
const BUTTON_BRAND = `${BUTTON_BASE} bg-brand-dim text-brand-ink hover:opacity-90`
const BUTTON_DANGER = `${BUTTON_BASE} border border-danger/40 text-danger hover:bg-danger/10`
