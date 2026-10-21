import { chapterTitle } from './Contents'
import { Chapter, Facts, Opening, Points, Said, Sub, type Fact } from './parts'

// docs/application/updates/v2.md, "Notes from your pet": the rules a note keeps.
const RULES: readonly Fact[] = [
	{ value: '3 hours', label: 'is the soonest a note can come after you leave' },
	{ value: '09:00 to 21:00', label: 'is the only time of day a note may arrive' },
	{ value: '1 a day', label: 'at most' },
	{ value: '3 in all', label: 'until you open the app, which cancels them and starts over' }
]

/** Notes from your pet: the local lock-screen note. */
export function NotesChapter() {
	return (
		<Chapter id="notes" title={chapterTitle('notes')}>
			<Opening>
				When you are away and the pet starts to miss you, a note in its voice appears on your lock
				screen, titled with its name: <Said>I saved you the warm spot</Said>. Tapping it opens the
				pet&rsquo;s home screen.
			</Opening>

			<Sub>How a note is scheduled</Sub>
			<Points>
				<li>
					The phone works out when one of the pet&rsquo;s needs will drop low and schedules the note
					itself. There is no server in the loop, no push token and no AI call.
				</li>
				<li>The lines come from a written bank, by need and by species.</li>
				<li>
					The pet asks first, after your first Feed, Play or Pet, and never at launch.{' '}
					<Said>Notes from Mochi</Said> in Settings turns them on or off.
				</li>
				<li>A note never mentions anything the pet remembers about you.</li>
				<li>
					A tapped note is counted when the app opens, with its day and the need it was about, so
					the open rate comes from the app&rsquo;s own numbers.
				</li>
			</Points>

			<Sub>The rules every note keeps</Sub>
			<Facts items={RULES} className="mt-5" />
		</Chapter>
	)
}
