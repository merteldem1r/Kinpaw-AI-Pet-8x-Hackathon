import { chapterTitle } from './Contents'
import { Chapter, Opening } from './parts'

/*
 * docs/application/updates/v2.md, "Day by day", with the process detail left
 * out: what was done each day, by feature. `date` is ISO for <time>.
 */
const DAYS: readonly {
	date: string
	label: string
	done: readonly { feature: string; text: string }[]
}[] = [
	{
		date: '2026-10-03',
		label: '3 October',
		done: [
			{
				feature: 'The plan',
				text: 'The reviewer’s questions answered (day 7, cost per user, the free limit) and v2 put in a new order.'
			},
			{
				feature: 'Memory',
				text: 'Specified, then built: the rules tested against Groq, the table, memory in talking, and “Mochi remembers…” with forget.'
			},
			{ feature: 'Pet looks', text: 'Finished.' }
		]
	},
	{
		date: '2026-10-04',
		label: '4 October',
		done: [
			{ feature: 'Memory', text: '“Tell me about you” decided, and its server and screen built.' },
			{ feature: 'Notes', text: 'Specified and built.' },
			{
				feature: 'Photo',
				text: 'Specified, the AI read built and tested (36 of 36), and the screens built.'
			}
		]
	},
	{
		date: '2026-10-05',
		label: '5 October',
		done: [
			{
				feature: 'Memory',
				text: '“Tell me about you” reworked after a first try: one page, words kept across pauses, and the facts floating around the pet.'
			},
			{
				feature: 'Photo',
				text: 'Finished: 5 problems fixed on the Simulator, the Plus redo, permission before the AI, and the privacy and paywall lines.'
			}
		]
	},
	{
		date: '2026-10-06',
		label: '6 October',
		done: [
			{
				feature: 'Memory',
				text: '“I missed you” built: the return line and a question that is due, with no AI call.'
			},
			{ feature: 'Notes', text: 'Opens counted.' },
			{
				feature: 'Voice',
				text: 'The speech models on fal.ai compared, then the feature specified and built: a voice for each species and personality, and a Settings toggle.'
			},
			{
				feature: 'Voice, then tuned',
				text: 'Inworld instead of MiniMax for the cost, played 1.15× faster; 5 spoken replies a day free and 20 with Plus; the voice on the personality step, on meeting the pet and in “Tell me about you”; text and voice arriving together; the pet’s eyes and sound bars while it speaks.'
			}
		]
	}
]

/** The build log, one row per day. */
export function LogChapter() {
	return (
		<Chapter id="log" title={chapterTitle('log')}>
			<Opening>
				v2 started on 3 October 2026. This is what was done on each day since, up to 6 October.
			</Opening>

			<ol className="mt-8 border-y border-line-soft">
				{DAYS.map((day) => (
					<li
						key={day.date}
						className="grid gap-x-8 gap-y-3 border-b border-line-hairline py-6 last:border-b-0 sm:grid-cols-[8rem_minmax(0,1fr)]"
					>
						<time dateTime={day.date} className="t-number text-ink">
							{day.label}
						</time>
						<ul className="max-w-[60ch] space-y-2.5">
							{day.done.map((item) => (
								<li key={item.feature} className="text-pretty leading-relaxed text-ink-body">
									<span className="font-semibold text-ink">{item.feature}.</span> {item.text}
								</li>
							))}
						</ul>
					</li>
				))}
			</ol>
		</Chapter>
	)
}
