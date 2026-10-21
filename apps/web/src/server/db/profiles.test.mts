import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { after, before, describe, test } from 'node:test'
import { PrismaClient } from '@prisma/client'

// The profile store's own-settings write, the one write /api/app/v1/profile makes, against a
// real database: that it writes only the person's own row, makes the row if the signup trigger
// never did, reports a marketing-consent flip once, and reaches no money column.
//
// Needs a database with the migrations applied (CI's migrations job, or a local replay:
// docs/rules/migrations.md), named by TEST_DATABASE_URL, and run by `npm run test:db`. It
// signs up throwaway auth users, whose profiles on_auth_user_created makes, and deletes them
// after, which takes their profiles with them. Without the variable it skips, so `npm test`
// stays a no-database lane.
const url = process.env.TEST_DATABASE_URL

describe(
	'the profile store, on a real database',
	{ skip: url ? false : 'TEST_DATABASE_URL is not set' },
	() => {
		const base = new PrismaClient({ datasourceUrl: url })
		let profiles: import('./profiles').ProfileStore

		// Supabase Auth's side of a person: a profile can't exist without its auth user
		// (profiles_require_auth_user), so a test signs one up and the trigger makes the profile.
		const signUp = (...ids: string[]) =>
			Promise.all(
				ids.map(
					(id) =>
						base.$executeRaw`insert into auth.users (id, email) values (${id}::uuid, ${`${id}@example.test`})`
				)
			)
		const deleteUsers = (...ids: string[]) =>
			base.$executeRaw`delete from auth.users where id = any(${ids}::uuid[])`

		before(async () => {
			// Loaded here, not at the top: it imports server-only modules, which resolve only
			// under the react-server condition `npm run test:db` sets.
			profiles = (await import('./profiles')).createProfileStore(base)
		})

		after(async () => {
			await base.$disconnect()
		})

		test('profiles: own settings only, the row made if missing, a consent flip reported once', async () => {
			const who = randomUUID()
			try {
				// No auth user (an account deleted while its token still worked): the trigger
				// refuses the profile, and nothing is written.
				assert.equal(await profiles.updateOwnSettings(who, { displayName: 'Ghost' }), null)
				assert.equal(await base.profile.count({ where: { id: who } }), 0)

				// A live user whose profile the signup trigger never made (removed here to stand in
				// for it): made now, with the settings on it.
				await signUp(who)
				await base.profile.delete({ where: { id: who } })
				const first = await profiles.updateOwnSettings(who, {
					displayName: 'Sam',
					locale: 'pt-BR',
					marketingConsent: true
				})
				assert.equal(first?.consentChanged, true)
				assert.deepEqual(
					{ ...first?.profile, createdAt: null },
					{
						displayName: 'Sam',
						avatarUrl: null,
						planType: 'free',
						locale: 'pt-BR',
						marketingConsent: true,
						createdAt: null
					}
				)

				// Money: an object carrying more than the four settings writes no more.
				const smuggled = {
					displayName: null,
					planType: 'premium',
					isAdmin: true,
					premiumStatus: 'active',
					region: 'US'
				} as import('./profiles').OwnSettings
				const second = await profiles.updateOwnSettings(who, smuggled)
				assert.equal(second?.profile.displayName, null)
				assert.equal(second?.consentChanged, false)
				const stored = await base.profile.findUniqueOrThrow({ where: { id: who } })
				assert.equal(stored.planType, 'free')
				assert.equal(stored.isAdmin, false)
				assert.equal(stored.premiumStatus, null)
				assert.equal(stored.region, null)
				assert.equal(stored.locale, 'pt-BR', 'undefined leaves a field as it is')

				// The same value again is no change.
				const same = await profiles.updateOwnSettings(who, { marketingConsent: true })
				assert.equal(same?.consentChanged, false)

				// Two toggles at once: one flip, one report.
				const both = await Promise.all([
					profiles.updateOwnSettings(who, { marketingConsent: false }),
					profiles.updateOwnSettings(who, { marketingConsent: false })
				])
				assert.deepEqual(both.map((result) => result?.consentChanged).sort(), [false, true])
				assert.equal((await profiles.appProfile(who))?.marketingConsent, false)
				assert.equal(await profiles.appProfile(randomUUID()), null)
			} finally {
				await deleteUsers(who)
			}
		})

		test('grants: Plus given and taken back with an audit row each; a store subscription is never revoked', async () => {
			const admin = randomUUID()
			const who = randomUUID()
			const paying = randomUUID()
			try {
				await signUp(admin, who, paying)
				const grants = (userId: string) =>
					base.premiumGrant.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } })

				// Granted: premium from a grant, the dashboard's `granted`, and one audit row.
				assert.equal(await profiles.grantPremium(who, admin, 'Demo'), 'granted')
				let stored = await base.profile.findUniqueOrThrow({ where: { id: who } })
				assert.equal(stored.planType, 'premium')
				assert.equal(stored.premiumSource, 'grant')
				assert.equal(await profiles.isPremium(who), true)
				assert.deepEqual(
					(await grants(who)).map((g) => [g.action, g.grantedBy, g.reason]),
					[['grant', admin, 'Demo']]
				)

				// Again: nothing written; two at once write one.
				assert.equal(await profiles.grantPremium(who, admin, null), 'already_premium')
				assert.equal((await grants(who)).length, 1)

				// Revoked: free again, a second audit row.
				assert.equal(await profiles.revokeGrant(who, admin, null), 'revoked')
				stored = await base.profile.findUniqueOrThrow({ where: { id: who } })
				assert.equal(stored.planType, 'free')
				assert.equal(stored.premiumSource, null)
				assert.equal(stored.premiumStatus, 'revoked')
				assert.deepEqual(
					(await grants(who)).map((g) => g.action),
					['grant', 'revoke']
				)
				assert.equal(await profiles.revokeGrant(who, admin, null), 'not_a_grant')

				const race = await Promise.all([
					profiles.grantPremium(who, admin, null),
					profiles.grantPremium(who, admin, null)
				])
				assert.deepEqual(race.sort(), ['already_premium', 'granted'])
				assert.equal((await grants(who)).length, 3)

				// A store subscription: a grant leaves it alone, a revoke never touches it.
				await base.profile.update({
					where: { id: paying },
					data: { planType: 'premium', premiumSource: 'app_store', premiumStatus: 'active' }
				})
				assert.equal(await profiles.grantPremium(paying, admin, null), 'already_premium')
				assert.equal(await profiles.revokeGrant(paying, admin, null), 'not_a_grant')
				stored = await base.profile.findUniqueOrThrow({ where: { id: paying } })
				assert.equal(stored.planType, 'premium')
				assert.equal(stored.premiumSource, 'app_store')
				assert.equal((await grants(paying)).length, 0)

				// No such profile.
				assert.equal(await profiles.grantPremium(randomUUID(), admin, null), 'no_profile')
				assert.equal(await profiles.revokeGrant(randomUUID(), admin, null), 'no_profile')
			} finally {
				await deleteUsers(admin, who, paying)
			}
		})
	}
)
