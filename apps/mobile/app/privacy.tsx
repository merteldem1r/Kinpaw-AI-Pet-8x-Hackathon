import { LegalDocument, type LegalSection } from '@/components/LegalDocument'

// 🎨 REPLACE: your privacy policy, reviewed by counsel, and the date it took effect.
const UPDATED = '[effective date]'

const SECTIONS: LegalSection[] = [
	{
		heading: 'Overview',
		body: 'This template application is provided for demonstration purposes. Data shown across the app can be mock data, sample analytics, or developer-provided environment values.'
	},
	{
		heading: 'Data we may process',
		body: 'Depending on how you configure this template, your production app may process account identifiers, product usage events, subscription status, and support inquiries.'
	},
	{
		heading: 'Talking to your pet',
		body: "When you talk to your pet, your iPhone turns your voice into text with Apple's speech recognition, on the device when it can. Only that text leaves your phone: it is sent to our server and, to write your pet's reply, to Groq, the AI service we use. Kinpaw never keeps a recording, the words you say or your pet's replies. We keep only that a message was sent, the kind of message it was (for example, kind or playful) and how it changed your pet, to run the game and its daily limit."
	},
	{
		heading: 'Your pet from a photo',
		body: "When you make your pet from a photo, the photo you pick is sent to our server, made smaller there with its location and camera details removed, and then sent to Google's Gemini model, through fal.ai, the AI service we use, so it can see your pet's colours and markings. Kinpaw never saves the photo, on our server or in your account, and it is used only to draw your pet. We keep only that a photo was read and what was found (a cat, a dog or neither), counted against the photo limits by a scrambled code for your phone and your network, never your photo, your phone's id or your address."
	},
	{
		heading: "Your pet's voice",
		body: "When your pet answers you, its reply (the pet's words, never yours) is sent from our server to a speech model (Inworld's), through fal.ai, to be spoken in your pet's voice. fal.ai keeps the sound file so your iPhone can play it; Kinpaw doesn't save it. We keep only that a reply was spoken and how long it was, never the words. Turn the voice off in Settings and nothing is sent for it."
	},
	{
		heading: 'Notes from your pet',
		body: "If you allow notifications, your pet's daily notes are scheduled on your iPhone, from its needs, and shown there. Nothing about them is sent to us or anyone else, and Kinpaw never asks for a push token. Turn them off in Settings, in the app or on your iPhone."
	},
	{
		heading: 'Friends',
		body: "When you add a friend with their code, you each see the other's name and pet: its look, its name, its mood and roughly how it is doing. Never your email, your photo, what you said to your pet, what it remembers, or whether you have Kinpaw Plus. Remove a friend at any time, and make a new code so an old one stops working. Deleting your account removes your friends too."
	},
	{
		heading: 'How data is used',
		body: 'Typical use cases include account authentication, feature personalization, billing state checks, and improving product quality through aggregate analytics.'
	},
	{
		heading: 'Third-party services',
		body: "This starter may integrate with providers like authentication backends, subscription platforms, analytics services, and app update delivery. Review each provider's privacy policy before publishing."
	},
	{
		heading: 'Your responsibility before launch',
		body: 'Replace this document with your legal policy, verify regional compliance requirements, and keep your final policy URL available inside app settings.'
	}
]

export default function PrivacyScreen() {
	return <LegalDocument title="Privacy Policy" updated={UPDATED} sections={SECTIONS} />
}
