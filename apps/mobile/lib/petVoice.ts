/**
 * Mochi speaks (docs/application/features/v2-voice-requirements.md, R7–R11): plays the pet's
 * voice for a reply, one at a time, and keeps the Settings preference (on unless turned off, kept
 * on this phone).
 *
 * The audio mode is set before every voice. Listening leaves iOS's audio session in record mode,
 * where playback can come out of the quiet earpiece; `allowsRecording: false` switches it back to
 * playback, which is the speaker (R7). What the person asked to hear plays even with the silent
 * switch on, like Siri: a reply to something spoken, a personality's line they tapped. What plays
 * by itself follows the switch: a reply to something typed, Meet's line (R8). Through the switch,
 * other audio is lowered while the pet speaks; otherwise it mixes (iOS refuses to lower other
 * audio for a sound the silent switch can silence: that refusal kept every such line quiet).
 *
 * expo-audio is loaded only once its native module is known to be in this build, as for the pet's
 * sounds. Nothing here throws: a voice that can't play is reported and skipped (R6).
 */
import { AccessibilityInfo } from 'react-native'
import { useSyncExternalStore } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { requireOptionalNativeModule } from 'expo'
import type { AudioPlayer, AudioSample, AudioSource, AudioStatus } from 'expo-audio'
import type { PresetId, Species, TalkInput, VoiceSource } from '@app/contract'
import { track } from '@/lib/analytics'
import { api, errorCode } from '@/lib/api'
import { log } from '@/lib/logger'
import { nextMouth, opennessOf, shutMouth, soundMouth } from '@/lib/petMouth'
import { localDayNow } from '@/lib/timeZone'
import { voiceSample } from '@/lib/voiceSamples'

const PREF_KEY = 'kinpaw:voice:v1'
/** The local day the pet last said it was out of voice: it says so once a day. */
const OUT_OF_VOICE_KEY = 'kinpaw:voiceOut:v1'
/** A voice that hasn't started this long after it was handed over is given up on. */
const START_TIMEOUT_MS = 8_000
/** The server gives fal 10 s; past this, the voice is no longer "a beat" after the text. */
const FETCH_TIMEOUT_MS = 15_000

export type VoiceStop = 'mic' | 'reply' | 'left' | 'setting'

type Audio = typeof import('expo-audio')
let audio: Promise<Audio | null> | null = null

function loadAudio(): Promise<Audio | null> {
	audio ??= (async () => {
		if (!requireOptionalNativeModule('ExpoAudio')) return null
		// Required here, not imported at the top: only once the native module is known to exist.
		// A require, not import(): Jest can't run a dynamic import, and both are lazy under Metro.
		// eslint-disable-next-line @typescript-eslint/no-require-imports
		return require('expo-audio') as Audio
	})().catch((err) => {
		log.warn('pet voice unavailable', { err })
		return null
	})
	return audio
}

let enabled: boolean | null = null

/** Whether the pet speaks its replies (R11). On unless turned off on this phone. */
export async function voiceEnabled(): Promise<boolean> {
	if (enabled !== null) return enabled
	try {
		enabled = (await AsyncStorage.getItem(PREF_KEY)) !== 'off'
	} catch {
		enabled = true
	}
	return enabled
}

/** The Settings toggle. Turning it off stops a voice that is playing. */
export async function setVoiceEnabled(on: boolean): Promise<void> {
	enabled = on
	track('voice_changed', { enabled: on })
	if (!on) stopVoice('setting')
	try {
		await AsyncStorage.setItem(PREF_KEY, on ? 'on' : 'off')
	} catch (err) {
		log.warn('Could not keep the voice setting', { err })
	}
}

let current: { player: AudioPlayer; started: boolean; sampled: boolean } | null = null

/**
 * Whether the voice playing has sent its sound to the mouth (v3-pet-looks-requirements.md, R6).
 * Without samples (a platform or a file that gives none), the pet's mouth chatters instead.
 */
export const voiceSampled = (): boolean => current?.sampled ?? false

// What is speaking now, for the screens to show it: a recorded line's `{screen}:{preset}`, or
// `reply`. Null when quiet.
let speaking: string | null = null
const speakingListeners = new Set<() => void>()

