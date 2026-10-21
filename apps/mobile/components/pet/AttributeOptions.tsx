import { useEffect, useMemo, useRef } from 'react'
import { ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import Animated, {
	ReduceMotion,
	useAnimatedStyle,
	useSharedValue,
	withSequence,
	withSpring,
	withTiming
} from 'react-native-reanimated'
import { Check, Lock } from 'lucide-react-native'
import { art, HEAD_CENTRE, withAlpha } from '@app/brand'
import {
	optionsFor,
	withAttribute,
	type AttributeDef,
	type AttributeKey,
	type AttributeOption,
	type EyeId,
	type FurId,
	type PetAppearance,
	type Species
} from '@app/contract'
import { PressableScale } from '@/components/motion/PressableScale'
import { Text } from '@/components/ui/Text'
import { useTheme } from '@/contexts/ThemeContext'
import { Springs } from '@/lib/motion'
import { PetArt } from './PetArt'

const SWATCH = 44
const RING = 2
const RING_GAP = 3
const LOCK = 18
/** A preview tile, pt, and the window its pet shows through. */
const TILE_W = 84
const WINDOW_H = 74
/** The check badge on the chosen option, pt. */
const BADGE = 20

/**
 * How each tile frames its pet: the head, big, for ears; the whole pet for what
 * changes its body (pattern, body, tail). `size` is the drawing, `cx`/`cy` the
 * point of it (shares of the drawing) set in the window's centre.
 */
const FRAME: Partial<Record<AttributeKey, { size: number; cx: number; cy: number }>> = {
	ears: { size: 150, cx: HEAD_CENTRE.x, cy: HEAD_CENTRE.y - 0.07 },
	pattern: { size: 92, cx: 0.48, cy: 0.52 },
	body: { size: 86, cx: 0.48, cy: 0.54 },
	tail: { size: 86, cx: 0.52, cy: 0.54 }
}
const WHOLE = { size: 86, cx: 0.48, cy: 0.54 }

/**
 * The colour a swatch shows: the coat's base, or the iris; odd eyes are blue and amber. A
 * Matching marking colour shows the pet's coat beside the colour its markings take.
 */
function swatchColors(
	key: AttributeDef['key'],
	id: string,
	appearance: PetAppearance
): readonly [string] | readonly [string, string] {
	if (key === 'fur') return [art.pet.fur[id as FurId].base]
	if (key === 'accent') {
		const coat = art.pet.fur[appearance.fur]
		return id === 'auto' ? [coat.base, coat.stripe] : [art.pet.fur[id as FurId].base]
	}
	if (key === 'trim') return [id === 'white' ? art.pet.white : art.pet.fur[id as FurId].base]
	if (id === 'odd') return [art.pet.eyes.blue, art.pet.eyes.amber]
	return [art.pet.eyes[id as Exclude<EyeId, 'odd'>]]
}

/** A picked tile pops to this scale, over this long, then settles. */
const POP_SCALE = 1.08
const POP_MS = 110

/**
 * One builder row's choices (docs/application/UI/kinpaw-screen-spec-v1.md,
 * "Create · Make your own"): glossy 44pt colour swatches with their names for fur
 * and eyes (the chosen one ringed in `brandInk` with a gap of ground and a check),
 * and live preview tiles for the rest: the person's own pet wearing that option,
 * framed on the part it changes, its name below (the chosen one in `brandDim` with
 * a `brandInk` edge, a glow and a check, popping when picked). A Plus option
 * carries a lock and a quieter label; the caller decides what a tap on it does.
 * `unlocked` (a Plus member changing their pet's look) shows Plus options like any other.
 * The row scrolls sideways if it is wider than the card. A radio group to VoiceOver.
 */
export function AttributeOptions({
	attribute,
	species,
	appearance,
	value,
	unlocked = false,
	onPick
}: {
	attribute: AttributeDef
	species: Species
	/** The pet as it is now: each preview tile shows it wearing that tile's option. */
	appearance: PetAppearance
	value: string
	unlocked?: boolean
	onPick: (option: AttributeOption) => void
}) {
	const options = optionsFor(attribute.key, species).map((option) =>
		unlocked && option.premium ? { ...option, premium: false } : option
	)
	return (
		<ScrollView
			horizontal
			showsHorizontalScrollIndicator={false}
			contentContainerStyle={s.row}
			accessibilityRole="radiogroup"
			accessibilityLabel={attribute.title}
		>
			{options.map((option) =>
				attribute.display === 'swatch' ? (
					<Swatch
						key={option.id}
						option={option}
						colors={swatchColors(attribute.key, option.id, appearance)}
						selected={option.id === value}
						onPress={() => onPick(option)}
					/>
				) : (
					<PreviewTile
						key={option.id}
						option={option}
						attribute={attribute.key}
						appearance={appearance}
						selected={option.id === value}
						onPress={() => onPick(option)}
					/>
				)
			)}
		</ScrollView>
	)
}

function label(option: AttributeOption, selected: boolean): string {
	return `${option.label}${option.premium ? ', Plus option' : ''}${selected ? ', selected' : ''}`
}

function Swatch({
	option,
	colors,
	selected,
	onPress
}: {
	option: AttributeOption
	colors: readonly [string] | readonly [string, string]
	selected: boolean
	onPress: () => void
}) {
	const { colors: c } = useTheme()
	const outer = SWATCH + (RING + RING_GAP) * 2
	const pop = usePop(selected)
	return (
		<PressableScale
			onPress={onPress}
			haptic={false}
			accessibilityRole="radio"
			accessibilityLabel={label(option, selected)}
			accessibilityState={{ selected }}
			style={s.swatchCell}
		>
			<Animated.View
				style={[
					s.swatchRing,
					{
						width: outer,
						height: outer,
						borderRadius: outer / 2,
						borderColor: selected ? c.brandInk : 'transparent'
					},
					pop
				]}
			>
				<View
					style={[
						s.swatch,
						{ borderColor: c.borderSoft, backgroundColor: colors[0] },
						option.premium && !selected && s.quiet
					]}
				>
					{colors[1] ? <View style={[s.half, { backgroundColor: colors[1] }]} /> : null}
					{/* The gloss: a soft highlight on the upper left, so each colour reads as a bead. */}
					<View style={[s.gloss, { backgroundColor: withAlpha(art.cloud, 0.35) }]} />
				</View>
				{option.premium ? (
					<View style={[s.lock, { backgroundColor: c.surface3, borderColor: c.bg }]}>
						<Lock size={10} color={c.textSecondary} strokeWidth={2.4} />
					</View>
				) : selected ? (
					<CheckBadge style={s.swatchCheck} />
				) : null}
			</Animated.View>
			<Text
				variant="caption"
				numberOfLines={1}
				maxFontSizeMultiplier={1.2}
				style={[
					s.swatchName,
					{ color: selected ? c.brandInk : option.premium ? c.textTertiary : c.textSecondary }
				]}
			>
				{option.label}
			</Text>
		</PressableScale>
	)
}

/** A quick swell and settle when an option becomes the chosen one. */
function usePop(selected: boolean) {
	const scale = useSharedValue(1)
	const first = useRef(true)
	useEffect(() => {
		if (first.current) {
			first.current = false
			return
		}
		if (selected) {
			// The pop follows Reduce Motion like every other animation (M8, R4).
			scale.value = withSequence(
				withTiming(POP_SCALE, { duration: POP_MS, reduceMotion: ReduceMotion.System }),
				withSpring(1, Springs.settle)
			)
		}
	}, [selected, scale])
	return useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }))
}

