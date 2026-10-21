import type { ReactNode } from 'react'
import { StyleSheet, View } from 'react-native'
import { Mail } from 'lucide-react-native'
import { Button } from '@/components/ui/Button'
import { Text } from '@/components/ui/Text'
import TextInputField from '@/components/ui/TextInputField'

// The sign-in sheet's first step (kinpaw-screen-spec-v1.md, "Save Mochi · Email" and "Sign in ·
// Welcome back"): the address the code goes to.

type Props = {
	mode: 'save' | 'welcome_back'
	/** The pet being saved, for the title. */
	name: string
	email: string
	onEmailChange: (value: string) => void
	error: string | null
	onSend: () => void
	sending: boolean
	/** Another way in is on its way (Apple, Google): this one waits. */
	busy: boolean
	/** Apple and Google, under an "or", when they are configured. */
	providers?: ReactNode
}

export function EmailStep({
	mode,
	name,
	email,
	onEmailChange,
	error,
	onSend,
	sending,
	busy,
	providers
}: Props) {
	return (
		<>
			<View style={s.titles}>
				<Text variant="h1" accessibilityRole="header">
					{mode === 'save' ? `Save ${name}` : 'Welcome back'}
				</Text>
				<Text variant="body" tone="secondary">
					{mode === 'save'
						? `Sign in so ${name} is here every time you open the app.`
						: "Sign in to see your pet. They've been waiting."}
				</Text>
			</View>

			<TextInputField
				label="Email"
				icon={(color) => <Mail size={18} color={color} strokeWidth={2} />}
				value={email}
				onChangeText={onEmailChange}
				placeholder="you@example.com"
				keyboardType="email-address"
				textContentType="emailAddress"
				autoComplete="email"
				autoCapitalize="none"
				autoCorrect={false}
				returnKeyType="send"
				onSubmitEditing={onSend}
				error={error}
			/>

			<Button
				label="Email me a code"
				size="lg"
				fullWidth
				loading={sending}
				disabled={!email.trim() || busy}
				onPress={onSend}
			/>

			{providers}
		</>
	)
}

const s = StyleSheet.create({ titles: { gap: 10 } })
