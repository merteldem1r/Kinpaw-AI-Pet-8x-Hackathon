import { PageShell } from '@/components/PageShell'
import { PricingTeaser } from '@/components/PricingTeaser'
import { TrackEvent } from '@/components/TrackEvent'
import { Closing } from '@/components/landing/Closing'
import { DayFive } from '@/components/landing/DayFive'
import { DayOne } from '@/components/landing/DayOne'
import { DaySix } from '@/components/landing/DaySix'
import { DaySeven } from '@/components/landing/DaySeven'
import { DayThree } from '@/components/landing/DayThree'
import { DayTwo } from '@/components/landing/DayTwo'
import { FaqSection } from '@/components/landing/FaqSection'
import { MakeSection } from '@/components/landing/MakeSection'
import { PetDraftProvider } from '@/components/landing/PetDraft'
import { RealThing } from '@/components/landing/RealThing'
import { TimeLapse } from '@/components/landing/TimeLapse'
import { WeekStrip } from '@/components/landing/WeekStrip'
import { FUNNEL_EVENTS } from '@/lib/analytics/events'
import { SKY_CSS } from '@/lib/sky'

/**
 * The landing page is a week with a pet: days 1, 2, 3, 5, 6 and 7 are scenes,
 * each a thing the visitor can do or see under that day's sky, and day 4
 * passes while you scroll, midnight to midnight. After the week: make your own, see the real app, the plans, the
 * questions, and the night it ends on.
 */
export default function HomePage() {
	return (
		<PetDraftProvider>
			<PageShell isPadded={false}>
				{/* The skies' colours, from the app's own art (src/lib/sky.ts). */}
				<style dangerouslySetInnerHTML={{ __html: SKY_CSS }} />
				{/* The top of the funnel. Every conversion rate this play reports uses
				    this as its denominator, so it fires for guests too. */}
				<TrackEvent name={FUNNEL_EVENTS.landingView} />
				<div id="week">
					<DayOne />
					<DayTwo />
					<DayThree />
					<TimeLapse
						day={4}
						prev="dark"
						scrollScreens={2.2}
						line="On day four you forget. Nothing happens to Mochi."
					/>
					<DayFive />
					<DaySix />
					<DaySeven />
				</div>
				<WeekStrip />
				<MakeSection />
				<RealThing />
				<PricingTeaser />
				<FaqSection />
				<Closing />
			</PageShell>
		</PetDraftProvider>
	)
}
