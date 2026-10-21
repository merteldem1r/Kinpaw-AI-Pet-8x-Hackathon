/**
 * The pet's voice on the phone (docs/application/features/v2-voice-requirements.md, R6–R11): no
 * request when it is off or VoiceOver is on; the speaker, and the silent switch by how the
 * message was said; a limit is silent; a failure keeps the text; a voice still on its way when
 * the mic opens is dropped.
 */
import { AccessibilityInfo } from 'react-native'

jest.mock('@react-native-async-storage/async-storage', () =>
	jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock')
)
jest.mock('@/lib/analytics', () => ({ track: jest.fn() }))
jest.mock('@/lib/logger', () => ({ log: { warn: jest.fn(), error: jest.fn() } }))
jest.mock('@/lib/api', () => ({
	api: jest.fn(),
	errorCode: (error: unknown) => (error as { code?: string }).code ?? null
}))
jest.mock('expo', () => ({ requireOptionalNativeModule: () => ({}) }))
// The mouth follows the voice (v3-pet-looks-requirements.md, R6); here only what it is told.
jest.mock('@/lib/petMouth', () => ({
	soundMouth: { value: 0 },
	opennessOf: (frames: number[]) => Math.max(0, ...frames.map(Math.abs)),
	nextMouth: (_last: number, openness: number) => openness,
	shutMouth: jest.fn()
}))
jest.mock('@/lib/voiceSamples', () => ({
	voiceSample: (species: string, preset: string, line: string) =>
		`clip:${species}-${preset}-${line}`
}))

type Listener = (status: Record<string, unknown>) => void
type SampleListener = (sample: { channels: { frames: number[] }[] }) => void
type FakePlayer = {
	uri: string
	listener: Listener | null
	/** Set when the voice asks for its sound, batch by batch. */
	sampleListener: SampleListener | null
	sampling: boolean
	paused: boolean
	removed: boolean
	rate: number
	correctsPitch: boolean
}
const players: FakePlayer[] = []
const modes: Record<string, unknown>[] = []
jest.mock('expo-audio', () => ({
	// As expo-audio on iOS: a mode the silent switch can silence may not lower other audio, record
	// or play in the background (AudioUtils.validateAudioMode). It throws, and nothing plays.
	setAudioModeAsync: jest.fn(async (mode: Record<string, unknown>) => {
		if (
			!mode.playsInSilentMode &&
			(mode.interruptionMode === 'duckOthers' || mode.allowsRecording)
		) {
			throw new Error('playsInSilentMode == false and duckOthers == true cannot be set on iOS')
		}
		modes.push(mode)
	}),
	createAudioPlayer: (source: { uri: string } | string) => {
		const uri = typeof source === 'string' ? source : source.uri
		const player: FakePlayer = {
			uri,
			listener: null,
			sampleListener: null,
			sampling: false,
			paused: false,
			removed: false,
			rate: 1,
			correctsPitch: true
		}
		players.push(player)
		return {
			set shouldCorrectPitch(value: boolean) {
				player.correctsPitch = value
			},
			setPlaybackRate: (rate: number) => {
				player.rate = rate
			},
			isAudioSamplingSupported: true,
			setAudioSamplingEnabled: (on: boolean) => {
				player.sampling = on
			},
			addListener: (event: string, listener: Listener & SampleListener) => {
				if (event === 'audioSampleUpdate') player.sampleListener = listener
				else player.listener = listener
			},
			play: () => player.listener?.({ playing: true }),
			pause: () => {
				player.paused = true
			},
			remove: () => {
				player.removed = true
			}
		}
	}
}))

type PetVoice = typeof import('@/lib/petVoice')
const URL = 'https://v3b.fal.media/files/voice.mp3'
const ID = '0b6f3c62-6a43-4c39-9d3a-3c8f1a2b9e11'

let voice: PetVoice
let api: jest.Mock
let track: jest.Mock

beforeEach(async () => {
	jest.resetModules()
	players.length = 0
	modes.length = 0
	const storage = jest.requireMock('@react-native-async-storage/async-storage') as {
		clear: () => Promise<void>
	}
	await storage.clear()
	jest.spyOn(AccessibilityInfo, 'isScreenReaderEnabled').mockResolvedValue(false)
	voice = jest.requireActual('@/lib/petVoice')
	api = (jest.requireMock('@/lib/api') as { api: jest.Mock }).api
	api.mockReset()
	api.mockResolvedValue({ outcome: 'spoken', audio_url: URL, duration_ms: 0, playback_rate: 1.15 })
	track = (jest.requireMock('@/lib/analytics') as { track: jest.Mock }).track
	track.mockReset()
})

