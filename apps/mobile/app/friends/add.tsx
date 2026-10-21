/**
 * Add a friend (docs/application/features/v2-friends-requirements.md, R8–R10). One screen for the
 * three ways in: a friend's QR scanned with the iPhone's Camera, a shared link (both arrive as
 * `cozypet://friends/add?code=…`), or a code typed here. Once there is a code, the server says
 * whose it is and the screen shows their pet; nothing is added before "Add friend".
 */
import { useEffect, useRef, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { UserPlus } from 'lucide-react-native'
import {
	FRIEND_CODE_LENGTH,
	normalizeFriendCode,
	type FriendAddSource,
	type FriendPreview
} from '@app/contract'
import { FadeSlideIn } from '@/components/motion/FadeSlideIn'
import { PetArt } from '@/components/pet/PetArt'
import { Button } from '@/components/ui/Button'
import { PageHeader } from '@/components/ui/PageHeader'
import { Screen } from '@/components/ui/Screen'
import { Text } from '@/components/ui/Text'
import TextInputField from '@/components/ui/TextInputField'
import { useAddFriend, useLookupFriend } from '@/hooks/useFriends'
import { track } from '@/lib/analytics'
import { errorCode } from '@/lib/api'
import { codeFromParam, friendName, friendPetCaption, friendPetLine } from '@/lib/friends'
import { haptic } from '@/lib/haptics'

const PREVIEW_PET = 200
/** The typed code's field: 8 characters and the dash people may type. */
const FIELD_MAX = FRIEND_CODE_LENGTH + 1

type FailReason = 'own_code' | 'unknown_code' | 'cap' | 'network'

/** What each refusal says (R9), and the reason `friend_add_failed` carries. */
function failureOf(error: unknown): { reason: FailReason; line: string } {
	switch (errorCode(error)) {
		case 'friend_own_code':
			return { reason: 'own_code', line: "That's your own code. Ask your friend for theirs." }
		case 'friend_code_unknown':
			return {
				reason: 'unknown_code',
				line: "That code didn't work. Ask your friend to show it again."
			}
		case 'friends_full':
			return { reason: 'cap', line: 'You can have up to 50 friends.' }
		case 'friend_friends_full':
			return { reason: 'cap', line: "They can't add more friends right now." }
		default:
			return { reason: 'network', line: "Couldn't reach Kinpaw just now. Try again." }
	}
}

export default function AddFriendScreen() {
	const params = useLocalSearchParams<{ code?: string }>()
	const linked = codeFromParam(params.code)
	const lookup = useLookupFriend()
	const add = useAddFriend()

	const [typed, setTyped] = useState('')
	const [code, setCode] = useState<string | null>(linked)
	const [source, setSource] = useState<FriendAddSource>(linked ? 'link' : 'typed')
	const [preview, setPreview] = useState<FriendPreview | null>(null)
	const [failure, setFailure] = useState<string | null>(null)
	const opened = useRef(false)

	useEffect(() => {
		if (opened.current) return
		opened.current = true
		track('friend_add_opened', { source: linked ? 'link' : 'typed' })
	}, [linked])

	// A new link while this screen is open replaces its code.
	useEffect(() => {
		if (!linked) return
		setCode(linked)
		setSource('link')
	}, [linked])

	function fail(error: unknown) {
		const { reason, line } = failureOf(error)
		haptic.error()
		track('friend_add_failed', { reason })
		setFailure(line)
	}

	// Who the code is, whenever there is a new one.
	const lookupRef = useRef(lookup)
	lookupRef.current = lookup
	useEffect(() => {
		if (!code) return
		setPreview(null)
		setFailure(null)
		lookupRef.current.mutate(code, {
			onSuccess: ({ friend }) => setPreview(friend),
			onError: fail
		})
	}, [code])

	function lookUp(target: string) {
		setFailure(null)
		lookup.mutate(target, { onSuccess: ({ friend }) => setPreview(friend), onError: fail })
	}

	function submitTyped() {
		const normal = normalizeFriendCode(typed)
		if (!normal) {
			setFailure(`A friend code has ${FRIEND_CODE_LENGTH} letters and numbers.`)
			return
		}
		setSource('typed')
		// The same code again, after a failure, is asked again; a new one is looked up by the effect.
		if (normal === code) lookUp(normal)
		else setCode(normal)
	}

	function confirm() {
		if (!code) return
		setFailure(null)
		add.mutate(
			{ code, source },
			{
				onSuccess: ({ friend }) => {
					haptic.success()
					router.replace({ pathname: '/friends/[id]', params: { id: friend.id } })
				},
				onError: fail
			}
		)
	}

	return (
		<Screen header={<PageHeader title="Add a friend" />} gap={18}>
			{preview ? (
				<Preview
					preview={preview}
					adding={add.isPending}
					failure={failure}
					onAdd={confirm}
					onNotNow={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/friends'))}
				/>
			) : code && lookup.isPending ? (
				<Text variant="body" tone="secondary" style={s.center}>
					Finding your friend…
				</Text>
			) : (
				<FadeSlideIn index={0} style={s.form}>
					<Text variant="body" tone="secondary">
						Type the code from your friend&apos;s Friends tab, or scan their QR with your
						iPhone&apos;s Camera.
					</Text>
					<TextInputField
						label="Friend code"
						value={typed}
						onChangeText={(text) => {
							setTyped(text.toUpperCase())
							setFailure(null)
						}}
						placeholder="KP7X-M3QD"
						autoCapitalize="characters"
						autoCorrect={false}
						autoComplete="off"
						maxLength={FIELD_MAX}
						returnKeyType="go"
						onSubmitEditing={submitTyped}
						error={failure}
						autoFocus={!code}
					/>
					<Button
						label={failure && code ? 'Try again' : 'Find friend'}
						fullWidth
						loading={lookup.isPending}
						disabled={typed.trim().length === 0 && !code}
						onPress={() => (typed.trim() || !code ? submitTyped() : lookUp(code))}
					/>
				</FadeSlideIn>
			)}
		</Screen>
	)
}

function Preview({
	preview,
	adding,
	failure,
	onAdd,
	onNotNow
}: {
	preview: FriendPreview
	adding: boolean
	failure: string | null
	onAdd: () => void
	onNotNow: () => void
}) {
	const pet = preview.pet
	const name = friendName(preview)
	return (
		<FadeSlideIn index={0} style={s.preview}>
			{pet ? <PetArt appearance={pet.appearance} mood={pet.mood} size={PREVIEW_PET} /> : null}
			<Text variant="h2" style={s.center}>
				{pet ? `Add ${name} and ${pet.name}?` : `Add ${name}?`}
			</Text>
			{pet ? (
				<Text variant="body" tone="secondary" style={s.center}>
					{`${friendPetCaption(preview)}. ${friendPetLine(pet)}`}
				</Text>
			) : null}
			<Text variant="bodySm" tone="secondary" style={s.center}>
				You&apos;ll see each other&apos;s pets. Nothing else is shared.
			</Text>
			{failure ? (
				<Text variant="bodySm" tone="error" style={s.center} accessibilityLiveRegion="polite">
					{failure}
				</Text>
			) : null}
			<View style={s.buttons}>
				<Button
					label="Add friend"
					fullWidth
					loading={adding}
					icon={(color) => <UserPlus size={16} color={color} strokeWidth={2} />}
					onPress={onAdd}
				/>
				<Button label="Not now" variant="ghost" fullWidth onPress={onNotNow} />
			</View>
		</FadeSlideIn>
	)
}

const s = StyleSheet.create({
	form: { gap: 16 },
	preview: { alignItems: 'center', gap: 10, paddingTop: 8 },
	buttons: { alignSelf: 'stretch', gap: 8, marginTop: 8 },
	center: { textAlign: 'center' }
})
