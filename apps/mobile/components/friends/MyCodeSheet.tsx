/**
 * My code (docs/application/features/v2-friends-requirements.md, R6–R7): the QR a friend scans
 * with their iPhone's Camera, the code to type in two groups of four, Share, and New code, which
 * stops the old one after a confirm.
 */
import { useEffect, useState } from 'react'
import { Share, StyleSheet, View } from 'react-native'
import QRCode from 'react-native-qrcode-svg'
import { RefreshCw, Share2 } from 'lucide-react-native'
import { art } from '@app/brand'
import { formatFriendCode, type Pet } from '@app/contract'
import { PetPortrait } from '@/components/pet/PetPortrait'
import { AlertModal } from '@/components/ui/AppModal'
import { Button } from '@/components/ui/Button'
import { Sheet } from '@/components/ui/Sheet'
import { Text } from '@/components/ui/Text'
import { useTheme } from '@/contexts/ThemeContext'
import { useToast } from '@/contexts/ToastContext'
import { useResetFriendCode } from '@/hooks/useFriends'
import { track } from '@/lib/analytics'
import { friendLink, friendShareMessage } from '@/lib/friends'
import { haptic } from '@/lib/haptics'
import { log } from '@/lib/logger'

const QR_SIZE = 200
/** The light margin a camera needs around the squares (the QR quiet zone). */
const QR_MARGIN = 14

export function MyCodeSheet({
	open,
	onClose,
	code,
	pet,
	source
}: {
	open: boolean
	onClose: () => void
	code: string
	pet: Pet | null | undefined
	/** Where it was opened from, for `friend_code_shown`. */
	source: 'empty_state' | 'list'
}) {
	const { colors: c, radii } = useTheme()
	const { showToast } = useToast()
	const reset = useResetFriendCode()
	const [asking, setAsking] = useState(false)
	const pretty = formatFriendCode(code)

	useEffect(() => {
		if (open) track('friend_code_shown', { source })
	}, [open, source])

	async function share() {
		try {
			const result = await Share.share({ message: friendShareMessage(code, pet?.name ?? 'my pet') })
			if (result.action === Share.sharedAction) track('friend_code_shared')
		} catch (error) {
			log.warn('friend code share failed', { error })
		}
	}

	function renew() {
		reset.mutate(undefined, {
			onSuccess: () => {
				haptic.success()
				track('friend_code_reset')
				showToast('New code ready. The old one no longer works.', 'success')
			},
			onError: () => showToast("Couldn't make a new code just now. Try again.", 'error')
		})
	}

	return (
		<Sheet open={open} onClose={onClose} title="My friend code">
			<View style={s.body}>
				<Text variant="body" tone="secondary" style={s.center}>
					A friend scans this with their iPhone&apos;s Camera, or types the code in Kinpaw.
				</Text>
				<View
					style={[s.qr, { backgroundColor: art.qr.paper, borderRadius: radii.card }]}
					accessible
					accessibilityRole="image"
					accessibilityLabel={`QR code for your friend code, ${pretty.split('').join(' ')}`}
				>
					<QRCode
						value={friendLink(code)}
						size={QR_SIZE}
						color={art.qr.ink}
						backgroundColor={art.qr.paper}
						ecl="M"
					/>
					{pet ? (
						<View style={[s.badge, { backgroundColor: art.qr.paper }]}>
							<PetPortrait appearance={pet.appearance} mood="happy" size={44} />
						</View>
					) : null}
				</View>
				<Text
					variant="h2"
					style={[s.center, s.code, { color: c.textPrimary }]}
					selectable
					accessibilityLabel={`Your code: ${pretty.split('').join(' ')}`}
				>
					{pretty}
				</Text>
				<Button
					label="Share my code"
					fullWidth
					icon={(color) => <Share2 size={16} color={color} strokeWidth={2} />}
					onPress={share}
				/>
				<Button
					label="New code"
					variant="ghost"
					fullWidth
					loading={reset.isPending}
					icon={(color) => <RefreshCw size={16} color={color} strokeWidth={2} />}
					onPress={() => setAsking(true)}
				/>
			</View>
			<AlertModal
				visible={asking}
				title="Make a new code?"
				message="Your old code will stop working. Friends you already have stay."
				buttons={[
					{ text: 'Cancel', style: 'cancel' },
					{ text: 'New code', style: 'destructive', onPress: renew }
				]}
				onDismiss={() => setAsking(false)}
			/>
		</Sheet>
	)
}

const s = StyleSheet.create({
	body: { gap: 16, alignItems: 'stretch', paddingBottom: 8 },
	center: { textAlign: 'center' },
	qr: { alignSelf: 'center', padding: QR_MARGIN },
	// The pet sits under the code's corner, outside the squares, so the code stays readable.
	badge: {
		position: 'absolute',
		right: -14,
		bottom: -14,
		borderRadius: 30,
		padding: 4
	},
	code: { letterSpacing: 2 }
})
