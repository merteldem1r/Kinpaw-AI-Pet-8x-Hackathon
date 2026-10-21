import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import {
	Dices,
	Ear,
	Eye,
	Palette,
	PawPrint,
	Shapes,
	Spline,
	type LucideIcon
} from 'lucide-react-native'
import { art, type SkyPhase } from '@app/brand'
import {
	attributesIn,
	BUILDER_TABS,
	describeAppearance,
	type AttributeKey,
	type AttributeOption,
	type BuilderTab,
	type PetAppearance
} from '@app/contract'
import { PressableScale } from '@/components/motion/PressableScale'
import { AttributeOptions } from '@/components/pet/AttributeOptions'
import { PetArt } from '@/components/pet/PetArt'
import { SkyPicker } from '@/components/pet/SkyPicker'
import { SkyScene } from '@/components/pet/SkyScene'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { Text } from '@/components/ui/Text'
import { useTheme } from '@/contexts/ThemeContext'
import { track } from '@/lib/analytics'
import { haptic } from '@/lib/haptics'
import { useSkyPhase } from '@/lib/sky'

const STAGE_HEIGHT = 280
const PET_SIZE = 250
/** The photo the pet was read from, pt square, bottom left of the stage. */
const PHOTO_THUMB = 58
/** How long the pet looks happy after a change, ms. */
const FLASH_MS = 700
/** Each builder tab's icon, above its label. */
const TAB_ICON: Record<BuilderTab, LucideIcon> = {
	fur: Palette,
	pattern: Shapes,
	eyes: Eye,
	ears: Ear,
	body: PawPrint,
	tail: Spline
}
/** Where the sun or moon sits on the stage: right, below Surprise me, clear of the pet's head. */
const STAGE_BODY = { x: 0.86, y: 104 }

/**
 * The pet builder (docs/application/UI/kinpaw-screen-spec-v1.md, "Create · Make your own";
 * features/m4b-pet-builder-requirements.md, R8–R9): the pet large on a sky stage, six attribute
 * tabs, one row of choices, Surprise me, and a status line. Fur and Pattern each hold two
 * attributes of the coat (v2-pet-looks-requirements.md, R15): a small switch at the top of the
 * card picks which row shows (Main colour or Markings; Pattern or White). Every change shows at once and the
 * pet looks happy for a moment. Used by onboarding (Make your own) and by Change look (M7).
 *
 * The caller owns the appearance and decides what a pick does: `onPick` answers whether it was
 * applied (a locked Plus option isn't), and only then does the pet flash. With `unlocked`, Plus
 * options show and pick like any other (a Plus member in Change look).
 */
