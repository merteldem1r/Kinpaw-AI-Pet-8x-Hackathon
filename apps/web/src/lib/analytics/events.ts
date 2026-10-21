/**
 * The event-name registry. Single source of truth for everything this play
 * measures on the web.
 *
 * Client-safe: this module has NO server imports, so it is importable from
 * client components. That matters because the same constants feed both the
 * client `gaEvent` call sites AND the server-side TRACKED_EVENTS whitelist in
 * `lib/analytics/record.ts` — sharing the constants is what stops the two from
 * drifting.
 *
 * An event fired but not registered here is rejected by /api/track with a 400
 * and disappears with no error anywhere a person would see it. Real plays have
 * lost their main funnel step this way for months. `npm run check:events`
 * exists to make that impossible; it runs in CI.
 *
 * Adding events: use the `events` skill (.claude/skills/events/). It asks the
 * questions the code cannot answer — what the "aha" is, where the drop-off is,
 * what discriminator each event carries.
 *
 * Naming: snake_case, object then action (`checkout_started`, not
 * `start_checkout`). Reuse an existing name when the moment is the same moment;
 * two names for one action means every funnel built on either is wrong.
 */

/**
 * Marketing funnel — the anonymous top of funnel.
 *
 * These fire for GUESTS, who are most of the traffic on these pages. They are
 * recorded first-party against a session id rather than a user id, which is the
 * only way landing → pricing → signup conversion is computable at all.
 *
 * `pricingView` is the one that matters: it is the denominator for every
 * conversion rate this play will be judged on.
 */
export const FUNNEL_EVENTS = {
	/** The landing page was viewed. */
	landingView: 'landing_view',
	/** The pricing page or pricing section was viewed. */
	pricingView: 'pricing_view',
	/** A plan was selected on the pricing page. metadata: { plan } */
	planSelected: 'plan_selected',
	/**
	 * The waitlist form was submitted. metadata: { placement, named }
	 *
	 * Neither is a first-party discriminator: one visitor joins once. Both ride
	 * to PostHog and GA4 only. `placement` ('hero' | 'closing') says which form
	 * won the email; `named` ('yes' | 'no') says whether the visitor had named a
	 * pet in the builder first, which is the test of whether the builder earns
	 * its place before the closing form.
	 */
	waitlistJoined: 'waitlist_joined',
	/** The contact form was submitted. */
	contactSubmitted: 'contact_submitted',
	/**
	 * A store button was clicked through to App Store / Play. metadata: { store, placement }
	 *
	 * `store` is the first-party discriminator (one row per store per visitor per
	 * day). `placement` ('hero' | 'closing') rides to PostHog and GA4 only: it
	 * answers "which part of the page sends people to the store", a design
	 * question for funnels, and widening the first-party dedupe key with it would
	 * count one visitor's two clicks on the same store as two store visits.
	 */
	storeBadgeClicked: 'store_badge_clicked',

	// The landing page's own interactions. None of them is the conversion (that
	// is a store click or a waitlist join); each one explains a drop before it.

	/**
	 * An in-page call to action was clicked. metadata: { cta }
	 * `cta` is the discriminator: 'nav' (the capsule nav's "Get the app"),
	 * 'pricing_teaser' (the landing pricing section's link to /pricing) or
	 * 'whats_new' (the landing page's link to /whats-new). Compare each against
	 * `store_badge_clicked` to see whether the nav or the page is doing the
	 * sending.
	 */
	ctaClicked: 'cta_clicked',
	/**
	 * A FAQ answer was opened, on the landing page or /pricing. metadata: { question }
	 * `question` is the discriminator (a stable slug from src/lib/faq.ts), so the
	 * count per question is real: the most-opened question is the objection the
	 * page above it failed to answer.
	 */
	faqOpened: 'faq_opened',
	/** The /whats-new page was viewed: the reviewers' page, linked from the landing page. */
	whatsNewView: 'whats_new_view'
} as const

