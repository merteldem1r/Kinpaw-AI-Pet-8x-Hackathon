/**
 * My pet — the home tab, the pet's room, the core loop (docs/application/UI/
 * kinpaw-screen-spec-v1.md, "Home" and "Talking (on Home)"; features/
 * m5-home-core-loop-requirements.md, m6-talk-requirements.md): the pet under the
 * live sky, its four needs, Feed / Play / Pet, and talking to it. The needs shown
 * are the server's, decayed to now on the phone with the same rules the server
 * runs; an action shows at once and the server's answer is the truth.
 *
 * This screen decides what the pet says and does; the room, the talk controls and
 * the fallbacks are drawn by components/home and components/pet.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AccessibilityInfo, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useQueryClient } from '@tanstack/react-query'
import { BookHeart, RefreshCw, Sparkles } from 'lucide-react-native'
import { isLow, lowCount, lowestNeed, moodFor, type Need, type PetAction } from '@app/contract'
import { HomeFailed, HomeLoading } from '@/components/home/HomeFallbacks'
import { HomeRoom } from '@/components/home/HomeRoom'
import type { StrokeZone, Zone } from '@/components/pet/PetStage'
import { SKY_HEIGHT } from '@/components/home/layout'
import { SkyTarget } from '@/components/home/SkyTarget'
import { NeedSheet } from '@/components/pet/NeedSheet'
import type { BubbleAction } from '@/components/pet/PetBubble'
import { SkyBand } from '@/components/pet/SkyBand'
import { skyBodyAt } from '@/components/pet/SkyScene'
import { TalkControls } from '@/components/pet/TalkControls'
import { TypingPaws } from '@/components/pet/TypingPaws'
import { useTabBarClearance } from '@/components/TabBar'
import { Eyebrow } from '@/components/ui/Eyebrow'
import { useTheme } from '@/contexts/ThemeContext'
import { useGreeting } from '@/hooks/useGreeting'
import { useIdleNudge } from '@/hooks/useIdleNudge'
import { PET_QUERY_KEY, usePet } from '@/hooks/usePet'
import { PET_ACTION_KEY, usePetAction } from '@/hooks/usePetAction'
import { usePetGaze } from '@/hooks/usePetGaze'
import { usePetNeeds } from '@/hooks/usePetNeeds'
import { usePetReactions } from '@/hooks/usePetReactions'
import { usePlus } from '@/hooks/usePlus'
import { useReplyVoice } from '@/hooks/useReplyVoice'
import { PROFILE_QUERY_KEY, useProfile, type UserProfile } from '@/hooks/useProfile'
import { useIntroOffer } from '@/hooks/useIntroOffer'
import { useNotesAsk } from '@/hooks/useNotesAsk'
import { useTalk, type TalkAnswer } from '@/hooks/useTalk'
import { useVoice } from '@/hooks/useVoice'
import { track } from '@/lib/analytics'
import { errorCode } from '@/lib/api'
import { haptic } from '@/lib/haptics'
import { homeBubble, type HomeBubbleAction, type MemoryNote } from '@/lib/homeBubble'
import { openPaywall } from '@/lib/openPaywall'
import { playPetSound, soundFor } from '@/lib/petSounds'
import { stopVoice } from '@/lib/petVoice'
import {
	ACTION_FAILED_LINE,
	cantHelpLine,
	eyebrowLine,
	idleLine,
	notesAsk,
	reactionLine,
	returnLine,
	SKY_LINES,
	hugLine,
	strokeLine,
	TALK_LINES,
	touchLine
} from '@/lib/petLines'
import { useSkyPhase } from '@/lib/sky'

export default function HomeScreen() {
	const petQuery = usePet()
	// Kinpaw Plus from the server: with it the mic shows no count and no lock, whatever the last
	// reply said (M7, R7). The server still decides every message.
	const plus = usePlus()
	const pet = petQuery.data
	const needs = usePetNeeds(pet)
	const queryClient = useQueryClient()
	const phase = useSkyPhase()
	const { isDark, colors: c, layout } = useTheme()
	const insets = useSafeAreaInsets()
	const clearance = useTabBarClearance()

	// What the pet just said (a reaction, a tap line, "Oops"); null: the line for its needs.
	const [said, setSaid] = useState<string | null>(null)
	// The reply said out loud: whose voice it is, still on its way, or playing.
	const replyVoice = useReplyVoice()
	const reactions = useRef<Record<PetAction, number>>({ feed: 0, play: 0, pet: 0 })
	const [focused, setFocused] = useState(false)
	const viewed = useRef(false)
	// The moving feedback after care or a reply: what floats up, a face for a moment, the chips.
	const { bursts, moment, careEffects, celebrate, showMoment, showCareEffects } = usePetReactions(
		pet?.appearance.species
	)
	// Where the pet looks next (the sky, you, around while it speaks its reply).
	const { cue, look } = usePetGaze(replyVoice.speaking)
	// A stroke in progress, and the sun or moon's tap.
	const [stroking, setStroking] = useState(false)
	const [skyPoke, setSkyPoke] = useState(0)
	const strokes = useRef(0)
	const { width } = useWindowDimensions()
	// Left alone for a minute, the pet looks up at you, hops, and says so. Once per quiet.
	const markTouched = useIdleNudge(focused && Boolean(pet), () => {
		setSaid((previous) => idleLine(previous))
		look(0, 0.1, true)
	})
	// The need sheet: which need it explains (kept while it slides away), and whether it is open.
	const [infoNeed, setInfoNeed] = useState<Need | null>(null)
	const [infoOpen, setInfoOpen] = useState(false)
	// The care action the pet's last reply suggested: its tile glows until it is used or the
	// next message is sent (m6-talk-requirements.md, R9).
	const [suggested, setSuggested] = useState<PetAction | null>(null)
	// The reply that kept a fact (v2-memory-requirements.md, R15) or brought one up (R15b): while
	// it is the bubble's line, "Mochi will remember that" or "From Mochi's memory" sits under it
	// and opens what the pet remembers, on that fact. Keeping wins: it is the newer news.
	const [memoryNote, setMemoryNote] = useState<MemoryNote | null>(null)
	// The pet asking to send its daily notes, under the reaction to a confirmed care
	// (v2-notifications-requirements.md, R13–R14): shown while that reaction is the bubble's line.
	const notes = useNotesAsk({ name: pet?.name, said, setSaid })

	// "Tell me about you" (v2 memory, R18): opened at once after a new pet is saved; a pet from
	// before it is offered it once, in the bubble, while the step is open on the server.
	const introOffer = useIntroOffer(focused, pet?.id)
	const { end: endIntroOffer } = introOffer

	// "I missed you" (v2 memory, R26–R27): asked once per foreground; the return line takes the
	// bubble before the needs line until anything else is said, and is gone once Home is left.
	const { greeting, clear: clearGreeting } = useGreeting(Boolean(pet), focused)
	const displayName = useProfile().data?.displayName
	const species = pet?.appearance.species
	const greetingLine = useMemo(
		() =>
			greeting && species
				? returnLine(greeting.away, greeting.follow_up?.question ?? null, species, displayName)
				: null,
		[greeting, species, displayName]
	)

	const talk = useTalk({
		onAnswer: answered,
		onTalkedOut: () => {
			haptic.warning()
			setSaid(TALK_LINES.talkedOut)
			// The server says free and out; if the app still thought Plus, it re-reads the plan.
			void queryClient.refetchQueries({ queryKey: PROFILE_QUERY_KEY, type: 'active' })
		},
		onFailed: () => haptic.warning()
	})
	const { forget: forgetFailedTalk } = talk

	const voice = useVoice({
		onHeard: (words) => {
			touched()
			if (talk.send(words, 'voice')) setSuggested(null)
		},
		onNothingHeard: () => {
			haptic.press()
			setSaid(TALK_LINES.nothingHeard)
		},
		onCouldNotHear: () => {
			haptic.warning()
			setSaid(TALK_LINES.couldNotHear)
		}
	})

	const touched = useCallback(() => {
		markTouched()
		// Doing anything else moves on from a reply that never came.
		forgetFailedTalk()
	}, [markTouched, forgetFailedTalk])

	/**
	 * The pet answered (m6-talk-requirements.md, R20): its reply in the bubble, read out by
	 * VoiceOver; hearts and a happy face when it felt the kindness, a hurt face after harsh words,
	 * and quiet comfort, no fanfare, when the person sounds upset.
	 */
	function answered(answer: TalkAnswer) {
		touched()
		setSuggested(answer.suggestedAction)
		setSaid(answer.reply)
		const fact = answer.remembered ?? answer.recalled
		const note = fact
			? {
					reply: answer.reply,
					factId: fact.id,
					kind: answer.remembered ? ('remembered' as const) : ('recalled' as const)
				}
			: null
		setMemoryNote(note)
		AccessibilityInfo.announceForAccessibility(
			note && pet ? `${answer.reply} ${memoryLabel(note.kind, pet.name)}` : answer.reply
		)
		if (pet) void playPetSound(soundFor(pet.appearance.species, answer.intent))
		replyVoice.play(answer)
		if (answer.intent === 'harsh') {
			haptic.press()
			showMoment('sad')
		} else if (answer.needChanged && answer.intent !== 'upset') {
			haptic.success()
			celebrate('pet', true)
		} else {
			haptic.press()
		}
	}

	/**
	 * The locked mic: the pet says why, and Kinpaw Plus opens (the only way to it from Home).
	 * Plus may have arrived since the last reply (a grant, a purchase elsewhere), so the plan is
	 * re-read first; with Plus the lock simply goes, and no paywall opens.
	 */
	async function lockedPressed() {
		touched()
		haptic.press()
		await queryClient.refetchQueries({ queryKey: PROFILE_QUERY_KEY, type: 'active' })
		if (queryClient.getQueryData<UserProfile>(PROFILE_QUERY_KEY)?.planType === 'premium') return
		setSaid(TALK_LINES.talkedOut)
		track('talk_limit_reached')
		openPaywall('talk_limit')
	}

	const act = usePetAction({
		onFailed: () => {
			haptic.warning()
			setSaid(ACTION_FAILED_LINE)
		},
		onConfirmed: () => void notes.confirmed()
	})

	function answerNotes(yes: boolean) {
		touched()
		void notes.answer(yes)
	}

	useFocusEffect(
		useCallback(() => {
			setFocused(true)
			setSaid(null)
			touched()
			// Refetch quietly on arrival, unless a care action is on its way (its answer is newer).
			if (queryClient.isMutating({ mutationKey: PET_ACTION_KEY }) === 0) {
				void queryClient.refetchQueries({ queryKey: PET_QUERY_KEY, type: 'active' })
			}
			// The plan too: Plus granted or ended while away shows at once (M7, R6).
			void queryClient.refetchQueries({ queryKey: PROFILE_QUERY_KEY, type: 'active' })
			return () => {
				setFocused(false)
				viewed.current = false
				// The intro's offer is made once: leaving Home ends it. So is the return line.
				endIntroOffer()
				clearGreeting()
				stopVoice('left')
			}
		}, [queryClient, touched, endIntroOffer, clearGreeting])
	)

	function openIntro() {
		touched()
		endIntroOffer()
		router.push({ pathname: '/intro', params: { entry: 'existing_pet' } })
	}

	// Once per visit, as soon as there is a pet to show.
	useEffect(() => {
		if (!focused || !needs || viewed.current) return
		viewed.current = true
		track('home_viewed', {
			mood: moodFor(needs),
			lowest_need: lowestNeed(needs),
			low_count: lowCount(needs)
		})
	}, [focused, needs])

	const failedWithNothing = !pet && petQuery.isError
	useEffect(() => {
		if (failedWithNothing && focused) {
			track('home_load_failed', { error_kind: errorCode(petQuery.error) ?? 'unknown' })
		}
	}, [failedWithNothing, focused, petQuery.error])

	function care(action: PetAction) {
		if (!pet) return
		touched()
		const outcome = act(action, suggested === action)
		if (!outcome) return
		if (suggested === action) setSuggested(null)
		const n = reactions.current[action]++
		if (outcome.changed) {
			haptic.success()
			const line = reactionLine(action, pet.appearance.species, n)
			notes.cared(line)
			setSaid(line)
			celebrate(action, true)
			showCareEffects(outcome.before, outcome.after)
		} else {
			haptic.press()
			setSaid(cantHelpLine(action, pet.appearance.species, n))
			// Too sleepy to play: a few z's. Too full to eat: the line says it.
			celebrate(action === 'play' ? 'sleepy' : null, false)
		}
	}

	// Each spot answers its own way (v3-pet-looks-requirements.md, R7): a pat on the head or a
	// chin scratch makes it beam; the rest is the stage's motion and a line.
	function tapPet(mood: ReturnType<typeof moodFor>, zone: Zone) {
		if (!pet) return
		touched()
		setSaid((previous) => touchLine(zone, pet.appearance.species, previous))
		if (zone === 'head' || zone === 'chin') showMoment('happy')
		track('pet_tapped', { mood, zone })
	}

	function strokePet(mood: ReturnType<typeof moodFor>, zone: StrokeZone) {
		if (!pet) return
		touched()
		setSaid(strokeLine(pet.appearance.species, strokes.current++, zone))
		celebrate('pet', true)
		track('pet_stroked', { mood, zone })
	}

	function hugPet(mood: ReturnType<typeof moodFor>) {
		touched()
		setSaid((previous) => hugLine(previous))
		celebrate('pet', true)
		track('pet_hugged', { mood })
	}

	function openNeedInfo(need: Need) {
		if (!needs) return
		touched()
		setInfoNeed(need)
		setInfoOpen(true)
		track('need_info_opened', { need, low: isLow(needs[need]) })
	}

	function tapSky() {
		if (!pet) return
		touched()
		haptic.select()
		setSkyPoke((n) => n + 1)
		setSaid(SKY_LINES[phase])
		// The pet looks up at it, left or right of centre as it is.
		look((skyBodyAt(phase).x - 0.5) * 2, -1, false)
		track('home_sky_tapped', { time_of_day: phase })
	}

	const sleepyZs = useCallback(() => celebrate('sleepy', false), [celebrate])

	function retry() {
		track('home_retry_tapped')
		void petQuery.refetch()
	}

	const talkState = talk.state
	const bubble =
		pet && needs
			? homeBubble({
					name: pet.name,
					species: pet.appearance.species,
					needs,
					talk: talkState,
					said,
					greetingLine,
					offeringIntro: introOffer.offering,
					memoryNote,
					askingNotes: notes.asking,
					voicedLine: replyVoice.voicedLine,
					speakingReply: replyVoice.speaking,
					voiceComing: replyVoice.voiceComing,
					listening: voice.listening
				})
			: null

	function openMemories(note: MemoryNote) {
		if (!pet) return
		touched()
		track('memory_chip_tapped', { kind: note.kind })
		router.push({ pathname: '/pet/[id]', params: { id: pet.id, memory: note.factId } })
	}

	function bubbleAction(action: HomeBubbleAction | null, name: string): BubbleAction | undefined {
		switch (action?.kind) {
			case 'retry':
				return {
					label: 'Try again',
					icon: (color) => <RefreshCw size={16} color={color} strokeWidth={2} />,
					onPress: talk.retry
				}
			case 'intro':
				return {
					label: `Tell ${name} about you`,
					icon: (color) => <Sparkles size={16} color={color} strokeWidth={2} />,
					onPress: openIntro
				}
			case 'memory': {
				const { note } = action
				const Icon = note.kind === 'remembered' ? Sparkles : BookHeart
				return {
					label: memoryLabel(note.kind, name),
					icon: (color) => <Icon size={16} color={color} strokeWidth={2} />,
					onPress: () => openMemories(note)
				}
			}
			default:
				return undefined
		}
	}

	return (
		<View style={[s.root, { backgroundColor: c.bg }]}>
			<SkyBand phase={phase} height={SKY_HEIGHT} poke={skyPoke} />
			<ScrollView
				// Home fits the screen; it scrolls only when it can't (the keyboard, the largest text).
				scrollEnabled={!stroking}
				alwaysBounceVertical={false}
				showsVerticalScrollIndicator={false}
				keyboardShouldPersistTaps="handled"
				automaticallyAdjustKeyboardInsets
				contentContainerStyle={[
					s.content,
					{
						paddingTop: insets.top + 12,
						paddingBottom: clearance,
						paddingHorizontal: layout.gutter
					}
				]}
			>
				<Eyebrow tone={isDark ? 'brand' : 'primary'}>{eyebrowLine(new Date())}</Eyebrow>

				{pet && needs && bubble ? (
					<HomeRoom
						pet={pet}
						needs={needs}
						line={bubble.line}
						active={focused}
						listening={voice.listening}
						speaking={replyVoice.speaking}
						bubbleChoice={
							bubble.ask
								? {
										prompt: notesAsk(pet.name),
										yes: { label: 'Yes', onPress: () => answerNotes(true) },
										no: { label: 'Not now', onPress: () => answerNotes(false) }
									}
								: undefined
						}
						bubbleContent={bubble.thinking ? <TypingPaws name={pet.name} /> : undefined}
						bubbleVoice={bubble.voice}
						bubbleAction={bubbleAction(bubble.action, pet.name)}
						bursts={bursts}
						careEffects={careEffects}
						moment={moment}
						cue={cue}
						night={phase === 'evening' || phase === 'night'}
						talk={
							<TalkControls
								name={pet.name}
								words={
									voice.listening
										? voice.words || 'Listening…'
										: talkState.status === 'idle'
											? null
											: talkState.words
								}
								busy={talkState.status === 'thinking'}
								messagesLeft={plus ? null : talk.messagesLeft}
								onSend={(text) => {
									touched()
									const sent = talk.send(text, 'typed')
									if (sent) setSuggested(null)
									return sent
								}}
								onLockedPress={() => void lockedPressed()}
								voice={
									voice.available
										? {
												listening: voice.listening,
												onStart: () => {
													touched()
													stopVoice('mic')
													void voice.start()
												},
												onFinish: voice.finish,
												onCancel: voice.cancel
											}
										: null
								}
								micRefused={voice.refused}
							/>
						}
						suggested={suggested}
						onTapPet={tapPet}
						onStrokePet={strokePet}
						onHugPet={hugPet}
						onStrokingChange={setStroking}
						onYawn={sleepyZs}
						onCare={care}
						onNeedPress={openNeedInfo}
					/>
				) : failedWithNothing ? (
					<HomeFailed onRetry={retry} retrying={petQuery.isFetching} />
				) : (
					<HomeLoading />
				)}
			</ScrollView>
			{pet && needs ? <SkyTarget phase={phase} width={width} onPress={tapSky} /> : null}
			{pet && needs ? (
				<NeedSheet
					need={infoNeed}
					open={infoOpen}
					needs={needs}
					name={pet.name}
					onClose={() => setInfoOpen(false)}
				/>
			) : null}
		</View>
	)
}

/** Under a reply that kept a fact (R15), or brought one up from memory (R15b). */
const memoryLabel = (kind: 'remembered' | 'recalled', name: string) =>
	kind === 'remembered' ? `${name} will remember that` : `From ${name}'s memory`

const s = StyleSheet.create({
	root: { flex: 1 },
	content: { flexGrow: 1, gap: 14 }
})
