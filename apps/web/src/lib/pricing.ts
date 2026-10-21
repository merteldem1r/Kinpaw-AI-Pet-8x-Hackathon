/**
 * Single source of truth for pricing, shared by the landing teaser, the full
 * pricing page and the paywall drawn in the landing page's phone. Edit here;
 * every surface updates.
 *
 * 🎨 REPLACE: the template has no prices of its own and must not invent any.
 * The paid prices below are placeholders (`isPricePlaceholder`), and the site
 * marks them as such until you set your real ones and delete the flag. Keep
 * them in step with the products in App Store Connect and the Play Console.
 */
export interface Plan {
	id: string
	name: string
	/** Shown as written, e.g. '$4.99'. */
	price: string
	cadence: string
	/** A short label for the cadence inside the app's paywall ('month', 'year'). */
	period?: string
	tagline: string
	features: string[]
	cta: string
	featured?: boolean
	/** True while `price` is the template's placeholder. Delete once the price is real. */
	isPricePlaceholder?: boolean
}

// Kinpaw Plus (placeholder name, docs/memory/monetization-v1.md): unlimited
// talking and the Plus looks, and since v2 more spoken replies, a bigger memory
// and the redo from a photo (docs/application/product.md, "v2 decisions"; the
// app's own list is apps/mobile/components/plus/plusFeatures.ts). The numbers
// are the server's limits: change them there first. No trial is decided yet,
// so no plan offers one.
export const plans: Plan[] = [
	{
		id: 'free',
		name: 'Free',
		price: '$0',
		cadence: 'forever',
		tagline: 'Your pet, every day, for good.',
		features: [
			'A cat or dog made by hand, or from a photo of your own pet',
			'Feed, play and pet, as often as you like',
			'10 messages a day to your pet, by voice or typing',
			'5 replies a day said out loud, in a voice that fits your pet',
			'A memory of up to 30 things you tell it',
			'A note on your lock screen when it misses you'
		],
		cta: 'Join the waitlist'
	},
	{
		id: 'plus',
		name: 'Kinpaw Plus',
		price: '$X.XX',
		cadence: 'per month',
		period: 'month',
		tagline: 'For long talks and rare looks.',
		features: [
			'Everything in Free',
			'Unlimited talking with your pet',
			'20 replies a day said out loud',
			'A memory of up to 100 things you tell it',
			'Redo your pet from a new photo, once a day',
			'Plus looks and rare builder options: calico and blue merle coats, tortie, points and brindle, odd and ice eyes, lynx ears'
		],
		cta: 'Join the waitlist',
		featured: true,
		isPricePlaceholder: true
	},
	{
		id: 'plus-annual',
		name: 'Kinpaw Plus Annual',
		price: '$XX.XX',
		cadence: 'per year',
		period: 'year',
		tagline: 'Plus, billed once a year.',
		features: ['Everything in Plus', 'One payment a year', 'Cancel any time in the App Store'],
		cta: 'Join the waitlist',
		isPricePlaceholder: true
	}
]

/** The plans a subscriber picks between on the paywall (every plan with a period). */
export const paidPlans = plans.filter((p) => p.period != null)