const FUNNEL_EVENT_NAMES = Object.values(FUNNEL_EVENTS)

/**
 * The landing page's week ("Seven days with Mochi"): five scenes, days 1, 2, 3,
 * 5 and 7, each a thing the visitor can do. Guests, recorded against a session.
 *
 * THE metric is `week_day_viewed` with day 7 over `landing_view`: the share of
 * visitors who reach the scene where the pet remembers (decided with Mert,
 * 2026-10-06). The waitlist join stays the conversion; this says whether the
 * week holds attention on the way there, and the days before it are the
 * drop-off: the first day whose count falls away is the scene to fix.
 *
 * The rest say which hands-on piece pulls people in. None carries what a
 * visitor typed: the builder's name never leaves the page.
 */
export const WEEK_EVENTS = {
	/**
	 * A day's scene came into view, once per page view. metadata: { day }
	 * `day` is the discriminator: '1' | '2' | '3' | '5' | '6' | '7' (day 6,
	 * the friends, since 2026-10-08; day 4 passes and is not counted). Replaces
	 * `story_view`, which went with the scene-scroll story (2026-10-06).
	 */
	dayViewed: 'week_day_viewed',
	/**
	 * The visitor cared for the pet on day 1. metadata: { action }
	 * `action` is the discriminator: 'feed' | 'play' | 'pet'. Its share of
	 * `landing_view` is how many people touch the first viewport at all.
	 * A tap on Mochi itself is the Pet button's moment and fires as
	 * `action: 'pet'` (2026-10-08), not a name of its own.
	 */
	heroPetCared: 'hero_pet_cared',
	/**
	 * A voice sample was played on day 2. metadata: { voice }
	 * `voice` is the discriminator: '<species>-<preset>', e.g. 'cat-cool', the
	 * eight voices of apps/mobile/assets/voice.
	 */
	voiceSamplePlayed: 'voice_sample_played',
	/**
	 * The scripted talk was played. metadata: { part }
	 * `part` is the discriminator: 'day3' (it keeps a fact) or 'day7' (it asks
	 * about it). Day 7 without day 3 means the payoff was heard without its setup.
	 */
	memoryReplayPlayed: 'memory_replay_played',
	/**
	 * The visitor changed something in the pet builder, once per page view.
	 * metadata: { species } ('cat' | 'dog', the discriminator).
	 */
	petBuilderUsed: 'pet_builder_used',
	/** The demo recording of the app was started, once per page view. */
	demoVideoPlayed: 'demo_video_played'
} as const

const WEEK_EVENT_NAMES = Object.values(WEEK_EVENTS)

/**
 * Account lifecycle.
 *
 * Every one of these ALSO goes to the Play Events API (lib/plays/events.ts),
 * because they are what the platform's email automation runs on. `signupCompleted`
 * and `accountDeleted` are mandatory for every play — the second is the GDPR
 * right-to-be-forgotten hook and must never be skipped.
 *
 * `userActivated` is the only one you have to decide: it fires on this play's
 * "aha", the single action that means the product worked. If you cannot name
 * that action, the play has no success criterion yet, which is worth saying out
 * loud before building more of it.
 */
export const LIFECYCLE_EVENTS = {
	/** An account was created. metadata: { signup_method } */
	signupCompleted: 'signup_completed',
	/** The user reached this play's "aha". metadata: { activation_type } */
	userActivated: 'user_activated',
	/** Onboarding finished. */
	onboardingCompleted: 'onboarding_completed',
	/** The account was deleted / erasure requested. metadata: { reason } */
	accountDeleted: 'account_deleted',
	/** Product-email opt-in toggled. metadata: { subscribed } */
	marketingConsentChanged: 'marketing_consent_changed'
} as const

const LIFECYCLE_EVENT_NAMES = Object.values(LIFECYCLE_EVENTS)

