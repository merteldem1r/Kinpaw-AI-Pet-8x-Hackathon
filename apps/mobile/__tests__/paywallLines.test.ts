/**
 * The paywall's lines (m7-plus-profile-settings-requirements.md, R8–R11; Apple 3.1.2): the
 * price disclosure says what a trial becomes, a plan row says its saving, the member card says
 * when Plus renews or ends.
 */
import { planSubtitle, priceLine, renewalLine, type PlanOption } from '@/lib/paywall'

const yearly: PlanOption = {
	id: 'annual',
	title: 'Yearly',
	price: '$39.99',
	period: 'year',
	perMonth: '$3.33 / month',
	savingsPct: 33
}
const monthly: PlanOption = { id: 'monthly', title: 'Monthly', price: '$4.99', period: 'month' }

describe('paywall lines', () => {
	it('says what a trial becomes, or that a plan can be cancelled', () => {
		expect(priceLine({ ...yearly, trialDays: 7 })).toBe('7 days free, then $39.99 per year')
		expect(priceLine(monthly)).toBe('$4.99 per month · cancel anytime')
		expect(priceLine({ ...monthly, period: 'lifetime' })).toBe('$4.99 once · cancel anytime')
	})

	it('gives a plan row its saving and per-month price, or nothing when it has neither', () => {
		expect(planSubtitle(yearly)).toBe('Save 33% · $3.33 / month')
		expect(planSubtitle(monthly)).toBe('Billed monthly')
		expect(planSubtitle({ ...monthly, period: 'lifetime' })).toBeUndefined()
	})

	it('says when Plus renews or ends, and nothing without a date', () => {
		expect(renewalLine('2026-11-09T12:00:00Z', true)).toMatch(/^Renews on .*2026/)
		expect(renewalLine('2026-11-09T12:00:00Z', false)).toMatch(/^Ends on .*2026/)
		expect(renewalLine(null, true)).toBeNull()
	})
})