/** The chosen option's check: a small `brandInk` disc. */
function CheckBadge({ style }: { style: StyleProp<ViewStyle> }) {
	const { colors: c } = useTheme()
	return (
		<View style={[s.check, { backgroundColor: c.brandInk, borderColor: c.surface }, style]}>
			<Check size={11} color={c.onBrand} strokeWidth={3} />
		</View>
	)
}

/**
 * One option as a tile: the person's pet wearing it, framed on the part it
 * changes, and its name. Chosen: `brandDim` ground, `brandInk` edge, a glow and
 * a check. Plus: a lock, the pet dimmed, a quieter name.
 */
function PreviewTile({
	option,
	attribute,
	appearance,
	selected,
	onPress
}: {
	option: AttributeOption
	attribute: AttributeKey
	appearance: PetAppearance
	selected: boolean
	onPress: () => void
}) {
	const { colors: c } = useTheme()
	const pop = usePop(selected)
	const wearing = useMemo(
		() => withAttribute(appearance, attribute, option.id),
		[appearance, attribute, option.id]
	)
	const frame = FRAME[attribute] ?? WHOLE
	return (
		// No press scale, and the pop swells only the frame: a scaled view's drawn content (the
		// pet's SVG, the name) is stretched as a bitmap until it settles, so the picked tile
		// looked blurred for most of a second.
		<PressableScale
			onPress={onPress}
			haptic={false}
			scaleTo={1}
			accessibilityRole="radio"
			accessibilityLabel={label(option, selected)}
			accessibilityState={{ selected }}
		>
			<View style={s.tile}>
				<Animated.View
					pointerEvents="none"
					style={[
						s.tileFrame,
						{
							backgroundColor: selected ? c.brandDim : c.surface2,
							borderColor: selected ? c.brandInk : c.borderSoft,
							borderWidth: selected ? 1.5 : StyleSheet.hairlineWidth,
							shadowColor: c.brandInk,
							shadowOpacity: selected ? 0.35 : 0
						},
						pop
					]}
				/>
				<View style={[s.window, { backgroundColor: c.well }]}>
					<PetArt
						appearance={wearing}
						mood="content"
						size={frame.size}
						shadow={false}
						style={[
							s.tilePet,
							{
								left: TILE_W / 2 - 4 - frame.cx * frame.size,
								top: WINDOW_H / 2 - frame.cy * frame.size
							},
							option.premium && !selected && s.dimmed
						]}
					/>
				</View>
				<Text
					variant="caption"
					numberOfLines={1}
					maxFontSizeMultiplier={1.2}
					style={[
						s.tileName,
						{ color: selected ? c.brandInk : option.premium ? c.textSecondary : c.textPrimary }
					]}
				>
					{option.label}
				</Text>
				{option.premium ? (
					<View style={[s.tileLock, { backgroundColor: c.surface3, borderColor: c.surface2 }]}>
						<Lock size={11} color={c.textSecondary} strokeWidth={2.4} />
					</View>
				) : selected ? (
					<CheckBadge style={s.tileCheck} />
				) : null}
			</View>
		</PressableScale>
	)
}

