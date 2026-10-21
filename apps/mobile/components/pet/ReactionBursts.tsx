import { useEffect, useMemo } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, {
	useAnimatedStyle,
	useReducedMotion,
	useSharedValue,
	withDelay,
	withTiming
} from 'react-native-reanimated'
import { Bone, Fish, Heart, Star, type LucideIcon } from 'lucide-react-native'
import { art } from '@app/brand'
import type { Species } from '@app/contract'
import { Text } from '@/components/ui/Text'
import { Easings } from '@/lib/motion'
import type { Burst, BurstKind } from '@/lib/petEffects'

/** One particle's path: where it ends up, how big, when it starts. */
type Particle = { dx: number; dy: number; size: number; delay: number; spin: number }

const between = (low: number, high: number) => low + Math.random() * (high - low)

/** Where each kind starts, as a share of the pet's size (the head, or the mouth for a treat). */
const ORIGIN_Y: Record<BurstKind, number> = { pet: 0.3, feed: 0.42, play: 0.36, sleepy: 0.26 }

function particlesFor(kind: BurstKind): Particle[] {
	switch (kind) {
		case 'pet':
			return Array.from({ length: 5 }, (_, i) => ({
				dx: between(-56, 56),
				dy: -between(80, 130),
				size: between(15, 24),
				delay: i * 70,
				spin: between(-12, 12)
			}))
		case 'feed':
			return Array.from({ length: 4 }, (_, i) => ({
				dx: between(-44, 44),
				dy: -between(60, 100),
				size: between(16, 22),
				delay: i * 80,
				spin: between(-30, 30)
			}))
		case 'play':
			// A burst outwards, both sides, mostly upwards.
			return Array.from({ length: 6 }, (_, i) => ({
				dx: (i % 2 === 0 ? 1 : -1) * between(60, 112),
				dy: -between(20, 90),
				size: between(14, 22),
				delay: Math.floor(i / 2) * 50,
				spin: between(-90, 90)
			}))
		case 'sleepy':
			// Three z's drifting up to the right, each a little bigger.
			return [0, 1, 2].map((i) => ({
				dx: 26 + i * 18,
				dy: -(46 + i * 30),
				size: 14 + i * 5,
				delay: i * 260,
				spin: 0
			}))
	}
}

const ICON: Record<Exclude<BurstKind, 'sleepy'>, (species: Species) => LucideIcon> = {
	pet: () => Heart,
	feed: (species) => (species === 'cat' ? Fish : Bone),
	play: () => Star
}

const COLOR: Record<BurstKind, string> = {
	pet: art.pet.fx.heart,
	feed: art.pet.fx.treat,
	play: art.pet.fx.star,
	sleepy: art.pet.fx.sleep
}

/**
 * Hearts after Pet, treats after Feed (fish for a cat, bones for a dog), stars
 * after Play, and a sleepy "z z z" when the pet is too tired to play, floating up
 * from the pet and fading. Laid over the pet, `size` points square, and never
 * touchable. With Reduce Motion nothing travels, so nothing is drawn: the line,
 * the face and the haptic still say what happened.
 */
export function ReactionBursts({ bursts, size }: { bursts: readonly Burst[]; size: number }) {
	const reduceMotion = useReducedMotion()
	if (reduceMotion) return null
	return (
		<View
			pointerEvents="none"
			importantForAccessibility="no-hide-descendants"
			accessibilityElementsHidden
			style={[s.layer, { width: size, height: size }]}
		>
			{bursts.map((burst) => (
				<BurstView key={burst.id} burst={burst} size={size} />
			))}
		</View>
	)
}

function BurstView({ burst, size }: { burst: Burst; size: number }) {
	// Fixed for the burst's life: a re-render must not reshuffle its particles.
	const particles = useMemo(() => particlesFor(burst.kind), [burst.kind])
	const origin = { left: size / 2, top: size * ORIGIN_Y[burst.kind] }
	return (
		<>
			{particles.map((particle, i) => (
				<Floater key={i} particle={particle} origin={origin}>
					{burst.kind === 'sleepy' ? (
						<Text
							variant="label"
							style={{
								color: COLOR.sleepy,
								fontSize: particle.size,
								lineHeight: particle.size * 1.2
							}}
						>
							z
						</Text>
					) : (
						<BurstIcon kind={burst.kind} species={burst.species} size={particle.size} />
					)}
				</Floater>
			))}
		</>
	)
}

function BurstIcon({
	kind,
	species,
	size
}: {
	kind: Exclude<BurstKind, 'sleepy'>
	species: Species
	size: number
}) {
	const Icon = ICON[kind](species)
	const color = COLOR[kind]
	return <Icon size={size} color={color} fill={color} strokeWidth={1.5} />
}

/** Rise along the particle's path, fading in quickly and out slowly. */
const RISE_MS = 1100

function Floater({
	particle,
	origin,
	children
}: {
	particle: Particle
	origin: { left: number; top: number }
	children: React.ReactNode
}) {
	const progress = useSharedValue(0)

	useEffect(() => {
		progress.value = withDelay(
			particle.delay,
			withTiming(1, { duration: RISE_MS, easing: Easings.out })
		)
	}, [particle.delay, progress])

	const style = useAnimatedStyle(() => {
		const t = progress.value
		return {
			opacity: t < 0.15 ? t / 0.15 : 1 - (t - 0.15) / 0.85,
			transform: [
				{ translateX: particle.dx * t },
				{ translateY: particle.dy * t },
				{ scale: 0.6 + 0.4 * Math.min(1, t * 3) },
				{ rotate: `${particle.spin * t}deg` }
			]
		}
	})

	return (
		<Animated.View
			style={[
				s.particle,
				{ left: origin.left - particle.size / 2, top: origin.top - particle.size / 2 },
				style
			]}
		>
			{children}
		</Animated.View>
	)
}

const s = StyleSheet.create({
	layer: { position: 'absolute', bottom: 0, alignSelf: 'center' },
	particle: { position: 'absolute', opacity: 0 }
})
