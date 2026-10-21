/**
 * The paywall: Kinpaw Plus (M7, docs/application/features/m7-plus-profile-settings-requirements.md,
 * R8–R11; the spec's "Paywall"). The pet, happy, on the glow; "More time with {name}"; what Plus
 * adds. Opened only from a limit or Profile, with a `trigger` param (lib/openPaywall.ts).
 *
 * To customise:
 *   1. The headline below, and components/plus/plusFeatures.ts.
 *   2. Prices, periods and trials come from the store through RevenueCat —
 *      never write a price into the app. Create the products in App Store
 *      Connect / Play Console, add them to a RevenueCat offering, and set the
 *      entitlement to 'premium' (or change ENTITLEMENT_ID in lib/purchases.ts).
 *
 * Store rules this screen carries (Apple 3.1.1 / 3.1.2, Play subscriptions):
 * price and period before purchase (the shelf), what the trial becomes
 * (TrialTimeline), Restore, Terms of Use and Privacy Policy links, and the
 * auto-renew disclosure (below). Keep them here: check:store reads this file.
 *
 * What the buttons do is usePaywall's; the plans' words are lib/paywall's.
 */
import { useState } from 'react'
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Gift, RotateCcw, Sparkles } from 'lucide-react-native'
import { FadeSlideIn } from '@/components/motion/FadeSlideIn'
import { PetArt } from '@/components/pet/PetArt'
import { PlanList } from '@/components/plus/PlanList'
import { PlusMemberCard } from '@/components/plus/PlusMemberCard'
import { plusFeatures } from '@/components/plus/plusFeatures'
import { TrialTimeline } from '@/components/plus/TrialTimeline'
import { AlertModal } from '@/components/ui/AppModal'
import { Button } from '@/components/ui/Button'
import { Glow } from '@/components/ui/Marks'
import { PageHeader } from '@/components/ui/PageHeader'
import { Text } from '@/components/ui/Text'
import { useTheme } from '@/contexts/ThemeContext'
import { useToast } from '@/contexts/ToastContext'
import { usePaywall } from '@/hooks/usePaywall'
import { usePet } from '@/hooks/usePet'
import { usePlus } from '@/hooks/usePlus'
import { track } from '@/lib/analytics'
import { APP_NAME } from '@/lib/constants'
import { haptic } from '@/lib/haptics'
import { periodPhrase, priceLine, STORE_NAME } from '@/lib/paywall'
import { makeStyles } from '@/lib/themedStyles'

/** The pet on the glow, at the top. */
const PET_SIZE = 120

function openLegal(document: 'terms' | 'privacy') {
	track('upgrade_legal_link_tapped', { document })
	router.push(document === 'terms' ? '/terms' : '/privacy')
}

