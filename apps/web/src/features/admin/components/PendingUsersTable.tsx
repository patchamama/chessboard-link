import { usePendingUsers, useApproveUser, useRejectUser } from '../api/adminApi'

export default function PendingUsersTable() {
  const { data: users, isLoading } = usePendingUsers()
  const approveUser = useApproveUser()
  const rejectUser = useRejectUser()

  if (isLoading) return <p className="text-slate-600">Loading...</p>
  if (!users || users.length === 0)
    return (
      <div className="rounded-lg bg-white p-8 text-center text-slate-600 shadow">
        No pending users.
      </div>
    )

  return (
    <div className="overflow-hidden rounded-lg bg-white shadow">
      <h1 className="border-b border-slate-200 px-6 py-4 text-lg font-bold">
        Pending Users
      </h1>
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-6 py-3">Email</th>
            <th className="px-6 py-3">Status</th>
            <th className="px-6 py-3">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {users.map((user) => (
            <tr key={user.id}>
              <td className="px-6 py-3 font-medium">{user.email}</td>
              <td className="px-6 py-3">
                <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
                  {user.status}
                </span>
              </td>
              <td className="space-x-2 px-6 py-3">
                <button
                  onClick={() => approveUser.mutateAsync(user.id)}
                  disabled={approveUser.isPending}
                  className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
                >
                  Approve
                </button>
                <button
                  onClick={() => rejectUser.mutateAsync(user.id)}
                  disabled={rejectUser.isPending}
                  className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-500 disabled:opacity-50"
                >
                  Reject
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