const events = () => track.mock.calls.map(([name, props]) => [name, props])

it('speaks a reply through the speaker, and a spoken message through the silent switch', async () => {
	await voice.speakReply(ID, 'Hi!', 'voice')
	expect(api).toHaveBeenCalledWith(
		'petVoice',
		expect.objectContaining({ body: { message_id: ID, text: 'Hi!', from: 'talk' } })
	)
	expect(players.map((p) => p.uri)).toEqual([URL])
	expect(modes[0]).toEqual({
		allowsRecording: false,
		playsInSilentMode: true,
		interruptionMode: 'duckOthers'
	})
	expect(events()).toEqual([['voice_played', { input: 'voice', from: 'talk' }]])
})

it("moves the pet's mouth with a reply's sound, and shuts it when the voice ends", async () => {
	const mouth = jest.requireMock('@/lib/petMouth') as {
		soundMouth: { value: number }
		shutMouth: jest.Mock
	}
	mouth.shutMouth.mockClear()
	await voice.speakReply(ID, 'Hi!', 'voice')
	const player = players[0]!
	expect(player.sampling).toBe(true)
	expect(voice.voiceSampled()).toBe(false)
	player.sampleListener?.({ channels: [{ frames: [0.1, -0.6, 0.3] }] })
	expect(mouth.soundMouth.value).toBe(0.6)
	expect(voice.voiceSampled()).toBe(true)
	player.listener?.({ didJustFinish: true })
	expect(mouth.shutMouth).toHaveBeenCalled()
	expect(voice.voiceSampled()).toBe(false)
})

it('plays at the rate the server gives, without pitch correction, so the pet sounds small', async () => {
	await voice.speakReply(ID, 'Hi!', 'voice')
	expect(players[0]).toMatchObject({ rate: 1.15, correctsPitch: false })

	api.mockResolvedValueOnce({ outcome: 'spoken', audio_url: URL, duration_ms: 0, playback_rate: 1 })
	await voice.speakReply(ID, 'Hi!', 'voice')
	expect(players[1]).toMatchObject({ rate: 1, correctsPitch: true })
})

it('a typed message follows the silent switch', async () => {
	await voice.speakReply(ID, 'Hi!', 'typed')
	expect(modes[0]).toEqual({
		allowsRecording: false,
		playsInSilentMode: false,
		interruptionMode: 'mixWithOthers'
	})
	expect(players).toHaveLength(1)
	expect(events()).toEqual([['voice_played', { input: 'typed', from: 'talk' }]])
})

it('off: no request at all, and turning it off stops the voice playing', async () => {
	await voice.speakReply(ID, 'Hi!', 'voice')
	await voice.setVoiceEnabled(false)
	expect(players[0]?.paused).toBe(true)
	expect(events()).toContainEqual(['voice_stopped', { by: 'setting' }])
	expect(events()).toContainEqual(['voice_changed', { enabled: false }])

	api.mockClear()
	await voice.speakReply(ID, 'Again!', 'voice')
	expect(api).not.toHaveBeenCalled()
	expect(await voice.voiceEnabled()).toBe(false)
})

it('with VoiceOver on, VoiceOver reads the reply and no voice is asked for', async () => {
	jest.spyOn(AccessibilityInfo, 'isScreenReaderEnabled').mockResolvedValue(true)
	await voice.speakReply(ID, 'Hi!', 'voice')
	expect(api).not.toHaveBeenCalled()
})

it("the day's voice used up: the pet says so once a day, plays nothing", async () => {
	api.mockResolvedValue({ outcome: 'limited' })
	expect(await voice.speakReply(ID, 'Hi!', 'voice')).toBe('out_of_voice')
	expect(await voice.speakReply(ID, 'Again', 'voice')).toBeNull()
	expect(players).toHaveLength(0)
	expect(events()).toEqual([['voice_limit_reached', undefined]])
})

it('a failed request is reported, plays nothing and says nothing', async () => {
	api.mockRejectedValueOnce({ code: 'voice_unavailable' })
	expect(await voice.speakReply(ID, 'Hi!', 'voice')).toBeNull()
	expect(players).toHaveLength(0)
	expect(events()).toEqual([['voice_failed', { stage: 'fetch', error_kind: 'voice_unavailable' }]])
})

