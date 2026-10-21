import { useState } from 'react'
import { ActivityIndicator, StyleSheet, View, type LayoutChangeEvent } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { Camera, CalendarHeart } from 'lucide-react-native'
import { art } from '@app/brand'
import type { Pet } from '@app/contract'
import { PressableScale } from '@/components/motion/PressableScale'
import { PetArt } from '@/components/pet/PetArt'
import { RiseAndBreathe } from '@/components/pet/RiseAndBreathe'
import { RoomGlow } from '@/components/pet/RoomGlow'
import { SkyScene } from '@/components/pet/SkyScene'
import { Avatar } from '@/components/ui/Marks'
import { Text } from '@/components/ui/Text'
import { useTheme } from '@/contexts/ThemeContext'
import { daysTogether } from '@/lib/petAge'
import { useSkyPhase } from '@/lib/sky'

const HEIGHT = 236
const AVATAR = 112
const BADGE = 34
const PET = 132
/** The sun or moon: upper right, clear of the pair. */
const BODY = { x: 0.86, y: 54 }

/**
 * The top of Edit profile: the person and their pet together under the sky outside right now
 * (the pet details hero's sky), the avatar in front with a camera badge that changes the photo,
 * the pet sitting beside it, breathing, and how long they've been together on a glass pill.
 * Without a pet (it can't happen behind the tabs, but never breaks), just the avatar.
 */
export function ProfileHero({
	initials,
	uri,
	cacheKey,
	hasPhoto,
	pet,
	disabled,
	busy = false,
	onChangePhoto
}: {
	initials: string
	uri: string | null
	cacheKey: string | null
	hasPhoto: boolean
	pet: Pet | null
	disabled: boolean
	/** The photo library is opening, or the chosen photo is being prepared. */
	busy?: boolean
	onChangePhoto: () => void
}) {
	const { colors: c, radii } = useTheme()
	const phase = useSkyPhase()
	const [width, setWidth] = useState(0)
	const night = phase === 'evening' || phase === 'night'
	const days = pet ? daysTogether(new Date(pet.created_at), new Date()) : null

	return (
		<View
			onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
			style={[s.hero, { borderRadius: radii.card + 6, borderColor: c.borderGlass }]}
		>
			<LinearGradient colors={art.sky[phase].stops} style={StyleSheet.absoluteFill} />
			{width > 0 ? <SkyScene phase={phase} width={width} height={HEIGHT} body={BODY} /> : null}
			{night ? (
				<View style={s.glow} pointerEvents="none">
					<RoomGlow size={320} />
				</View>
			) : null}

			{pet && days ? (
				<View
					style={[s.pill, { backgroundColor: c.surface2, borderColor: c.borderGlass }]}
					accessible
					accessibilityLabel={`You and ${pet.name}, ${days} ${days === 1 ? 'day' : 'days'} together`}
				>
					<CalendarHeart size={13} color={c.brandInk} strokeWidth={2.2} />
					<Text variant="caption" style={{ color: c.textPrimary }} maxFontSizeMultiplier={1.3}>
						You & {pet.name} · {days} {days === 1 ? 'day' : 'days'}
					</Text>
				</View>
			) : null}

			<View style={s.pair}>
				<PressableScale
					onPress={onChangePhoto}
					disabled={disabled}
					haptic="select"
					accessibilityRole="button"
					accessibilityLabel={hasPhoto ? 'Profile photo' : 'No profile photo, showing initials'}
					accessibilityHint={hasPhoto ? 'Changes your photo' : 'Adds a photo'}
					accessibilityState={{ busy, disabled }}
				>
					<View style={[s.ring, { borderColor: c.surface2 }]}>
						<Avatar initials={initials} size={AVATAR} uri={uri} cacheKey={cacheKey} />
						{busy ? (
							<View style={[s.busy, { backgroundColor: c.scrim }]}>
								<ActivityIndicator color={c.textPrimary} />
							</View>
						) : null}
					</View>
					<View style={[s.badge, { backgroundColor: c.brandFill, borderColor: c.surface2 }]}>
						<Camera size={16} color={c.onBrand} strokeWidth={2.3} />
					</View>
				</PressableScale>
				{pet ? (
					<RiseAndBreathe style={s.pet}>
						<View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
							<PetArt appearance={pet.appearance} mood="happy" size={PET} />
						</View>
					</RiseAndBreathe>
				) : null}
			</View>
		</View>
	)
}

const s = StyleSheet.create({
	hero: {
		height: HEIGHT,
		overflow: 'hidden',
		borderWidth: StyleSheet.hairlineWidth,
		alignItems: 'center',
		justifyContent: 'flex-end'
	},
	glow: { position: 'absolute', bottom: -90, alignSelf: 'center' },
	pill: {
		position: 'absolute',
		top: 14,
		left: 14,
		flexDirection: 'row',
		alignItems: 'center',
		gap: 6,
		paddingHorizontal: 10,
		paddingVertical: 5,
		borderRadius: 14,
		borderWidth: StyleSheet.hairlineWidth
	},
	// The avatar a little left of centre, the pet sitting against its right side.
	pair: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 18, marginLeft: 40 },
	ring: { borderRadius: (AVATAR + 8) / 2, borderWidth: 4, overflow: 'hidden' },
	busy: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
	badge: {
		position: 'absolute',
		right: 2,
		bottom: 2,
		width: BADGE,
		height: BADGE,
		borderRadius: BADGE / 2,
		borderWidth: 3,
		alignItems: 'center',
		justifyContent: 'center'
	},
	pet: { marginLeft: -28, marginBottom: -14 }
})