/**
 * The pet (Kinpaw). Recorded first-party by the app API's routes, so the admin
 * panel has real numbers without PostHog (docs/application/product.md,
 * "Measurement"). Not Play Events: the platform's email automation has no flow
 * for them.
 *
 * `petCreated` is M4's "aha": the pet is saved to the account and survives a
 * new phone. It fires on a real create only (a retry of the same save, or an
 * account that already has a pet, records nothing). metadata: { species,
 * look_id (a ready-made look, or 'custom' for a pet built or customized),
 * appearance_key, preset, custom_traits }, never the pet's name. appearance_key is
 * species.fur.pattern.eyes.ears.body.tail.accent.white.trim since 2026-10-03 (the
 * layered coat); older rows lack the last segments, so an older key is a prefix.
 * Once per account in v1 (one pet each), so it is recorded with `dedupeForever`.
 */
export const PET_EVENTS = {
	petCreated: 'pet_created',
	/**
	 * M5's metric: a care action the server applied (POST /api/app/v1/pet/actions),
	 * so care days per person come from this table, not PostHog. metadata:
	 * { action: 'feed' | 'play' | 'pet', need_changed }. `action` is the
	 * discriminator: recorded with `dedupeMatch: { action }`, at most one row per
	 * action per person per day, so Feed doesn't hide Play.
	 */
	petActionTaken: 'pet_action_taken'
} as const

const PET_EVENT_NAMES = Object.values(PET_EVENTS)

/**
 * Talking to the pet (M6, docs/application/features/m6-talk-requirements.md). Recorded
 * first-party by POST /api/app/v1/pet/talk, so talk days per person and activation come from
 * this table, not PostHog. Not Play Events: no email flow runs on a single reply (activation,
 * which does, is `LIFECYCLE_EVENTS.userActivated`, fired by the same route on the account's
 * first counted reply).
 *
 * The aha is the pet's first reply when you talk to it (`user_activated`). The metric is talk
 * days per person: days with a `talk_reply_received`. The funnel above it (talk_started →
 * talk_message_sent → talk_reply_received, with the drop-offs) is the app's, in PostHog.
 */
export const TALK_EVENTS = {
	/**
	 * A reply that counted: not a retry of a message already counted, not a failure, not the
	 * limit. metadata: { input: 'voice' | 'typed', intent (upset sent as 'other'), need_changed }.
	 * `input` is the discriminator, recorded with `dedupeMatch: { input }`, so a typed message
	 * doesn't hide a spoken one on the same day. Never what was said, the reply or the pet's name.
	 */
	talkReplyReceived: 'talk_reply_received',
	/**
	 * A counted reply was spoken in the pet's voice (v2, docs/application/features/
	 * v2-voice-requirements.md), recorded by POST /api/app/v1/pet/voice when the voice was made.
	 * The first-party side of "does a voice bring people back": talk days of people who heard it
	 * against those who turned it off (PostHog, the app's voice_* events, is off in this play).
	 * metadata: { voice: the preset that picked it, from: 'talk' | 'intro' (a talk reply, or
	 * "Tell me about you"'s answer) }. Daily per `from` (`dedupeMatch: { from }`). Never the
	 * reply's words.
	 */
	talkReplyVoiced: 'talk_reply_voiced'
} as const

const TALK_EVENT_NAMES = Object.values(TALK_EVENTS)

/**
 * Long-term memory (v2, docs/application/features/v2-memory-requirements.md). Recorded
 * first-party by the routes that keep, show and delete facts, so the day-7 question the reviewer
 * asked ("why do they open it on day 7?") can be answered from this table: return days of people
 * with memories against people without, and of people who did the intro against those who
 * skipped it. Not Play Events: no email flow runs on these.
 *
 * The metric is people with at least one `memory_saved`, and their D7 return. Never a fact's
 * text, a tag, what was said, the reply or the pet's name: only the labels below.
 */
