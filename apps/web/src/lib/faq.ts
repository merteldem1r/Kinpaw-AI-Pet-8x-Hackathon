/**
 * The questions answered on the landing page and on /pricing. `id` is the
 * `question` discriminator on `faq_opened`, so keep ids stable once live:
 * renaming one splits its history in two.
 *
 * True of Kinpaw as decided in docs/application/product.md (v1, and "v2
 * decisions" for the voice, memory, photo and notes answers); change an answer
 * there first. Nothing here may contradict the privacy page.
 */
export interface Faq {
	id: string
	question: string
	answer: string
}

export const faqs: Faq[] = [
	{
		id: 'pet_dies',
		question: 'Can my pet die or run away?',
		answer:
			'Never. Its needs drift down while you are away, so at worst it is hungry, sleepy or a little sad. It perks up the moment you look after it, however long you have been gone.'
	},
	{
		id: 'chat',
		question: 'How does talking to my pet work?',
		answer:
			"Hold the mic on your pet's screen and talk, or type if you prefer. Your pet answers in its bubble, in the personality you gave it, and knows how it feels right now. It can say the reply out loud too. Free accounts get 10 messages a day, fresh each midnight, with 5 of the replies spoken; Kinpaw Plus is unlimited talking, with 20 spoken replies a day."
	},
	{
		id: 'pet_speaks',
		question: 'Does my pet really speak?',
		answer:
			'Yes. When your pet answers you, it says the reply out loud in one of eight voices, chosen by whether it is a cat or a dog and by its personality. Speak to it and it answers aloud even with the silent switch on; type, and it follows the switch. Free accounts hear 5 spoken replies a day and Kinpaw Plus 20; after that the replies stay as text. You can turn the voice off in Settings.'
	},
	{
		id: 'pet_memory',
		question: 'What does my pet remember about me?',
		answer:
			"Short facts from what you tell it, like an exam on Friday or your sister's name, so it can ask about them later. It never keeps the conversation itself, and it keeps nothing sensitive, such as health, religion, politics or money. It holds up to 30 facts, or 100 with Kinpaw Plus. You can see what it remembers on your pet's page, search the list, and have it forget anything."
	},
	{
		id: 'pet_photo',
		question: 'What happens to a photo of my pet?',
		answer:
			"The photo is made smaller, our server removes its location, and it is sent once to Google's Gemini model, through fal.ai, to read your pet's colours and markings. Kinpaw then draws your pet itself. The photo is never saved, and the app asks your permission before it sends the first one."
	},
	{
		id: 'pet_notes',
		question: 'Will it nag me with notifications?',
		answer:
			'No. Your pet asks before it sends anything, and only after you have fed, played with or petted it once. If you say yes, a note arrives when it starts to miss you: never sooner than 3 hours after you leave, only between 09:00 and 21:00, at most one a day, and three in all until you open the app again. You can turn the notes off in Settings.'
	},
	{
		id: 'devices',
		question: 'Which phones does it work on?',
		answer: 'Kinpaw is coming to iPhone first. Android is not planned yet.'
	},
	{
		id: 'sign_in',
		question: 'Do I need a password?',
		answer:
			'No. You make your pet first, then save it with your email and a six-digit code that we send you.'
	},
	{
		id: 'cancel',
		question: 'Can I cancel Kinpaw Plus any time?',
		answer:
			'Yes. Kinpaw Plus is billed by the App Store, and you can cancel in your Apple account settings whenever you like. Your pet stays, and so does everything free.'
	},
	{
		id: 'delete',
		question: 'How do I delete my account?',
		answer:
			'In the app, open Settings and tap Delete account; your pet, everything about it and everything it remembers go with it. The conversation itself is never stored: your pet keeps only short facts, which you can see and forget at any time. If you cannot sign in, use the form on the delete account page.'
	}
]
