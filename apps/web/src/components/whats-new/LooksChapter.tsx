import { chapterTitle } from './Contents'
import { Chapter, Ledger, Opening, Para, Points, Sub, TextLink, type Fact } from './parts'

// docs/application/updates/v2.md, "More pet looks and a layered coat": what is new.
const ADDED: readonly Fact[] = [
	{ value: '5', label: 'patterns' },
	{ value: '3', label: 'fur colours' },
	{ value: '3', label: 'eye colours' },
	{ value: '2', label: 'ears for each species' },
	{ value: '2', label: 'tails' },
	{ value: '1', label: 'body, Tiny' }
]

/** More pet looks: the layered coat and the new builder options. */
export function LooksChapter() {
	return (
		<Chapter id="looks" title={chapterTitle('looks')}>
			<Opening>
				The builder has more choices, and a coat can have more than one colour, so you can make a
				pet that looks like your own: a tabby with white socks, a calico, a Siamese, a husky, a
				beagle, a Doberman.
			</Opening>

			<Sub>How a coat is built</Sub>
			<Points>
				<li>
					A coat is four choices: its colour, its pattern, the colour of its markings, and its paws
					and chest, which can be white markings on any fur colour.
				</li>
				<li>
					The app and this website draw the pet from one shared list of shapes, so the two always
					match. No pet is an image file.
				</li>
				<li>Pets saved before the change look exactly as they did.</li>
				<li>Lynx ears and Ice eyes are Kinpaw Plus options.</li>
				<li>A glitch of 1 to 2 seconds on each pick in the builder is gone.</li>
			</Points>

			<Sub>What was added</Sub>
			<Ledger items={ADDED} />
			<Para>
				The landing page has <TextLink href="/#make">a builder you can try</TextLink>.
			</Para>
		</Chapter>
	)
}

/** The daily postcard: planned, with nothing built. */
export function PostcardChapter() {
	return (
		<Chapter id="postcard" title={chapterTitle('postcard')}>
			<Opening>
				Not started. The plan is a picture and a caption from your pet each day, kept in an album.
			</Opening>
			<Para>
				Nothing of it is built, so this page has nothing to show for it and no numbers to report.
			</Para>
		</Chapter>
	)
}
