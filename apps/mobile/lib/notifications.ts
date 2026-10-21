/**
 * The pet's daily notes on the phone (docs/application/features/v2-notifications-requirements.md):
 * the one module that touches expo-notifications. Local notifications only: no push token is ever
 * asked for, and nothing about a note leaves the phone (R1, R22).
 *
 * The plan comes from lib/nudge.ts and the words from lib/notificationLines.ts. Scheduling and
 * cancelling run one after another, in the order they were asked for, so a quick background →
 * foreground never leaves a note scheduled after the cancel that should have removed it.
 */
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Notifications from 'expo-notifications'
import type { Need, NotesState, Pet } from '@app/contract'
import { track } from '@/lib/analytics'
import { log } from '@/lib/logger'
import { pickLine } from '@/lib/notificationLines'
import { planNudges, type NudgeDay } from '@/lib/nudge'
import { deviceTimeZone } from '@/lib/timeZone'

const KEY = 'app:notifications:v1'
/** The notes' identifiers: fixed, so cancelling never touches another notification. */
const NUDGE_IDS = ['nudge-1', 'nudge-2', 'nudge-3'] as const
/** After a first "Not now", the bubble may ask once more, this long after (R14). */
const ASK_AGAIN_AFTER_MS = 3 * 24 * 60 * 60 * 1000
/** The bubble asks at most this many times (R14). */
const MAX_ASKS = 2

/** Whether notes can reach this person (the `notifications_state` values): the contract's. */
export type { NotesState }

/** What a note carries for the app when it is tapped: never a line or a name (R12). */
export type NudgeData = { kind: 'nudge'; day: NudgeDay; need: Need }

type Prefs = {
	/** The Settings toggle. On unless turned off (R15). */
	enabled: boolean
	/** How many times the bubble has asked, and when it last did (R13–R14). */
	asks: number
	lastAskAt: number | null
	/** The last line used for each need and day tier, so the next note picks another (R11). */
	lastLines: Record<string, string>
}

const DEFAULT_PREFS: Prefs = { enabled: true, asks: 0, lastAskAt: null, lastLines: {} }
let prefs: Prefs = DEFAULT_PREFS
let loaded: Promise<void> | null = null

function loadPrefs(): Promise<void> {
	loaded ??= AsyncStorage.getItem(KEY)
		.then((raw) => {
			if (raw) prefs = { ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<Prefs>) }
		})
		.catch(() => {
			// Keep the defaults: a broken value never stops the app.
		})
	return loaded
}

async function savePrefs(patch: Partial<Prefs>): Promise<void> {
	await loadPrefs()
	prefs = { ...prefs, ...patch }
	try {
		await AsyncStorage.setItem(KEY, JSON.stringify(prefs))
	} catch {
		// Non-fatal: the choice still applies for this session.
	}
}

// Every scheduling change runs after the one before it.
let queue: Promise<unknown> = Promise.resolve()
function serial<T>(work: () => Promise<T>): Promise<T> {
	const next = queue.then(work, work)
	queue = next.catch(() => undefined)
	return next
}

/** Nothing shows while the app is open (R8). Called once, at launch. */
export function configureNotifications(): void {
	Notifications.setNotificationHandler({
		handleNotification: async () => ({
			shouldShowBanner: false,
			shouldShowList: false,
			shouldPlaySound: false,
			shouldSetBadge: false
		})
	})
}

function granted(status: Notifications.NotificationPermissionsStatus): boolean {
	const ios = status.ios?.status
	return (
		status.granted ||
		ios === Notifications.IosAuthorizationStatus.PROVISIONAL ||
		ios === Notifications.IosAuthorizationStatus.EPHEMERAL
	)
}

/** iOS's answer and the toggle together. Never prompts. */
export async function notesState(): Promise<NotesState> {
	await loadPrefs()
	try {
		const status = await Notifications.getPermissionsAsync()
		if (granted(status)) return prefs.enabled ? 'on' : 'off'
		return status.status === Notifications.PermissionStatus.UNDETERMINED ? 'unasked' : 'denied'
	} catch {
		return 'off'
	}
}

