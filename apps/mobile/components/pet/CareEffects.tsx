import { useEffect, useMemo } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, {
	useAnimatedStyle,
	useReducedMotion,
	useSharedValue,
	withDelay,
	withSequence,
	withSpring,
	withTiming
} from 'react-native-reanimated'
import { ArrowDown, ArrowUp } from 'lucide-react-native'
import { art } from '@app/brand'
import type { Need } from '@app/contract'
import { NEED } from '@/components/pet/NeedPill'
import { useTheme } from '@/contexts/ThemeContext'
import { Easings, Springs } from '@/lib/motion'
import type { CareEffect, Side } from '@/lib/petEffects'

/** A rise takes the colour of the care that fills that need. */
const RISE_COLOR: Partial<Record<Need, string>> = {
	hunger: art.care.feed,
	happiness: art.care.play,
	affection: art.care.pet
}
/** Where each side starts, as a share of the pet's square: beside the head, clear of the ears. */
const ORIGIN: Record<Side, { x: number; y: number }> = {
	left: { x: 0.17, y: 0.2 },
	right: { x: 0.83, y: 0.14 }
}
const ICON = 15
const ARROW = 13
const TRAIL = 9

const between = (low: number, high: number) => low + Math.random() * (high - low)

/**
 * What a care action did, beside the pet's head (Home): the need's tiny icon and an arrow pop
 * out on that need's side and float away, with a few small arrows trailing, the way the hearts
 * rise after Pet. Up drifts up and out in the colour of the care that fills it (Feed orange,
 * Play teal, Pet pink); down sinks in `errorText`. Play shows both: happiness up on the right,
 * energy down on the left. Laid over the pet, `size` points square, never touchable, hidden
 * from VoiceOver (the pills read the new values); under Reduce Motion nothing is drawn.
 */
export function CareEffects({ effects, size }: { effects: readonly CareEffect[]; size: number }) {
	const reduceMotion = useReducedMotion()
	if (reduceMotion) return null
	return (
		<View
			pointerEvents="none"
			importantForAccessibility="no-hide-descendants"
			accessibilityElementsHidden
			style={[s.layer, { width: size, height: size }]}
		>
			{effects.map((effect) => (
				<Effect key={effect.id} effect={effect} size={size} />
			))}
		</View>
	)
}

function Effect({ effect, size }: { effect: CareEffect; size: number }) {
	const { colors: c } = useTheme()
	const color = effect.up ? (RISE_COLOR[effect.need] ?? c.brandInk) : c.errorText
	const out = effect.side === 'left' ? -1 : 1
	const origin = { left: size * ORIGIN[effect.side].x, top: size * ORIGIN[effect.side].y }
	// Fixed for the effect's life: a re-render must not reshuffle the trail.
	const trail = useMemo(
		() =>
			[0, 1, 2].map((i) => ({
				dx: out * between(4, 22) + between(-6, 6),
				dy: (effect.up ? -1 : 1) * between(26, 44),
				delay: 200 + i * 160
			})),
		[out, effect.up]
	)
	const Arrow = effect.up ? ArrowUp : ArrowDown
	return (
		<>
			<Token effect={effect} color={color} origin={origin} out={out} />
			{trail.map((t, i) => (
				<Trail key={i} {...t} origin={origin}>
					<Arrow size={TRAIL} color={color} strokeWidth={3} />
				</Trail>
			))}
		</>
	)
}

/** The need's icon and its arrow: pops in, then drifts up and out, or sinks, and fades. */
function Token({
	effect,
	color,
	origin,
	out
}: {
	effect: CareEffect
	color: string
	origin: { left: number; top: number }
	out: number
}) {
	const pop = useSharedValue(0)
	const travel = useSharedValue(0)
	const nudge = useSharedValue(0)
	const Icon = NEED[effect.need].icon
	const Arrow = effect.up ? ArrowUp : ArrowDown

	useEffect(() => {
		pop.value = withSequence(withSpring(1.2, Springs.snappy), withSpring(1, Springs.settle))
		travel.value = withDelay(310, withTiming(1, { duration: 1690, easing: Easings.out }))
		const step = effect.up ? -3 : 3
		nudge.value = withSequence(
			withTiming(step, { duration: 175 }),
			withTiming(0, { duration: 200 }),
			withTiming(step, { duration: 175 }),
			withTiming(0, { duration: 200 })
		)
	}, [pop, travel, nudge, effect.up])

	const style = useAnimatedStyle(() => {
		const t = travel.value
		return {
			opacity: Math.min(1, pop.value * 1.5) * (t < 0.45 ? 1 : 1 - (t - 0.45) / 0.55),
			transform: [
				{ translateX: out * 12 * t },
				{ translateY: (effect.up ? -42 : 26) * t },
				{ scale: pop.value }
			]
		}
	})
	const arrowStyle = useAnimatedStyle(() => ({ transform: [{ translateY: nudge.value }] }))

	return (
		<Animated.View
			style={[
				s.token,
				{ left: origin.left - (ICON + ARROW) / 2, top: origin.top - ICON / 2, shadowColor: color },
				style
			]}
		>
			<Icon size={ICON} color={color} strokeWidth={2.4} />
			<Animated.View style={arrowStyle}>
				<Arrow size={ARROW} color={color} strokeWidth={3} />
			</Animated.View>
		</Animated.View>
	)
}

/** A small arrow leaving the token's spot along its own path, fading as it goes. */
function Trail({
	dx,
	dy,
	delay,
	origin,
	children
}: {
	dx: number
	dy: number
	delay: number
	origin: { left: number; top: number }
	children: React.ReactNode
}) {
	const progress = useSharedValue(0)
	useEffect(() => {
		progress.value = withDelay(delay, withTiming(1, { duration: 1125, easing: Easings.out }))
	}, [progress, delay])
	const style = useAnimatedStyle(() => {
		const t = progress.value
		return {
			opacity: t === 0 ? 0 : t < 0.2 ? t / 0.2 : 1 - (t - 0.2) / 0.8,
			transform: [{ translateX: dx * t }, { translateY: dy * t }, { scale: 0.6 + 0.4 * t }]
		}
	})
	return (
		<Animated.View
			style={[s.trail, { left: origin.left - TRAIL / 2, top: origin.top - TRAIL / 2 }, style]}
		>
			{children}
		</Animated.View>
	)
}

const s = StyleSheet.create({
	layer: { position: 'absolute', bottom: 0, alignSelf: 'center' },
	token: {
		position: 'absolute',
		flexDirection: 'row',
		alignItems: 'center',
		gap: 1,
		opacity: 0,
		shadowOpacity: 0.35,
		shadowRadius: 4,
		shadowOffset: { width: 0, height: 0 }
	},
	trail: { position: 'absolute', opacity: 0 }
})
