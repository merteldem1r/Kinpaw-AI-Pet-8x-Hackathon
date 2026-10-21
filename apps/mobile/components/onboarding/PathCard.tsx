import { useEffect, useState, type ReactNode } from 'react'
import { StyleSheet, View, useWindowDimensions, type LayoutChangeEvent } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import Animated, {
	cancelAnimation,
	Easing,
	useAnimatedStyle,
	useReducedMotion,
	useSharedValue,
	withDelay,
	withRepeat,
	withSequence,
	withTiming
} from 'react-native-reanimated'
import { ArrowRight, Sparkles } from 'lucide-react-native'
import { art, withAlpha } from '@app/brand'
import { PressableScale } from '@/components/motion/PressableScale'
import { Text } from '@/components/ui/Text'
import { useTheme } from '@/contexts/ThemeContext'
import { Easings } from '@/lib/motion'

// A way to start on Create · Start (kinpaw-screen-spec-v1.md; v2-pet-from-photo-requirements.md,
// R1): a stage with art, a title and an arrow. A featured card wears the brand gradient as its
// edge, a sheen crossing it now and then, and, on the card to look at first, a light running
// round the edge. Every motion here is still under Reduce Motion.

/** The stage's height, where the card's art goes, pt. */
export const CARD_STAGE = 150
const ARROW = 40
/** The featured card's gradient edge, pt. */
const EDGE = 1.5
/** The light sheen crossing the featured card: how long it takes, and the rest between. */
const SHEEN_MS = 1400
const SHEEN_REST_MS = 3200
const SHEEN_WIDTH = 70
/** A second featured card's sheen waits half a pass, so the two never cross together. */
export const SHEEN_OFFSET_MS = (SHEEN_MS + SHEEN_REST_MS) / 2
/** One lap of the light round the edge. */
const ORBIT_MS = 3600

export function PathCard({
	title,
	line,
	stage,
	featured = false,
	badge,
	orbit = false,
	sheenDelay = 0,
	onPress
}: {
	title: string
	line: string
	stage: ReactNode
	/** The field in the accent, the edge and the arrow disc in the brand gradient. */
	featured?: boolean
	/** A pill above the title ("One of a kind"). */
	badge?: string
	/** A light running round the gradient edge: the card to look at first (From a photo). */
	orbit?: boolean
	/** When the sheen first crosses, after the first 0.8 s, ms. */
	sheenDelay?: number
	onPress: () => void
}) {
	const { colors: c, radii } = useTheme()
	const content = (
		<>
			<View
				style={[s.cardStage, featured && { backgroundColor: c.brandDim }]}
				importantForAccessibility="no-hide-descendants"
				accessibilityElementsHidden
			>
				{stage}
			</View>
			<View style={s.cardText}>
				<View style={s.cardWords}>
					{badge ? <Badge label={badge} /> : null}
					<Text variant="h3">{title}</Text>
					<Text variant="caption" tone="secondary">
						{line}
					</Text>
				</View>
				<View style={s.arrowWrap}>
					{featured ? <ArrowHalo /> : null}
					<View style={[s.arrow, { backgroundColor: c.surface3 }]}>
						{featured ? (
							<LinearGradient
								colors={c.brandGradient}
								start={{ x: 0, y: 0 }}
								end={{ x: 1, y: 1 }}
								style={[StyleSheet.absoluteFill, { borderRadius: ARROW / 2 }]}
							/>
						) : null}
						<ArrowRight size={18} strokeWidth={2.2} color={featured ? c.onBrand : c.brandInk} />
					</View>
				</View>
			</View>
			{featured ? <Sheen delay={sheenDelay} /> : null}
		</>
	)
	return (
		<PressableScale
			onPress={onPress}
			scaleTo="card"
			haptic="select"
			accessibilityRole="button"
			accessibilityLabel={`${title}. ${line}`}
			style={[
				s.card,
				featured
					? { borderRadius: radii.card, padding: EDGE, borderWidth: 0 }
					: { borderRadius: radii.card, backgroundColor: c.surface, borderColor: c.borderSoft }
			]}
		>
			{featured ? (
				<>
					{/* The edge: the brand gradient showing round the inner card. */}
					<LinearGradient
						colors={[c.brandGradient[0], c.brandBorder, c.brandGradient[1]]}
						start={{ x: 0, y: 0 }}
						end={{ x: 1, y: 1 }}
						style={StyleSheet.absoluteFill}
					/>
					{orbit ? <OrbitLight /> : null}
					<View
						style={[
							s.featuredInner,
							{ borderRadius: radii.card - EDGE, backgroundColor: c.surface }
						]}
					>
						{content}
					</View>
				</>
			) : (
				content
			)}
		</PressableScale>
	)
}

/** A small pill above the featured card's title. */
function Badge({ label }: { label: string }) {
	const { colors: c } = useTheme()
	return (
		<View style={[s.badge, { backgroundColor: c.brandDim, borderColor: c.brandBorder }]}>
			<Sparkles size={12} strokeWidth={2.2} color={c.brandInk} />
			<Text variant="caption" style={[s.badgeText, { color: c.brandInk }]}>
				{label}
			</Text>
		</View>
	)
}

