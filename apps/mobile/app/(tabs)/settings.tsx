/**
 * Settings — the third tab: haptics, the pet's voice and daily notes, signing out, managing a store subscription,
 * help and legal, and deleting the account (Apple 5.1.1(v)). No appearance
 * choice: Kinpaw follows the sky (docs/application/product.md, "Structure and
 * scope"). "Manage subscription" shows only for Plus bought in the store, never
 * for an admin grant, whose store page would be empty (M7, R13).
 */
import { useEffect, useState } from 'react'
import { Linking, Platform, StyleSheet } from 'react-native'
import { router } from 'expo-router'
import Constants from 'expo-constants'
import {
	Bell,
	CreditCard,
	FileText,
	LifeBuoy,
	LogOut,
	ShieldCheck,
	Trash2,
	Vibrate,
	Volume2
} from 'lucide-react-native'
import { FadeSlideIn } from '@/components/motion/FadeSlideIn'
import { AlertModal } from '@/components/ui/AppModal'
import { ListRow, Section } from '@/components/ui/List'
import { Screen } from '@/components/ui/Screen'
import { Text } from '@/components/ui/Text'
import { Toggle } from '@/components/ui/Toggle'
import { useSubscription } from '@/contexts/SubscriptionContext'
import { useToast } from '@/contexts/ToastContext'
import { useNotesState } from '@/hooks/useNotesState'
import { usePet } from '@/hooks/usePet'
import { AccountDeletionError, deleteAccount } from '@/lib/account'
import { track } from '@/lib/analytics'
import { APP_NAME } from '@/lib/constants'
import { hapticsPreference, saveHapticsPref } from '@/lib/haptics'
import { requestNotes, setNotesEnabled } from '@/lib/notifications'
import { setVoiceEnabled, voiceEnabled } from '@/lib/petVoice'
import { logoutRevenueCat, MANAGE_SUBSCRIPTIONS_URL } from '@/lib/purchases'
import { supabase } from '@/lib/supabase'

const STORE_NAME = Platform.OS === 'ios' ? 'the App Store' : 'Google Play'

// What deleting the account takes with it: everything that cascades from
// auth.users(id), the pet included.
const DELETE_ACCOUNT_MESSAGE =
	"This permanently deletes your account and your pet. It can't be undone.\n\n" +
	`Deleting your account does not cancel a subscription bought through ${STORE_NAME}. ` +
	"Cancel it there first, or you'll keep being charged."

