import Link from 'next/link'
import { faqs } from '@/lib/faq'
import { Container } from '../Container'
import { FaqList } from '../FaqList'
import { Reveal } from '../motion/Reveal'
import { WordRise } from '../motion/WordRise'
import { Ground } from './Ground'

/** The questions about the pet itself; the rest are on /pricing. */
const ON_LANDING = new Set([
	'pet_dies',
	'pet_speaks',
	'pet_memory',
	'pet_photo',
	'pet_notes',
	'devices'
])

export function FaqSection() {
	return (
		<section id="faq" className="relative isolate bg-bg py-24 sm:py-28">
			<Ground washAt="left" />
			<Container className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
				<Reveal>
					<WordRise
						as="h2"
						onView
						lines={['Questions, answered.']}
						className="t-h1 max-w-[5.8em] text-balance"
					/>
					<p className="mt-6 max-w-[34ch] text-pretty leading-relaxed text-ink-secondary">
						Something else on your mind?{' '}
						<Link href="/support" className="font-medium text-brand-ink underline">
							Ask us
						</Link>{' '}
						and we will get back to you.
					</p>
				</Reveal>
				<Reveal delay={90}>
					<FaqList items={faqs.filter((faq) => ON_LANDING.has(faq.id))} className="stagger" />
				</Reveal>
			</Container>
		</section>
	)
}
