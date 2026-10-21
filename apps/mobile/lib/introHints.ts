// "Tell me about you"'s hint chips (docs/application/UI/kinpaw-screen-spec-v1.md, "Tell me about
// you (v2)", "Hint matching"): five ideas of what to say, each lit when it is said. A plain word
// match on the phone, run on the live words; nothing depends on it, so a miss only leaves a chip
// unlit. The words never leave this function.

export const INTRO_HINTS = ['name', 'studyWork', 'pets', 'hobbies', 'comingUp'] as const
export type IntroHint = (typeof INTRO_HINTS)[number]

export const HINT_LABEL: Record<IntroHint, string> = {
	name: 'Your name',
	studyWork: 'Study or work',
	pets: 'Pets',
	hobbies: 'Hobbies',
	comingUp: 'Coming up'
}

/** Whole words, any case; plural and -ing forms are listed where they matter. */
const words = (list: readonly string[]) => new RegExp(`\\b(?:${list.join('|')})\\b`, 'i')

const MATCHERS: Record<IntroHint, RegExp> = {
	// Said outright ("My name is…", any case), or "I'm Ece": there the capital is what makes it a
	// name, so "I'm tired" isn't one.
	name: /\b(?:[Mm]y name is|[Mm]y name's|[Ii]'?m called|[Cc]all me)\b|\b(?:I'm|I am|Im)\s+[A-Z][a-z]/,
	studyWork: words([
		'study',
		'studies',
		'studying',
		'student',
		'school',
		'university',
		'uni',
		'college',
		'class',
		'classes',
		'exams?',
		'work',
		'works',
		'working',
		'job',
		'office',
		'engineer',
		'developer',
		'designer',
		'teacher',
		'doctor',
		'nurse',
		'manager',
		'intern'
	]),
	pets: words([
		'dogs?',
		'cats?',
		'pupp(?:y|ies)',
		'kittens?',
		'pets?',
		'birds?',
		'fish',
		'rabbits?',
		'hamsters?',
		'horses?',
		'parrots?',
		'turtles?',
		// The breeds people name instead of "dog" or "cat".
		'retrievers?',
		'labradors?',
		'poodles?',
		'terriers?',
		'huskies',
		'husky',
		'beagles?',
		'corgis?',
		'persian',
		'siamese',
		'tabby'
	]),
	hobbies: words([
		'hobby',
		'hobbies',
		'play',
		'playing',
		'love',
		'like',
		'enjoy',
		'music',
		'guitar',
		'piano',
		'sing',
		'singing',
		'paint',
		'painting',
		'draw',
		'drawing',
		'read',
		'reading',
		'books?',
		'games?',
		'gaming',
		'sports?',
		'football',
		'run',
		'running',
		'gym',
		'climb',
		'climbing',
		'cook',
		'cooking',
		'dance',
		'dancing'
	]),
	comingUp: words([
		'tomorrow',
		'tonight',
		'next week',
		'this weekend',
		'soon',
		'monday',
		'tuesday',
		'wednesday',
		'thursday',
		'friday',
		'saturday',
		'sunday',
		'exams?',
		'interview',
		'trip',
		'birthday',
		'wedding',
		'holiday',
		'concert'
	])
}

/** The hints these words cover, in the chips' order. */
export function litHints(said: string): IntroHint[] {
	return INTRO_HINTS.filter((hint) => MATCHERS[hint].test(said))
}
