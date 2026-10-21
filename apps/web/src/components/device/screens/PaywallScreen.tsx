import { Infinity as InfinityIcon, Sparkles, X } from 'lucide-react'
import { lookById } from '@app/contract'
import { paidPlans } from '@/lib/pricing'
import { PetSvg } from '../../pet/PetSvg'
import {
	AppButton,
	Glow,
	GUTTER_WIDE,
	HomeIndicator,
	IconDisc,
	INSET_BOTTOM,
	INSET_TOP,
	SelectionRow,
	StatusBar,
	type
} from '../parts'

/*
 * Kinpaw Plus (apps/mobile/app/upgrade.tsx; spec "Paywall"): Mochi on the glow,
 * what Plus adds, the plan rows, and the pinned shelf with the price line and
 * the action. Restore, Terms and Privacy sit under the action, as the store
 * rules ask. Prices come from src/lib/pricing.ts, so this shows its
 * placeholders until there are real ones; the app always shows the store's.
 * No trial is decided, so none is shown.
 */
const PET = lookById('ginger')
// The app's own two lines (apps/mobile/components/plus/plusFeatures.ts).
const FEATURES = [
	{ icon: InfinityIcon, label: 'Talk with Mochi as much as you like' },
	{ icon: Sparkles, label: 'Plus looks and rare builder options' }
]
/** Which paid plan the sample shows as picked (the yearly one, as in the app). */
const PICKED_PERIOD = 'year'

/** Kinpaw Plus, at 393 × 852 pt. */
export function PaywallScreen() {
	const plans = [...paidPlans].sort((a) => (a.period === PICKED_PERIOD ? -1 : 1))
	const picked = plans[0]
	return (
		<div className="absolute inset-0 overflow-hidden bg-bg text-ink">
			<Glow className="-top-[120px] left-1/2 h-[520px] w-[520px] -translate-x-1/2" />
			<StatusBar />

			<div
				className="absolute inset-x-0 flex flex-col gap-[20px]"
				style={{ top: INSET_TOP + 4, padding: `0 ${GUTTER_WIDE}px` }}
			>
				<IconDisc>
					<X size={18} strokeWidth={2.2} />
				</IconDisc>

				<div className="-mt-[28px] flex flex-col items-center gap-[4px] text-center">
					<PetSvg appearance={PET.appearance} mood="happy" className="h-[120px] w-[120px]" />
					<p style={{ ...type('display'), fontSize: 34, lineHeight: '38px' }}>
						More time with Mochi
					</p>
				</div>

				<div className="flex flex-col gap-[12px]">
					{FEATURES.map(({ icon: Icon, label }) => (
						<span key={label} className="flex items-center gap-[12px]" style={type('body')}>
							<span className="grid h-[32px] w-[32px] place-items-center rounded-[10px] bg-brand-dim text-brand-ink">
								<Icon size={16} strokeWidth={2} />
							</span>
							{label}
						</span>
					))}
				</div>

				<div className="flex flex-col gap-[10px]">
					{plans.map((plan) => (
						<SelectionRow
							key={plan.id}
							title={plan.period === 'year' ? 'Yearly' : 'Monthly'}
							subtitle={plan.period === 'year' ? 'Billed once a year' : 'Billed monthly'}
							isSelected={plan === picked}
							trailing={
								<span className="flex flex-col items-end">
									<span style={{ ...type('label'), fontVariantNumeric: 'tabular-nums' }}>
										{plan.price}
									</span>
									<span className="text-ink-tertiary" style={type('caption')}>
										per {plan.period}
									</span>
								</span>
							}
						/>
					))}
				</div>
			</div>

			<div
				className="absolute inset-x-0 bottom-0 z-10 flex flex-col gap-[10px] border-t border-line-hairline bg-surface shadow-overlay"
				style={{ padding: `12px ${GUTTER_WIDE}px ${INSET_BOTTOM + 8}px` }}
			>
				<p
					className="text-center text-ink-secondary"
					style={{ ...type('bodySm'), fontVariantNumeric: 'tabular-nums' }}
				>
					{picked?.price} per {picked?.period}. Cancel any time in the App Store.
				</p>
				<AppButton withArrow>Continue</AppButton>
				<p className="text-center text-ink-tertiary" style={type('caption')}>
					Restore purchases · Terms of Use · Privacy
				</p>
			</div>
			<HomeIndicator />
		</div>
	)
}
