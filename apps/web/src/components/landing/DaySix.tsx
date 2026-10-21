import { Container } from '../Container'
import { WordRise } from '../motion/WordRise'
import { Reveal } from '../motion/Reveal'
import { FriendsRail } from './FriendsRail'
import { Scene } from './Scene'

/**
 * Day 6, a morning: your friends' pets. What a friend sees and how you add one
 * are the app's rules (docs/application/features/v2-friends-requirements.md:
 * R3 the list, R8 the Camera, R9 no request to accept, R13 what a friend sees).
 * The scene holds still while the row of pets passes (FriendsRail); a Scene
 * clips (`overflow-clip`) rather than hides, so the row can stick.
 */
export function DaySix() {
	return (
		<Scene id="day-6" day={6} phase="morning" prev="light" bodyAt={{ x: 90, y: 9 }}>
			<FriendsRail>
				<Container>
					<Reveal className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr] lg:items-end lg:gap-16">
						<WordRise
							as="h2"
							onView
							lines={['On day six, you look in', 'on your friends’ pets.']}
							className="t-h1 text-balance"
						/>
						<p className="t-lead max-w-[44ch] text-pretty text-ink-body">
							Show a friend your code, or scan theirs with the iPhone&rsquo;s Camera. Their pet
							joins your Friends tab in its mood right now, and yours joins theirs. They see your
							name and your pet, nothing else.
						</p>
					</Reveal>
				</Container>
			</FriendsRail>
		</Scene>
	)
}
