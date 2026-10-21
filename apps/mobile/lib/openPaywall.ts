import { router } from 'expo-router'
import { track } from '@/lib/analytics'
import type { PaywallTrigger } from '@/lib/paywall'

/** Opens Kinpaw Plus from `trigger`, recording what was pressed (M7, R10). */
export function openPaywall(trigger: PaywallTrigger) {
	track('upgrade_tapped', { source: trigger })
	router.push({ pathname: '/upgrade', params: { trigger } })
}
