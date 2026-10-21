import type { ReactNode, RefObject } from 'react'
import { Pressable, StyleSheet, View, type TextInput } from 'react-native'
import { Button } from '@/components/ui/Button'
import { CodeInput } from '@/components/ui/CodeInput'
import { Text } from '@/components/ui/Text'
import { useTheme } from '@/contexts/ThemeContext'
import { CODE_LENGTH } from '@/lib/signIn'

// The sign-in sheet's second step (kinpaw-screen-spec-v1.md, "Save Mochi · Code" and "· Wrong
// code"): the six digits from the email, then resend or a different address.

type Props = {
	/** The address the code went to, as it was sent. */
	sentTo: string
	code: string
	onCodeChange: (value: string) => void
	codeRef: RefObject<TextInput | null>
	verifying: boolean
	codeError: boolean
	/** Signed in: the boxes show it, and the actions go. */
	verified: boolean
	/** Seconds left of a lockout; null when there is none. */
	lockoutLeft: number | null
	/** Under the boxes: the mistake, signing in, or a save that failed (AfterMessage). */
	message: ReactNode
	onVerify: () => void
	/** Seconds until a code can be sent again; 0 when it can. */
	cooldown: number
	/** Something is on its way: no resend meanwhile. */
	busy: boolean
	onResend: () => void
	onChangeEmail: () => void
}

export function CodeStep({
	sentTo,
	code,
	onCodeChange,
	codeRef,
	verifying,
	codeError,
	verified,
	lockoutLeft,
	message,
	onVerify,
	cooldown,
	busy,
	onResend,
	onChangeEmail
}: Props) {
	const { colors: c } = useTheme()
	const locked = lockoutLeft !== null

	return (
		<>
			<View style={s.titles}>
				<Text variant="h1" accessibilityRole="header">
					Check your inbox
				</Text>
				<Text variant="body" tone="secondary">
					Enter the code we sent to{' '}
					<Text variant="body" tone="primary">
						{sentTo}
					</Text>
					. It can take a minute; check spam too.
				</Text>
			</View>

			<CodeInput
				value={code}
				onChange={onCodeChange}
				inputRef={codeRef}
				disabled={verifying || locked || verified}
				error={codeError}
				success={verified}
			/>

			{message}
			{locked ? (
				<Text variant="bodySm" tone="secondary" tabular>
					Try again in {Math.floor(lockoutLeft / 60)}:{String(lockoutLeft % 60).padStart(2, '0')}
				</Text>
			) : null}

			{verified ? null : (
				<>
					<Button
						label="Verify"
						size="lg"
						fullWidth
						loading={verifying}
						disabled={code.length < CODE_LENGTH || locked}
						onPress={onVerify}
					/>
					<View style={s.actions}>
						{cooldown > 0 ? (
							<View style={[s.pill, { backgroundColor: c.well }]}>
								<Text variant="caption" tone="secondary" tabular>
									{`Resend in ${cooldown}s`}
								</Text>
							</View>
						) : (
							<Pressable onPress={onResend} disabled={busy} accessibilityRole="button" hitSlop={12}>
								<Text variant="label" tone="brand">
									Resend code
								</Text>
							</Pressable>
						)}
						<Pressable onPress={onChangeEmail} accessibilityRole="button" hitSlop={12}>
							<Text variant="label" tone="secondary">
								Change email
							</Text>
						</Pressable>
					</View>
				</>
			)}
		</>
	)
}

const s = StyleSheet.create({
	titles: { gap: 10 },
	actions: {
		flexDirection: 'row',
		justifyContent: 'center',
		alignItems: 'center',
		gap: 20
	},
	pill: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999 }
})
