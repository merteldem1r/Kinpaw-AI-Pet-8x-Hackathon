import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { RefreshCw } from 'lucide-react-native'
import { DEFAULT_LOOK, lookById } from '@app/contract'
import { CARE_ACTIONS } from '@/components/home/HomeRoom'
import { homeLayout, pillsBottom, roomHeight, useStageSize } from '@/components/home/layout'
import { CARE_TILE_HEIGHT, CARE_TILE_RADIUS } from '@/components/pet/CareButton'
import { NEED_PILL_HEIGHT } from '@/components/pet/NeedPill'
import { PetArt } from '@/components/pet/PetArt'
import { VOICE_ROW_HEIGHT } from '@/components/pet/TalkControls'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { Text } from '@/components/ui/Text'
import { useTheme } from '@/contexts/ThemeContext'
import { errorLines } from '@/lib/petLines'

/** First load with nothing cached (rare: the gate loads the pet before the tabs). */
export function HomeLoading() {
	const { petSize, onLayout } = useStageSize()
	return (
		<>
			<Skeleton width="70%" height={34} />
			<View style={homeLayout.stage} onLayout={onLayout}>
				{petSize ? (
					<View style={[homeLayout.room, { height: roomHeight(petSize) }]}>
						<SkeletonPills style={[homeLayout.pillsLeft, { bottom: pillsBottom(petSize) }]} />
						<SkeletonPills style={[homeLayout.pillsRight, { bottom: pillsBottom(petSize) }]} />
					</View>
				) : null}
			</View>
			{/* The talk controls' place, so nothing moves when the pet arrives. */}
			<View style={{ height: VOICE_ROW_HEIGHT }} />
			<View style={homeLayout.row}>
				{CARE_ACTIONS.map(({ action, label }) => (
					<QuietTile key={action} label={label} />
				))}
			</View>
		</>
	)
}

/** A care tile's place, quiet and not tappable, while the pet loads. */
function QuietTile({ label }: { label: string }) {
	const { colors: c } = useTheme()
	return (
		<View style={[s.tile, { backgroundColor: c.well }]}>
			<Text variant="label" tone="tertiary" numberOfLines={1}>
				{label}
			</Text>
		</View>
	)
}

/** Two need pills' places, waiting for the needs. */
function SkeletonPills({ style }: { style: StyleProp<ViewStyle> }) {
	return (
		<View style={[homeLayout.pills, style]}>
			<Skeleton width={PILL_WIDTH} height={NEED_PILL_HEIGHT} radius={NEED_PILL_HEIGHT / 2} />
			<Skeleton width={PILL_WIDTH} height={NEED_PILL_HEIGHT} radius={NEED_PILL_HEIGHT / 2} />
		</View>
	)
}

/**
 * The load failed and nothing is cached: never empty or zeroed needs. The name
 * isn't known either, so the copy says "Your pet".
 */
export function HomeFailed({ onRetry, retrying }: { onRetry: () => void; retrying: boolean }) {
	const lines = errorLines('Your pet')
	const { petSize, onLayout } = useStageSize()
	return (
		<>
			<Text variant="title" accessibilityRole="header">
				{lines.header}
			</Text>
			<View style={homeLayout.stage} onLayout={onLayout}>
				{/* The pet itself is what failed to load: a sleeping stand-in, out of sight. */}
				{petSize ? (
					<View style={[homeLayout.room, { height: roomHeight(petSize) }]}>
						<PetArt
							appearance={lookById(DEFAULT_LOOK.cat).appearance}
							mood="sleepy"
							size={petSize}
							style={s.dim}
						/>
					</View>
				) : null}
			</View>
			<Card style={homeLayout.panel}>
				<Text variant="h3">{lines.title}</Text>
				<Text variant="bodySm" tone="secondary">
					{lines.body}
				</Text>
				<Button
					label="Try again"
					variant="secondary"
					loading={retrying}
					icon={(color) => <RefreshCw size={18} color={color} strokeWidth={1.9} />}
					onPress={onRetry}
					style={{ alignSelf: 'flex-start' }}
				/>
			</Card>
		</>
	)
}

/** A need pill's width at rest (the icon, the bar and the padding), pt. */
const PILL_WIDTH = 82

const s = StyleSheet.create({
	dim: { opacity: 0.7 },
	tile: {
		flex: 1,
		height: CARE_TILE_HEIGHT,
		borderRadius: CARE_TILE_RADIUS,
		alignItems: 'center',
		justifyContent: 'center'
	}
})