const s = StyleSheet.create({
	row: { gap: 10, alignItems: 'flex-start', paddingTop: 8, paddingBottom: 6, paddingHorizontal: 6 },
	swatchCell: { alignItems: 'center', gap: 6, width: SWATCH + (RING + RING_GAP) * 2 + 8 },
	swatchRing: { borderWidth: RING, alignItems: 'center', justifyContent: 'center' },
	swatchName: { fontSize: 12 },
	gloss: {
		position: 'absolute',
		left: SWATCH * 0.2,
		top: SWATCH * 0.14,
		width: SWATCH * 0.32,
		height: SWATCH * 0.2,
		borderRadius: SWATCH * 0.1,
		transform: [{ rotate: '-30deg' }]
	},
	check: {
		position: 'absolute',
		width: BADGE,
		height: BADGE,
		borderRadius: BADGE / 2,
		borderWidth: 2,
		alignItems: 'center',
		justifyContent: 'center'
	},
	swatchCheck: { right: -4, top: -4 },
	tile: {
		width: TILE_W,
		padding: 4,
		gap: 6,
		paddingBottom: 8,
		alignItems: 'center'
	},
	/** The tile's ground, border and glow, behind its content: the part that pops. */
	tileFrame: {
		...StyleSheet.absoluteFillObject,
		borderRadius: 18,
		shadowRadius: 10,
		shadowOffset: { width: 0, height: 0 }
	},
	window: {
		width: TILE_W - 8,
		height: WINDOW_H,
		borderRadius: 14,
		overflow: 'hidden'
	},
	tilePet: { position: 'absolute' },
	dimmed: { opacity: 0.55 },
	tileName: { fontSize: 13, fontWeight: '600' },
	tileCheck: { right: -6, top: -6 },
	tileLock: {
		position: 'absolute',
		right: -6,
		top: -6,
		width: BADGE,
		height: BADGE,
		borderRadius: BADGE / 2,
		borderWidth: 2,
		alignItems: 'center',
		justifyContent: 'center'
	},
	swatch: {
		width: SWATCH,
		height: SWATCH,
		borderRadius: SWATCH / 2,
		borderWidth: StyleSheet.hairlineWidth,
		overflow: 'hidden'
	},
	half: { position: 'absolute', right: 0, top: 0, bottom: 0, width: SWATCH / 2 },
	quiet: { opacity: 0.75 },
	lock: {
		position: 'absolute',
		right: 0,
		bottom: 0,
		width: LOCK,
		height: LOCK,
		borderRadius: LOCK / 2,
		borderWidth: 2,
		alignItems: 'center',
		justifyContent: 'center'
	}
})
