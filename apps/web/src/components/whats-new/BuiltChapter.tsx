import { cn } from '@/lib/utils'
import { chapterTitle, type ChapterId } from './Contents'
import { Chapter, Para } from './parts'

/*
 * Every fact here is docs/application/updates/v2.md, "At a glance". A feature
 * is "Built" when its code runs end to end on localhost, and "Not started"
 * when nothing of it exists; the page claims nothing in between.
 */
const FEATURES: readonly { id: ChapterId; gives: string; isBuilt: boolean }[] = [
	{
		id: 'memory',
		gives: 'The pet remembers what you tell it and asks about it later.',
		isBuilt: true
	},
	{
		id: 'notes',
		gives: 'A daily note on your lock screen when the pet misses you.',
		isBuilt: true
	},
	{
		id: 'voice',
		gives: 'The pet says its replies out loud, in a voice that fits it.',
		isBuilt: true
	},
	{
		id: 'photo',
		gives: 'A photo of your real cat or dog becomes your Kinpaw pet.',
		isBuilt: true
	},
	{
		id: 'looks',
		gives: 'New options and two-colour coats: tabby, calico, Siamese, husky.',
		isBuilt: true
	},
	{
		id: 'postcard',
		gives: 'A picture and caption from your pet each day, kept in an album.',
		isBuilt: false
	}
]

/** The answer in one screen: the six parts of v2 and which of them exist. */
export function BuiltChapter() {
	return (
		<Chapter id="built" title={chapterTitle('built')}>
			<Para>
				Long-term memory came first: it is the one feature that gets better the longer you use it,
				so it is the reason to come back on day 7. The daily note is what brings you back. Five of
				the six parts are built, and the postcard is not started.
			</Para>

			<ul className="pane mt-8 divide-y divide-line-hairline px-5 sm:px-7">
				{FEATURES.map((feature) => (
					<li
						key={feature.id}
						className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1 py-4 sm:grid-cols-[13rem_minmax(0,1fr)_auto] sm:items-baseline sm:gap-x-6"
					>
						<a
							href={`#${feature.id}`}
							className="font-semibold text-ink underline decoration-line-active transition-colors duration-fast hover:text-brand-ink"
						>
							{chapterTitle(feature.id)}
						</a>
						<span
							className={cn(
								'text-sm font-semibold sm:order-3',
								feature.isBuilt ? 'text-brand-ink' : 'text-ink-tertiary'
							)}
						>
							{feature.isBuilt ? 'Built' : 'Not started'}
						</span>
						<span className="col-span-2 text-pretty leading-relaxed text-ink-secondary sm:order-2 sm:col-span-1">
							{feature.gives}
						</span>
					</li>
				))}
			</ul>
		</Chapter>
	)
}
