import { useEffect, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { Camera, ChevronRight, Images, Lock, type LucideIcon } from 'lucide-react-native'
import { PressableScale } from '@/components/motion/PressableScale'
import { Button } from '@/components/ui/Button'
import { Sheet } from '@/components/ui/Sheet'
import { Text } from '@/components/ui/Text'
import { useTheme } from '@/contexts/ThemeContext'
import { track } from '@/lib/analytics'
import { haptic } from '@/lib/haptics'
import { pickPetPhoto, type PhotoSource, type PickedPhoto } from '@/lib/petPhoto'
import { hasPhotoAiConsent, savePhotoAiConsent } from '@/lib/photoRedo'

/** Where the photo goes, named (Apple 5.1.2(i)): the same words as the privacy page. */
const AI_SERVICE = "Google's Gemini, through fal.ai"

/**
 * "Show me your pet" (docs/application/features/v2-pet-from-photo-requirements.md, R3–R5; mockup
 * B1): take a photo or choose one, with what makes a good photo, the tries left, and what happens
 * to the photo. Apple 5.1.2(i) asks apps to name the third-party AI personal data goes to and to
 * get explicit permission first: the note names it, and the first photo asks, in the sheet, with
 * Allow or Not now (kept on the phone, so once). Used while creating (`create`, with the tries)
 * and in Change look (`redo`).
 */
export function PhotoSheet({
	open,
	onClose,
	context,
	triesLeft,
	onPicked
}: {
	open: boolean
	onClose: () => void
	context: 'create' | 'redo'
	/** The phone's tries while creating; left out for a redo. */
	triesLeft?: number
	onPicked: (photo: PickedPhoto) => void
}) {
	const { colors: c } = useTheme()
	const [status, setStatus] = useState<string | null>(null)
	const [busy, setBusy] = useState(false)
	// The source tapped before the person allowed the AI: asked about first, then opened.
	const [asking, setAsking] = useState<PhotoSource | null>(null)

	useEffect(() => {
		if (!open) return
		setStatus(null)
		setAsking(null)
		track('pet_photo_sheet_opened', { context, tries_left: triesLeft ?? null })
	}, [open, context, triesLeft])

	async function choose(source: PhotoSource) {
		if (busy) return
		if (await hasPhotoAiConsent()) void pick(source)
		else setAsking(source)
	}

	async function allow() {
		if (!asking) return
		await savePhotoAiConsent()
		const source = asking
		setAsking(null)
		void pick(source)
	}

	async function pick(source: PhotoSource) {
		if (busy) return
		setBusy(true)
		setStatus(null)
		track('pet_photo_source_selected', { context, source })
		try {
			const result = await pickPetPhoto(source)
			if (result.kind === 'picked') {
				onPicked(result.photo)
				return
			}
			if (result.kind === 'camera_denied') {
				haptic.warning()
				track('pet_photo_permission_denied', { context })
				setStatus('Camera access is off. Choose from your library, or turn it on in Settings.')
			} else if (result.kind === 'too_large') {
				haptic.warning()
				setStatus('That photo is too large. Try another one.')
			} else if (result.kind === 'unreadable') {
				haptic.warning()
				setStatus("I couldn't open that photo. Try another one.")
			}
		} finally {
			setBusy(false)
		}
	}

	return (
		<Sheet open={open} onClose={onClose} title="Show me your pet">
			<View style={s.body}>
				<View style={s.lead}>
					<Text variant="bodySm" tone="secondary" style={s.leadText}>
						One cat or dog, face to the camera, in good light.
					</Text>
					{triesLeft !== undefined ? <Tries left={triesLeft} /> : null}
				</View>
				{asking ? (
					<View style={[s.ask, { backgroundColor: c.surface2, borderColor: c.brandBorder }]}>
						<Text variant="label">Send your photo to the AI?</Text>
						<Text variant="bodySm" tone="secondary">
							To draw your pet, your photo goes to {AI_SERVICE}, which looks at its colours and
							markings. Kinpaw never saves it.
						</Text>
						<View style={s.askButtons}>
							<Button label="Not now" variant="ghost" size="sm" onPress={() => setAsking(null)} />
							<Button label="Allow" size="sm" onPress={() => void allow()} />
						</View>
					</View>
				) : (
					<>
						<SourceRow icon={Camera} label="Take a photo" onPress={() => void choose('camera')} />
						<SourceRow
							icon={Images}
							label="Choose from library"
							onPress={() => void choose('library')}
						/>
					</>
				)}
				{status ? (
					<Text variant="caption" style={{ color: c.errorText }} accessibilityLiveRegion="polite">
						{status}
					</Text>
				) : null}
				<View style={s.note}>
					<Lock size={13} strokeWidth={2} color={c.textTertiary} style={s.noteIcon} />
					<Text variant="caption" tone="tertiary" style={s.noteText}>
						Your photo goes to {AI_SERVICE}, our AI service, so it can see your pet&apos;s colours.
						Kinpaw never saves it, and it&apos;s only used to draw your pet.
					</Text>
				</View>
			</View>
		</Sheet>
	)
}

function SourceRow({
	icon: Icon,
	label,
	onPress
}: {
	icon: LucideIcon
	label: string
	onPress: () => void
}) {
	const { colors: c, radii } = useTheme()
	return (
		<PressableScale
			onPress={onPress}
			haptic="select"
			accessibilityRole="button"
			accessibilityLabel={label}
			style={[s.row, { backgroundColor: c.surface2, borderRadius: radii.card - 6 }]}
		>
			<View style={[s.rowIcon, { backgroundColor: c.brandDim }]}>
				<Icon size={18} strokeWidth={2} color={c.brandInk} />
			</View>
			<Text variant="label" style={s.rowLabel}>
				{label}
			</Text>
			<ChevronRight size={18} strokeWidth={2} color={c.textTertiary} />
		</PressableScale>
	)
}

/** The tries left as dots and words: "2 tries", "1 try left". */
export function Tries({ left }: { left: number }) {
	const { colors: c } = useTheme()
	const words = left === 0 ? 'No tries left' : left === 1 ? '1 try left' : `${left} tries`
	return (
		<View style={s.tries} accessible accessibilityLabel={`${words} on this phone`}>
			{[0, 1].map((i) => (
				<View key={i} style={[s.dot, { backgroundColor: i < left ? c.brandInk : c.surface3 }]} />
			))}
			<Text variant="caption" tone="secondary">
				{words}
			</Text>
		</View>
	)
}

const s = StyleSheet.create({
	body: { gap: 12 },
	lead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
	leadText: { flex: 1 },
	row: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 12,
		minHeight: 56,
		paddingHorizontal: 14
	},
	rowIcon: {
		width: 34,
		height: 34,
		borderRadius: 10,
		alignItems: 'center',
		justifyContent: 'center'
	},
	rowLabel: { flex: 1 },
	note: { flexDirection: 'row', gap: 8, paddingTop: 4 },
	noteIcon: { marginTop: 2 },
	noteText: { flex: 1 },
	tries: { flexDirection: 'row', alignItems: 'center', gap: 5 },
	ask: { gap: 8, padding: 14, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth },
	askButtons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
	dot: { width: 7, height: 7, borderRadius: 3.5 }
})
