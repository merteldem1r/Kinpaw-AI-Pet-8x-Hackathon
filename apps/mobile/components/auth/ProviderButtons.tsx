import { StyleSheet, View } from 'react-native'
import * as AppleAuthentication from 'expo-apple-authentication'
import { Ionicons } from '@expo/vector-icons'
import { Button } from '@/components/ui/Button'
import { Text } from '@/components/ui/Text'
import { useTheme } from '@/contexts/ThemeContext'
import type { Provider } from '@/hooks/useThirdPartySignIn'
import { makeStyles } from '@/lib/themedStyles'

// Apple and Google under the email button, after an "or" (hidden until they are configured:
// THIRD_PARTY_SIGN_IN in app/(auth)/login.tsx). Apple's own button where iOS has its native sheet.

/** Provider buttons match the large Button (Apple's button takes an explicit height). */
const PROVIDER_HEIGHT = 56

type Props = {
	nativeApple: boolean
	/** What is signing in now, any way in; null when nothing is. */
	loading: string | null
	onApple: () => void
	onProvider: (provider: Provider) => void
}

export function ProviderButtons({ nativeApple, loading, onApple, onProvider }: Props) {
	const s = useStyles()
	const { isDark, radii } = useTheme()
	return (
		<>
			<View style={s.divider}>
				<View style={s.rule} />
				<Text variant="caption" tone="tertiary">
					or
				</Text>
				<View style={s.rule} />
			</View>
			<View style={s.providers}>
				{nativeApple ? (
					<View
						pointerEvents={loading !== null ? 'none' : 'auto'}
						style={loading !== null && s.dimmed}
					>
						<AppleAuthentication.AppleAuthenticationButton
							buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
							buttonStyle={
								isDark
									? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
									: AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
							}
							cornerRadius={Math.min(radii.button, PROVIDER_HEIGHT / 2)}
							style={s.appleButton}
							onPress={onApple}
						/>
					</View>
				) : (
					<Button
						label="Continue with Apple"
						variant="outline"
						size="lg"
						fullWidth
						loading={loading === 'apple'}
						disabled={loading !== null && loading !== 'apple'}
						icon={(color) => <Ionicons name="logo-apple" size={18} color={color} />}
						onPress={() => onProvider('apple')}
					/>
				)}
				<Button
					label="Continue with Google"
					variant="outline"
					size="lg"
					fullWidth
					loading={loading === 'google'}
					disabled={loading !== null && loading !== 'google'}
					icon={(color) => <Ionicons name="logo-google" size={16} color={color} />}
					onPress={() => onProvider('google')}
				/>
			</View>
		</>
	)
}

const useStyles = makeStyles((c) => ({
	divider: { flexDirection: 'row', alignItems: 'center', gap: 12 },
	rule: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: c.borderSoft },
	providers: { gap: 10 },
	appleButton: { width: '100%', height: PROVIDER_HEIGHT },
	dimmed: { opacity: 0.5 }
}))
