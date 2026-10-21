/**
 * Speech to text on the phone (docs/application/features/m6-talk-requirements.md, R25–R26):
 * Apple's recognizer, through expo-speech-recognition's native module, in English, on the device
 * when it can be. Only the text it hears ever leaves the phone, and only when it is sent to the
 * pet.
 *
 * The native module is read optionally: a build made before it was added (or Expo Go, or the
 * tests) has none, and gets `null` here, so the app offers typing instead of crashing. Nothing
 * here keeps state; the hook that listens (hooks/useVoice.ts) does.
 */
import { requireOptionalNativeModule } from 'expo'
import type {
	ExpoSpeechRecognitionErrorCode,
	ExpoSpeechRecognitionModuleType,
	ExpoSpeechRecognitionNativeEventMap
} from 'expo-speech-recognition/build/ExpoSpeechRecognitionModule.types'
import { log } from '@/lib/logger'
import { createTranscript } from '@/lib/transcript'

/** v1 talks in English only (product.md, "Talking"). */
const LANGUAGE = 'en-US'

let module: ExpoSpeechRecognitionModuleType | null | undefined

function recognizer(): ExpoSpeechRecognitionModuleType | null {
	if (module === undefined) {
		module = requireOptionalNativeModule<ExpoSpeechRecognitionModuleType>('ExpoSpeechRecognition')
	}
	return module
}

/** Whether this build has the recognizer and the phone can use it now. */
export function canListen(): boolean {
	try {
		return recognizer()?.isRecognitionAvailable() ?? false
	} catch {
		return false
	}
}

/**
 * - `granted`: the microphone and speech recognition are both allowed.
 * - `ask`: not decided yet; ask the first time the mic is pressed, never before.
 * - `refused`: refused (or restricted); typing is the way to talk.
 */
export type ListenPermission = 'granted' | 'ask' | 'refused'

function permissionOf(response: { granted: boolean; canAskAgain: boolean }): ListenPermission {
	if (response.granted) return 'granted'
	return response.canAskAgain ? 'ask' : 'refused'
}

/** What the person decided so far, without asking. */
export async function listenPermission(): Promise<ListenPermission> {
	const speech = recognizer()
	if (!speech) return 'refused'
	try {
		return permissionOf(await speech.getPermissionsAsync())
	} catch {
		return 'refused'
	}
}

/** Shows the system prompts (microphone, then speech recognition) when they haven't been answered. */
export async function askToListen(): Promise<ListenPermission> {
	const speech = recognizer()
	if (!speech) return 'refused'
	try {
		return permissionOf(await speech.requestPermissionsAsync())
	} catch {
		return 'refused'
	}
}

export type ListenEvents = {
	/** What it has heard so far; replaced as it hears more. */
	onHeard: (words: string) => void
	/** Listening stopped (stopped, cancelled, or the recognizer gave up). */
	onEnd: () => void
	onError: (code: ExpoSpeechRecognitionErrorCode) => void
}

type Subscription = { remove: () => void }

/** One listening session. `release` removes its listeners; call it once the session is over. */
export type ListenSession = { stop: () => void; cancel: () => void; release: () => void }

/**
 * On-device recognition, until it fails to start on this phone; then Apple's own servers for the
 * rest of the session. "Supports on-device" doesn't mean the English model is installed (the
 * Simulator has none, and iOS can't say which languages are), so the first failure decides.
 */
let onDevicePreferred = true

/** Errors that say nothing about whether the recognizer works: never a reason to switch. */
const NOT_THE_RECOGNIZER: ReadonlySet<ExpoSpeechRecognitionErrorCode> = new Set([
	'aborted',
	'no-speech',
	'not-allowed',
	'interrupted'
])

/**
 * Starts listening and reports what it hears until `stop` (keep what was heard) or `cancel`
 * (throw it away). Continuous, so it waits for the person, not for a pause. Returns null when
 * this build can't listen. If on-device recognition can't start before anything is heard, it
 * starts again on Apple's servers within the same session, unnoticed. Its listeners go when it
 * ends, or on `release`, whichever is first, so a session that never reports its end can't hear
 * for the next one.
 */
export function startListening(events: ListenEvents): ListenSession | null {
	const speech = recognizer()
	if (!speech) return null

	let onDevice = onDevicePreferred && speech.supportsOnDeviceRecognition()
	let heardAnything = false
	let stopped = false
	let restarting = false

	const subscriptions: Subscription[] = []
	const removeAll = () => subscriptions.splice(0).forEach((subscription) => subscription.remove())
	const on = <K extends keyof ExpoSpeechRecognitionNativeEventMap>(
		name: K,
		listener: (event: ExpoSpeechRecognitionNativeEventMap[K]) => void
	) => subscriptions.push(speech.addListener(name, listener as never))
	const begin = () =>
		speech.start({
			lang: LANGUAGE,
			interimResults: true,
			continuous: true,
			addsPunctuation: true,
			requiresOnDeviceRecognition: onDevice
		})
	const finish = () => {
		removeAll()
		events.onEnd()
	}

	const transcript = createTranscript()
	on('result', (event) => {
		const words = event.results[0]?.transcript?.trim()
		if (!words) return
		heardAnything = true
		events.onHeard(transcript.add(words, event.isFinal))
	})
	on('error', (event) => {
		if (onDevice && !heardAnything && !stopped && !NOT_THE_RECOGNIZER.has(event.error)) {
			log.warn('on-device speech recognition unavailable; using Apple servers', {
				code: event.error
			})
			onDevicePreferred = false
			onDevice = false
			restarting = true
			return
		}
		if (!NOT_THE_RECOGNIZER.has(event.error)) {
			log.warn('speech recognition failed', { code: event.error, message: event.message })
		}
		events.onError(event.error)
	})
	on('end', () => {
		if (restarting && !stopped) {
			restarting = false
			try {
				begin()
				return
			} catch {
				// Can't start again: end the session as it is.
			}
		}
		finish()
	})

	try {
		begin()
	} catch {
		removeAll()
		return null
	}
	return {
		stop: () => {
			stopped = true
			speech.stop()
		},
		cancel: () => {
			stopped = true
			removeAll()
			speech.abort()
		},
		release: removeAll
	}
}
