// DEV ONLY (docs/application/features/v3-pet-looks-requirements.md, R21): the living pet without
// an account, to compare the SVG pet with Skia's on the Simulator (which takes no taps) and to
// read the frame time on the iPhone. Opened from Home's "Dev: pet screen" link, or with
// cozypet://dev-pet?renderer=puppet&look=2&mood=happy. Goes when the Skia pet has rolled out (B5).

import { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { Redirect, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { runOnJS, useFrameCallback, useSharedValue } from 'react-native-reanimated'
import { LOOKS, MOODS, type Mood } from '@app/contract'
import { RENDERER_LABEL } from '@/components/home/HomeRoom'
import { PET_RENDERERS, PetStage, type PetRenderer } from '@/components/pet/PetStage'
import { PageHeader, ScreenTitle } from '@/components/ui/PageHeader'
import { Screen } from '@/components/ui/Screen'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { Text } from '@/components/ui/Text'
import { TextLink } from '@/components/ui/TextLink'
import { hasSkia } from '@/lib/skia'

/** The pet's size here: about its size on Home. */
const PET_SIZE = 300
/** How many frames one reading of the frame time covers. */
const FRAMES = 60

const known = <T extends string>(all: readonly T[], value: string | undefined, otherwise: T): T =>
	all.find((each) => each === value) ?? otherwise

export default function DevPetScreen() {
	const params = useLocalSearchParams<{ renderer?: string; look?: string; mood?: string }>()
	const first = {
		renderer: known(PET_RENDERERS, params.renderer, 'puppet'),
		look: (Number(params.look) || 0) % LOOKS.length,
		mood: known(MOODS, params.mood, 'happy')
	}
	if (!__DEV__) return <Redirect href="/" />
	// A link opened again with other choices starts the screen over on them.
	return <DevPet key={`${first.renderer}-${first.look}-${first.mood}`} first={first} />
}

function DevPet({ first }: { first: { renderer: PetRenderer; look: number; mood: Mood } }) {
	const [renderer, setRenderer] = useState(first.renderer)
	const [look, setLook] = useState(first.look)
	const [mood, setMood] = useState(first.mood)
	const [focused, setFocused] = useState(false)
	const [touch, setTouch] = useState('Tap it, stroke it, hold it')
	const times = useFrameTimes()
	useFocusEffect(() => {
		setFocused(true)
		return () => setFocused(false)
	})
	const pet = LOOKS[look]!
	return (
		<Screen header={<PageHeader />} gap={16}>
			<ScreenTitle title="The living pet" />
			{hasSkia() ? null : (
				<Text tone="secondary">This build has no Skia: every choice draws the SVG pet.</Text>
			)}
			<View style={s.stage}>
				<PetStage
					appearance={pet.appearance}
					mood={mood}
					name={pet.name}
					line=""
					wants={null}
					cue={null}
					active={focused}
					renderer={renderer}
					size={PET_SIZE}
					hint="Answers your touch"
					onPress={(zone) => setTouch(`A tap on its ${zone}`)}
					onStroke={(zone) => setTouch(`A stroke on its ${zone}`)}
					onHug={() => setTouch('A hug')}
				/>
			</View>
			<SegmentedControl
				segments={PET_RENDERERS.map((value) => ({ value, label: RENDERER_LABEL[value] }))}
				value={renderer}
				onChange={setRenderer}
				accessibilityLabel="How the pet is drawn"
				dense
			/>
			<SegmentedControl
				segments={MOODS.map((value) => ({ value, label: value }))}
				value={mood}
				onChange={setMood}
				accessibilityLabel="Its mood"
				dense
			/>
			<View style={s.notes}>
				<Text variant="caption" tone="secondary">
					{touch}
				</Text>
				<Text variant="caption" tone="tertiary">
					{times
						? `${times.average.toFixed(1)} ms a frame, worst ${times.worst.toFixed(1)} ms (16.7 is 60 fps)`
						: 'Measuring…'}
				</Text>
				<TextLink
					label={`${pet.name}: next look`}
					onPress={() => setLook((current) => (current + 1) % LOOKS.length)}
				/>
			</View>
		</Screen>
	)
}

/** The time between frames on the UI thread, read every `FRAMES` frames: the average and the worst. */
function useFrameTimes() {
	const [times, setTimes] = useState<{ average: number; worst: number } | null>(null)
	const sum = useSharedValue(0)
	const worst = useSharedValue(0)
	const count = useSharedValue(0)
	useFrameCallback((frame) => {
		const ms = frame.timeSincePreviousFrame
		if (ms == null) return
		sum.value += ms
		worst.value = Math.max(worst.value, ms)
		count.value += 1
		if (count.value < FRAMES) return
		runOnJS(setTimes)({ average: sum.value / count.value, worst: worst.value })
		sum.value = 0
		worst.value = 0
		count.value = 0
	})
	return times
}

const s = StyleSheet.create({
	stage: { alignItems: 'center', paddingTop: 8 },
	notes: { alignItems: 'center', gap: 10 }
})
