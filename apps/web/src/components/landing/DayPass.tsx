import type { Scheme } from '@app/brand'
import { Container } from '../Container'
import { Reveal } from '../motion/Reveal'

/**
 * A day with no scene: it passes in one line on the page's own ground. That is
 * the point of it. Nothing happens to a pet you did not open the app for
 * (docs/application/product.md, "No guilt").
 */
export function DayPass({
	day,
	line,
	prev
}: {
	day: number
	line: string
	/** The scheme of the scene above; after a daytime scene the band opens on its dusk. */
	prev: Scheme
}) {
	return (
		<div data-day={day} data-prev={prev} className="day-pass relative bg-bg">
			<Container className={prev === 'light' ? 'pb-24 pt-64 sm:pb-28 sm:pt-72' : 'py-24 sm:py-28'}>
				<Reveal>
					<p className="t-h2 mx-auto max-w-[24ch] text-balance text-center text-ink-secondary">
						{line}
					</p>
				</Reveal>
			</Container>
		</div>
	)
}