export const MEMORY_EVENTS = {
	/**
	 * A fact kept: added or replaced, from a talk reply or the intro (not a duplicate). metadata:
	 * { source: 'talk' | 'intro', category, kind: 'lasting' | 'event', replaced }. `source` is the
	 * discriminator, recorded with `dedupeMatch: { source }`, so the intro's facts don't hide the
	 * day's first fact from talking.
	 */
	memorySaved: 'memory_saved',
	/**
	 * A fact deleted by its person. metadata: { from: 'list' | 'intro' }, the discriminator
	 * (`dedupeMatch: { from }`): a ✕ on the intro's chips is a wrong fact caught at once, a delete
	 * from the list is one noticed later.
	 */
	memoryDeleted: 'memory_deleted',
	/**
	 * "Tell me about you" kept at least one fact. metadata: { input: 'voice' | 'typed',
	 * facts: '1-2' | '3-5' | '6-8' }. Once per account (`dedupeForever`).
	 */
	introCompleted: 'intro_completed',
	/**
	 * "Tell me about you" skipped for good. metadata: { step: 'record' | 'review' | 'empty_result' },
	 * where the person left. Once per account (`dedupeForever`).
	 */
	introSkipped: 'intro_skipped',
	/**
	 * A return line served on coming back (R26–R27), by POST /api/app/v1/pet/greeting: time away
	 * of 6 hours or more, a due question, or both. metadata: { away: 'none' | '6-24h' | '1-3d' |
	 * '3d+', follow_up: boolean }: whether it asked about a remembered event ('none' only with a
	 * question). Daily. Never the question's words.
	 */
	greetingShown: 'greeting_shown'
} as const

const MEMORY_EVENT_NAMES = Object.values(MEMORY_EVENTS)

/**
 * Your pet from a photo (v2, docs/application/features/v2-pet-from-photo-requirements.md):
 * judged on whether a photo gives people a pet they keep. The aha is the reveal kept as it is
 * (the app's `pet_photo_confirmed` and `pet_photo_kept`, PostHog); this server row is the one
 * that survives without PostHog and counts reads against cost and the limits.
 */
export const PHOTO_EVENTS = {
	/**
	 * A read the model answered, recorded by the photo read and redo routes for every
	 * counted read (`dedupeDaily: false`: each is a row, bounded by the read limits). metadata:
	 * { context: 'create' | 'redo', result: 'read' | 'no_pet' | 'several' | 'unclear',
	 * swapped_count }. A redo: the user id. A creation read (public, signed out): a null user and
	 * the read's own random id as the session id. Never the image, the model's words or a hash.
	 */
	petPhotoRead: 'pet_photo_read'
} as const

const PHOTO_EVENT_NAMES = Object.values(PHOTO_EVENTS)

/**
 * The pet's daily note (v2, docs/application/features/v2-notifications-requirements.md): a local
 * notification in the pet's voice, scheduled on the phone, never sent by the server. Recorded
 * first-party by the greeting route (`POST /api/app/v1/pet/greeting`, via: 'notification'), the
 * one request a tapped note leads to, because the app's own events go to PostHog only. Not Play
 * Events: no email flow runs on these.
 *
 * The metric is notes opened per person, and D1/D3/D7 return of people with notes on against
 * those without (`notifications_state`). Never a line's text or a name: only the labels below.
 */
export const NOTIFICATION_EVENTS = {
	/**
	 * A note opened the app. metadata: { day: 1 | 2 | 3, need: 'hunger' | 'happiness' | 'energy' |
	 * 'affection' }. Recorded whatever the time away (a day-1 note can fire 3 hours after leaving,
	 * when no return line is served). Daily: one note a day at most.
	 */
	notificationOpened: 'notification_opened',
	/**
	 * Whether notes can reach this person, sent with every greeting call. metadata: { state: 'on' |
	 * 'off' | 'denied' | 'unasked' }, the discriminator (`dedupeMatch: { state }`), so a change
	 * made during the day is kept. The denominator for notification_opened.
	 */
	notificationsState: 'notifications_state'
} as const

