import { useEffect, useRef, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { Camera, ChevronRight, Lock } from 'lucide-react-native'
import type { PetAppearance, PhotoReadResponse, Species } from '@app/contract'
import { PressableScale } from '@/components/motion/PressableScale'
import { PhotoPolaroid } from '@/components/pet/PhotoPolaroid'
import { PhotoSheet } from '@/components/pet/PhotoSheet'
import { AlertModal } from '@/components/ui/AppModal'
import { Text } from '@/components/ui/Text'
import { useTheme } from '@/contexts/ThemeContext'
import { track } from '@/lib/analytics'
import { api, errorCode, errorMessage } from '@/lib/api'
import { haptic } from '@/lib/haptics'
import { openPaywall } from '@/lib/openPaywall'
import { FAILED_LINE, withCoatOf, type PickedPhoto } from '@/lib/petPhoto'
import { markRedoUsed, redoUsedToday } from '@/lib/photoRedo'
import { deviceTimeZone } from '@/lib/timeZone'

/** As the creation read: a little longer than the server waits for the model. */
const READ_TIMEOUT_MS = 25_000
const POLAROID = 120

const USED_TODAY = "You've used today's photo. Try another tomorrow."
const RESTING = 'Photo reading is resting for today. Try again tomorrow.'
const MISSED: Record<'no_pet' | 'several' | 'unclear', string> = {
	no_pet:
		"I couldn't spot a cat or dog in that photo. That was today's photo; try another tomorrow.",
	several: "I saw more than one friend there. That was today's photo; try another tomorrow.",
	unclear: "That photo was a bit blurry. That was today's photo; try another tomorrow."
}

/**
 * "Redo from a photo" at the top of Change look (docs/application/features/v2-pet-from-photo-
 * requirements.md, R26–R29; mockup F1). Kinpaw Plus, once a day: the photo is read, and the
 * result goes into the editor unsaved (`onApply`); Save is still the person's. A photo of the
 * other species asks first: switch, or keep the species with the photo's colours. A free
 * account sees the row with a Plus pill, and a tap opens the paywall.
 *
 * Plus is the server's to decide (the redo route reads plan_type); `plus` here only picks what
 * the row shows.
 */
export function RedoFromPhoto({
	petName,
	species,
	plus,
	current,
	onApply,
	onStatus
}: {
	petName: string
	/** The species the editor shows now. */
	species: Species
	plus: boolean
	/** The look in the editor now: the base "Keep {name} a cat" paints the photo's coat onto. */
	current: PetAppearance
	/** The look to show, the photo it came from, and the pet as read (for pet_photo_kept). */
	onApply: (appearance: PetAppearance, photoUri: string, read: PetAppearance) => void
	onStatus: (status: string | null) => void
}) {
	const { colors: c, radii } = useTheme()
	const [usedToday, setUsedToday] = useState(false)
	const [sheetOpen, setSheetOpen] = useState(false)
	const [reading, setReading] = useState<PickedPhoto | null>(null)
	const [ask, setAsk] = useState<{ read: PetAppearance; photo: PickedPhoto } | null>(null)
	const request = useRef<AbortController | null>(null)

	useEffect(() => {
		void redoUsedToday().then(setUsedToday)
		return () => request.current?.abort()
	}, [])

	function tap() {
		track('pet_photo_redo_tapped', { plan: plus ? 'plus' : 'free', left: usedToday ? 0 : 1 })
		if (!plus) {
			haptic.warning()
			openPaywall('photo_redo')
			return
		}
		if (usedToday) {
			haptic.warning()
			onStatus(USED_TODAY)
			return
		}
		onStatus(null)
		setSheetOpen(true)
	}

	async function read(photo: PickedPhoto) {
		setSheetOpen(false)
		setReading(photo)
		const controller = new AbortController()
		request.current = controller
		const started = Date.now()
		let response: PhotoReadResponse
		try {
			response = await api('redoPetPhoto', {
				body: { image: photo.base64, time_zone: deviceTimeZone() },
				signal: controller.signal,
				timeoutMs: READ_TIMEOUT_MS
			})
		} catch (error) {
			if (controller.signal.aborted) return
			setReading(null)
			haptic.warning()
			track('pet_photo_read', { context: 'redo', result: 'failed', ms: Date.now() - started })
			onStatus(errorCode(error) === 'offline' ? errorMessage(error) : FAILED_LINE)
			return
		}
		if (controller.signal.aborted) return
		setReading(null)
		track('pet_photo_read', {
			context: 'redo',
			result: response.outcome,
			ms: Date.now() - started,
			...(response.outcome === 'read'
				? { species: response.appearance.species, swapped_count: response.swapped.length }
				: {})
		})
		const used = () => {
			setUsedToday(true)
			void markRedoUsed()
		}
		switch (response.outcome) {
			case 'read':
				used()
				if (response.appearance.species !== species) setAsk({ read: response.appearance, photo })
				else onApply(response.appearance, photo.uri, response.appearance)
				return
			case 'no_pet':
			case 'several':
			case 'unclear':
				used()
				haptic.warning()
				onStatus(MISSED[response.outcome])
				return
			case 'limit_reached':
				haptic.warning()
				if (response.limit === 'today') {
					used()
					onStatus(USED_TODAY)
				} else {
					onStatus(RESTING)
				}
				return
			case 'plus_required':
				openPaywall('photo_redo')
		}
	}

	/** The species dialog's answer (R28). */
	function answer(choice: 'switch' | 'keep') {
		if (!ask) return
		track('pet_photo_species_choice', { choice })
		const next = choice === 'switch' ? ask.read : withCoatOf(current, ask.read)
		onApply(next, ask.photo.uri, ask.read)
		setAsk(null)
	}

	const other = ask?.read.species ?? species
	return (
		<>
			{reading ? (
				<View style={s.reading} accessible accessibilityLabel="Reading your photo">
					<PhotoPolaroid uri={reading.uri} width={POLAROID} tilt={-4} scanning />
					<View style={s.readingWords}>
						<Text variant="h3">Drawing {petName}…</Text>
						<Text variant="caption" tone="secondary">
							Fur · markings · eyes · ears
						</Text>
					</View>
				</View>
			) : (
				<PressableScale
					onPress={tap}
					haptic="select"
					accessibilityRole="button"
					accessibilityLabel={
						plus
							? `Redo from a photo. ${usedToday ? 'Used today' : '1 left today'}`
							: 'Redo from a photo. Comes with Kinpaw Plus'
					}
					style={[
						s.row,
						{ borderRadius: radii.card - 6 },
						plus
							? { backgroundColor: c.brandDim, borderColor: c.brandBorder }
							: { backgroundColor: c.surface, borderColor: c.borderSoft }
					]}
				>
					<View style={[s.icon, { backgroundColor: plus ? c.surface : c.brandDim }]}>
						<Camera size={18} strokeWidth={2} color={c.brandInk} />
					</View>
					<View style={s.words}>
						<Text variant="label">Redo from a photo</Text>
						<Text variant="caption" tone="secondary">
							{plus
								? usedToday
									? 'Used today. Another tomorrow.'
									: 'Plus · 1 left today'
								: 'Your real pet, drawn from a photo'}
						</Text>
					</View>
					{plus ? (
						<ChevronRight size={18} strokeWidth={2} color={c.textTertiary} />
					) : (
						<View style={[s.pill, { backgroundColor: c.surface3 }]}>
							<Lock size={11} strokeWidth={2.2} color={c.textSecondary} />
							<Text variant="caption" tone="secondary" style={s.pillText}>
								Plus
							</Text>
						</View>
					)}
				</PressableScale>
			)}

			<PhotoSheet
				open={sheetOpen}
				onClose={() => setSheetOpen(false)}
				context="redo"
				onPicked={(photo) => void read(photo)}
			/>
			<AlertModal
				visible={ask !== null}
				title={`This looks like a ${other}`}
				message={`Turn ${petName} into a ${other}? ${petName} keeps their name, personality and memories. Only the look changes, and nothing is saved until you tap Save.`}
				buttons={[
					{ text: `Turn ${petName} into a ${other}`, onPress: () => answer('switch') },
					{ text: `Keep ${petName} a ${species}`, style: 'cancel', onPress: () => answer('keep') }
				]}
			/>
		</>
	)
}

const s = StyleSheet.create({
	row: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 12,
		minHeight: 60,
		paddingHorizontal: 14,
		paddingVertical: 10,
		borderWidth: StyleSheet.hairlineWidth
	},
	icon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
	words: { flex: 1, gap: 2 },
	pill: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 4,
		borderRadius: 10,
		paddingHorizontal: 8,
		paddingVertical: 3
	},
	pillText: { fontWeight: '600' },
	reading: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 6 },
	readingWords: { flex: 1, gap: 4 }
})
