import { Container } from '../Container'
import { Reveal } from '../motion/Reveal'
import { ScrubText } from '../motion/ScrubText'
import { WordRise } from '../motion/WordRise'
import { Scene } from './Scene'
import { TalkReplay } from './TalkReplay'

/**
 * Day 3, late at night: you tell the pet something, and it keeps it. What it
 * keeps and never keeps is the app's own rule
 * (docs/application/product.md, "v2 decisions": long-term memory).
 */
export function DayThree() {
	return (
		<Scene id="day-3" day={3} phase="night" prev="light" bodyAt={{ x: 12, y: 10 }}>
			<Container className="pb-32 pt-36 sm:pb-40 sm:pt-48">
				<Reveal className="max-w-[52rem] lg:ml-auto lg:text-right">
					<WordRise
						as="h2"
						onView
						lines={['On day three, you', 'tell it about Friday.']}
						className="t-display text-balance"
					/>
					<p className="t-lead mt-6 max-w-[46ch] text-pretty text-ink-body lg:ml-auto">
						<ScrubText text="Hold the mic and talk, or type. It answers in the personality you gave it, and when you say something worth keeping, it keeps it: one short fact, never the conversation." />
					</p>
				</Reveal>

				<Reveal className="mt-10 sm:mt-12">
					<TalkReplay />
				</Reveal>

				<Reveal>
					<p className="mt-12 max-w-[62ch] text-pretty text-[15px] leading-relaxed text-ink-secondary">
						You can read everything your pet remembers and make it forget any of it. Health,
						religion, money and passwords are never kept, and ten messages a day are free.
					</p>
				</Reveal>
			</Container>
		</Scene>
	)
}
