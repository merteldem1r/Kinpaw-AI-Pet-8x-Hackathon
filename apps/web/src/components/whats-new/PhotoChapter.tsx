import { chapterTitle } from './Contents'
import { Chapter, Facts, Opening, Para, Points, Said, Sub, TextLink, type Fact } from './parts'

// docs/application/updates/v2.md, "Your pet from a photo".
const MEASURED: readonly Fact[] = [
	{
		value: '36 of 36',
		label: 'right on species, coat, pattern, markings, eyes and ears, across 6 photos'
	},
	{ value: 'About 2 seconds', label: 'to read a photo' },
	{ value: 'About $0.001', label: 'a photo' }
]

/** Your pet from a photo: one AI read, drawn by Kinpaw's own code. */
export function PhotoChapter() {
	return (
		<Chapter id="photo" title={chapterTitle('photo')}>
			<Opening>
				A photo of your real cat or dog becomes your Kinpaw pet. You watch it draw itself, check it
				against the question <Said>Is this your pet?</Said>, then keep it or adjust it.
			</Opening>
			<Para>
				Making a pet now starts with two choices: from a photo, or by hand. With Kinpaw Plus you can
				redo your pet from a new photo once a day, even from a dog to a cat. You can try the by-hand
				builder <TextLink href="/#make">on the landing page</TextLink>.
			</Para>

			<Sub>How a photo becomes a pet</Sub>
			<Points>
				<li>The phone shrinks the photo to a few hundred KB before it sends it.</li>
				<li>
					The server strips the photo&rsquo;s location, then makes one call to Google&rsquo;s Gemini
					2.5 Flash, through fal.ai. The model describes the pet using Kinpaw&rsquo;s own list of
					options.
				</li>
				<li>
					Kinpaw&rsquo;s own code draws the pet from that description. The AI reads the photo; it
					does not make the picture.
				</li>
				<li>The photo is never kept.</li>
				<li>
					The first photo asks your permission before anything is sent to the AI, and names the
					service.
				</li>
				<li>
					On a free account, a Plus option that the photo shows becomes the nearest free one, with a
					note. Whether an account has Plus is checked on the server.
				</li>
			</Points>

			<Sub>What the test measured</Sub>
			<Facts items={MEASURED} className="mt-5" />
			<Para>
				Six photos is a small test. It says the read works on the pets it was tried on, not on every
				cat and dog.
			</Para>

			<Sub>Limits against abuse</Sub>
			<Para>
				Signed out, a phone gets 2 tries, and deleting the app does not reset them. A network gets 6
				reads a day and the whole app 300. Only a read the AI actually answered counts. Tries are
				counted by scrambled codes, never by the phone&rsquo;s id or its address.
			</Para>
		</Chapter>
	)
}
