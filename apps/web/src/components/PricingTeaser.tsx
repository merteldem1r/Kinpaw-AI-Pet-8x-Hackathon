import { ArrowRight, Check } from 'lucide-react'
import { plans } from '@/lib/pricing'
import { FUNNEL_EVENTS } from '@/lib/analytics/events'
import { Container } from './Container'
import { TrackedLink } from './TrackedLink'
import { Ground } from './landing/Ground'
import { Reveal } from './motion/Reveal'
import { WordRise } from './motion/WordRise'

// One clause per line. The plans themselves live in src/lib/pricing.ts.
const HEADING = ['Free to love.', 'Plus for more time together.']

const FREE = plans.find((p) => p.id === 'free')!
const PLUS = plans.find((p) => p.featured)!

/**
 * The landing page's plans, in two short columns: what is free, and what Plus
 * adds. No prices and no cards here; the cards, with their placeholder prices,
 * are on /pricing.
 */
export function PricingTeaser() {
	return (
		<section id="pricing" className="relative isolate bg-bg py-24 sm:py-28">
			<Ground washAt="right" />
			<Container className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
				<Reveal>
					<WordRise as="h2" onView lines={HEADING} className="t-h1" />
					<p className="mt-6 max-w-[36ch] text-pretty leading-relaxed text-ink-secondary">
						Kinpaw Plus is billed by the App Store, so cancelling is always in your hands. Prices
						are set before launch.
					</p>
					{/* `cta` is this event's declared discriminator. */}
					<TrackedLink
						href="/pricing"
						name={FUNNEL_EVENTS.ctaClicked}
						properties={{ cta: 'pricing_teaser' }}
						className="group mt-5 inline-flex min-h-11 items-center gap-2 font-semibold text-brand-ink"
					>
						Compare plans
						<ArrowRight className="h-4 w-4 transition-transform duration-fast group-hover:translate-x-0.5" />
					</TrackedLink>
				</Reveal>
				<Reveal delay={90} className="stagger grid gap-10 sm:grid-cols-2">
					{[
						FREE,
						{ ...PLUS, features: PLUS.features.filter((f) => f !== 'Everything in Free') }
					].map((plan) => (
						<div key={plan.id}>
							<h3 className="t-h3">
								{plan.id === 'free' ? 'Free, for good' : `${plan.name} adds`}
							</h3>
							<ul className="mt-5 space-y-3 border-t border-line-hairline pt-5">
								{plan.features.map((feature) => (
									<li key={feature} className="flex gap-3 text-[15px] leading-snug text-ink-body">
										<Check aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-brand-ink" />
										{feature}
									</li>
								))}
							</ul>
						</div>
					))}
				</Reveal>
			</Container>
		</section>
	)
}
