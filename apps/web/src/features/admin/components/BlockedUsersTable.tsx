import { useBlockedUsers, useApproveUser } from '../api/adminApi'

export default function BlockedUsersTable() {
  const { data: users, isLoading } = useBlockedUsers()
  const approveUser = useApproveUser()

  if (isLoading) return <p className="text-slate-600">Loading...</p>
  if (!users || users.length === 0)
    return <div className="rounded-lg bg-white p-8 text-center text-slate-600 shadow">No blocked users.</div>

  return (
    <div className="overflow-hidden rounded-lg bg-white shadow">
      <h2 className="border-b border-slate-200 px-6 py-4 text-lg font-bold">Blocked Users</h2>
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-6 py-3">Email</th>
            <th className="px-6 py-3">Name</th>
            <th className="px-6 py-3">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {users.map((user) => (
            <tr key={user.id}>
              <td className="px-6 py-3 font-medium">{user.email}</td>
              <td className="px-6 py-3">{user.name}</td>
              <td className="px-6 py-3">
                <button
                  type="button"
                  onClick={() => approveUser.mutateAsync(user.id)}
                  disabled={approveUser.isPending}
                  className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
                >
                  Approve
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
