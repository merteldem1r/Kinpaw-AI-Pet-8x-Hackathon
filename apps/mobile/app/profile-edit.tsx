/**
 * Edit profile (docs/application/features/profile-edit-requirements.md, R3–R10, R13): the
 * person's photo and name, pushed from Profile's identity row. A picked photo shows at once and
 * is uploaded only on Save; Save sends only what changed, through POST /api/app/v1/uploads and
 * PATCH /api/app/v1/profile, and a failure keeps the edits on screen.
 */
import { useEffect, useRef, useState } from 'react'
import { AccessibilityInfo, KeyboardAvoidingView, StyleSheet, View } from 'react-native'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { DISPLAY_NAME_MAX, type UpdateProfileBody } from '@app/contract'
import { NameGreeting } from '@/components/profile/NameGreeting'
import { ProfileHero } from '@/components/profile/ProfileHero'
import { QueryErrorState } from '@/components/QueryError'
import { Button } from '@/components/ui/Button'
import { PageHeader } from '@/components/ui/PageHeader'
import { Screen } from '@/components/ui/Screen'
import { Skeleton } from '@/components/ui/Skeleton'
import { Text } from '@/components/ui/Text'
import TextInputField from '@/components/ui/TextInputField'
import { useTheme } from '@/contexts/ThemeContext'
import { usePet } from '@/hooks/usePet'
import { useProfile, type UserProfile } from '@/hooks/useProfile'
import { useUpdateProfile } from '@/hooks/useUpdateProfile'
import { track } from '@/lib/analytics'
import { errorCode } from '@/lib/api'
import { avatarContentType, AvatarError, checkAvatar } from '@/lib/avatar'
import { pickAvatar, uploadAvatar, type PickedAvatar } from '@/lib/avatarUpload'
import { haptic } from '@/lib/haptics'
import { log } from '@/lib/logger'
import { getInitials } from '@/lib/utils'

/** The hero's height while the profile loads (components/profile/ProfileHero.tsx). */
const HERO_HEIGHT = 236
const SAVE_FAILED = "Couldn't save your changes. Try again."
const NAME_EMPTY = "Your name can't be empty"

/** What happens to the photo on Save. */
type PhotoEdit = { kind: 'keep' } | { kind: 'new'; picked: PickedAvatar } | { kind: 'remove' }

export default function ProfileEditScreen() {
	const profileQuery = useProfile()
	const profile = profileQuery.data
	return (
		<KeyboardAvoidingView style={s.flex} behavior="padding">
			{profile ? (
				<EditProfile profile={profile} />
			) : (
				<Screen header={<PageHeader title="Edit profile" />}>
					{profileQuery.isError ? (
						<QueryErrorState
							error={profileQuery.error}
							title="Couldn't load your profile"
							onRetry={() => profileQuery.refetch()}
						/>
					) : (
						<View style={s.top}>
							<Skeleton width="100%" height={HERO_HEIGHT} />
							<Skeleton width="100%" height={50} />
						</View>
					)}
				</Screen>
			)}
		</KeyboardAvoidingView>
	)
}

