/**
 * Mock / placeholder data for the template — DEVELOPMENT BUILDS ONLY.
 *
 * It fills what has no data source yet while you build: the paywall's preview
 * plans. Lists come from the API in every build; with no backend configured,
 * their screens say so instead of showing made-up rows.
 *
 * Never import this file. Read it through `devPlaceholders` in
 * lib/devPlaceholders.ts, which loads it only when `__DEV__` is true, so a
 * release build does not contain it at all (placeholder content in a store
 * build is an App Store 2.1 rejection).
 */

import type { PlanOption } from './paywall'

// ─── Paywall preview ──────────────────────────────────────────────────────────
// Sample plans so the paywall can be built and reviewed before the store
// products exist. Shown only when the store returns nothing, labelled as a
// preview, and never purchasable: real prices always come from the store.

export const paywallPreview: PlanOption[] = [
	{
		id: 'preview-annual',
		title: 'Yearly',
		price: '$39.99',
		period: 'year',
		perMonth: '$3.33 / month',
		savingsPct: 33,
		trialDays: 7
	},
	{ id: 'preview-monthly', title: 'Monthly', price: '$4.99', period: 'month' }
]
