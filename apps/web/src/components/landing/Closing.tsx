import { IS_LIVE } from '@/lib/stores'
import { Container } from '../Container'
import { StoreBadges } from '../StoreBadges'
import { WaitlistForm } from '../WaitlistForm'
import { Reveal } from '../motion/Reveal'
import { ScrubText } from '../motion/ScrubText'
import { WordRise } from '../motion/WordRise'
import { ClosingPet } from './ClosingPet'
import { Scene } from './Scene'

const HEADING = 'Day eight is yours.'
// One line for each state. Which one shows follows the store URLs in
// src/lib/stores.ts, so the page never says the app is out before it is.
const BODY = IS_LIVE
	? 'Free on iPhone. Make your pet first; sign in only when you want to keep it.'
	: 'Kinpaw is not in the App Store yet. Leave your email and we will write once, the day it is.'

/**
 * The close: the night after the week. The pet the visitor made (or Mochi) is
 * asleep on the right, and the action is on the left, its button carrying the
 * pet's name when it has one.
 */
export function Closing() {
	return (
		<Scene id="download" phase="night" prev="dark">
			<Container className="grid items-end gap-12 pb-28 pt-36 sm:pb-36 sm:pt-44 lg:grid-cols-[1.1fr_0.9fr] lg:gap-10">
				<Reveal>
					<WordRise as="h2" onView lines={[HEADING]} className="t-display text-balance" />
					<p className="t-lead mt-6 max-w-[40ch] text-pretty text-ink-body">
						<ScrubText text={BODY} />
					</p>
					{IS_LIVE ? (
						<StoreBadges placement="closing" className="mt-9" />
					) : (
						<div className="mt-9 max-w-md">
							<WaitlistForm placement="closing" />
						</div>
					)}
				</Reveal>
				<Reveal delay={120} className="flex justify-center lg:justify-end">
					<ClosingPet />
				</Reveal>
			</Container>
		</Scene>
	)
}
