import { useEffect, useMemo, useRef, useState } from 'react'
import { AppState, Linking, Platform, type AppStateStatus } from 'react-native'
import { router } from 'expo-router'
import { useQueryClient } from '@tanstack/react-query'
import Purchases from 'react-native-purchases'
import { useSubscription } from '@/contexts/SubscriptionContext'
import { useMountEffect } from '@/hooks/useMountEffect'
import { PROFILE_QUERY_KEY } from '@/hooks/useProfile'
import { track } from '@/lib/analytics'
import { devPlaceholders } from '@/lib/devPlaceholders'
import { haptic } from '@/lib/haptics'
import {
	paywallTrigger,
	plansFromOfferings,
	renewalLine,
	STORE_NAME,
	type PlanOption
} from '@/lib/paywall'

// The paywall's state and what its buttons do (app/upgrade.tsx; m7-plus-profile-settings-
// requirements.md, R8–R11): the plans from the store, the one chosen, buying, restoring and
// redeeming a code, and the alert each one can end in. The screen draws it, and keeps the
// store-rule pieces (Restore, the legal links, the disclosure) in its own file, where
// check:store reads them.

export type PaywallAlert = { title: string; message: string }

export function usePaywall(trigger: string | undefined) {
	const queryClient = useQueryClient()
	const {
		// A store subscription specifically: only that can be managed in the store (a grant can't).
		isPremium: storePremium,
		isLoading,
		offerings,
		offeringsStatus,
		purchase: purchasePackage,
		restore,
		refresh,
		customerInfo
	} = useSubscription()

	const [selectedId, setSelectedId] = useState<string | null>(null)
	const [purchasing, setPurchasing] = useState(false)
	const [restoring, setRestoring] = useState(false)
	const [waitingForRedeem, setWaitingForRedeem] = useState(false)
	const waitingRef = useRef(false)
	const [alert, setAlert] = useState<PaywallAlert | null>(null)

	const livePlans = useMemo(() => plansFromOfferings(offerings), [offerings])
	// Development builds with no store products get sample plans to design
	// against; they are labelled as a preview and cannot be bought.
	const preview = offeringsStatus === 'unavailable' && !!devPlaceholders
	const plans: PlanOption[] = preview ? (devPlaceholders?.paywallPreview ?? []) : livePlans
	const selected = plans.find((p) => p.id === selectedId) ?? plans[0] ?? null
	const loadingPlans = offeringsStatus === 'loading' || isLoading
	const entitlement = customerInfo?.entitlements.active['premium']

	useMountEffect(() => {
		// Once per visit: the trigger is the route's, fixed for the screen's life.
		track('upgrade_page_viewed', { trigger: paywallTrigger(trigger) })
		// Closing the paywall re-reads the plan, so a purchase shows everywhere at once (M7, R6).
		return () => void queryClient.invalidateQueries({ queryKey: PROFILE_QUERY_KEY })
	})

	// Auto-restore when returning from the Play Store redeem flow
	useEffect(() => {
		const sub = AppState.addEventListener('change', async (next: AppStateStatus) => {
			if (next === 'active' && waitingRef.current) {
				waitingRef.current = false
				setWaitingForRedeem(false)
				const result = await restore()
				if (result.success) await refresh()
			}
		})
		return () => sub.remove()
	}, [restore, refresh])

	function select(plan: PlanOption) {
		if (plan.id === selected?.id) return
		setSelectedId(plan.id)
		track('upgrade_plan_selected', { package: plan.id })
	}

	async function purchase() {
		if (!selected?.pkg || purchasing) return
		track('upgrade_cta_tapped', { package: selected.id })
		setPurchasing(true)
		try {
			const result = await purchasePackage(selected.pkg)
			if (result.success) {
				track('purchase_success', { package: selected.id })
				await refresh()
				haptic.success()
				router.back()
			} else if (!result.cancelled) {
				haptic.error()
				setAlert({
					title: "The purchase didn't go through",
					message: result.error ?? 'Nothing was charged. Please try again.'
				})
			}
		} finally {
			setPurchasing(false)
		}
	}

	async function restorePurchases() {
		if (restoring) return
		track('restore_purchases_tapped')
		setRestoring(true)
		try {
			const result = await restore()
			if (!result.success) {
				setAlert({
					title: "Couldn't restore",
					message: result.error ?? 'Something went wrong. Please try again.'
				})
			} else if (result.premium) {
				await refresh()
				haptic.success()
				setAlert({ title: 'Restored', message: 'Your subscription is active on this device.' })
			} else {
				setAlert({
					title: 'Nothing to restore',
					message: `No active subscription was found for this ${STORE_NAME} account.`
				})
			}
		} finally {
			setRestoring(false)
		}
	}

	async function redeem() {
		track('redeem_code_tapped')
		if (Platform.OS === 'ios') {
			try {
				await Purchases.presentCodeRedemptionSheet()
			} catch {
				Linking.openURL('https://apps.apple.com/redeem')
			}
		} else {
			waitingRef.current = true
			setWaitingForRedeem(true)
			const canUseMarket = await Linking.canOpenURL('market://redeem')
			Linking.openURL(canUseMarket ? 'market://redeem' : 'https://play.google.com/redeem')
		}
	}

	return {
		storePremium,
		plans,
		selected,
		preview,
		loadingPlans,
		renewal: renewalLine(entitlement?.expirationDate, entitlement?.willRenew ?? false),
		purchasing,
		restoring,
		waitingForRedeem,
		alert,
		dismissAlert: () => setAlert(null),
		select,
		purchase,
		restorePurchases,
		redeem,
		retry: refresh
	}
}