it('the mic opening while the voice is on its way drops it', async () => {
	let answer: (value: unknown) => void = () => undefined
	api.mockReturnValueOnce(new Promise((resolve) => (answer = resolve)))
	const speaking = voice.speakReply(ID, 'Hi!', 'voice')
	await Promise.resolve()
	voice.stopVoice('mic')
	answer({ outcome: 'spoken', audio_url: URL, duration_ms: 0, playback_rate: 1.15 })
	await speaking
	expect(players).toHaveLength(0)
})

it('a new reply stops the one playing', async () => {
	await voice.speakReply(ID, 'First', 'voice')
	await voice.speakReply(ID, 'Second', 'voice')
	expect(players[0]?.paused).toBe(true)
	expect(events()).toContainEqual(['voice_stopped', { by: 'reply' }])
	expect(players).toHaveLength(2)
})

it('a voice fetched with the text plays then, unless the mic opened in between', async () => {
	const ready = await voice.fetchReplyVoice(ID, 'Hi!')
	expect(ready).toMatchObject({ url: URL, rate: 1.15 })
	expect(players).toHaveLength(0)
	await voice.playReplyVoice(ready, 'voice')
	expect(players).toHaveLength(1)

	const late = await voice.fetchReplyVoice(ID, 'Again')
	voice.stopVoice('mic')
	await voice.playReplyVoice(late, 'voice')
	expect(players).toHaveLength(1)
})

it("speaks the intro's answer as an intro voice", async () => {
	await voice.speakReply(ID, 'A student with a dog!', 'typed', 'intro')
	expect(api).toHaveBeenCalledWith(
		'petVoice',
		expect.objectContaining({
			body: { message_id: ID, text: 'A student with a dog!', from: 'intro' }
		})
	)
	expect(events()).toEqual([['voice_played', { input: 'typed', from: 'intro' }]])
})

describe('the recorded lines while the pet is made', () => {
	it('plays the clip for the species and preset, following the silent switch, with no request', async () => {
		await voice.playVoiceSample('personality', 'dog', 'curious', { asked: true })
		expect(players.map((p) => p.uri)).toEqual(['clip:dog-curious-hello'])
		// Only a reply on Home moves the mouth; a recorded line asks for no sound to follow.
		expect(players[0]!.sampling).toBe(false)
		// Tapped to hear: plays even with the silent switch on.
		expect(modes[0]).toMatchObject({ allowsRecording: false, playsInSilentMode: true })
		expect(api).not.toHaveBeenCalled()
		expect(events()).toEqual([
			['voice_sample_played', { screen: 'personality', preset: 'curious' }]
		])
	})

	it("Meet's line, or the own-mix line for fine-tuned traits", async () => {
		await voice.playVoiceSample('meet', 'cat', 'cool')
		await voice.playVoiceSample('meet', 'cat', 'cool', { custom: true })
		expect(players.map((p) => p.uri)).toEqual(['clip:cat-cool-meet', 'clip:cat-cool-custom'])
		expect(players[0]?.paused).toBe(true)
		expect(events()).not.toContainEqual(expect.arrayContaining(['voice_stopped']))
		// Played by itself: it follows the silent switch, so it mixes rather than lowering others.
		expect(modes[0]).toEqual({
			allowsRecording: false,
			playsInSilentMode: false,
			interruptionMode: 'mixWithOthers'
		})
		expect(events()).toContainEqual(['voice_sample_played', { screen: 'meet', preset: 'cool' }])
	})

	it('says what is speaking while it plays, and nothing once it stops', async () => {
		expect(voice.voiceSpeaking()).toBeNull()
		await voice.playVoiceSample('personality', 'cat', 'loyal')
		expect(voice.voiceSpeaking()).toBe('personality:loyal')
		voice.stopVoice()
		expect(voice.voiceSpeaking()).toBeNull()
	})

	it('quiet with the voice off or VoiceOver on', async () => {
		await voice.setVoiceEnabled(false)
		await voice.playVoiceSample('meet', 'cat', 'cool')
		await voice.setVoiceEnabled(true)
		jest.spyOn(AccessibilityInfo, 'isScreenReaderEnabled').mockResolvedValue(true)
		await voice.playVoiceSample('meet', 'cat', 'cool')
		expect(players).toHaveLength(0)
	})
})
