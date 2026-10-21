import { Container } from '../Container'
import { Reveal } from '../motion/Reveal'
import { ScrubText } from '../motion/ScrubText'
import { WordRise } from '../motion/WordRise'
import { Ground } from './Ground'
import { MakeYours } from './MakeYours'

/**
 * After the week: the visitor's own pet. The builder is the app's (the same
 * catalogue and drawing code); what "from a photo" does and keeps is the app's
 * rule (docs/application/updates/v2.md, "Your pet from a photo").
 */
export function MakeSection() {
	return (
		<section id="make" className="relative isolate bg-bg py-28 sm:py-36">
			<Ground washAt="left" />
			<Container>
				<Reveal>
					<WordRise as="h2" onView lines={['Now make yours.']} className="t-display" />
					<p className="t-lead mt-6 max-w-[48ch] text-pretty text-ink-secondary">
						<ScrubText text="This is the app’s own pet builder, drawing with the same code the app does. Give yours a name and it will be waiting at the bottom of this page." />
					</p>
				</Reveal>
				<Reveal className="mt-14 sm:mt-16">
					<MakeYours />
				</Reveal>
				<Reveal>
					<p className="mt-14 max-w-[62ch] text-pretty text-[15px] leading-relaxed text-ink-secondary">
						In the app, a photo of your real cat or dog can do this for you: it is read once, your
						pet is drawn from it, and the photo is never kept. Options marked with a plus come with
						Kinpaw Plus.
					</p>
				</Reveal>
			</Container>
		</section>
	)
}