/** A soft ring breathing out of the featured arrow disc. Still under Reduce Motion. */
function ArrowHalo() {
	const { colors: c } = useTheme()
	const reduceMotion = useReducedMotion()
	const pulse = useSharedValue(0)
	useEffect(() => {
		if (reduceMotion) return
		pulse.value = withRepeat(
			withSequence(
				withTiming(1, { duration: 1600, easing: Easings.out }),
				withTiming(0, { duration: 0 })
			),
			-1,
			false
		)
	}, [pulse, reduceMotion])
	const style = useAnimatedStyle(() => ({
		opacity: 0.45 * (1 - pulse.value),
		transform: [{ scale: 1 + pulse.value * 0.55 }]
	}))
	if (reduceMotion) return null
	return <Animated.View style={[s.halo, { backgroundColor: c.brandInk }, style]} />
}

/**
 * A light running round a featured card's edge: a bright arc of the brand colour on a square
 * that turns behind the inner card, so only the edge shows it. Not under Reduce Motion.
 */
function OrbitLight() {
	const { colors: c } = useTheme()
	const reduceMotion = useReducedMotion()
	const [size, setSize] = useState<{ width: number; height: number } | null>(null)
	const turn = useSharedValue(0)
	useEffect(() => {
		if (reduceMotion) return
		// Linear on purpose: an eased lap would stall at the end of every turn.
		turn.value = withRepeat(withTiming(1, { duration: ORBIT_MS, easing: Easing.linear }), -1)
		return () => cancelAnimation(turn)
	}, [turn, reduceMotion])
	const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value * 360}deg` }] }))
	function onLayout(e: LayoutChangeEvent) {
		const { width, height } = e.nativeEvent.layout
		setSize((prev) => (prev?.width === width && prev.height === height ? prev : { width, height }))
	}
	if (reduceMotion) return null
	// A square that covers the card at every angle as it turns.
	const side = size ? Math.ceil(Math.hypot(size.width, size.height)) : 0
	return (
		<View style={StyleSheet.absoluteFill} pointerEvents="none" onLayout={onLayout}>
			{size ? (
				<Animated.View
					style={[
						s.orbit,
						{
							width: side,
							height: side,
							left: (size.width - side) / 2,
							top: (size.height - side) / 2
						},
						style
					]}
				>
					<LinearGradient
						colors={[withAlpha(art.cloud, 0), withAlpha(art.cloud, 0), c.brandInk, art.cloud]}
						locations={[0, 0.6, 0.9, 1]}
						style={StyleSheet.absoluteFill}
					/>
				</Animated.View>
			) : null}
		</View>
	)
}

/** A band of light sweeping across the featured card now and then. Not under Reduce Motion. */
function Sheen({ delay = 0 }: { delay?: number }) {
	const { width } = useWindowDimensions()
	const reduceMotion = useReducedMotion()
	const sweep = useSharedValue(0)
	useEffect(() => {
		if (reduceMotion) return
		sweep.value = withDelay(
			800 + delay,
			withRepeat(
				withSequence(
					withTiming(1, { duration: SHEEN_MS, easing: Easings.inOut }),
					withDelay(SHEEN_REST_MS, withTiming(0, { duration: 0 }))
				),
				-1,
				false
			)
		)
	}, [sweep, reduceMotion, delay])
	const style = useAnimatedStyle(() => ({
		transform: [
			{ translateX: -SHEEN_WIDTH * 2 + sweep.value * (width + SHEEN_WIDTH * 2) },
			{ rotate: '18deg' }
		]
	}))
	if (reduceMotion) return null
	return (
		<Animated.View pointerEvents="none" style={[s.sheen, style]}>
			<LinearGradient
				colors={[withAlpha(art.cloud, 0), withAlpha(art.cloud, 0.13), withAlpha(art.cloud, 0)]}
				start={{ x: 0, y: 0.5 }}
				end={{ x: 1, y: 0.5 }}
				style={StyleSheet.absoluteFill}
			/>
		</Animated.View>
	)
}

const s = StyleSheet.create({
	card: { borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
	featuredInner: { overflow: 'hidden' },
	badge: {
		flexDirection: 'row',
		alignItems: 'center',
		alignSelf: 'flex-start',
		gap: 5,
		borderWidth: StyleSheet.hairlineWidth,
		borderRadius: 10,
		paddingHorizontal: 8,
		paddingVertical: 3,
		marginBottom: 2
	},
	badgeText: { fontWeight: '600' },
	arrowWrap: { width: ARROW, height: ARROW, alignItems: 'center', justifyContent: 'center' },
	halo: { position: 'absolute', width: ARROW, height: ARROW, borderRadius: ARROW / 2 },
	orbit: { position: 'absolute' },
	sheen: { position: 'absolute', top: -60, bottom: -60, left: 0, width: SHEEN_WIDTH },
	cardStage: { height: CARD_STAGE, overflow: 'hidden' },
	cardText: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 18 },
	cardWords: { flex: 1, gap: 4 },
	arrow: {
		width: ARROW,
		height: ARROW,
		borderRadius: ARROW / 2,
		alignItems: 'center',
		justifyContent: 'center',
		overflow: 'hidden'
	}
})