export function PetBuilder({
	appearance,
	status,
	unlocked = false,
	onPick,
	onSurprise,
	onTabChange,
	photoUri
}: {
	appearance: PetAppearance
	/**
	 * A line under the options ("Calico is a Plus look…"), or null. Left out, there is no line:
	 * the caller shows it elsewhere (onboarding, above Continue).
	 */
	status?: string | null
	unlocked?: boolean
	onPick: (option: AttributeOption, attribute: AttributeKey) => boolean
	onSurprise: () => void
	/** Another tab picked (the caller usually clears its status). */
	onTabChange?: () => void
	/** The photo the pet was read from, small on the stage to compare (v2 pet from a photo, R14). */
	photoUri?: string
}) {
	const { colors: c, radii } = useTheme()
	const [tab, setTab] = useState<BuilderTab>('fur')
	// The attribute the card shows: the tab's own, or its second (Markings, White).
	const [row, setRow] = useState<AttributeKey>('fur')
	const [happy, setHappy] = useState(false)
	const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
	// The stage's sky: the time it is now, until another is picked (a preview only).
	const now = useSkyPhase()
	const [picked, setPicked] = useState<SkyPhase | null>(null)
	const sky = picked ?? now
	const [stageWidth, setStageWidth] = useState(0)

	useEffect(
		() => () => {
			if (flashTimer.current) clearTimeout(flashTimer.current)
		},
		[]
	)

	function flash() {
		haptic.select()
		setHappy(true)
		if (flashTimer.current) clearTimeout(flashTimer.current)
		flashTimer.current = setTimeout(() => setHappy(false), FLASH_MS)
	}

	const chooseSky = useCallback(
		(next: SkyPhase) => {
			if (next === sky) return
			setPicked(next)
			track('pet_builder_sky_changed', { time_of_day: next })
		},
		[sky]
	)

	// The caller's onTabChange is a new function each render; read the latest without
	// rebuilding the tabs.
	const tabChanged = useRef(onTabChange)
	tabChanged.current = onTabChange
	const chooseTab = useCallback((next: BuilderTab) => {
		setTab(next)
		setRow(next)
		tabChanged.current?.()
	}, [])

	const rows = attributesIn(tab)
	const attribute = rows.find((candidate) => candidate.key === row) ?? rows[0]!
	// A colour with nothing to colour says so rather than look broken.
	const markingsHint =
		attribute.key === 'accent' && appearance.pattern === 'solid'
			? 'Solid has no markings. Pick a pattern to see this colour.'
			: attribute.key === 'trim' && appearance.white === 'none'
				? 'No paws & chest markings. Pick some under Pattern.'
				: null

	return (
		<>
			<View
				style={[s.stage, { borderRadius: radii.card + 6, borderColor: c.borderGlass }]}
				onLayout={(e: LayoutChangeEvent) => setStageWidth(e.nativeEvent.layout.width)}
			>
				<LinearGradient
					colors={art.sky[sky].stops}
					style={StyleSheet.absoluteFill}
					pointerEvents="none"
				/>
				{stageWidth > 0 ? (
					<SkyScene phase={sky} width={stageWidth} height={STAGE_HEIGHT} body={STAGE_BODY} />
				) : null}
				<StageSkyPicker value={sky} onChange={chooseSky} style={s.skyPicker} />
				<PressableScale
					onPress={() => {
						onSurprise()
						flash()
					}}
					haptic={false}
					// 36pt tall: 4 above and below make the touch area 44pt (M8, R1).
					hitSlop={{ top: 4, bottom: 4 }}
					accessibilityLabel="Surprise me"
					accessibilityHint="Makes a random pet"
					style={[s.surprise, { backgroundColor: c.surface2, borderColor: c.borderGlass }]}
				>
					<Dices size={15} color={c.textPrimary} strokeWidth={2} />
					<Text variant="caption" style={[s.surpriseText, { color: c.textPrimary }]}>
						Surprise me
					</Text>
				</PressableScale>
				<PetArt
					appearance={appearance}
					mood={happy ? 'happy' : 'content'}
					size={PET_SIZE}
					label={describeAppearance(appearance, happy ? 'happy' : undefined)}
					style={s.pet}
				/>
				{photoUri ? (
					<View
						style={[s.photo, { borderColor: art.cloud, borderRadius: radii.card / 2 }]}
						accessible
						accessibilityLabel="Your photo"
					>
						<Image source={{ uri: photoUri }} style={StyleSheet.absoluteFill} contentFit="cover" />
					</View>
				) : null}
			</View>

			<BuilderTabs tab={tab} onChange={chooseTab} />

			<View style={[s.options, { backgroundColor: c.surface, borderRadius: radii.card }]}>
				{rows.length > 1 ? (
					<SegmentedControl<AttributeKey>
						dense
						accessibilityLabel={`${BUILDER_TABS.find((a) => a.tab === tab)?.label ?? ''} options`}
						value={attribute.key}
						onChange={(next) => {
							setRow(next)
							onTabChange?.()
						}}
						segments={rows.map((a) => ({ value: a.key, label: a.title }))}
						style={s.rowSwitch}
					/>
				) : null}
				{markingsHint ? (
					<Text variant="caption" tone="secondary" style={s.hint}>
						{markingsHint}
					</Text>
				) : null}
				<AttributeOptions
					attribute={attribute}
					species={appearance.species}
					appearance={appearance}
					value={appearance[attribute.key]}
					unlocked={unlocked}
					onPick={(option) => {
						if (option.id === appearance[attribute.key]) return
						if (onPick(option, attribute.key)) flash()
					}}
				/>
			</View>

			{status !== undefined ? (
				<Text variant="caption" tone="secondary" style={s.status} accessibilityLiveRegion="polite">
					{status ?? ' '}
				</Text>
			) : null}
		</>
	)
}

/** The six tabs, the same for the builder's whole life. */
const TAB_SEGMENTS = BUILDER_TABS.map((a) => {
	const Icon = TAB_ICON[a.tab]
	return {
		value: a.tab,
		label: a.label,
		icon: (color: string) => <Icon size={18} strokeWidth={2} color={color} />
	}
})

/** The tab bar, memoized: a pick redraws the pet and its options, not the tabs. */
const BuilderTabs = memo(function BuilderTabs({
	tab,
	onChange
}: {
	tab: BuilderTab
	onChange: (next: BuilderTab) => void
}) {
	return (
		<SegmentedControl<BuilderTab>
			stacked
			accessibilityLabel="What to change"
			value={tab}
			onChange={onChange}
			segments={TAB_SEGMENTS}
		/>
	)
})

/** The stage's time-of-day picker, memoized for the same reason. */
const StageSkyPicker = memo(SkyPicker)

const s = StyleSheet.create({
	photo: {
		position: 'absolute',
		left: 12,
		bottom: 12,
		width: PHOTO_THUMB,
		height: PHOTO_THUMB,
		borderWidth: 2,
		overflow: 'hidden'
	},
	stage: {
		height: STAGE_HEIGHT,
		overflow: 'hidden',
		borderWidth: StyleSheet.hairlineWidth,
		alignItems: 'center',
		justifyContent: 'flex-end'
	},
	skyPicker: { position: 'absolute', top: 12, left: 12, zIndex: 1 },
	surprise: {
		position: 'absolute',
		top: 12,
		right: 12,
		zIndex: 1,
		height: 36,
		paddingHorizontal: 12,
		borderRadius: 18,
		borderWidth: StyleSheet.hairlineWidth,
		flexDirection: 'row',
		alignItems: 'center',
		gap: 6
	},
	surpriseText: { fontWeight: '600' },
	pet: { marginBottom: 6 },
	options: { paddingVertical: 10, paddingHorizontal: 10 },
	rowSwitch: { marginBottom: 8 },
	hint: { textAlign: 'center', marginBottom: 6 },
	status: { textAlign: 'center', minHeight: 18 }
})
