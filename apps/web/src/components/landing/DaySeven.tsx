import { Container } from '../Container'
import { Reveal } from '../motion/Reveal'
import { ScrubText } from '../motion/ScrubText'
import { WordRise } from '../motion/WordRise'
import { MissedYou } from './MissedYou'
import { Scene } from './Scene'

/**
 * Day 7, at dusk, the brightest sky on the page: the pet asks how Friday went. This is the scene the week exists for, and the one the page is judged
 * on (`week_day_viewed`, day 7). It is kept nearly empty: one line of the
 * narrator, the pet's line at headline size, and the pet.
 */
export function DaySeven() {
	return (
		<Scene id="day-7" day={7} phase="evening" prev="light" bodyAt={{ x: 86, y: 9 }}>
			<Container className="pb-36 pt-36 sm:pb-44 sm:pt-48">
				<Reveal>
					<WordRise
						as="h2"
						onView
						lines={['On day seven, it asks how it went.']}
						className="t-h1 max-w-[20ch] text-balance"
					/>
				</Reveal>
				<div className="mt-12 sm:mt-16">
					<MissedYou />
				</div>
				<Reveal>
					<p className="t-lead mt-14 max-w-[50ch] text-pretty text-ink-body">
						<ScrubText text="Nobody reminded it. Come back after a few hours, a day or three, and the first thing your pet says is that it missed you. If something you told it has come due, it asks." />
					</p>
					<p className="mt-4 max-w-[62ch] text-pretty text-[15px] leading-relaxed text-ink-secondary">
						It keeps up to 30 small facts about you, 100 with Kinpaw Plus. Memory itself is free.
					</p>
				</Reveal>
			</Container>
		</Scene>
	)
}
