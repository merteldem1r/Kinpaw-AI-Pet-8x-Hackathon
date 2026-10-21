import { useCallback, useEffect, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { useFocusEffect } from 'expo-router'
import { LinearGradient } from 'expo-linear-gradient'
import Animated, {
	FadeIn,
	FadeOut,
	ReduceMotion,
	useAnimatedStyle,
	useSharedValue,
	withDelay,
	withTiming,
	ZoomIn
} from 'react-native-reanimated'
import { ArrowRight, Sparkle } from 'lucide-react-native'
import { art } from '@app/brand'
import { lookById, type LookId, type Species } from '@app/contract'
import { PetArt } from '@/components/pet/PetArt'
import { PhotoPolaroid } from '@/components/pet/PhotoPolaroid'
import { RoomGlow } from '@/components/pet/RoomGlow'
import { useTheme } from '@/contexts/ThemeContext'
import { Durations, Easings, useReducedMotion } from '@/lib/motion'

/** The pets in the "photos" and drawn from them, per species: free looks only. */
const SHOWN: Record<Species, readonly LookId[]> = {
	cat: ['ginger', 'tuxedo', 'smoke'],
	dog: ['biscuit', 'pepper', 'snow']
}
const POLAROID = 92
const PET = 118
/** One photo becoming one pet: scanned, carried across, drawn, then held. */
const CYCLE_MS = 3600
/** The scan runs this long before the sparkles leave the photo. */
const SCAN_MS = 700
/** A sparkle's flight from the photo to the pet. */
const FLY_MS = 650
/** The pet drawing itself, bottom to top. */
const DRAW_MS = 650
/** When the drawing starts: as the first sparkles land. */
const DRAW_AT = SCAN_MS + FLY_MS * 0.6
/** The sparkles in flight: when each leaves, and how high it arcs (pt, up). */
const FLIGHT = [
	{ delay: 0, arc: 14, size: 9 },
	{ delay: 120, arc: -6, size: 7 },
	{ delay: 240, arc: 22, size: 6 },
	{ delay: 360, arc: 6, size: 8 }
] as const
/** How far a sparkle travels, pt: from inside the photo to the pet's middle. */
const FLY_FROM = -34
const FLY_TO = 64
/** The glints round the pet once it is drawn: where (pt from the pet's box), and how big. */
const GLINTS = [
	{ x: 10, y: 18, size: 11 },
	{ x: PET - 18, y: 6, size: 9 },
	{ x: PET - 6, y: PET * 0.55, size: 8 }
] as const

/**
 * The From a photo card's stage on Start (docs/application/features/v2-pet-from-photo-
 * requirements.md, R1; mockup A1): a photo becoming a pet, over and over. A light scans the
 * polaroid, sparkles carry it across, and the same pet draws itself from the bottom up, with a
 * glint; then the next photo. The polaroid holds a drawing on an afternoon sky as a stand-in for a
 * photo. Holds still under Reduce Motion, and waits while Start is covered (as Make your own's
 * card does: Start stays mounted under the next steps).
 */
export function PhotoPathStage({ species }: { species: Species }) {
	const { colors: c } = useTheme()
	const reduceMotion = useReducedMotion()
	const [index, setIndex] = useState(0)
	const [focused, setFocused] = useState(true)
	const looks = SHOWN[species]
	const moving = !reduceMotion && focused

	useFocusEffect(
		useCallback(() => {
			setFocused(true)
			return () => setFocused(false)
		}, [])
	)

	useEffect(() => setIndex(0), [species])

	useEffect(() => {
		if (!moving) return
		const id = setInterval(() => setIndex((i) => (i + 1) % looks.length), CYCLE_MS)
		return () => clearInterval(id)
	}, [moving, looks.length])

	const appearance = lookById(looks[index] ?? looks[0]!).appearance
	const key = `${species}-${index}`
	const fade = FadeIn.duration(Durations.base).reduceMotion(ReduceMotion.System)
	const leave = FadeOut.duration(Durations.fast).reduceMotion(ReduceMotion.System)

	return (
		<>
			<View style={s.glow} pointerEvents="none">
				<RoomGlow size={220} />
			</View>
			<View style={s.row}>
				<View style={s.polaroidSlot}>
					<Animated.View key={key} entering={fade} exiting={leave} style={s.slotFill}>
						<PhotoPolaroid width={POLAROID} tilt={-6} scanning={moving}>
							<LinearGradient colors={art.sky.afternoon.stops} style={StyleSheet.absoluteFill} />
							<PetArt appearance={appearance} mood="content" size={POLAROID} shadow={false} />
						</PhotoPolaroid>
					</Animated.View>
				</View>

				<View style={s.bridge}>
					{moving ? (
						FLIGHT.map((flight, i) => <Flight key={`${key}-${i}`} {...flight} />)
					) : (
						<ArrowRight size={20} strokeWidth={2.2} color={c.brandInk} />
					)}
				</View>

				<View style={s.petSlot}>
					<Animated.View key={key} exiting={leave} style={s.slotFill}>
						{moving ? (
							<>
								<Drawn>
									<PetArt appearance={appearance} mood="happy" size={PET} />
								</Drawn>
								{GLINTS.map((glint, i) => (
									<Animated.View
										key={i}
										entering={ZoomIn.delay(DRAW_AT + DRAW_MS + i * 90)
											.springify()
											.reduceMotion(ReduceMotion.System)}
										style={[s.glint, { left: glint.x, top: glint.y }]}
									>
										<Sparkle
											size={glint.size}
											strokeWidth={2}
											color={c.brandInk}
											fill={c.brandInk}
										/>
									</Animated.View>
								))}
							</>
						) : (
							<PetArt appearance={appearance} mood="happy" size={PET} />
						)}
					</Animated.View>
				</View>
			</View>
		</>
	)
}

/** One sparkle carried from the photo to the pet on a small arc, fading in and out. */
function Flight({ delay, arc, size }: { delay: number; arc: number; size: number }) {
	const { colors: c } = useTheme()
	const t = useSharedValue(0)
	useEffect(() => {
		t.value = withDelay(SCAN_MS + delay, withTiming(1, { duration: FLY_MS, easing: Easings.inOut }))
	}, [t, delay])
	const style = useAnimatedStyle(() => ({
		// Bright through the middle of the flight, gone at both ends.
		opacity: Math.min(1, Math.sin(t.value * Math.PI) * 1.6),
		transform: [
			{ translateX: FLY_FROM + (FLY_TO - FLY_FROM) * t.value },
			{ translateY: -arc * Math.sin(t.value * Math.PI) },
			{ rotate: `${t.value * 180}deg` }
		]
	}))
	return (
		<Animated.View pointerEvents="none" style={[s.flight, style]}>
			<Sparkle size={size} strokeWidth={2} color={c.brandInk} fill={c.brandInk} />
		</Animated.View>
	)
}

/** The pet drawing itself from the bottom up as the sparkles land, then holding. */
function Drawn({ children }: { children: React.ReactNode }) {
	const height = useSharedValue(0)
	useEffect(() => {
		height.value = withDelay(DRAW_AT, withTiming(PET, { duration: DRAW_MS, easing: Easings.out }))
	}, [height])
	const style = useAnimatedStyle(() => ({ height: height.value }))
	return (
		<View style={s.drawBox}>
			<Animated.View style={[s.drawMask, style]}>
				<View style={s.drawPet}>{children}</View>
			</Animated.View>
		</View>
	)
}

const s = StyleSheet.create({
	glow: { position: 'absolute', alignSelf: 'center', top: -30 },
	row: {
		flex: 1,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		paddingTop: 8
	},
	polaroidSlot: { width: POLAROID + 8, height: POLAROID + 24 },
	petSlot: { width: PET, height: PET },
	slotFill: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
	bridge: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
	flight: { position: 'absolute' },
	glint: { position: 'absolute' },
	drawBox: { width: PET, height: PET, justifyContent: 'flex-end' },
	drawMask: { width: PET, overflow: 'hidden', justifyContent: 'flex-end' },
	drawPet: { position: 'absolute', bottom: 0 }
})
