import { chapterTitle } from './Contents'
import { Chapter, Opening, Para, TextLink } from './parts'

/*
 * What leaves the phone, where it goes and what is kept, one row per kind of
 * data. Sources: docs/application/product.md ("Talking", "v2 decisions") and
 * docs/application/updates/v2.md. It must never say more than /privacy does.
 */
const FLOWS: readonly { what: string; goes: string; kept: string }[] = [
	{
		what: 'Your voice',
		goes: 'Apple’s speech recognition on the iPhone turns it into text, and only that text is sent to Kinpaw.',
		kept: 'No audio reaches the Kinpaw server.'
	},
	{
		what: 'What you say',
		goes: 'As text, to the Kinpaw server and to Groq, which writes the pet’s reply.',
		kept: 'The conversation is never kept. The server keeps only that a message was sent, the kind of message it was and how it changed the pet.'
	},
	{
		what: 'What the pet remembers',
		goes: 'Short facts are written in the same call as the reply and stored on the Kinpaw server.',
		kept: 'You can see each one and forget it, and all of them are deleted with the pet and the account. Nothing sensitive is kept at all.'
	},
	{
		what: 'A spoken reply',
		goes: 'The pet’s reply, never what you said, is sent to Inworld’s speech model, through fal.ai, to be spoken.',
		kept: 'With the voice turned off in Settings, nothing is sent.'
	},
	{
		what: 'A photo of your pet',
		goes: 'Shrunk on the phone, stripped of its location on the server, then sent once to Google’s Gemini 2.5 Flash, through fal.ai. You are asked first.',
		kept: 'The photo is never kept. Tries are counted by scrambled codes, never by the phone’s id or its address.'
	},
	{
		what: 'Notes from your pet',
		goes: 'Nowhere. The phone schedules them itself, with no server, no push token and no AI call.',
		kept: 'A note never mentions anything the pet remembers.'
	},
	{
		what: 'Tell me about you',
		goes: 'Your words go to the AI only when you tap send, and only after you have signed in.',
		kept: 'Nothing is sent for someone who says they are under 13.'
	}
]

/** What is sent where, and what is never kept. */
export function PrivacyChapter() {
	return (
		<Chapter id="privacy" title={chapterTitle('privacy')}>
			<Opening>
				Three AI services are involved. Groq writes the pet&rsquo;s reply, Google&rsquo;s Gemini
				reads a photo once, and Inworld speaks the reply; the last two are reached through fal.ai.
				Each row says what is sent and what is kept afterwards.
			</Opening>

			<dl className="mt-8 border-y border-line-soft">
				{FLOWS.map((flow) => (
					<div
						key={flow.what}
						className="grid gap-x-8 gap-y-1.5 border-b border-line-hairline py-5 last:border-b-0 sm:grid-cols-[11rem_minmax(0,1fr)]"
					>
						<dt className="font-semibold text-ink">{flow.what}</dt>
						<dd className="max-w-[60ch] text-pretty leading-relaxed text-ink-body">
							{flow.goes} <span className="text-ink">{flow.kept}</span>
						</dd>
					</div>
				))}
			</dl>

			<Para>
				Analytics events never carry what was said, the pet&rsquo;s reply or the pet&rsquo;s name.
				The site&rsquo;s <TextLink href="/privacy">privacy page</TextLink> has the wording for
				talking and for photos.
			</Para>
		</Chapter>
	)
}
