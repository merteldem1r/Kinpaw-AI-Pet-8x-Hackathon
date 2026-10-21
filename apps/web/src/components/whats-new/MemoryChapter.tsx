import { chapterTitle } from './Contents'
import { Chapter, Facts, Opening, Para, Points, Said, Sub, TextLink, type Fact } from './parts'

// docs/application/updates/v2.md, "Long-term memory": "How well it works".
const MEASURED: readonly Fact[] = [
	{ value: '12 of 12', label: 'facts worth keeping were kept, in the check against Groq' },
	{ value: '0 of 8', label: 'sensitive facts were kept, in the same check' },
	{ value: '6', label: 'facts kept from one paragraph, in a real try' }
]

/** Long-term memory, with "Tell me about you" and "I missed you". */
export function MemoryChapter() {
	return (
		<Chapter id="memory" title={chapterTitle('memory')}>
			<Opening>
				The pet remembers short facts you tell it, such as <Said>exam on Friday</Said> or{' '}
				<Said>sister called Ece</Said>, and brings them up later: <Said>How did the exam go?</Said>{' '}
				You can see, search and forget everything it remembers.
			</Opening>

			<Sub>How a fact is kept and used</Sub>
			<Points>
				<li>
					When the pet replies, the same AI call may keep one new fact of about 80 characters. There
					is no second call, and the conversation itself is never kept.
				</li>
				<li>
					Nothing sensitive is kept: health, religion, politics, sexuality, ethnicity, money and
					passwords are filtered out.
				</li>
				<li>
					A pet holds up to 30 facts, or 100 with Kinpaw Plus. When it is full, the lowest-scored
					fact goes.
				</li>
				<li>
					For each message, a score in plain code picks the 6 facts the AI sees: matching words, a
					follow-up that is due, and importance. The prompt never grows, so memory costs about a
					cent a month per user.
				</li>
				<li>
					Lasting facts stay for months, until they are corrected or pushed out by the cap. An event
					is asked about once after its date, then dropped after about two weeks.
				</li>
				<li>
					Talking runs on Groq&rsquo;s <code className="text-[0.92em] text-ink">gpt-oss-120b</code>.
					It replaced <code className="text-[0.92em] text-ink">gpt-oss-20b</code>, which could not
					update a fact that had changed.
				</li>
			</Points>

			<Sub>What you see of it</Sub>
			<Para>
				A reply that kept a fact says <Said>Mochi will remember that</Said> under it. A reply that
				used one says <Said>From Mochi&rsquo;s memory</Said>, and only when the server has checked
				that the reply really mentions it. The pet&rsquo;s page shows the 5 newest facts, and a full
				list with a search and a forget that asks first. Facts are deleted with the pet and with the
				account.
			</Para>

			<Sub>What the checks measured</Sub>
			<Facts items={MEASURED} className="mt-5" />
			<Para>
				The real try left out depression, therapy, religion and a password, all of which were in the
				paragraph.
			</Para>

			<Sub>Tell me about you</Sub>
			<Para>
				Right after you save your pet, one optional step lets you say or type a few sentences, up to
				60 words, so the pet knows you from the first minute. One AI call turns them into up to 8
				facts and a first line from the pet. The facts appear as chips, and you can remove any of
				them. The AI is called only when you tap send, at most twice, and never for someone who says
				they are under 13.
			</Para>

			<Sub>I missed you</Sub>
			<Para>
				Come back after 6 hours or more and the pet&rsquo;s first line says so, by how long you were
				away: <Said>You&rsquo;re back! I missed you. Not even pretending.</Said> An event it
				remembers whose day has come is asked about once:{' '}
				<Said>I missed you! How did the exam go?</Said> This uses no AI call. The server says how
				long you were away and which question is due. The landing page plays this out in{' '}
				<TextLink href="/#week">the week with Mochi</TextLink>.
			</Para>
		</Chapter>
	)
}