const NOTIFICATION_EVENT_NAMES = Object.values(NOTIFICATION_EVENTS)

/**
 * Friends (v2, docs/application/features/v2-friends-requirements.md): add a friend by their QR
 * code and see their pet. Recorded first-party by the /api/app/v1/friends routes, because the
 * app's own events go to PostHog only, which is off in this play. Not Play Events: no email flow
 * runs on these.
 *
 * The metric is the share of people with a pet who have at least one friend (`friend_added`,
 * either side of the pair), and the days the list is opened with a friend in it
 * (`friends_viewed`). Never a code, a name or the friend's id: only the labels below.
 */
export const FRIEND_EVENTS = {
	/**
	 * A friendship made by POST /api/app/v1/friends, recorded for both people. metadata:
	 * { source: 'link' | 'typed' (how the adder's code arrived), side: 'adder' | 'added',
	 * friend_count (after) }. Every add is a row (`dedupeDaily: false`), bounded by the 50-friend
	 * cap.
	 */
	friendAdded: 'friend_added',
	/**
	 * A friendship removed by one of the two (DELETE /api/app/v1/friends/:id), recorded for the
	 * remover only. metadata: { friend_count (after) }. Every removal is a row.
	 */
	friendRemoved: 'friend_removed',
	/**
	 * The friends list was loaded with at least one friend in it (GET /api/app/v1/friends).
	 * metadata: { friend_count }. Daily.
	 */
	friendsViewed: 'friends_viewed'
} as const

const FRIEND_EVENT_NAMES = Object.values(FRIEND_EVENTS)

/**
 * Paywall and checkout.
 *
 * The gap between `checkoutStarted` and `purchase` is the drop that never
 * reached a payment sheet, which is a different problem from a sheet people
 * abandoned — so both exist deliberately.
 *
 * `purchase` is recorded with dedupe OFF: every occurrence is a row. Deduping
 * money by day would merge a customer's second purchase into their first.
 */
export const CHECKOUT_EVENTS = {
	/** The paywall / upgrade screen was viewed. metadata: { source } */
	upgradeView: 'upgrade_view',
	/** Checkout began — a real payment sheet is opening. metadata: { plan, price_cents } */
	checkoutStarted: 'checkout_started',
	/** Payment succeeded. metadata: { plan, price_cents, currency } */
	purchase: 'purchase',
	/** Payment failed. metadata: { plan, reason } */
	paymentFailed: 'payment_failed',
	/** A trial began. metadata: { plan } */
	trialStarted: 'trial_started',
	/** Auto-renew was turned off; access continues to period end. metadata: { plan } */
	subscriptionCancelled: 'subscription_cancelled',
	/** Access actually ended. metadata: { plan } */
	subscriptionExpired: 'subscription_expired',
	/** A refund was issued. metadata: { plan } */
	refundIssued: 'refund_issued'
} as const

const CHECKOUT_EVENT_NAMES = Object.values(CHECKOUT_EVENTS)

/**
 * Every registered web event, flat. This is what the whitelist and the CI check
 * read; adding a group above without spreading it here is the one mistake
 * `npm run check:events` is built to catch.
 */
export const ALL_EVENT_NAMES = [
	...FUNNEL_EVENT_NAMES,
	...WEEK_EVENT_NAMES,
	...LIFECYCLE_EVENT_NAMES,
	...PET_EVENT_NAMES,
	...TALK_EVENT_NAMES,
	...MEMORY_EVENT_NAMES,
	...PHOTO_EVENT_NAMES,
	...NOTIFICATION_EVENT_NAMES,
	...FRIEND_EVENT_NAMES,
	...CHECKOUT_EVENT_NAMES
] as const

export type AppEvent = (typeof ALL_EVENT_NAMES)[number]
