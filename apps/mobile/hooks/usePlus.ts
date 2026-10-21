import { useSubscription } from '@/contexts/SubscriptionContext'
import { useProfile } from '@/hooks/useProfile'

/**
 * Whether this person has Kinpaw Plus (M7, docs/application/features/
 * m7-plus-profile-settings-requirements.md, R5): the server's plan (`profiles.plan_type`, an
 * admin grant or a store subscription the webhook recorded), or RevenueCat's own entitlement
 * for the moment between a purchase and its webhook. The one place the app decides Plus; it
 * only changes what is shown, since the server enforces every limit itself.
 */
export function usePlus(): boolean {
	const { data: profile } = useProfile()
	const { isPremium: storePremium } = useSubscription()
	return profile?.planType === 'premium' || storePremium
}
