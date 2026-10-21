import { View } from 'react-native'
import type { Mood, PetAppearance } from '@app/contract'
import { useTheme } from '@/contexts/ThemeContext'
import { HEAD_CENTRE } from '@app/brand'
import { PetArt } from './PetArt'

/** How much of the art the circle shows: the head and a little shoulder. */
const ZOOM = 2

/**
 * The pet's head in a circle: the same drawing as PetArt, cropped (the spec's portrait on
 * Profile and in the Talk header). Decorative unless `label` is given.
 */
export function PetPortrait({
	appearance,
	mood,
	size,
	label
}: {
	appearance: PetAppearance
	mood: Mood
	size: number
	label?: string
}) {
	const { colors: c } = useTheme()
	const art = size * ZOOM
	return (
		<View
			accessible={!!label}
			accessibilityRole={label ? 'image' : undefined}
			accessibilityLabel={label}
			style={{
				width: size,
				height: size,
				borderRadius: size / 2,
				overflow: 'hidden',
				backgroundColor: c.surface2,
				borderColor: c.borderSoft,
				borderWidth: 1
			}}
		>
			<PetArt
				appearance={appearance}
				mood={mood}
				size={art}
				shadow={false}
				style={{
					position: 'absolute',
					left: size / 2 - art * HEAD_CENTRE.x,
					top: size / 2 - art * HEAD_CENTRE.y
				}}
			/>
		</View>
	)
}
