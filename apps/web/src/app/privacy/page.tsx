import type { Metadata } from 'next'
import { PageShell, Prose } from '@/components/PageShell'

export const metadata: Metadata = {
	title: 'Privacy Policy',
	description: 'How we collect, use, and protect your data.'
}

export default function PrivacyPage() {
	return (
		<PageShell>
			<Prose title="Privacy Policy" updated="January 1, 2026">
				<p>
					<strong>This is a template.</strong> Replace this copy with a privacy policy reviewed for
					your product, jurisdictions, and the data you actually collect. Both the App Store and
					Google Play require a reachable privacy policy URL — this page exists so you have one from
					day one.
				</p>

				<h2>1. Information we collect</h2>
				<p>
					Describe the account data (email, profile), usage/analytics data (PostHog, GA4), and any
					device permissions (camera, photos) your app uses. List third parties that process data:
					Supabase, RevenueCat, PostHog, Google Analytics, Sentry, Expo (app updates).
				</p>

				<h2>Talking to your pet</h2>
				<p>
					When you talk to your pet, your iPhone turns your voice into text with Apple&apos;s speech
					recognition, on the device when it can. Only that text leaves your phone: it is sent to
					our server and, to write your pet&apos;s reply, to Groq, the AI service we use. Kinpaw
					never keeps a recording, the words you say or your pet&apos;s replies. We keep only that a
					message was sent, the kind of message it was (for example, kind or playful) and how it
					changed your pet, to run the game and its daily limit.
				</p>

				<h2>Your pet from a photo</h2>
				<p>
					When you make your pet from a photo, the photo you pick is sent to our server, made
					smaller there with its location and camera details removed, and then sent to Google&apos;s
					Gemini model, through fal.ai, the AI service we use, so it can see your pet&apos;s colours
					and markings. Kinpaw never saves the photo, on our server or in your account, and it is
					used only to draw your pet. We keep only that a photo was read and what was found (a cat,
					a dog or neither), counted against the photo limits by a scrambled code for your phone and
					your network, never your photo, your phone&apos;s id or your address.
				</p>

				<h2>2. How we use information</h2>
				<ul>
					<li>To provide and maintain the service</li>
					<li>To process subscriptions and entitlements</li>
					<li>To understand product usage and improve the app</li>
					<li>To respond to support requests</li>
				</ul>

				<h2>3. Data retention &amp; deletion</h2>
				<p>
					Explain how long you keep data and how users can request deletion. Link to your{' '}
					<a href="/delete-account">account deletion page</a>.
				</p>

				<h2>4. Contact</h2>
				<p>
					Questions about this policy? Email{' '}
					<a href="mailto:privacy@example.com">privacy@example.com</a>.
				</p>
			</Prose>
		</PageShell>
	)
}
