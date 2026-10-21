import PostHog from 'posthog-react-native'
import { env } from './env'

const POSTHOG_KEY = env.EXPO_PUBLIC_POSTHOG_KEY ?? ''
const POSTHOG_HOST = env.EXPO_PUBLIC_POSTHOG_HOST

/** True when a valid PostHog key is configured. */
export const isPostHogEnabled = !!POSTHOG_KEY

// Only create the client when a key is present.
// Passing an empty string to PostHog() can trigger network errors or console warnings.
export const posthog: PostHog | null = isPostHogEnabled
	? new PostHog(POSTHOG_KEY, {
			host: POSTHOG_HOST,
			persistence: 'memory',
			fetchRetryCount: 0 // don't retry on network failure — avoids noisy offline errors
		})
	: null

type TrackProperties = Parameters<PostHog['capture']>[1]
type IdentifyProperties = Parameters<PostHog['identify']>[1]

// 🔑 Add your app-specific event names here for type safety.
// All event names in one place makes it easy to audit what you're tracking.
type EventName =
	// Auth — judged on how many who start signing in finish, per method.
	// metadata on login_started, login_success and login_failed:
	//   { method: 'email' | 'apple' | 'google' }
	// `method` is the discriminator: one funnel for every way in, and each method
	// still countable on its own (Apple's native sheet on iOS, Apple's web page
	// on Android, Google's web page, the emailed code). login_failed also
	// carries { reason: 'cancelled' | 'provider' | 'invalid_code' | 'locked' }:
	// started → success is the conversion; started → failed by reason is the
	// drop-off, and a cancelled Apple sheet is a different problem from a
	// provider that is not configured.
	| 'login_started'
	| 'otp_sent'
	| 'login_success'
	| 'login_failed'
	| 'logout'
	// Onboarding is creating the pet (below): onboarding_step_viewed fires as each
	// Create step appears. metadata: { step: 'look' | 'name' | 'personality',
	// index: number }. `step` is the discriminator. The template's post-sign-in
	// onboarding (and its started / completed events) went with M4: saving the pet
	// (pet_created) is where onboarding ends now.
	| 'onboarding_step_viewed'
	// Create your pet (M3) — the first-run path, signed out: Welcome, then Look,
	// Name and Personality, then Meet. Judged on how many who start reach Meet;
	// the product's activation stays user_activated on the pet's first talk reply.
	// The funnel, in order:
	//   welcome_viewed          metadata: { time_of_day: 'morning' | 'afternoon'
	//                                       | 'evening' | 'night' }
	//   welcome_start_tapped    "Meet your pet" (welcome_signin_tapped is the
	//                           other way out: "I already have an account")
	//   onboarding_step_viewed  metadata: { step: 'start' | 'look' | 'build' |
	//                           'photo' | 'name' | 'personality', index } (the
	//                           template's event, more steps; 'photo' is the photo
	//                           reveal, v2; 'look' stopped with Choose a friend)
	//   pet_meet_viewed         metadata: { species, look_id (a ready-made look, or
	//                           'custom'), appearance_key, preset, custom_traits }
	//   pet_meet_continued      "Take {name} home"
	// On Welcome (v3 pet looks, A4c, 2026-10-09): its three pets are alive and answer a touch.
	//   welcome_pet_touched     one of them tapped, stroked (once per stroke) or hugged.
	//                           metadata: { pet: 'tuxedo' | 'ginger' | 'biscuit', kind:
	//                           'tap' | 'stroke' | 'hug', zone } (zone as on
	//                           pet_meet_touched). The aha: a touch on a pet before
	//                           "Meet your pet"; the drop-off: welcome_viewed with no
	//                           welcome_pet_touched (the first screen read as a
	//                           picture). It answers whether those who touch a pet
	//                           go on to welcome_start_tapped more often.
	// On Meet (v3 pet looks, A4b, 2026-10-09): the pet there is alive and answers a touch.
	//   pet_meet_touched        the pet tapped, stroked (once per stroke) or hugged.
	//                           metadata: { kind: 'tap' | 'stroke' | 'hug', zone } (zone
	//                           as on pet_tapped for a tap, as on pet_stroked for a
	//                           stroke, none for a hug). Its own name, not Home's
	//                           pet_tapped: Home's touch drop-off is counted against
	//                           home_viewed. The aha: a touch on the pet before taking
	//                           it home; the drop-off: pet_meet_viewed with no
	//                           pet_meet_touched. It answers whether those who touch
	//                           the pet go on to pet_meet_continued more often.
	// Inside the steps:
	//   pet_species_selected    metadata: { species: 'cat' | 'dog' }
	//   pet_look_selected       metadata: { species, look_id, appearance_key } (a
	//                           free look). Retired 2026-10-04 with Choose a friend:
	//                           kept for the history the dashboard reads, fired by nothing.
	//   pet_look_locked_tapped  metadata: { species, look_id, during_onboarding }
	//                           (a Plus look: interest, not a money moment). Retired
	//                           2026-10-04, as pet_look_selected.
	//   pet_name_submitted      metadata: { name_length, from_idea } (never the
	//                           name; from_idea: a name idea was kept as tapped)
	//   pet_name_idea_tapped    a name idea chip tapped. metadata: { fur } (the
	//                           coat the ideas are for, never the name)
	//   pet_preset_selected     metadata: { preset }
	//   pet_finetune_opened     the fine-tune sheet opened. metadata: { preset }
	//   pet_trait_changed       a trait level picked in it. metadata: { trait,
	//                           level } (level 1–5, as shown)
	//   pet_finetune_closed     Done, a drag down or the backdrop. metadata:
	//                           { changed_count } (traits away from where the sheet
	//                           opened)
	// Discriminators: step, species, look_id, preset, time_of_day, kind, pet. appearance_key
	// ("cat.ginger.stripes.brown.pointy.round.long") describes the drawing, not a
	// person. No property carries the pet's name. No lifecycle change: the account comes in M4.
	| 'welcome_viewed'
	| 'welcome_start_tapped'
	| 'welcome_signin_tapped'
	| 'welcome_pet_touched'
	| 'pet_species_selected'
	| 'pet_look_selected'
	| 'pet_look_locked_tapped'
	| 'pet_name_submitted'
	| 'pet_name_idea_tapped'
	| 'pet_preset_selected'
	| 'pet_finetune_opened'
	| 'pet_trait_changed'
	| 'pet_finetune_closed'
	| 'pet_meet_viewed'
	| 'pet_meet_continued'
	| 'pet_meet_touched'
	// The pet builder (M4b Step C, docs/application/features/m4b-pet-builder-requirements.md):
	// Start offers a ready-made friend or Make your own. The aha is still a saved pet
	// (pet_created); these say which way people make it and where builders give up.
	// The drop-off: pet_builder_viewed with no later pet_name_submitted.
	//   pet_create_path_selected  a Start card tapped. metadata: { path: 'photo' |
	//                             'build', species } ('photo' since v2, From a photo;
	//                             'choose' until Choose a friend was removed, 2026-10-04)
	//   pet_builder_viewed        Make your own appeared. metadata: { from: 'start' |
	//                             'customize', species }
	//   pet_attribute_changed     a free option picked. metadata: { attribute: 'fur' |
	//                             'accent' | 'pattern' | 'white' | 'trim' | 'eyes' |
	//                             'ears' | 'body' | 'tail', option } ('accent', 'white'
	//                             and 'trim', the pattern's colour, the paws & chest
	//                             markings and their colour, since 2026-10-03:
	//                             features/v2-pet-looks-requirements.md; they show which
	//                             multi-colour coats people make)
	//   pet_option_locked_tapped  a Plus option tapped. metadata: { attribute, option,
	//                             during_onboarding } (interest, not a money moment)
	//   pet_surprise_tapped       Surprise me. metadata: { species }
	//   pet_builder_sky_changed   the stage's time of day picked (a preview only, nothing
	//                             saved). metadata: { time_of_day: 'morning' |
	//                             'afternoon' | 'evening' | 'night' }
	//   pet_customize_tapped      Customize on Choose a friend, opening Make your own
	//                             with that look. metadata: { look_id } ('custom'
	//                             when the pet is already customized). Retired
	//                             2026-10-04 with Choose a friend, as pet_look_selected.
	// Discriminators: path, from, attribute, option, species, look_id, time_of_day. option is an id from
	// the catalog ('stripes'), never free text. No lifecycle change.
	| 'pet_create_path_selected'
	| 'pet_builder_viewed'
	| 'pet_attribute_changed'
	| 'pet_option_locked_tapped'
	| 'pet_surprise_tapped'
	| 'pet_builder_sky_changed'
	| 'pet_customize_tapped'
	// Save your pet (M4) — signing in to keep the pet. The funnel:
	//   pet_save_viewed   the Save screen appeared. metadata: { mode: 'save' |
	//                     'welcome_back' } (Welcome back is "I already have an
	//                     account": no pet to save, the same screens)
	//   login_*           the template's sign-in events, unchanged
	//   pet_created       recorded first-party by POST /api/app/v1/pet (the web
	//                     registry), not here
	//   pet_save_failed   saving the draft after sign-in failed. metadata:
	//                     { error_kind } (the API client's error code)
	// Discriminators: mode, error_kind. No property carries the pet's name or
	// the email. No money moment; sign-up is the session route's, unchanged.
	| 'pet_save_viewed'
	| 'pet_save_failed'
	// Home, the core loop (M5, docs/application/features/
	// m5-home-core-loop-requirements.md): see the pet, care for it, come back.
	// The aha is the first care action that changes a need; the metric is care
	// days per person (days with a pet_action_taken), read first-party from the
	// row POST /api/app/v1/pet/actions records under the same name (the web
	// registry). user_activated stays on the pet's first talk reply. Not a money moment;
	// no lifecycle change.
	//
	// The drop-off: home_viewed → pet_action_taken (opened Home, never cared).
	//   home_viewed        Home focused with a pet. metadata: { mood, lowest_need,
	//                      low_count } (needs below 30)
	//   pet_action_taken   the server confirmed Feed, Play or Pet. metadata:
	//                      { action: 'feed' | 'play' | 'pet', need_changed,
	//                      mood_before, mood_after, suggested } (suggested: the
	//                      pet's last reply suggested this action, M6 Phase 4)
	//   pet_action_failed  an action's save failed, the needs rolled back.
	//                      metadata: { action, error_kind }
	//   pet_tapped         the pet image tapped. metadata: { mood, zone: 'head' |
	//                      'chin' | 'nose' | 'ear' | 'belly' | 'paw' | 'tail' |
	//                      'back' } (where it was touched; each zone answers in
	//                      its own way, v3-pet-looks-requirements.md, R7)
	//   pet_stroked        a finger dragged across the pet: it purrs and a heart
	//                      floats up. Cosmetic, no need changes (the Pet button
	//                      is the care action). Once per stroke. Answers whether
	//                      people find the gesture at all. metadata: { mood,
	//                      zone: 'head' | 'chin' | 'belly' | 'back' } (where the
	//                      stroke started)
	//   pet_hugged         the pet held (a long press): it squeezes into the hug.
	//                      Cosmetic, no need changes. Added 2026-10-09 (v3 pet
	//                      looks). metadata: { mood }
	// v3 pet looks (2026-10-09): the aha is touching the pet more than once in a
	// Home visit, in more than one zone; the drop-off is home_viewed with no
	// pet_tapped, pet_stroked or pet_hugged (touch never found). PostHog only,
	// like the rest of this app's events: not recorded until PostHog is set up.
	//   home_sky_tapped    the sun or moon tapped; the pet answers with the
	//                      sky's line. metadata: { time_of_day }
	//   home_load_failed   the Error state (nothing cached). metadata:
	//                      { error_kind }
	//   home_retry_tapped  Try again on it
	//   need_info_opened   a need pill tapped: the sheet that explains that need
	//                      (what lowers it, what raises it) opened. Added
	//                      2026-10-02 (Home fits one screen). Answers whether
	//                      people look up how the needs work, and which need
	//                      confuses them; low says whether the pill's "low" sent
	//                      them there. metadata: { need, low }
	// Discriminators: action, mood, lowest_need, time_of_day, error_kind, need,
	// zone. No property carries the pet's name.
	| 'home_viewed'
	| 'pet_action_taken'
	| 'pet_action_failed'
	| 'pet_tapped'
	| 'pet_stroked'
	| 'pet_hugged'
	| 'home_sky_tapped'
	| 'home_load_failed'
	| 'home_retry_tapped'
	| 'need_info_opened'
	// Talking to the pet (M6, docs/application/features/m6-talk-requirements.md):
	// hold the mic on Home (or type instead) and the pet answers in its bubble.
	// The aha is the pet's first reply: user_activated, emitted server-side by
	// POST /api/app/v1/pet/talk (the web registry, also a Play Event), which
	// records talk_reply_received first-party under the same name. The metric is
	// talk days per person. Not a money moment: the locked mic only opens the
	// paywall, whose own events cover the purchase.
	//
	// The funnel: talk_started → talk_message_sent → talk_reply_received.
	// The drop-offs: talk_cancelled (gave up before sending), talk_reply_failed
	// (sent, got nothing), mic_permission_answered { granted: false } (voice
	// refused), talk_limit_reached (out of free messages).
	//   talk_started             listening started, or the type-instead field
	//                            opened. metadata: { input: 'voice' | 'typed' }
	//   talk_cancelled           metadata: { reason: 'slid_away' | 'nothing_heard'
	//                            | 'speech_failed' (the recognizer couldn't
	//                            listen) | 'closed' }
	//   talk_message_sent        metadata: { input, length_bucket: 'short' |
	//                            'medium' | 'long' }
	//   talk_reply_received      metadata: { input, intent (upset sent as
	//                            'other'), latency_ms, messages_left (null for
	//                            Plus) }
	//   talk_reply_failed        metadata: { error_kind: 'timeout' |
	//                            'not_connected' | 'invalid_reply' | 'network' }
	//   talk_retry_tapped        Try again on a failed reply
	//   talk_limit_reached       the free count hit 0, or the mic pressed at 0
	//   mic_permission_answered  the system prompts answered. metadata:
	//                            { granted }
	//   upgrade_tapped           something that opens the paywall was pressed.
	//                            metadata: { source: 'talk_limit' (the locked
	//                            mic) | 'profile_panel' (Profile's "See plans",
	//                            M7) | 'locked_look' (a Plus option in Change
	//                            look, M7) }
	// Discriminators: input, reason, intent, error_kind, source, granted. No
	// property ever carries what was said, the reply or the pet's name.
	| 'talk_started'
	| 'talk_cancelled'
	| 'talk_message_sent'
	| 'talk_reply_received'
	| 'talk_reply_failed'
	| 'talk_retry_tapped'
	| 'talk_limit_reached'
	| 'mic_permission_answered'
	| 'upgrade_tapped'
	// Long-term memory (v2, docs/application/features/v2-memory-requirements.md):
	// the pet keeps short facts you tell it, "Mochi remembers…" on the pet's
	// page, and "Tell me about you" after sign-in. Keeping, deleting, the intro's
	// end and the return line are recorded first-party by the web routes
	// (memory_saved, memory_deleted, intro_completed, intro_skipped,
	// greeting_shown, the web registry). The app's events are the funnel around
	// them. Not a money moment: "Plus remembers up to 100" opens the paywall,
	// whose events cover it (upgrade_tapped { source: 'memory_full' }).
	//
	// The intro funnel: intro_viewed → intro_recorded → intro_sent →
	// intro_completed (server). The drop-offs: intro_skipped (server, by step)
	// and intro_failed.
	//   memory_chip_tapped   the memory row under the bubble tapped. metadata:
	//                        { kind: 'remembered' ("Mochi will remember that")
	//                        | 'recalled' ("From Mochi's memory") }
	//   memory_list_viewed   "Mochi remembers…" seen. metadata: { surface:
	//                        'card' (the pet's page) | 'page' (Manage all),
	//                        count_bucket: '0' | '1-5' | '6-15' | '16+', full }
	//   memory_searched      a search on "Manage all" came back, once a visit:
	//                        do people search, and do they find it. metadata:
	//                        { found }. Never the words
	//   intro_viewed         the intro appeared. metadata: { entry:
	//                        'after_signup' | 'existing_pet' | 'pet_details' }
	//   intro_recorded       words ready for review. metadata: { input,
	//                        length_bucket }
	//   intro_sent           Send to Mochi. metadata: { input, attempt: 1 | 2 }
	//   intro_failed         the call failed. metadata: { error_kind:
	//                        'not_connected' | 'invalid' | 'network' }
	// Discriminators: surface, entry, input, attempt, error_kind. No property ever
	// carries a fact, a tag, what was said or the pet's name.
	| 'memory_chip_tapped'
	| 'memory_list_viewed'
	| 'memory_searched'
	| 'intro_viewed'
	| 'intro_recorded'
	| 'intro_sent'
	| 'intro_failed'
	// The pet's daily note (v2, docs/application/features/v2-notifications-requirements.md):
	// a local notification in the pet's voice when it would start missing you,
	// one a day at most, three in all. Judged on whether it brings people back:
	// notification_opened and notifications_state are recorded first-party by the
	// greeting route (the web registry), since these go to PostHog only. Not a
	// money moment, not a lifecycle state.
	//
	// The funnel: notification_prompt_shown → notification_prompt_answered (yes)
	// → notification_permission_result (granted) → notification_opened (server).
	// The drop-offs: Not now, a refusal, and notes never opened.
	//   notification_prompt_shown       the bubble's ask after a care. metadata:
	//                                   { attempt: 1 | 2 }
	//   notification_prompt_answered    metadata: { answer: 'yes' | 'not_now',
	//                                   attempt: 1 | 2 }
	//   notification_permission_result  iOS answered its prompt. metadata:
	//                                   { granted, from: 'bubble' | 'settings' }
	//   notifications_changed           the Settings toggle. metadata: { enabled }
	//   notification_tapped             a note opened the app. metadata:
	//                                   { day: 1 | 2 | 3, need }
	// Discriminators: attempt, answer, from, day, need. Never a line's text or a name.
	| 'notification_prompt_shown'
	| 'notification_prompt_answered'
	| 'notification_permission_result'
	| 'notifications_changed'
	| 'notification_tapped'
	// Mochi speaks (v2, docs/application/features/v2-voice-requirements.md): a counted
	// talk reply read aloud in the pet's voice, a beat after the text. The aha is
	// the first voice heard (voice_played); talk_reply_voiced is recorded
	// first-party by the voice route (the web registry). Not a money moment, not
	// a lifecycle state.
	//   voice_played    the voice started. metadata: { input: 'voice' | 'typed', how
	//                   the message was said (it decides the silent switch); from:
	//                   'talk' | 'intro', a talk reply or "Tell me about you"'s answer }
	//   voice_stopped   cut off before its end. metadata: { by: 'mic' | 'reply' |
	//                   'left' | 'setting' }
	//   voice_failed    no voice for a counted reply. metadata: { stage: 'fetch' |
	//                   'play', error_kind (fetch only: the API's error code) }
	//   voice_changed   the Settings toggle. metadata: { enabled }
	//   voice_limit_reached  the day's voiced replies are used up (5 free, 20 with
	//                   Plus): the pet says "I'm out of voice for today",
	//                   once a local day. No metadata
	//   voice_sample_played  a recorded line in the pet's voice while creating it
	//                   (shipped in the app, no request): the personality page on
	//                   picking one, and Meet on arrival. metadata: { screen:
	//                   'personality' | 'meet', preset }. Does hearing it lead to
	//                   "Take {name} home"?
	// Discriminators: input, from, by, stage, screen, preset. Never the reply's
	// words or the pet's name.
	| 'voice_played'
	| 'voice_stopped'
	| 'voice_failed'
	| 'voice_changed'
	| 'voice_limit_reached'
	| 'voice_sample_played'
	// Preferences — settings toggles that change how the app feels. Not an "aha"
	// and not a money moment. There is no appearance choice to record: the app
	// follows the sky (product.md), so the template's appearance_changed is gone.
	//   haptics_changed     metadata: { enabled: boolean }
	| 'haptics_changed'
	// Subscription
	// The paywall appeared (the spec's paywall_viewed). metadata: { trigger:
	// 'talk_limit' | 'profile_panel' | 'locked_look' | 'memory_full' | 'photo_redo' |
	// 'unknown' }, the same
	// values as upgrade_tapped's source, so tapped → viewed joins per entry point
	// (M7); 'unknown' when opened without one.
	| 'upgrade_page_viewed'
	// Settings' "Manage subscription" row, shown only for a store subscription (not
	// an admin grant); it opens the store's subscriptions page (M7). No metadata.
	| 'manage_subscription_tapped'
	// A plan card was chosen on the paywall. metadata: { package }. `package` is
	// the discriminator (monthly vs annual): selected → cta_tapped per package is
	// the step before the store sheet.
	| 'upgrade_plan_selected'
	| 'upgrade_cta_tapped'
	| 'purchase_success'
	| 'restore_purchases_tapped'
	| 'redeem_code_tapped'
	// Paywall legal links — Apple 3.1.2: the purchase flow links to the Terms of
	// Use and the Privacy Policy. A compliance feature: it has no "aha" and is not
	// a money moment. Fired when either link in the paywall footer is tapped.
	// metadata: { document: 'terms' | 'privacy' }. `document` is the
	// discriminator: one name for both links keeps them one step in the paywall
	// funnel, and each can still be counted on its own.
	| 'upgrade_legal_link_tapped'
	// Account deletion — Apple 5.1.1(v) and Google Play: an account created in
	// the app can be deleted from inside it (Settings → Delete account).
	//
	// A compliance feature, so there is no "aha", and it is not a money moment.
	// It IS a lifecycle moment, and that moment already has its canonical name:
	// `account_deleted`, which POST /api/delete-account emits to the Play Events
	// API server-side before it deletes the user (the platform's
	// right-to-be-forgotten hook). The app reuses that name; it coins no other.
	//
	// The drop-off steps, in order:
	//   delete_account_tapped     the Settings row was tapped; the confirm step opened
	//   delete_account_confirmed  the person confirmed; the request is being sent
	//   account_deleted           the server deleted the account. Fired before the
	//                             sign-out, while PostHog still knows who it was.
	//   delete_account_failed     nothing was deleted, and the person was told why.
	//                             metadata: { reason: 'not_configured' | 'no_session'
	//                             | 'unauthorized' | 'network' | 'server' }
	// tapped → confirmed is the drop at the confirm step, which says a store
	// subscription keeps billing; confirmed → failed is everyone who asked to
	// leave and could not.
	| 'delete_account_tapped'
	| 'delete_account_confirmed'
	| 'account_deleted'
	| 'delete_account_failed'
	// Minimum-version gate (components/UpdateRequiredGate.tsx). A native bug
	// can't be fixed over the air, and a phone on an old runtime can't receive
	// updates, so when GET /api/app/v1/config says this binary is below the
	// minimum, a full-screen "Update required" sends the person to the store.
	//
	// An operational feature, not a product one: there is no "aha", it is not a
	// money moment, and no lifecycle state changes (the person is still a user;
	// they are only blocked until they update). What it answers: how many people
	// a raised minimum actually locked out, and how many of them went to update.
	//
	// The drop-off steps, in order:
	//   update_required_viewed             the gate was shown on launch
	//   update_required_store_link_tapped  the person tapped through to the store
	// viewed → tapped is everyone still stuck on the unsupported build.
	// metadata (both): { app_version, min_supported_version }. No discriminator:
	// there is one gate, and both values are the version strings, not ids.
	| 'update_required_viewed'
	| 'update_required_store_link_tapped'
	// Navigation
	| 'screen_viewed'
	// A tab was tapped in the tab bar (components/TabBar.tsx), not on first
	// mount and not a tap on the tab already showing.
	//   metadata: { tab: 'pet' | 'friends' | 'profile' | 'settings' } (there is no
	//   Talk tab: talking is on Home; friends since v2-friends)
	// `tab` is the discriminator. No "aha", no money moment, no lifecycle
	// change: it answers how people split their time between caring for the pet
	// (pet), their friends' pets (friends), their profile and Plus (profile), and
	// settings.
	| 'tab_selected'
	// Profile
	| 'profile_viewed'
	// Profile edit (docs/application/features/profile-edit-requirements.md): the
	// person's name and photo, set on the Edit profile screen (app/profile-edit.tsx).
	// THE metric is profile_updated (Mert, 2026-10-02): how many who open the screen
	// save a change. Not an "aha", not a money moment, no lifecycle change, so
	// PostHog only. The drop-off: opened → photo_picked → updated, and
	// update_failed by stage says where a save breaks.
	//   profile_edit_opened    the screen appeared. metadata: { from: 'profile',
	//                          has_photo }
	//   profile_photo_picked   a photo chosen in the library (not cancelled)
	//   profile_updated        a save succeeded. metadata: { name_changed,
	//                          photo: 'added' | 'replaced' | 'removed' | 'unchanged' }
	//   profile_update_failed  a save failed. metadata: { stage: 'too_large' |
	//                          'unsupported' | 'upload' | 'save', error_kind }
	// Discriminators: from, photo, stage. No property carries the name, the photo
	// or its storage path.
	| 'profile_edit_opened'
	| 'profile_photo_picked'
	| 'profile_updated'
	| 'profile_update_failed'
	// Pet details — a read-only page per pet (app/pet/[id].tsx), opened from the pet
	// on Profile; with more pets later it is where each one is seen. Not an "aha",
	// not a money moment, no lifecycle change. Answers whether people look at their
	// pet's page and whether it sends them back to caring for it.
	//   pet_details_viewed       the page appeared. metadata: { from: 'profile' }
	//   pet_details_room_tapped  "Go to {name}'s room" tapped (back to Home)
	// Discriminator: from. No property carries the pet's name.
	| 'pet_details_viewed'
	| 'pet_details_room_tapped'
	// Change look (M7, m7-plus-profile-settings-requirements.md, R14–R15): the
	// builder on the pet's own appearance, from its details page. Not an aha, not
	// a money moment by itself; a Plus option tapped there opens the paywall
	// (upgrade_tapped { source: 'locked_look' }), and pet_option_locked_tapped
	// fires with during_onboarding: false. The drop-off: opened → changed.
	//   pet_look_change_opened  the screen appeared. metadata: { species }
	//   pet_look_changed        the new look saved. metadata: { species,
	//                           preset_id (the ready-made look, or 'custom'),
	//                           appearance_key, plus (a Plus option in it) }
	// No property carries the pet's name.
	| 'pet_look_change_opened'
	| 'pet_look_changed'
	// Your pet from a photo (v2, features/v2-pet-from-photo-requirements.md): a photo of a
	// real cat or dog read by the AI into the catalog and drawn. Start's From a photo card
	// fires pet_create_path_selected { path: 'photo' }; the reveal is onboarding_step_viewed
	// { step: 'photo' }. The aha: the reveal kept as it is (pet_photo_confirmed { choice:
	// 'keep' }), and how close it was (pet_photo_kept's changed_count). The drop-offs:
	// sheet_opened with no read (the photo or the AI note put people off), and a read with
	// no pet_photo_kept. Not a money moment; a free redo tapped opens the paywall
	// (trigger 'photo_redo').
	//   pet_photo_sheet_opened       the photo sheet appeared. metadata: { context: 'create'
	//                                | 'redo', tries_left }
	//   pet_photo_source_selected    metadata: { context, source: 'camera' | 'library' }
	//   pet_photo_permission_denied  camera permission refused. metadata: { context }
	//   pet_photo_read               a read finished. metadata: { context, result: 'read' |
	//                                'no_pet' | 'several' | 'unclear' | 'limit_reached' |
	//                                'failed', ms, species, swapped_count }
	//   pet_photo_confirmed          the reveal answered. metadata: { choice: 'keep' |
	//                                'adjust' }
	//   pet_photo_kept               Name reached (create) or the look saved (redo) from a
	//                                photo. metadata: { context, changed_count } (attributes
	//                                the person changed after the read)
	//   pet_photo_redo_tapped        Change look's "Redo from a photo". metadata: { plan:
	//                                'free' | 'plus', left: 0 | 1 }
	//   pet_photo_species_choice     the species dialog answered (redo). metadata: { choice:
	//                                'switch' | 'keep' }
	// Discriminators: context, source, result, choice, plan. Never the photo, the pet's name
	// or the install id. The server records counted reads first-party (web registry,
	// pet_photo_read).
	| 'pet_photo_sheet_opened'
	| 'pet_photo_source_selected'
	| 'pet_photo_permission_denied'
	| 'pet_photo_read'
	| 'pet_photo_confirmed'
	| 'pet_photo_kept'
	| 'pet_photo_redo_tapped'
	| 'pet_photo_species_choice'
	// Friends (v2, docs/application/features/v2-friends-requirements.md): add a friend
	// by their QR code and see their pet. The metric is first-party, recorded by the
	// web routes (friend_added, friend_removed, friends_viewed in the web registry);
	// these are the funnel around it, in PostHog:
	//   friend_code_shown    My code opened. metadata: { source: 'empty_state' | 'list' }
	//   friend_code_shared   Share tapped on My code and the sheet completed
	//   friend_code_reset    New code confirmed (the old one stops working)
	//   friend_add_opened    the add screen opened. metadata: { source: 'link' | 'typed' }
	//   friend_add_failed    an add or a lookup refused. metadata: { reason: 'own_code' |
	//                        'unknown_code' | 'cap' | 'network' }
	//   friend_pet_viewed    a friend's pet page opened. metadata: { mood }
	// The drop-off is code shown → add opened (on the other phone) → friend_added.
	// Never a code, a name or the friend's id.
	| 'friend_code_shown'
	| 'friend_code_shared'
	| 'friend_code_reset'
	| 'friend_add_opened'
	| 'friend_add_failed'
	| 'friend_pet_viewed'
// TODO: add your app-specific events here

/** Track an event. No-ops silently when PostHog is unconfigured. */
export function track(event: EventName, properties?: TrackProperties) {
	if (!posthog) return
	try {
		posthog.capture(event, properties)
	} catch {
		// intentionally silent
	}
}

/** Identify the user in PostHog (call after login). */
export function identify(userId: string, properties?: IdentifyProperties) {
	if (!posthog) return
	try {
		posthog.identify(userId, properties)
	} catch {
		// intentionally silent
	}
}

/** Reset the PostHog identity (call after logout). */
export function resetIdentity() {
	if (!posthog) return
	try {
		posthog.reset()
	} catch {
		// intentionally silent
	}
}
