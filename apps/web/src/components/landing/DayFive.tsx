import { brandConfig } from '@app/brand'
import { DEFAULT_LOOK, lookById } from '@app/contract'
import { BrandMark } from '../BrandMark'
import { Container } from '../Container'
import { LivePet } from '../pet/LivePet'
import { Reveal } from '../motion/Reveal'
import { ScrubText } from '../motion/ScrubText'
import { WordRise } from '../motion/WordRise'
import { Scene } from './Scene'
import { Stand } from './stage'

const MOCHI = lookById(DEFAULT_LOOK.cat)

// What a note is allowed to be, from the app's own rules
// (docs/application/updates/v2.md, "Notes from your pet").
const RULES = [
	'It asks before it ever sends one, and one switch turns them off.',
	'At most one a day, three in all, and only between 9 in the morning and 9 at night.',
	'Open the app and the count starts over. Your pet perks up the moment you are back.'
]

/**
 * Day 5, a bright afternoon you spent elsewhere. The scene is the lock screen
 * the note arrives on: the hour, large, and one banner in the pet's voice,
 * drawn straight onto the sky. The pet waits at the bottom, a little sad and
 * otherwise fine.
 */
export function DayFive() {
	return (
		<Scene id="day-5" day={5} phase="afternoon" prev="dark" bodyAt={{ x: 88, y: 9 }}>
			<Container className="pb-32 pt-36 sm:pb-40 sm:pt-44">
				<Reveal className="mx-auto max-w-[26rem] text-center">
					<p aria-hidden="true" className="lock-clock t-number text-ink">
						2:10
					</p>
					<div
						role="img"
						aria-label="A notification from Mochi: I saved you the warm spot."
						className="mt-6 flex items-start gap-3 rounded-[1.4rem] border border-line-soft bg-surface/90 p-3.5 text-left shadow-raised backdrop-blur-md"
					>
						<BrandMark siteName={brandConfig.siteName} />
						<span className="min-w-0 flex-1">
							<span className="flex items-baseline justify-between gap-3">
								<span className="text-[15px] font-semibold text-ink">Mochi</span>
								<span className="text-xs text-ink-tertiary">now</span>
							</span>
							<span className="mt-0.5 block text-[15px] leading-snug text-ink-body">
								I saved you the warm spot.
							</span>
						</span>
					</div>
				</Reveal>

				<Reveal className="mt-20 lg:mt-24">
					<WordRise
						as="h2"
						onView
						lines={["On day five, you're busy.", 'Nothing bad happens.']}
						className="t-display text-balance"
					/>
				</Reveal>
				<div className="mt-8 grid items-end gap-12 lg:grid-cols-[1.15fr_0.85fr] lg:gap-16">
					<Reveal>
						<p className="t-lead max-w-[46ch] text-pretty text-ink-body">
							<ScrubText text="Your pet never dies, never leaves and never keeps score. Its needs drift down while you are away and more slowly while it sleeps. At worst it is hungry or a little sad, and it writes you one small note." />
						</p>
						<ul className="mt-8 max-w-[52ch] space-y-3 text-[15px] leading-relaxed text-ink-body">
							{RULES.map((rule) => (
								<li key={rule} className="flex gap-3">
									<span
										aria-hidden="true"
										className="mt-[0.6em] h-1.5 w-1.5 shrink-0 rounded-full bg-brand-ink"
									/>
									{rule}
								</li>
							))}
						</ul>
					</Reveal>
					<Reveal delay={120} className="flex justify-center lg:justify-end">
						<Stand>
							<LivePet
								appearance={MOCHI.appearance}
								mood="sad"
								label="Mochi, a ginger cat, waiting and a little sad"
								sizeClassName="scene-pet"
							/>
						</Stand>
					</Reveal>
				</div>
			</Container>
		</Scene>
	)
}
