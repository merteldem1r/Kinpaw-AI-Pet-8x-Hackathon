import { chapterTitle } from './Contents'
import { Chapter, Ledger, Opening, Para, Sub, TextLink, type Fact } from './parts'

/*
 * The limits the server enforces, by plan: docs/application/product.md
 * ("Talking", "Money", "v2 decisions") and docs/application/updates/v2.md.
 */
const BY_PLAN: readonly { what: string; free: string; plus: string }[] = [
	{ what: 'Messages to the pet, a day', free: '10', plus: 'Unlimited' },
	{ what: 'Replies said out loud, a day', free: '5', plus: '20' },
	{ what: 'Facts the pet remembers', free: '30', plus: '100' },
	{ what: 'Redoing the pet from a new photo, a day', free: 'None', plus: '1' }
]

// Limits that hold whatever the plan: they protect the app, not a tier.
const FOR_EVERYONE: readonly Fact[] = [
	{ value: '6', label: 'remembered facts go into each message, never more' },
	{ value: '2', label: 'AI calls for “Tell me about you”, at most' },
	{ value: '2', label: 'photo tries for a phone that is signed out' },
	{ value: '6', label: 'photo reads a day for one network' },
	{ value: '300', label: 'photo reads a day for the whole app' },
	{ value: '1,000', label: 'spoken replies a day for the whole app' }
]

/** Every limit in one place, by plan and for the whole app. */
export function LimitsChapter() {
	return (
		<Chapter id="limits" title={chapterTitle('limits')}>
			<Opening>
				Memory, the voice, the notes and a pet from a photo are all on the free plan. Kinpaw Plus
				raises the numbers, and the server does the counting, never the phone.
			</Opening>

			<div className="mt-8 max-w-[68ch]">
				<table className="w-full table-fixed border-collapse border-y border-line-soft text-left">
					<caption className="sr-only">Daily limits on the free plan and on Kinpaw Plus</caption>
					<thead>
						<tr className="border-b border-line-soft text-sm text-ink-secondary">
							<th scope="col" className="w-[52%] py-3 pr-3 font-semibold">
								Limit
							</th>
							<th scope="col" className="py-3 pr-3 font-semibold">
								Free
							</th>
							<th scope="col" className="py-3 font-semibold">
								Plus
							</th>
						</tr>
					</thead>
					<tbody className="divide-y divide-line-hairline">
						{BY_PLAN.map((row) => (
							<tr key={row.what}>
								<th
									scope="row"
									className="text-pretty py-3.5 pr-3 align-top font-normal leading-snug text-ink-body"
								>
									{row.what}
								</th>
								<td className="t-number py-3.5 pr-3 align-top text-ink">{row.free}</td>
								<td className="t-number py-3.5 align-top text-ink">{row.plus}</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
			<Para>
				The message count resets at your local midnight, and a message counts only when its reply
				arrives. A free account can use a photo only while it is creating its pet. The prices for
				Kinpaw Plus are still placeholders: see <TextLink href="/pricing">pricing</TextLink>.
			</Para>

			<Sub>The same for everyone</Sub>
			<Ledger items={FOR_EVERYONE} />
			<Para>
				Reaching a limit never breaks anything. A reply past the voice limit stays as text. At the
				end of the free messages the pet says it is all talked out and the Kinpaw Plus screen opens,
				while Feed, Play and Pet keep working.
			</Para>
		</Chapter>
	)
}
