import type { Metadata } from 'next'
import { Container } from '@/components/Container'
import { FaqList } from '@/components/FaqList'
import { PageHeader, PageShell } from '@/components/PageShell'
import { PricingMatrix } from '@/components/PricingMatrix'
import { TrackEvent } from '@/components/TrackEvent'
import { FUNNEL_EVENTS } from '@/lib/analytics/events'
import { faqs } from '@/lib/faq'

export const metadata: Metadata = {
	title: 'Pricing',
	description:
		'Kinpaw is free to love. Kinpaw Plus adds unlimited talking, more spoken replies, a longer memory and the Plus looks.'
}

export default function PricingPage() {
	return (
		<PageShell>
			{/* Intent signal. The gap between this and checkout_started is the drop
          that never reached a payment sheet. */}
			<TrackEvent name={FUNNEL_EVENTS.pricingView} />
			<Container className="pb-28 sm:pb-36">
				<PageHeader
					title="Free to love. Plus for more."
					lead="Your pet, its voice, its memory and ten messages a day to it are free for good. Kinpaw Plus is unlimited talking, more spoken replies, a longer memory and the rare looks, billed by the App Store, so you can cancel there at any time."
				/>
				<div className="mt-14 sm:mt-16">
					<PricingMatrix />
				</div>

				<section className="mt-28 grid gap-12 sm:mt-36 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
					<h2 className="t-h1 max-w-[5.8em] text-balance">Questions, answered.</h2>
					<FaqList items={faqs} />
				</section>
			</Container>
		</PageShell>
	)
}
