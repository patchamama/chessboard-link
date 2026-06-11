import { useState } from 'react'
import { useActiveUsers, useRejectUser } from '../api/adminApi'
import UserBooksList from './UserBooksList'
import PasswordModal from './PasswordModal'

function formatStorage(bytes: number): string {
  if (bytes === 0) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function ActiveUsersTable() {
  const { data: users, isLoading } = useActiveUsers()
  const rejectUser = useRejectUser()
  const [expandedUserId, setExpandedUserId] = useState<number | null>(null)
  const [passwordModalUserId, setPasswordModalUserId] = useState<number | null>(null)

  if (isLoading) return <p className="text-slate-600">Loading...</p>
  if (!users || users.length === 0)
    return <div className="rounded-lg bg-white p-8 text-center text-slate-600 shadow">No active users.</div>

  return (
    <div className="overflow-hidden rounded-lg bg-white shadow">
      <h2 className="border-b border-slate-200 px-6 py-4 text-lg font-bold">Active Users</h2>
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-6 py-3">Email</th>
            <th className="px-6 py-3">Logins</th>
            <th className="px-6 py-3">Last Read</th>
            <th className="px-6 py-3">Books</th>
            <th className="px-6 py-3">Storage</th>
            <th className="px-6 py-3">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {users.map((user) => (
            <>
              <tr key={user.id}>
                <td className="px-6 py-3 font-medium">{user.email}</td>
                <td className="px-6 py-3">{user.login_count}</td>
                <td className="px-6 py-3">{user.last_read_book_title ?? '—'}</td>
                <td
                  className="cursor-pointer px-6 py-3 text-blue-600 hover:underline"
                  onClick={() =>
                    setExpandedUserId(expandedUserId === user.id ? null : user.id)
                  }
                >
                  {user.book_count}
                </td>
                <td className="px-6 py-3">{formatStorage(user.storage_bytes)}</td>
                <td className="space-x-1 px-6 py-3">
                  <button
                    type="button"
                    onClick={() => rejectUser.mutateAsync(user.id)}
                    disabled={rejectUser.isPending}
                    className="rounded-md bg-red-600 px-2 py-1 text-xs font-medium text-white hover:bg-red-500 disabled:opacity-50"
                  >
                    Reject
                  </button>
                  <button
                    type="button"
                    onClick={() => setPasswordModalUserId(user.id)}
                    className="rounded-md bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-500"
                  >
                    Set Password
                  </button>
                  <button
                    type="button"
                    onClick={() => setPasswordModalUserId(user.id)}
                    className="rounded-md bg-amber-600 px-2 py-1 text-xs font-medium text-white hover:bg-amber-500"
                  >
                    Send Reset
                  </button>
                </td>
              </tr>
              {expandedUserId === user.id && (
                <tr key={`books-${user.id}`}>
                  <td colSpan={6} className="bg-slate-50 px-6 py-3">
                    <UserBooksList userId={user.id} />
                  </td>
                </tr>
              )}
            </>
          ))}
        </tbody>
      </table>

      {passwordModalUserId !== null && (
        <PasswordModal userId={passwordModalUserId} onClose={() => setPasswordModalUserId(null)} />
      )}
    </div>
  )
}
