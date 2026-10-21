import { Container } from '../Container'
import { Reveal } from '../motion/Reveal'
import { ScrubText } from '../motion/ScrubText'
import { WordRise } from '../motion/WordRise'
import { Scene } from './Scene'
import { Voices } from './Voices'

/**
 * Day 2, a morning: the pet has a voice. The copy stands at the top left of
 * the sky and the pet below it, over one wide row of the four personalities.
 * The limits are the app's (docs/memory/pet-voice.md).
 */
export function DayTwo() {
	return (
		<Scene id="day-2" day={2} phase="morning" followsLocalPrev>
			<Container className="pb-28 pt-36 sm:pb-32 sm:pt-48">
				<Reveal className="max-w-[52rem]">
					<WordRise
						as="h2"
						onView
						lines={['On day two, it says', 'good morning. Out loud.']}
						className="t-display text-balance"
					/>
					<p className="t-lead mt-6 max-w-[46ch] text-pretty text-ink-body">
						<ScrubText text="Every pet has a voice that fits it: a cat or a dog, in one of four personalities. These are the app’s own recordings. Pick one and listen." />
					</p>
				</Reveal>

				<Reveal className="mt-24 sm:mt-20">
					<Voices />
				</Reveal>

				<Reveal>
					<p className="mx-auto mt-8 max-w-[62ch] text-pretty text-center text-[15px] leading-relaxed text-ink-secondary">
						In the app your pet says its replies out loud. Five spoken replies a day are free,
						twenty with Kinpaw Plus, and one switch in Settings turns the voice off.
					</p>
				</Reveal>
			</Container>
		</Scene>
	)
}
