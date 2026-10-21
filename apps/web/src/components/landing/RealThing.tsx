import { ArrowRight } from 'lucide-react'
import { DEMO, SHOTS } from '@/lib/captures'
import { FUNNEL_EVENTS } from '@/lib/analytics/events'
import { cn } from '@/lib/utils'
import { Container } from '../Container'
import { TrackedLink } from '../TrackedLink'
import { DeviceFrame } from '../device/DeviceFrame'
import { HomeScreen } from '../device/screens/HomeScreen'
import { PaywallScreen } from '../device/screens/PaywallScreen'
import { TalkingScreen } from '../device/screens/TalkingScreen'
import { WelcomeScreen } from '../device/screens/WelcomeScreen'
import { Reveal } from '../motion/Reveal'
import { ScrubText } from '../motion/ScrubText'
import { WordRise } from '../motion/WordRise'
import { DemoVideo } from './DemoVideo'
import { Ground } from './Ground'
import { RailControls } from './RailControls'

/** The app's screens drawn from its own parts, for a page that has no screenshots yet. */
const DRAWN: { screen: React.ReactNode; label: string; caption: string }[] = [
	{
		screen: <WelcomeScreen />,
		label: 'The welcome screen: three pets waiting under the evening sky',
		caption: 'Welcome, at whatever hour it is'
	},
	{
		screen: <HomeScreen />,
		label: 'My pet: Mochi under the evening sky, its needs at its sides, Feed, Play and Pet below',
		caption: 'My pet, on one screen'
	},
	{
		screen: <TalkingScreen />,
		label: 'My pet: what you said above the mic, and Mochi answering in its bubble',
		caption: 'Talking, by voice or by typing'
	},
	{
		screen: <PaywallScreen />,
		label: 'Kinpaw Plus, with placeholder prices',
		caption: 'Kinpaw Plus, on one clear screen'
	}
]

const PHONE = '[--screen:236] sm:[--screen:262]'

const LEAD = {
	real: 'Everything above runs in the page. These are real screens and a real recording, from the iPhone app as it is built today.',
	drawn:
		'Everything above runs in the page. These are the screens of the iPhone app, drawn here from the same parts the app is built with.'
}

/**
 * The app itself, after a page that never showed a phone: real screens from the
 * Simulator and one recording (src/lib/captures.ts), in a row that scrolls
 * sideways, every second phone a step lower from a desktop up.
 */
export function RealThing() {
	const hasShots = SHOTS.length > 0
	return (
		<section id="app" className="relative isolate overflow-clip bg-bg py-28 sm:py-36">
			<Ground washAt="right" />
			<Container className="grid items-center gap-12 lg:grid-cols-[1fr_auto] lg:gap-20">
				<Reveal>
					<WordRise
						as="h2"
						onView
						lines={['And this is the app itself.']}
						className="t-display max-w-[14ch] text-balance"
					/>
					<p className="t-lead mt-6 max-w-[44ch] text-pretty text-ink-secondary">
						<ScrubText text={hasShots ? LEAD.real : LEAD.drawn} />
					</p>
					{/* `cta` is this event's declared discriminator. */}
					<TrackedLink
						href="/whats-new"
						name={FUNNEL_EVENTS.ctaClicked}
						properties={{ cta: 'whats_new' }}
						className="group mt-8 inline-flex min-h-11 items-center gap-2 font-semibold text-brand-ink"
					>
						What is new, and how each part works
						<ArrowRight className="h-4 w-4 transition-transform duration-fast group-hover:translate-x-0.5" />
					</TrackedLink>
				</Reveal>
				{DEMO && (
					<Reveal delay={120} className="flex justify-center">
						<DemoVideo
							{...DEMO}
							caption="Thirty seconds with Mochi, recorded"
							className="[--screen:272] sm:[--screen:320]"
						/>
					</Reveal>
				)}
			</Container>

			<Container className="mt-20 flex items-end justify-between gap-6 sm:mt-24">
				<h3 className="t-h3">The screens, as they are</h3>
				<RailControls target="app-rail" />
			</Container>
			<Reveal className="mt-8">
				<ul
					id="app-rail"
					aria-label="Screens of the app"
					className="app-rail flex snap-x snap-mandatory gap-6 overflow-x-auto pb-8 lg:gap-8"
				>
					{hasShots
						? SHOTS.map((shot, i) => (
								<Phone key={shot.src} index={i} caption={shot.caption}>
									<DeviceFrame label={shot.label} src={shot.src} className={PHONE} />
								</Phone>
							))
						: DRAWN.map((drawn, i) => (
								<Phone key={drawn.caption} index={i} caption={drawn.caption}>
									<DeviceFrame label={drawn.label} className={PHONE}>
										{drawn.screen}
									</DeviceFrame>
								</Phone>
							))}
				</ul>
			</Reveal>
		</section>
	)
}

/** One phone in the row; every second one sits lower on a desktop. */
function Phone({
	index,
	caption,
	children
}: {
	index: number
	caption: string
	children: React.ReactNode
}) {
	return (
		<li className={cn('rail-phone flex-none snap-start', index % 2 === 1 && 'lg:mt-14')}>
			<figure>
				{children}
				<figcaption className="mt-4 max-w-[15rem] text-sm leading-snug text-ink-secondary">
					{caption}
				</figcaption>
			</figure>
		</li>
	)
}
