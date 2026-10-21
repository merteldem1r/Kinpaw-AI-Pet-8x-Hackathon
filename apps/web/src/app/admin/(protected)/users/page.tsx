import { bucketFor } from '@/lib/dashboard-stats'
import { createSecretKeyClient } from '@/lib/supabase/secret-key'
import { profileStore } from '@/server/db/profiles'
import { PlanControls } from './PlanControls'

export const dynamic = 'force-dynamic'

async function getUsers() {
	const supabase = createSecretKeyClient()
	const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 100 })
	if (error) throw error

	// A failed profile read fails the screen, rather than listing everyone as free.
	const profiles = await profileStore.adminRows(data.users.map((u) => u.id))
	const byId = new Map(profiles.map((p) => [p.id, p]))

	return data.users.map((u) => {
		const profile = byId.get(u.id)
		return {
			id: u.id,
			email: u.email ?? '—',
			created_at: u.created_at,
			// The dashboard's own buckets (free, granted, premium, trial…): a grant is never revenue.
			bucket: profile ? bucketFor(profile) : 'free',
			hasProfile: Boolean(profile),
			isAdmin: profile?.is_admin ?? false,
			region: profile?.region ?? '—'
		}
	})
}

export default async function AdminUsersPage() {
	let users: Awaited<ReturnType<typeof getUsers>> = []
	let error = ''
	try {
		users = await getUsers()
	} catch (err) {
		error = err instanceof Error ? err.message : 'Failed to load users'
	}

	return (
		<div>
			<h1 className="text-2xl font-bold">Users</h1>
			<p className="mt-1 text-sm text-ink-mute">
				First 100 accounts. Paginate via /api/admin/users. Grant Kinpaw Plus to show it without a
				purchase; a grant is counted as granted, never as paid.
			</p>

			{error ? (
				<div className="card mt-6 border-danger/40 p-6 text-sm text-danger">{error}</div>
			) : (
				<div className="card mt-6 overflow-x-auto">
					<table className="w-full text-left text-sm">
						<thead className="border-b border-border-soft text-ink-mute">
							<tr>
								<th className="px-5 py-3 font-medium">Email</th>
								<th className="px-5 py-3 font-medium">Plan</th>
								<th className="px-5 py-3 font-medium">Kinpaw Plus</th>
								<th className="px-5 py-3 font-medium">Region</th>
								<th className="px-5 py-3 font-medium">Admin</th>
								<th className="px-5 py-3 font-medium">Joined</th>
							</tr>
						</thead>
						<tbody>
							{users.map((u) => (
								<tr key={u.id} className="border-b border-border-soft/60 last:border-0">
									<td className="px-5 py-3">{u.email}</td>
									<td className="px-5 py-3">
										<span
											className={
												u.bucket !== 'free'
													? 'rounded-full bg-brand-dim px-2 py-0.5 text-xs text-brand-ink'
													: 'text-ink-soft'
											}
										>
											{u.bucket}
										</span>
									</td>
									<td className="px-5 py-3">
										{u.hasProfile ? (
											<PlanControls userId={u.id} bucket={u.bucket} />
										) : (
											<span className="text-xs text-ink-mute">No profile</span>
										)}
									</td>
									<td className="px-5 py-3 text-ink-soft">{u.region}</td>
									<td className="px-5 py-3 text-ink-soft">{u.isAdmin ? 'yes' : '—'}</td>
									<td className="px-5 py-3 text-ink-soft">
										{u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}
									</td>
								</tr>
							))}
							{users.length === 0 && (
								<tr>
									<td colSpan={6} className="px-5 py-8 text-center text-ink-mute">
										No users yet.
									</td>
								</tr>
							)}
						</tbody>
					</table>
				</div>
			)}
		</div>
	)
}
