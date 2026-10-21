/**
 * The chapters of /whats-new, in reading order. `id` is the section's anchor,
 * so the contents list and the "what is built" rows link to the same place.
 */
const CHAPTERS = [
	{ id: 'built', title: 'What is built' },
	{ id: 'memory', title: 'Long-term memory' },
	{ id: 'notes', title: 'Notes from your pet' },
	{ id: 'voice', title: 'Mochi speaks' },
	{ id: 'photo', title: 'Your pet from a photo' },
	{ id: 'looks', title: 'More pet looks' },
	{ id: 'postcard', title: 'The daily postcard' },
	{ id: 'limits', title: 'Fair-use limits' },
	{ id: 'privacy', title: 'What is sent where' },
	{ id: 'log', title: 'Day by day' }
] as const

export type ChapterId = (typeof CHAPTERS)[number]['id']

/** A chapter's title, by its id: the heading and the contents list never drift apart. */
export function chapterTitle(id: ChapterId): string {
	return CHAPTERS.find((chapter) => chapter.id === id)?.title ?? id
}

/**
 * Contents: a plain list of anchors. In the column beside the article it stays
 * in view while you read (from lg); on a phone it is a list above the article.
 */
export function Contents() {
	return (
		<nav
			aria-labelledby="contents-label"
			className="lg:sticky lg:top-28 lg:max-h-[calc(100vh-9rem)] lg:self-start lg:overflow-y-auto"
		>
			<p id="contents-label" className="text-sm font-semibold text-ink">
				On this page
			</p>
			<ol className="mt-3 border-y border-line-hairline py-2 lg:border-y-0 lg:border-l lg:py-0">
				{CHAPTERS.map((chapter) => (
					<li key={chapter.id}>
						<a
							href={`#${chapter.id}`}
							className="flex min-h-11 items-center text-[15px] text-ink-secondary transition-colors duration-fast hover:text-ink lg:min-h-0 lg:py-1.5 lg:pl-4"
						>
							{chapter.title}
						</a>
					</li>
				))}
			</ol>
		</nav>
	)
}