function EditProfile({ profile }: { profile: UserProfile }) {
	const { colors: c, layout } = useTheme()
	const insets = useSafeAreaInsets()
	const update = useUpdateProfile()
	const pet = usePet().data

	// The field starts with the name Profile shows; leaving it as it is sends no name.
	const startName = profile.displayName ?? profile.fullName
	const [name, setName] = useState(startName)
	const [photo, setPhoto] = useState<PhotoEdit>({ kind: 'keep' })
	const [saving, setSaving] = useState(false)
	const [picking, setPicking] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const opened = useRef(false)

	useEffect(() => {
		if (opened.current) return
		opened.current = true
		track('profile_edit_opened', { from: 'profile', has_photo: !!profile.avatarUrl })
	}, [profile.avatarUrl])

	const trimmed = name.trim()
	const nameEmpty = trimmed.length === 0
	const nameChanged = trimmed !== startName.trim()
	const changed = nameChanged || photo.kind !== 'keep'
	const hasPhoto = photo.kind === 'new' || (photo.kind === 'keep' && !!profile.avatarUrl)

	function failed(stage: AvatarError['stage'], kind: string, message: string) {
		setError(message)
		haptic.warning()
		AccessibilityInfo.announceForAccessibility(message)
		track('profile_update_failed', { stage, error_kind: kind })
	}

	async function changePhoto() {
		if (picking || saving) return
		setError(null)
		// From the tap until the photo is back: the system picker takes a moment to appear, and
		// the chosen photo a moment to be prepared.
		setPicking(true)
		let picked: PickedAvatar | null
		try {
			picked = await pickAvatar()
		} catch (e) {
			log.error('photo library not opened', { error: e })
			setError("Couldn't open your photos. Try again.")
			haptic.warning()
			return
		} finally {
			setPicking(false)
		}
		if (!picked) return
		track('profile_photo_picked')
		// Refuse at once what the upload would refuse later (R8); the size may be known only then.
		try {
			checkAvatar(avatarContentType(picked.mimeType, picked.uri), picked.fileSize ?? 0)
		} catch (e) {
			if (e instanceof AvatarError) return failed(e.stage, e.kind, e.message)
			throw e
		}
		setPhoto({ kind: 'new', picked })
	}

	function removePhoto() {
		setError(null)
		setPhoto({ kind: 'remove' })
	}

	async function save() {
		if (!changed || nameEmpty || saving) return
		setError(null)
		setSaving(true)
		const body: UpdateProfileBody = {}
		if (nameChanged) body.display_name = trimmed
		try {
			if (photo.kind === 'new') body.avatar_path = await uploadAvatar(photo.picked)
			if (photo.kind === 'remove') body.avatar_path = null
		} catch (e) {
			setSaving(false)
			if (e instanceof AvatarError) {
				if (e.stage === 'upload') log.error('profile photo not uploaded', { kind: e.kind })
				return failed(e.stage, e.kind, e.message)
			}
			log.error('profile photo not uploaded', { error: e })
			return failed('upload', 'unknown', SAVE_FAILED)
		}
		try {
			await update.mutateAsync(body)
		} catch (e) {
			setSaving(false)
			log.error('profile not saved', { error: e })
			return failed('save', errorCode(e) ?? 'unknown', SAVE_FAILED)
		}
		track('profile_updated', {
			name_changed: nameChanged,
			photo:
				photo.kind === 'remove'
					? 'removed'
					: photo.kind === 'new'
						? profile.avatarUrl
							? 'replaced'
							: 'added'
						: 'unchanged'
		})
		haptic.success()
		router.back()
	}

	const initials = getInitials(trimmed || profile.fullName)
	return (
		<Screen
			header={<PageHeader title="Edit profile" />}
			gap={22}
			footer={
				<View
					style={[
						s.footer,
						{
							paddingHorizontal: layout.gutter,
							paddingBottom: insets.bottom + 12,
							borderTopColor: c.borderSoft
						}
					]}
				>
					<Button
						label={saving ? 'Saving…' : 'Save'}
						size="lg"
						fullWidth
						loading={saving}
						disabled={!changed || nameEmpty || saving}
						haptic={false}
						onPress={save}
					/>
				</View>
			}
		>
			<View style={s.top}>
				<ProfileHero
					initials={initials}
					uri={
						photo.kind === 'new'
							? photo.picked.uri
							: photo.kind === 'remove'
								? null
								: profile.avatarUrl
					}
					cacheKey={photo.kind === 'keep' ? profile.avatarKey : null}
					hasPhoto={hasPhoto}
					pet={pet ?? null}
					disabled={saving || picking}
					busy={picking}
					onChangePhoto={changePhoto}
				/>
				<View style={s.photoActions}>
					<Button
						label={picking ? 'Opening Photos…' : hasPhoto ? 'Change photo' : 'Add photo'}
						variant="secondary"
						size="sm"
						loading={picking}
						disabled={saving || picking}
						onPress={changePhoto}
					/>
					{hasPhoto ? (
						<Button
							label="Remove photo"
							variant="ghost"
							size="sm"
							disabled={saving || picking}
							onPress={removePhoto}
						/>
					) : null}
				</View>
			</View>

			<TextInputField
				label="Name"
				value={name}
				onChangeText={(text) => {
					setName(text)
					setError(null)
				}}
				maxLength={DISPLAY_NAME_MAX}
				autoComplete="name"
				textContentType="name"
				autoCapitalize="words"
				autoCorrect={false}
				returnKeyType="done"
				editable={!saving}
				onSubmitEditing={save}
				error={nameEmpty ? NAME_EMPTY : null}
				accessibilityLabel="Name"
			/>

			{pet ? <NameGreeting pet={pet} name={trimmed} /> : null}

			{error ? (
				<Text
					variant="bodySm"
					style={{ color: c.errorText }}
					accessibilityLiveRegion="polite"
					accessibilityRole="alert"
				>
					{error}
				</Text>
			) : null}
		</Screen>
	)
}

const s = StyleSheet.create({
	flex: { flex: 1 },
	top: { gap: 14, paddingTop: 4 },
	photoActions: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
	footer: { paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth }
})
