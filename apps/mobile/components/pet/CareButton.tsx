import { useEffect } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, {
	useAnimatedStyle,
	useReducedMotion,
	useSharedValue,
	withRepeat,
	withSequence,
	withSpring,
	withTiming
} from 'react-native-reanimated'
import { LinearGradient } from 'expo-linear-gradient'
import type { LucideIcon } from 'lucide-react-native'
import { art, withAlpha } from '@app/brand'
import type { PetAction } from '@app/contract'
import { PressableScale } from '@/components/motion/PressableScale'
import { Text } from '@/components/ui/Text'
import { useTheme } from '@/contexts/ThemeContext'
import { Easings, Springs } from '@/lib/motion'

/** The tile's height, pt. */
export const CARE_TILE_HEIGHT = 56
export const CARE_TILE_RADIUS = 18
const HEIGHT = CARE_TILE_HEIGHT
const RADIUS = CARE_TILE_RADIUS
const DISC = 32
/** How far the icon pops on a tap, before it settles back. */
const POP = 1.2
/** The wanted tile's glow breathes between these, over GLOW_HALF_MS each way. */
const GLOW_LOW = 0.25
const GLOW_HIGH = 0.6
const GLOW_HALF_MS = 1300

export type CareState = 'normal' | 'wanted' | 'cantHelp'

/**
 * Feed, Play or Pet in Home's care row, as a slim tile: the icon on a disc
 * beside the label, each action in its own colour (`art.care`: Feed warm orange, Play
 * teal, Pet pink), matching the need it fills.
 *
 * - `normal`: a quiet surface, the disc tinted in the colour, the icon in it.
 * - `wanted` (the pet's lowest need is low and this helps): the tile fills with
 *   a soft gradient of its colour, its edge in the colour, a glow breathing
 *   around it, the disc solid, and a small badge on top ("Hungry").
 * - `cantHelp` (Feed when full, Play when too sleepy): faded, with a muted badge
 *   ("Full"); still tappable, so the pet can say why.
 *
 * A tap pops the icon on the motion springs. Reduce Motion stills the glow and
 * the pop. The caller plays the haptic, because it depends on the outcome.
 */
export function CareButton({
	action,
	label,
	icon: Icon,
	state,
	badge,
	hint,
	onPress
}: {
	action: PetAction
	label: string
	icon: LucideIcon
	state: CareState
	/** A word on top of the tile when wanted or can't help ("Hungry", "Full"). */
	badge?: string
	/** What VoiceOver adds, e.g. "Mochi is hungry". */
	hint?: string
	onPress: () => void
}) {
	const { colors: c } = useTheme()
	const reduceMotion = useReducedMotion()
	const color = art.care[action]
	const wanted = state === 'wanted'
	const quiet = state === 'cantHelp'

	const pop = useSharedValue(1)
	const popStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }))
	const glow = useSharedValue(GLOW_HIGH)
	useEffect(() => {
		if (!wanted || reduceMotion) {
			glow.value = GLOW_HIGH
			return
		}
		const ease = { duration: GLOW_HALF_MS, easing: Easings.inOut }
		glow.value = withRepeat(
			withSequence(withTiming(GLOW_LOW, ease), withTiming(GLOW_HIGH, ease)),
			-1,
			false
		)
	}, [wanted, reduceMotion, glow])
	const glowStyle = useAnimatedStyle(() => ({ shadowOpacity: wanted ? glow.value : 0 }))

	function press() {
		pop.value = withSequence(withSpring(POP, Springs.snappy), withSpring(1, Springs.settle))
		onPress()
	}

	return (
		<Animated.View style={[s.wrap, { shadowColor: color }, glowStyle]}>
			<PressableScale
				onPress={press}
				haptic={false}
				scaleTo="button"
				accessibilityRole="button"
				accessibilityLabel={label}
				accessibilityHint={hint}
				style={[
					s.tile,
					{
						backgroundColor: c.surface2,
						borderColor: wanted ? color : withAlpha(color, quiet ? 0.12 : 0.28),
						borderWidth: wanted ? 1.5 : StyleSheet.hairlineWidth
					},
					quiet && s.quiet
				]}
			>
				{wanted ? (
					<LinearGradient
						colors={[withAlpha(color, 0.32), withAlpha(color, 0.08)]}
						start={{ x: 0.5, y: 0 }}
						end={{ x: 0.5, y: 1 }}
						style={[StyleSheet.absoluteFill, { borderRadius: RADIUS }]}
					/>
				) : null}
				<Animated.View
					style={[
						s.disc,
						{ backgroundColor: wanted ? color : withAlpha(color, quiet ? 0.08 : 0.18) },
						popStyle
					]}
				>
					<Icon
						size={17}
						color={wanted ? art.mark.ground : quiet ? c.textTertiary : color}
						strokeWidth={2.2}
					/>
				</Animated.View>
				<Text
					variant="label"
					numberOfLines={1}
					maxFontSizeMultiplier={1.3}
					style={{ color: quiet ? c.textSecondary : c.textPrimary }}
				>
					{label}
				</Text>
			</PressableScale>
			{badge && (wanted || quiet) ? (
				<View
					pointerEvents="none"
					style={[
						s.badge,
						wanted
							? { backgroundColor: color }
							: { backgroundColor: c.surface3, borderColor: c.borderSoft, borderWidth: 1 }
					]}
				>
					<Text
						variant="caption"
						numberOfLines={1}
						style={[s.badgeText, { color: wanted ? art.mark.ground : c.textSecondary }]}
						maxFontSizeMultiplier={1.2}
					>
						{badge}
					</Text>
				</View>
			) : null}
		</Animated.View>
	)
}

const s = StyleSheet.create({
	wrap: {
		flex: 1,
		borderRadius: RADIUS,
		shadowRadius: 12,
		shadowOffset: { width: 0, height: 0 }
	},
	tile: {
		height: HEIGHT,
		borderRadius: RADIUS,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		gap: 8,
		paddingHorizontal: 8,
		overflow: 'hidden'
	},
	quiet: { opacity: 0.6 },
	disc: {
		width: DISC,
		height: DISC,
		borderRadius: DISC / 2,
		alignItems: 'center',
		justifyContent: 'center'
	},
	badge: {
		position: 'absolute',
		top: -9,
		alignSelf: 'center',
		paddingHorizontal: 8,
		paddingVertical: 1,
		borderRadius: 9
	},
	badgeText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.3 }
})