/** Shows iOS's prompt (only ever after a tap). Resolves whether notes are now allowed. */
export async function requestNotes(from: 'bubble' | 'settings'): Promise<boolean> {
	try {
		const status = await Notifications.requestPermissionsAsync({
			ios: { allowAlert: true, allowSound: true, allowBadge: false }
		})
		const ok = granted(status)
		track('notification_permission_result', { granted: ok, from })
		if (ok) await savePrefs({ enabled: true })
		return ok
	} catch (error) {
		log.warn('Notification permission request failed', { error })
		return false
	}
}

/** The Settings toggle. Off cancels every note at once (R15). */
export async function setNotesEnabled(enabled: boolean): Promise<void> {
	await savePrefs({ enabled })
	track('notifications_changed', { enabled })
	if (!enabled) await cancelNudges()
}

/** Whether the bubble may ask now: never asked, or once and long enough ago (R13–R14). */
export async function mayAsk(now = Date.now()): Promise<boolean> {
	if ((await notesState()) !== 'unasked') return false
	if (prefs.asks === 0) return true
	return (
		prefs.asks < MAX_ASKS && prefs.lastAskAt != null && now - prefs.lastAskAt >= ASK_AGAIN_AFTER_MS
	)
}

/** The bubble asked; `attempt` is 1 or 2, for the events. */
export async function markAsked(now = Date.now()): Promise<1 | 2> {
	await loadPrefs()
	const attempt = prefs.asks === 0 ? 1 : 2
	await savePrefs({ asks: prefs.asks + 1, lastAskAt: now })
	return attempt
}

/**
 * Schedules this absence's notes from the pet's needs as stored: up to three, cancelling any
 * before. Nothing when notes are not on (R15, R20).
 */
export function scheduleNudges(pet: Pet, yourName: string | null, leftAt = new Date()) {
	return serial(async () => {
		await cancelPending()
		if ((await notesState()) !== 'on') return
		const { updated_at, ...needs } = pet.needs
		const plan = planNudges({
			needs,
			storedAt: new Date(updated_at),
			leftAt,
			timeZone: deviceTimeZone()
		})
		const lastLines = { ...prefs.lastLines }
		for (const [index, nudge] of plan.entries()) {
			const slot = `${nudge.need}.${nudge.day === 1 ? 'first' : 'later'}`
			const line = pickLine(
				nudge.need,
				pet.appearance.species,
				nudge.day,
				{ pet: pet.name, you: yourName },
				lastLines[slot] ?? null
			)
			lastLines[slot] = line.key
			const data: NudgeData = { kind: 'nudge', day: nudge.day, need: nudge.need }
			await Notifications.scheduleNotificationAsync({
				identifier: NUDGE_IDS[index],
				content: { title: line.title, body: line.body, data, sound: 'default' },
				trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: nudge.at }
			})
		}
		await savePrefs({ lastLines })
	}).catch((error: unknown) => log.warn('Could not schedule the pet notes', { error }))
}

async function cancelPending(): Promise<void> {
	await Promise.all(NUDGE_IDS.map((id) => Notifications.cancelScheduledNotificationAsync(id)))
}

/**
 * Cancels every pending note and clears delivered ones from the notification centre: on every
 * return to the app (R8), on sign-out (R19) and when the toggle goes off.
 */
export function cancelNudges() {
	return serial(async () => {
		await cancelPending()
		await Notifications.dismissAllNotificationsAsync()
	}).catch((error: unknown) => log.warn('Could not cancel the pet notes', { error }))
}

/** On sign-out: no notes, and the next person gets their own ask (R19). */
export async function resetNotesForSignOut(): Promise<void> {
	await cancelNudges()
	await savePrefs({ asks: 0, lastAskAt: null, lastLines: {} })
}

/** A tapped note's labels, or null for anything else. */
export function nudgeData(data: unknown): NudgeData | null {
	if (typeof data !== 'object' || data === null) return null
	const { kind, day, need } = data as Record<string, unknown>
	if (kind !== 'nudge' || (day !== 1 && day !== 2 && day !== 3)) return null
	if (need !== 'hunger' && need !== 'happiness' && need !== 'energy' && need !== 'affection') {
		return null
	}
	return { kind, day, need }
}

// The last note that opened the app, kept until the greeting call takes it (Phase 3, R16).
let opened: NudgeData | null = null

export function rememberOpenedNudge(data: NudgeData): void {
	opened = data
}

/** Takes the note that opened the app, once. */
export function takeOpenedNudge(): NudgeData | null {
	const data = opened
	opened = null
	return data
}
