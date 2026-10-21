import { IS_LIVE } from '@/lib/stores'
import type { CssVars } from '@/lib/utils'
import { Container } from '../Container'
import { StoreBadges } from '../StoreBadges'
import { WaitlistForm } from '../WaitlistForm'
import { WordRise } from '../motion/WordRise'
import { FollowSky } from './FollowSky'
import { HeroPet } from './HeroPet'
import { Scene } from './Scene'

// The core feeling is "someone missed me" (docs/application/product.md); the
// promise names what sets Kinpaw apart: it talks, and since v2 it remembers.
const HEADLINE = ['Someone missed you today.']
const PROMISE =
	"Kinpaw is a cozy pet that lives on your phone. It talks, it remembers, and it's glad you're back."

/** The waitlist arrives after the headline's words have risen, ms. */
const ACTION_AT = 520

/**
 * Day 1, the first viewport: the sky at the visitor's own hour, the headline
 * across the top, and Mochi in the middle of it, alive, with the three things
 * you can do for a pet. No phone and no screenshot: the product is on the page.
 * The waitlist sits bottom left; the week strip runs under it all.
 */
export function DayOne() {
	return (
		// The sun or moon hangs left of the pet, clear of the headline, the bubble and the needs at every width.
		<Scene id="day-1" day={1} phase="evening" followsLocalSky bodyAt={{ x: 10, y: 33 }}>
			<FollowSky />
			<Container className="relative flex min-h-[100svh] flex-col pb-24 pt-20 sm:pb-28 sm:pt-28">
				<div className="text-center">
					<WordRise as="h1" lines={HEADLINE} className="t-hero hero-line text-balance" />
					{/* No entrance: the promise is the largest text block on a phone, so it
					    paints at once and LCP never waits on an animation. */}
					<p className="t-lead mx-auto mt-3 max-w-[44ch] text-pretty text-ink-body sm:mt-4">
						{PROMISE}
					</p>
				</div>

				<div className="flex flex-1 flex-col justify-end pt-14 sm:pt-12">
					<HeroPet />
				</div>

				<div
					className="enter mx-auto mt-5 w-full max-w-md sm:mt-8 xl:absolute xl:bottom-24 xl:left-8 xl:mx-0 xl:mt-0 xl:w-[17.5rem]"
					style={{ '--enter-delay': `${ACTION_AT}ms` } as CssVars}
				>
					{IS_LIVE ? (
						<StoreBadges placement="hero" />
					) : (
						<>
							<WaitlistForm placement="hero" isCompact />
							<p className="mt-3 text-center text-sm text-ink-secondary xl:text-left">
								Coming to iPhone. One email, the day it is out.
							</p>
						</>
					)}
				</div>
			</Container>
		</Scene>
	)
}
