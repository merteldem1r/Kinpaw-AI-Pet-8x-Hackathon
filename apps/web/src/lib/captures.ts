/*
 * What the landing page shows of the real app: screenshots and one recording,
 * taken from the iOS Simulator (iPhone 17 Pro) against the local stack on
 * 2026-10-06, with a test account made for the purpose, and kept in public/app.
 * Nothing in them is drawn or staged: the facts, the replies and the "From
 * Mochi's memory" line are what the app and its model produced.
 *
 * The Simulator records no sound, so the recording's two spoken replies were
 * made afterwards from the reply text on screen, with the app's own voice
 * provider, voice and playback rate, and laid in where the app's sound bars
 * move. While a list here is empty the page draws the app's screens from its
 * own parts instead (src/components/device), and shows no video at all.
 */

export type Shot = {
	/** Under public/, at the iPhone's proportion. */
	src: string
	/** What the screen shows, for screen readers. */
	label: string
	/** One line under the phone. */
	caption: string
}

export const SHOTS: readonly Shot[] = [
	{
		src: '/app/welcome.webp',
		label:
			'The welcome screen: three pets under the evening sky, one asking "How did the exam go? You said it was today."',
		caption: 'Welcome, under the sky at your hour'
	},
	{
		src: '/app/start.webp',
		label: 'Step 1 of 3, "Who\'s coming home with you?": cat or dog, from a photo or make your own',
		caption: 'From a photo of your pet, or made by hand'
	},
	{
		src: '/app/remembers.webp',
		label:
			'Mochi will remember: has an exam Friday, goes by Sam, drinks coffee black, studies design, has a sister named Ece',
		caption: 'Five facts kept from one sentence'
	},
	{
		src: '/app/talk.webp',
		label:
			'My pet: Mochi answers "Nervous about the exam Friday? You\'ve got this, I believe in you." marked From Mochi\'s memory',
		caption: 'A reply that uses what it remembers'
	},
	{
		src: '/app/memories.webp',
		label: 'Mochi remembers: six facts, each with a button to forget it, 6 of 30 kept',
		caption: 'Everything it remembers, each one forgettable'
	},
	{
		src: '/app/settings.webp',
		label: "Settings: haptics, Mochi's voice and notes from Mochi, each with a switch",
		caption: 'Its voice and its notes, each on a switch'
	}
]

export type Cue = {
	/** Seconds into the recording at which this line starts. */
	at: number
	line: string
}

/** The recording, the frame shown before it plays, and what is happening as it runs. */
export const DEMO: {
	src: string
	poster: string
	label: string
	/** As said on the play button. */
	length: string
	cues: readonly Cue[]
} | null = {
	src: '/app/demo.mp4',
	length: '0:30',
	poster: '/app/demo-poster.webp',
	label:
		'A 30-second recording of the app: Mochi is fed and petted, told that a friend is visiting, answers aloud and keeps the fact, then answers a second message from what it remembers',
	cues: [
		{ at: 0, line: 'Feed. It was hungry, and it says so.' },
		{ at: 3.4, line: 'Pet. Its affection rises.' },
		{ at: 7.4, line: 'You tell it something, typed here, or by voice on an iPhone.' },
		{ at: 12, line: 'It answers aloud, and keeps the fact.' },
		{ at: 22.8, line: 'A second message. It answers from what it remembers.' }
	]
}