function setSpeaking(key: string | null): void {
	if (speaking === key) return
	speaking = key
	for (const listener of speakingListeners) listener()
}

/** What the pet is saying out loud right now (`{screen}:{preset}` or `reply`), or null. */
export const voiceSpeaking = (): string | null => speaking

function onSpeakingChange(listener: () => void): () => void {
	speakingListeners.add(listener)
	return () => speakingListeners.delete(listener)
}

/** `voiceSpeaking()`, kept current in a component. */
export function useVoiceSpeaking(): string | null {
	return useSyncExternalStore(onSpeakingChange, voiceSpeaking)
}

function release(): void {
	const playing = current
	current = null
	setSpeaking(null)
	shutMouth()
	try {
		playing?.player.remove()
	} catch {
		// Already gone.
	}
}

// Bumped by every new reply and every stop, so a voice still on its way when the mic opens, Home
// is left or a newer reply comes is dropped instead of played over them.
let generation = 0

/**
 * Stops the voice that is playing, if any, and says why (R9); without a reason (a recorded line
 * replacing another) nothing is tracked. A voice on its way is dropped.
 */
export function stopVoice(by?: VoiceStop): void {
	generation += 1
	if (!current) return
	if (current.started && by) track('voice_stopped', { by })
	try {
		current.player.pause()
	} catch {
		// Released meanwhile.
	}
	release()
}

/**
 * Plays a voice: a reply's URL or a recorded line shipped in the app, at `rate` without pitch
 * correction (varispeed: above 1 the pet sounds smaller as well as quicker). Through the speaker;
 * `inSilentMode` plays it with the silent switch on (R7–R8). `key` is what `useVoiceSpeaking`
 * shows while it plays. Resolves whether it started; the caller reports it.
 */
async function playVoice(
	source: AudioSource,
	{ inSilentMode, rate = 1, key }: { inSilentMode: boolean; rate?: number; key: string }
): Promise<boolean> {
	const loaded = await loadAudio()
	if (!loaded) return false
	try {
		await loaded.setAudioModeAsync({
			allowsRecording: false,
			playsInSilentMode: inSilentMode,
			// iOS refuses `duckOthers` for a sound the silent switch can silence (expo-audio throws).
			interruptionMode: inSilentMode ? 'duckOthers' : 'mixWithOthers'
		})
		const player = loaded.createAudioPlayer(source)
		if (rate !== 1) {
			player.shouldCorrectPitch = false
			player.setPlaybackRate(rate)
		}
		const mine = { player, started: false, sampled: false }
		current = mine
		// A reply moves the pet's mouth on Home: its loudness, batch by batch, opens it (R6).
		if (key === 'reply' && player.isAudioSamplingSupported) {
			player.setAudioSamplingEnabled(true)
			player.addListener('audioSampleUpdate', (sample: AudioSample) => {
				if (current !== mine) return
				const frames = sample.channels[0]?.frames
				if (!frames) return
				mine.sampled = true
				soundMouth.value = nextMouth(soundMouth.value, opennessOf(frames))
			})
		}
		const started = await new Promise<boolean>((resolve) => {
			const timer = setTimeout(() => resolve(false), START_TIMEOUT_MS)
			player.addListener('playbackStatusUpdate', (status: AudioStatus) => {
				if (current !== mine) return
				if (status.playing && !mine.started) {
					mine.started = true
					setSpeaking(key)
					clearTimeout(timer)
					resolve(true)
				}
				if (status.playbackState === 'failed') {
					clearTimeout(timer)
					resolve(false)
				}
				if (status.didJustFinish) release()
			})
			player.play()
		})
		if (current === mine && !started) release()
		return started
	} catch (err) {
		log.warn('pet voice did not play', { err })
		release()
		return false
	}
}

/**
 * The day's voiced replies are used up: true the first time today (the caller says so once, R5),
 * false after. Kept on the phone by local day.
 */