export default function SettingsScreen() {
	const { showToast } = useToast()
	// RevenueCat's own entitlement: a store subscription, the only Plus a store can manage.
	const { isPremium: storeSubscription } = useSubscription()
	const [haptics, setHaptics] = useState(hapticsPreference())
	const petName = usePet().data?.name ?? 'your pet'
	const notes = useNotesState()
	// The pet's spoken voice (v2 voice, R11): a preference on this phone; null until read.
	const [voice, setVoice] = useState<boolean | null>(null)
	useEffect(() => {
		void voiceEnabled().then(setVoice)
	}, [])
	const [confirmSignOut, setConfirmSignOut] = useState(false)
	const [signingOut, setSigningOut] = useState(false)
	const [confirmDelete, setConfirmDelete] = useState(false)
	const [deleting, setDeleting] = useState(false)
	const [notice, setNotice] = useState<{ title: string; message: string } | null>(null)

	function changeHaptics(enabled: boolean) {
		setHaptics(enabled)
		void saveHapticsPref(enabled)
		track('haptics_changed', { enabled })
	}

	function changeVoice(next: boolean) {
		setVoice(next)
		void setVoiceEnabled(next)
	}

	// The pet's daily notes (v2-notifications R15): on and off here; refused in iOS, this opens
	// the app's page in iOS Settings, the only place it can change.
	async function changeNotes(next: boolean) {
		if (notes.state === 'denied') {
			void Linking.openSettings()
			return
		}
		if (next && notes.state === 'unasked') {
			const allowed = await requestNotes('settings')
			if (allowed) await setNotesEnabled(true)
			notes.refresh()
			return
		}
		notes.set(next ? 'on' : 'off')
		await setNotesEnabled(next)
		notes.refresh()
	}

	async function signOut() {
		setSigningOut(true)
		try {
			track('logout')
			await logoutRevenueCat()
			const { error } = await supabase.auth.signOut()
			if (error) throw error
		} catch (e) {
			setNotice({
				title: "Couldn't sign out",
				message:
					(e as { message?: string } | undefined)?.message ?? "Couldn't sign out. Please try again."
			})
		} finally {
			setSigningOut(false)
		}
	}

	// ── Delete account (Apple 5.1.1(v), Google Play) ──
	function handleDeletePress() {
		if (deleting) return
		track('delete_account_tapped')
		setConfirmDelete(true)
	}

	async function handleDeleteConfirmed() {
		track('delete_account_confirmed')
		setDeleting(true)
		try {
			await deleteAccount()
		} catch (e) {
			const failure = e instanceof AccountDeletionError ? e : null
			track('delete_account_failed', { reason: failure?.reason ?? 'server' })
			setNotice({
				title: 'Account not deleted',
				message: failure?.message ?? 'Your account was not deleted. Please try again.'
			})
			setDeleting(false)
			return
		}

		// Fired before the sign-out, while PostHog still knows who this was.
		track('account_deleted')
		showToast('Your account has been deleted.', 'success')

		// End the session on this device, as signing out does above: RevenueCat
		// first, then Supabase. `local`, because deleting the user already ended
		// every session on the server. The auth listener in app/_layout.tsx then
		// routes to the signed-out screens.
		await logoutRevenueCat()
		const { error } = await supabase.auth.signOut({ scope: 'local' })
		if (error) {
			setDeleting(false)
			setNotice({
				title: 'Account deleted',
				message:
					"Your account has been deleted, but this device couldn't sign out. Close and reopen the app."
			})
		}
	}

	return (
		<Screen tabs gap={26}>
			<FadeSlideIn index={0}>
				<Text variant="title" accessibilityRole="header">
					Settings
				</Text>
			</FadeSlideIn>

			{Platform.OS === 'web' ? null : (
				<FadeSlideIn index={1}>
					<Section title="Feel">
						<ListRow
							icon={Vibrate}
							title="Haptics"
							subtitle="A light tap under your finger as you use the app"
							accessory={
								<Toggle
									value={haptics}
									onValueChange={changeHaptics}
									accessibilityLabel="Haptics"
								/>
							}
						/>
						<ListRow
							icon={Volume2}
							title={`${petName}'s voice`}
							subtitle={`${petName} says its replies out loud`}
							accessory={
								<Toggle
									value={voice === true}
									onValueChange={changeVoice}
									disabled={voice === null}
									accessibilityLabel={`${petName}'s voice`}
								/>
							}
						/>
						<ListRow
							icon={Bell}
							title={`Notes from ${petName}`}
							subtitle={
								notes.state === 'denied'
									? 'Off in iOS Settings. Tap to open them'
									: `A note when ${petName} misses you, one a day at most`
							}
							onPress={notes.state === 'denied' ? () => void Linking.openSettings() : undefined}
							accessory={
								<Toggle
									value={notes.state === 'on'}
									onValueChange={(next) => void changeNotes(next)}
									disabled={notes.state === null}
									accessibilityLabel={`Notes from ${petName}`}
								/>
							}
						/>
					</Section>
				</FadeSlideIn>
			)}

			<FadeSlideIn index={2}>
				<Section title="Account">
					{storeSubscription ? (
						<ListRow
							icon={CreditCard}
							title="Manage subscription"
							subtitle={`${APP_NAME} Plus, in ${STORE_NAME}`}
							onPress={() => {
								track('manage_subscription_tapped')
								void Linking.openURL(MANAGE_SUBSCRIPTIONS_URL)
							}}
						/>
					) : null}
					<ListRow
						icon={LogOut}
						title={signingOut ? 'Signing out…' : 'Sign out'}
						destructive
						disabled={signingOut}
						onPress={() => setConfirmSignOut(true)}
					/>
				</Section>
			</FadeSlideIn>

			<FadeSlideIn index={3}>
				<Section title="Help">
					<ListRow icon={LifeBuoy} title="Help & support" onPress={() => router.push('/support')} />
					<ListRow icon={ShieldCheck} title="Terms of Use" onPress={() => router.push('/terms')} />
					<ListRow icon={FileText} title="Privacy Policy" onPress={() => router.push('/privacy')} />
				</Section>
			</FadeSlideIn>

			<FadeSlideIn index={4}>
				<ListRow
					icon={Trash2}
					title={deleting ? 'Deleting account…' : 'Delete account'}
					subtitle="Permanently delete your account and its data"
					onPress={handleDeletePress}
					disabled={deleting}
					destructive
				/>
			</FadeSlideIn>

			<Text variant="caption" tone="tertiary" style={s.version}>
				{APP_NAME} {Constants.expoConfig?.version ?? ''}
			</Text>

			<AlertModal
				visible={confirmSignOut}
				title="Sign out?"
				message="You'll need your email to sign back in."
				buttons={[
					{ text: 'Sign out', style: 'destructive', onPress: signOut },
					{ text: 'Cancel', style: 'cancel' }
				]}
				onDismiss={() => setConfirmSignOut(false)}
			/>
			<AlertModal
				visible={confirmDelete}
				title="Delete your account?"
				message={DELETE_ACCOUNT_MESSAGE}
				buttons={[
					{ text: 'Manage subscription', onPress: () => Linking.openURL(MANAGE_SUBSCRIPTIONS_URL) },
					{ text: 'Delete account', style: 'destructive', onPress: handleDeleteConfirmed },
					{ text: 'Cancel', style: 'cancel' }
				]}
				onDismiss={() => setConfirmDelete(false)}
			/>
			<AlertModal
				visible={!!notice}
				title={notice?.title ?? ''}
				message={notice?.message}
				onDismiss={() => setNotice(null)}
			/>
		</Screen>
	)
}

const s = StyleSheet.create({
	version: { textAlign: 'center' }
})
