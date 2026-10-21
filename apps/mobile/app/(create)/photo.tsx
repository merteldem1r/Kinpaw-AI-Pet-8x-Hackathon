/**
 * Create · From a photo (docs/application/features/v2-pet-from-photo-requirements.md, R13–R18;
 * mockups C2, D1, E2): the photo is read, the pet draws itself from the bottom up, and the
 * person keeps it ("That's them!" → Name) or adjusts it in Make your own. When the photo has no
 * single pet, the pet says so; when the phone is out of tries, it offers to make one by hand.
 *
 * The photo is held in memory only (lib/petPhoto.ts) and forgotten on the way to Name or Start.
 * A relaunch never resumes here: there is no photo to show.
 */
import { useCallback, useRef, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { LinearGradient } from 'expo-linear-gradient'
import Animated, {
	FadeIn,
	ReduceMotion,
	ZoomIn,
	useAnimatedStyle,
	useSharedValue,
	withTiming
} from 'react-native-reanimated'
import { SlidersHorizontal } from 'lucide-react-native'
import { art } from '@app/brand'
import {
	describeAppearance,
	type Mood,
	type PetAppearance,
	type PhotoReadResponse,
	type PhotoSwap
} from '@app/contract'
import { useMountEffect } from '@/hooks/useMountEffect'
import { OnboardingShell } from '@/components/onboarding/Shell'
import { PetArt } from '@/components/pet/PetArt'
import { PetBubble } from '@/components/pet/PetBubble'
import { PhotoPolaroid } from '@/components/pet/PhotoPolaroid'
import { ReadingPortal, ReadingSteps } from '@/components/pet/PhotoReading'
import { Bobbing, RevealBurst, RevealRays, SeenTraits } from '@/components/pet/PhotoReveal'
import { PhotoSheet, Tries } from '@/components/pet/PhotoSheet'
import { RoomGlow } from '@/components/pet/RoomGlow'
import { Text } from '@/components/ui/Text'
import { usePetDraft } from '@/contexts/PetDraftContext'
import { useTheme } from '@/contexts/ThemeContext'
import { track } from '@/lib/analytics'
import { api, errorCode, errorMessage } from '@/lib/api'
import { goBackTo, goToStep } from '@/lib/createFlow'
import { haptic } from '@/lib/haptics'
import { getInstallId, photoTriesLeft, savePhotoTriesLeft } from '@/lib/installId'
import { Durations, Easings, layoutTransition, useReducedMotion } from '@/lib/motion'
import {
	endPhotoSession,
	FAILED_LINE,
	MISS_LINE,
	OUT_OF_TRIES_LINE,
	photoSession,
	rememberRead,
	RESTING_LINE,
	startPhotoSession,
	swapNote,
	type PickedPhoto
} from '@/lib/petPhoto'
import { draftAppearance, newPetDraft } from '@/lib/petDraft'
import { useSkyPhase } from '@/lib/sky'

const STEP_INDEX = 0
const STEP_COUNT = 3
/** The phone waits a little longer than the server does for the model (15 s), R13. */
const READ_TIMEOUT_MS = 25_000
const STAGE_HEIGHT = 260
const PET_SIZE = 220
const POLAROID = 150
/** The photo beside the revealed pet, as a small tilted polaroid. */
const THUMB = 76
/** The pet's middle, from the stage's top: it stands at the bottom of the stage. */
const PET_CENTER_Y = STAGE_HEIGHT - PET_SIZE / 2
/** The pet drawing itself, bottom to top, once the answer is back (R13). */
const REVEAL_MS = 900

type PhotoView =
	| { kind: 'reading' }
	| { kind: 'read'; appearance: PetAppearance; swapped: PhotoSwap[]; revealed: boolean }
	| { kind: 'miss'; line: string; left: number }
	| { kind: 'out' }
	| { kind: 'resting' }
	| { kind: 'failed'; line: string }

export default function PhotoScreen() {
	// `tries=none`: opened from Start's used card. Not `state` or `screen`: React Navigation
	// reserves those param names.
	const params = useLocalSearchParams<{ tries?: string }>()
	const outOfTries = params.tries === 'none'
	const { draft: stored, update } = usePetDraft()
	const draft = stored ?? newPetDraft()
	const [view, setView] = useState<PhotoView>(() =>
		outOfTries ? { kind: 'out' } : { kind: 'reading' }
	)
	const [photo, setPhoto] = useState<PickedPhoto | null>(() => photoSession()?.photo ?? null)
	const [sheetOpen, setSheetOpen] = useState(false)
	const [triesLeft, setTriesLeft] = useState<number | null>(null)
	const reading = useRef<AbortController | null>(null)

	const read = useCallback(async (picked: PickedPhoto) => {
		reading.current?.abort()
		const controller = new AbortController()
		reading.current = controller
		setView({ kind: 'reading' })
		const started = Date.now()
		let response: PhotoReadResponse
		try {
			response = await api('readPetPhoto', {
				body: { install_id: await getInstallId(), image: picked.base64 },
				signal: controller.signal,
				timeoutMs: READ_TIMEOUT_MS
			})
		} catch (error) {
			if (controller.signal.aborted) return
			haptic.warning()
			track('pet_photo_read', { context: 'create', result: 'failed', ms: Date.now() - started })
			setView({
				kind: 'failed',
				line: errorCode(error) === 'offline' ? errorMessage(error) : FAILED_LINE
			})
			return
		}
		if (controller.signal.aborted) return
		track('pet_photo_read', {
			context: 'create',
			result: response.outcome,
			ms: Date.now() - started,
			...(response.outcome === 'read'
				? { species: response.appearance.species, swapped_count: response.swapped.length }
				: {})
		})
		if ('left' in response) {
			setTriesLeft(response.left)
			void savePhotoTriesLeft(response.left)
		}
		switch (response.outcome) {
			case 'read':
				rememberRead(response.appearance, response.swapped)
				setView({
					kind: 'read',
					appearance: response.appearance,
					swapped: response.swapped,
					revealed: false
				})
				return
			case 'no_pet':
			case 'several':
			case 'unclear':
				haptic.warning()
				setView(
					response.left === 0
						? { kind: 'out' }
						: { kind: 'miss', line: MISS_LINE[response.outcome], left: response.left }
				)
				return
			case 'limit_reached':
				setView(response.limit === 'device' ? { kind: 'out' } : { kind: 'resting' })
				return
			case 'plus_required':
				// A creation read is never Plus-gated; a server saying so is treated as resting.
				setView({ kind: 'resting' })
		}
	}, [])

	useMountEffect(() => {
		void photoTriesLeft().then(setTriesLeft)
		if (outOfTries) return
		const session = photoSession()
		// Read already (the screen mounted again): show it, never send the same photo twice.
		if (session?.read) {
			setView({ kind: 'read', appearance: session.read, swapped: session.swapped, revealed: true })
		} else if (photo) void read(photo)
		// Opened with no photo (a relaunch, a deep link): there is nothing to read.
		else router.replace('/start')
		return () => reading.current?.abort()
	})

	function keep(appearance: PetAppearance, choice: 'keep' | 'adjust') {
		update({
			species: appearance.species,
			appearances: { ...draft.appearances, [appearance.species]: appearance },
			path: 'photo'
		})
		track('pet_photo_confirmed', { choice })
		if (choice === 'keep') {
			track('pet_photo_kept', { context: 'create', changed_count: 0 })
			endPhotoSession()
			goToStep('name')
		} else {
			router.push({ pathname: '/build', params: { from: 'photo' } })
		}
	}

	function makeYourOwn() {
		endPhotoSession()
		router.push({ pathname: '/build', params: { from: 'start' } })
	}

	function back() {
		reading.current?.abort()
		endPhotoSession()
		goBackTo('start')
	}

	function picked(next: PickedPhoto) {
		setSheetOpen(false)
		startPhotoSession(next)
		setPhoto(next)
		void read(next)
	}

	const cta =
		view.kind === 'read' && view.revealed
			? {
					label: "That's them!",
					onPress: () => keep(view.appearance, 'keep'),
					secondary: {
						label: 'Adjust',
						icon: (color: string) => <SlidersHorizontal size={16} color={color} strokeWidth={2} />,
						onPress: () => keep(view.appearance, 'adjust')
					}
				}
			: view.kind === 'miss' || view.kind === 'failed'
				? {
						// Short: it shares the row with Make your own.
						label: view.kind === 'failed' ? 'Try again' : 'New photo',
						onPress: () =>
							view.kind === 'failed' && photo ? void read(photo) : setSheetOpen(true),
						secondary: { label: 'Make your own', onPress: makeYourOwn }
					}
				: view.kind === 'out' || view.kind === 'resting'
					? { label: 'Make your own', onPress: makeYourOwn }
					: undefined

	return (
		<OnboardingShell step={STEP_INDEX} total={STEP_COUNT} onBack={back} cta={cta}>
			{view.kind === 'reading' || view.kind === 'read' ? (
				<ReadView
					view={view}
					photo={photo}
					onRevealed={() => {
						if (view.kind !== 'read') return
						haptic.success()
						setView({ ...view, revealed: true })
						track('onboarding_step_viewed', { step: 'photo', index: STEP_INDEX })
					}}
				/>
			) : (
				<PetSays
					line={
						view.kind === 'miss' || view.kind === 'failed'
							? view.line
							: view.kind === 'out'
								? OUT_OF_TRIES_LINE
								: RESTING_LINE
					}
					appearance={draftAppearance(draft)}
					mood={view.kind === 'out' || view.kind === 'resting' ? 'sleepy' : 'sad'}
					triesLeft={view.kind === 'miss' ? view.left : view.kind === 'out' ? 0 : null}
				/>
			)}
			<PhotoSheet
				open={sheetOpen}
				onClose={() => setSheetOpen(false)}
				context="create"
				triesLeft={triesLeft ?? undefined}
				onPicked={picked}
			/>
		</OnboardingShell>
	)
}

/** Reading (the photo scanned, the pet drawing itself) and then the reveal (D1). */
function ReadView({
	view,
	photo,
	onRevealed
}: {
	view: Extract<PhotoView, { kind: 'reading' | 'read' }>
	photo: PickedPhoto | null
	onRevealed: () => void
}) {
	const { colors: c, radii } = useTheme()
	const revealed = view.kind === 'read' && view.revealed
	const note = view.kind === 'read' ? swapNote(view.swapped, view.appearance.species) : null
	return (
		<>
			<View style={s.titles}>
				<Text variant="question" accessibilityRole="header" accessibilityLiveRegion="polite">
					{revealed ? 'Is this your pet?' : 'Drawing your pet…'}
				</Text>
			</View>

			{!revealed && photo ? (
				<PhotoPolaroid uri={photo.uri} width={POLAROID} tilt={-5} scanning style={s.polaroid} />
			) : null}

			<Stage>
				{revealed ? <RevealRays centerY={PET_CENTER_Y} /> : null}
				{view.kind === 'read' ? (
					<Bobbing active={revealed}>
						<Reveal appearance={view.appearance} onDone={onRevealed} />
					</Bobbing>
				) : (
					<ReadingPortal />
				)}
				{revealed ? <RevealBurst centerY={PET_CENTER_Y} /> : null}
				{revealed && photo ? (
					<Animated.View
						entering={ZoomIn.springify().reduceMotion(ReduceMotion.System)}
						style={s.thumb}
					>
						<PhotoPolaroid uri={photo.uri} width={THUMB} tilt={-8} />
					</Animated.View>
				) : null}
			</Stage>

			{!revealed ? <ReadingSteps finished={view.kind === 'read'} /> : null}

			{revealed && view.kind === 'read' ? (
				<Animated.View
					entering={FadeIn.duration(Durations.base).reduceMotion(ReduceMotion.System)}
					style={s.after}
				>
					<SeenTraits appearance={view.appearance} label={describeAppearance(view.appearance)} />
					{note ? (
						<View style={[s.note, { backgroundColor: c.well, borderRadius: radii.card - 6 }]}>
							<Text variant="caption" tone="secondary">
								{note}
							</Text>
						</View>
					) : null}
				</Animated.View>
			) : null}
		</>
	)
}

/** The sky stage of the hour, with the lamp's warm glow behind the pet. */
function Stage({ children }: { children: React.ReactNode }) {
	const { colors: c, radii } = useTheme()
	const sky = useSkyPhase()
	return (
		// Slides up into place when the polaroid above it goes, at the reveal.
		<Animated.View
			layout={layoutTransition}
			style={[s.stage, { borderRadius: radii.card + 6, borderColor: c.borderGlass }]}
		>
			<LinearGradient colors={art.sky[sky].stops} style={StyleSheet.absoluteFill} />
			<View style={s.glow} pointerEvents="none">
				<RoomGlow size={PET_SIZE + 40} />
			</View>
			{children}
		</Animated.View>
	)
}

/** The pet drawing itself from the bottom up (R13); all at once under Reduce Motion. */
function Reveal({ appearance, onDone }: { appearance: PetAppearance; onDone: () => void }) {
	const reduceMotion = useReducedMotion()
	const height = useSharedValue(reduceMotion ? PET_SIZE : 0)
	useMountEffect(() => {
		if (reduceMotion) {
			onDone()
			return
		}
		height.value = withTiming(PET_SIZE, { duration: REVEAL_MS, easing: Easings.out })
		// Done on a timer, not the animation's callback: the screen must never wait on a frame.
		const timer = setTimeout(onDone, REVEAL_MS)
		return () => clearTimeout(timer)
		// Once, when the answer arrives.
	})
	const style = useAnimatedStyle(() => ({ height: height.value }))
	return (
		<View style={s.revealBox}>
			<Animated.View style={[s.revealMask, style]}>
				<PetArt
					appearance={appearance}
					mood="happy"
					size={PET_SIZE}
					label={describeAppearance(appearance, 'happy')}
					style={s.revealPet}
				/>
			</Animated.View>
		</View>
	)
}

/** The pet speaking for a photo that didn't work, or for no tries left (E2). */
function PetSays({
	line,
	appearance,
	mood,
	triesLeft
}: {
	line: string
	appearance: PetAppearance
	mood: Mood
	triesLeft: number | null
}) {
	return (
		<>
			<PetBubble line={line} />
			<Stage>
				<PetArt appearance={appearance} mood={mood} size={PET_SIZE - 40} />
			</Stage>
			{triesLeft !== null ? (
				<View style={s.triesRow}>
					<Tries left={triesLeft} />
				</View>
			) : null}
		</>
	)
}

const s = StyleSheet.create({
	titles: { gap: 6 },
	polaroid: { alignSelf: 'flex-start', marginLeft: 12, marginBottom: -36, zIndex: 2 },
	stage: {
		height: STAGE_HEIGHT,
		borderWidth: StyleSheet.hairlineWidth,
		overflow: 'hidden',
		alignItems: 'center',
		justifyContent: 'flex-end'
	},
	glow: { position: 'absolute', alignSelf: 'center', bottom: -20 },
	revealBox: { width: PET_SIZE, height: PET_SIZE, justifyContent: 'flex-end' },
	revealMask: { width: PET_SIZE, overflow: 'hidden', justifyContent: 'flex-end' },
	revealPet: { position: 'absolute', bottom: 0 },
	thumb: { position: 'absolute', top: 14, left: 14 },
	after: { gap: 12 },
	note: { padding: 12 },
	triesRow: { alignItems: 'center' }
})