async function firstOutOfVoiceToday(): Promise<boolean> {
	const today = localDayNow()
	try {
		if ((await AsyncStorage.getItem(OUT_OF_VOICE_KEY)) === today) return false
		await AsyncStorage.setItem(OUT_OF_VOICE_KEY, today)
	} catch {
		// Without storage, saying it again is better than never.
	}
	track('voice_limit_reached')
	return true
}

/** A reply's voice, fetched and ready to play; or the day's voice used up; or none. */
export type ReadyVoice = { url: string; rate: number; generation: number } | 'out_of_voice' | null

/**
 * Asks for the voice of words the server just answered (R1), without playing it: so the text can
 * wait for it and both arrive together (Mert, 2026-10-06). Stops a voice still playing. Null when
 * the voice is off or VoiceOver is on (no request at all, R10–R11), or it failed (reported; the
 * text stands, R6); `out_of_voice` the first time a day the limit is reached (R5). Never throws.
 */
export async function fetchReplyVoice(
	messageId: string,
	text: string,
	from: VoiceSource = 'talk'
): Promise<ReadyVoice> {
	stopVoice('reply')
	const mine = generation
	if (!(await canSpeak())) return null
	try {
		const answer = await api('petVoice', {
			body: { message_id: messageId, text, from },
			timeoutMs: FETCH_TIMEOUT_MS
		})
		if (answer.outcome === 'limited') {
			return (await firstOutOfVoiceToday()) ? 'out_of_voice' : null
		}
		return { url: answer.audio_url, rate: answer.playback_rate, generation: mine }
	} catch (error) {
		track('voice_failed', { stage: 'fetch', error_kind: errorCode(error) ?? 'unknown' })
		return null
	}
}

/**
 * Plays a fetched voice, unless something stopped it meanwhile (the mic, a newer reply, leaving).
 * Resolves `out_of_voice` for the pet to say so; otherwise null. Never throws.
 */
export async function playReplyVoice(
	ready: ReadyVoice,
	input: TalkInput,
	from: VoiceSource = 'talk'
): Promise<'out_of_voice' | null> {
	if (ready === 'out_of_voice') return ready
	if (!ready || ready.generation !== generation) return null
	const played = await playVoice(
		{ uri: ready.url },
		{ inSilentMode: input === 'voice', rate: ready.rate, key: 'reply' }
	)
	if (played) track('voice_played', { input, from })
	else if (ready.generation === generation) track('voice_failed', { stage: 'play' })
	return null
}

/** Fetches and plays at once: for an answer whose text shows first ("Tell me about you"). */
export async function speakReply(
	messageId: string,
	text: string,
	input: TalkInput,
	from: VoiceSource = 'talk'
): Promise<'out_of_voice' | null> {
	return playReplyVoice(await fetchReplyVoice(messageId, text, from), input, from)
}

/** Whether the pet speaks here at all: the voice on in Settings, and VoiceOver off (R10–R11). */
export async function canSpeak(): Promise<boolean> {
	if (!(await voiceEnabled())) return false
	return !(await AccessibilityInfo.isScreenReaderEnabled().catch(() => false))
}

/**
 * Says a recorded line in the pet's voice while it is being made (v2 voice, "Before Home"): a file
 * shipped in the app, so no request and no account needed. The personality page's line when a
 * personality is picked, Meet's first line on arrival and on "Hear it again". `asked` (a tap)
 * plays even with the silent switch on; by itself it follows the switch (R8). Follows the Settings preference, and stays quiet
 * with VoiceOver on. Replaces any line playing. Never throws.
 */
export async function playVoiceSample(
	screen: 'personality' | 'meet',
	species: Species,
	preset: PresetId,
	{ custom = false, asked = false }: { custom?: boolean; asked?: boolean } = {}
): Promise<void> {
	stopVoice()
	const mine = generation
	if (!(await canSpeak()) || mine !== generation) return
	const line = screen === 'personality' ? 'hello' : custom ? 'custom' : 'meet'
	const played = await playVoice(voiceSample(species, preset, line), {
		inSilentMode: asked,
		key: `${screen}:${preset}`
	})
	if (played) track('voice_sample_played', { screen, preset })
	else if (mine === generation) log.warn('pet voice line did not play', { screen, preset })
}