export default function UpgradeScreen() {
	const insets = useSafeAreaInsets()
	const { height } = useWindowDimensions()
	const { colors: c, layout } = useTheme()
	const s = useStyles()
	const { showToast } = useToast()
	// Plus as the app decides it (the server's plan or the store's entitlement), so a granted
	// account sees itself as Plus here too (M7, R5).
	const isPremium = usePlus()
	const pet = usePet().data
	const name = pet?.name ?? 'your pet'
	const { trigger } = useLocalSearchParams<{ trigger?: string }>()
	const paywall = usePaywall(trigger)
	const { selected } = paywall
	const [shelfH, setShelfH] = useState(0)
	const showShelf = !isPremium

	return (
		<View style={s.root}>
			<Glow size={height * 0.7} strength={1.3} style={s.glow} />
			<ScrollView
				contentContainerStyle={{
					paddingHorizontal: layout.gutterWide,
					paddingBottom: (showShelf ? shelfH : insets.bottom) + 28,
					gap: 22
				}}
				showsVerticalScrollIndicator={false}
			>
				<View style={s.header}>
					<PageHeader backIcon="close" />
				</View>

				<FadeSlideIn index={0} style={s.hero}>
					{pet ? (
						<PetArt
							appearance={pet.appearance}
							mood="happy"
							size={PET_SIZE}
							label={`${pet.name}, happy`}
						/>
					) : (
						<View style={[s.heroChip, { backgroundColor: c.brandDim }]}>
							<Sparkles size={22} color={c.brandInk} strokeWidth={2} />
						</View>
					)}
					<Text variant="display" style={s.center} accessibilityRole="header">
						{isPremium ? `${APP_NAME} Plus` : `More time with ${name}`}
					</Text>
					<Text variant="lead" tone="secondary" style={s.center}>
						{isPremium ? `Thank you for looking after ${name}.` : `${APP_NAME} Plus`}
					</Text>
				</FadeSlideIn>

				<FadeSlideIn index={1} style={s.features}>
					{plusFeatures(name).map(({ icon: Icon, label, detail }) => (
						<View key={label} style={s.feature}>
							<View style={[s.featureChip, { backgroundColor: c.brandDim }]}>
								<Icon size={16} color={c.brandInk} strokeWidth={2} />
							</View>
							<View style={s.flex}>
								<Text variant="body">{label}</Text>
								{detail ? (
									<Text variant="caption" tone="secondary">
										{detail}
									</Text>
								) : null}
							</View>
						</View>
					))}
				</FadeSlideIn>

				{isPremium ? (
					<FadeSlideIn index={2}>
						<PlusMemberCard renewal={paywall.renewal} storePremium={paywall.storePremium} />
					</FadeSlideIn>
				) : (
					<>
						<FadeSlideIn index={2} style={s.plans}>
							<PlanList
								plans={paywall.plans}
								selected={selected}
								loading={paywall.loadingPlans}
								preview={paywall.preview}
								onSelect={paywall.select}
								onRetry={() => void paywall.retry()}
							/>
						</FadeSlideIn>

						{selected?.trialDays ? (
							<FadeSlideIn index={3}>
								<TrialTimeline
									days={selected.trialDays}
									price={`${selected.price} ${periodPhrase(selected.period)}`}
								/>
							</FadeSlideIn>
						) : null}

						<FadeSlideIn index={4} style={s.footer}>
							<View style={s.links}>
								<Button
									label="Restore purchases"
									variant="ghost"
									size="sm"
									loading={paywall.restoring}
									disabled={paywall.waitingForRedeem}
									icon={(color) => <RotateCcw size={14} color={color} strokeWidth={2} />}
									onPress={() => void paywall.restorePurchases()}
								/>
								<Button
									label="Redeem a code"
									variant="ghost"
									size="sm"
									loading={paywall.waitingForRedeem}
									disabled={paywall.restoring}
									icon={(color) => <Gift size={14} color={color} strokeWidth={2} />}
									onPress={() => void paywall.redeem()}
								/>
							</View>
							{/* Apple 3.1.2: the purchase flow links to the Terms of Use and the
							    Privacy Policy. Both must work; a paywall without them is rejected. */}
							<View style={s.links}>
								<Button
									label="Terms of Use"
									variant="ghost"
									size="sm"
									onPress={() => openLegal('terms')}
								/>
								<Button
									label="Privacy Policy"
									variant="ghost"
									size="sm"
									onPress={() => openLegal('privacy')}
								/>
							</View>
							<Text variant="caption" tone="tertiary" style={s.center}>
								Subscriptions renew automatically unless cancelled at least 24 hours before the end
								of the current period. Your {STORE_NAME} account is charged at confirmation of
								purchase and at each renewal. Manage or cancel any time in your {STORE_NAME} account
								settings.
							</Text>
						</FadeSlideIn>
					</>
				)}
			</ScrollView>

			{showShelf ? (
				<View
					onLayout={(e) => setShelfH(e.nativeEvent.layout.height)}
					style={[
						s.shelf,
						{ paddingBottom: insets.bottom + 12, paddingHorizontal: layout.gutterWide }
					]}
				>
					{/* The price disclosure wraps rather than being cut at large text sizes (Apple 3.1.2;
					    M8, R3). The shelf is measured, so the scroll padding follows it. */}
					<Text variant="bodySm" tone="secondary" style={s.center} tabular>
						{paywall.loadingPlans || !selected ? ' ' : priceLine(selected)}
					</Text>
					<Button
						label={selected?.trialDays ? 'Start free trial' : 'Continue'}
						size="lg"
						withArrow
						fullWidth
						loading={paywall.purchasing}
						disabled={!selected?.pkg}
						onDisabledPress={() => {
							haptic.warning()
							if (paywall.preview) {
								showToast("Preview plans can't be bought. Add store products to test.", 'info')
							}
						}}
						onPress={() => void paywall.purchase()}
					/>
				</View>
			) : null}

			<AlertModal
				visible={!!paywall.alert}
				title={paywall.alert?.title ?? ''}
				message={paywall.alert?.message}
				onDismiss={paywall.dismissAlert}
			/>
		</View>
	)
}

const useStyles = makeStyles((c, t) => ({
	root: { flex: 1, backgroundColor: c.bg },
	glow: { position: 'absolute', alignSelf: 'center', top: -220 },
	// PageHeader brings its own side padding; cancel the scroll gutter under it.
	header: { marginHorizontal: -t.layout.gutterWide },
	hero: { alignItems: 'center', gap: 12, paddingTop: 4 },
	heroChip: {
		width: 52,
		height: 52,
		borderRadius: 18,
		alignItems: 'center',
		justifyContent: 'center'
	},
	center: { textAlign: 'center' },
	features: { gap: 12 },
	plans: { gap: 10 },
	feature: { flexDirection: 'row', alignItems: 'center', gap: 12 },
	featureChip: {
		width: 32,
		height: 32,
		borderRadius: 11,
		alignItems: 'center',
		justifyContent: 'center'
	},
	flex: { flex: 1 },
	footer: { gap: 6, alignItems: 'center' },
	links: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
	shelf: {
		position: 'absolute',
		left: 0,
		right: 0,
		bottom: 0,
		paddingTop: 12,
		gap: 10,
		backgroundColor: c.surface,
		borderTopWidth: StyleSheet.hairlineWidth,
		borderTopColor: c.borderSoft,
		...t.elevation.overlay,
		shadowOffset: { width: 0, height: -4 }
	}
}))
