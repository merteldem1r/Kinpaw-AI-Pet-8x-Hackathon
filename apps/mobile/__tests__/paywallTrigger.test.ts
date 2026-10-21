import { PAYWALL_TRIGGERS, paywallTrigger } from '@/lib/paywall'

describe('paywallTrigger', () => {
	it('keeps every known trigger', () => {
		for (const trigger of PAYWALL_TRIGGERS) expect(paywallTrigger(trigger)).toBe(trigger)
	})

	it('says unknown for a missing, repeated or made-up trigger', () => {
		expect(paywallTrigger(undefined)).toBe('unknown')
		expect(paywallTrigger(['talk_limit'])).toBe('unknown')
		expect(paywallTrigger('launch')).toBe('unknown')
	})
})
