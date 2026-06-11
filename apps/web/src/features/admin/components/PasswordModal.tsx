import { useState } from 'react'
import { useSetUserPassword, useSendResetLink } from '../api/adminApi'

interface Props {
  userId: number
  onClose: () => void
}

export default function PasswordModal({ userId, onClose }: Props) {
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const setPasswordMutation = useSetUserPassword()
  const sendResetMutation = useSendResetLink()

  const handleSetPassword = async () => {
    try {
      await setPasswordMutation.mutateAsync({ userId, password })
      setMessage('Password updated successfully.')
    } catch {
      setMessage('Failed to update password.')
    }
  }

  const handleSendReset = async () => {
    try {
      await sendResetMutation.mutateAsync(userId)
      setMessage('Reset link sent.')
    } catch {
      setMessage('Failed to send reset link.')
    }
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 w-96 space-y-4">
        <h2 className="text-lg font-bold">Password Actions</h2>

        {message && <p className="text-sm text-emerald-600">{message}</p>}

        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-700">New Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleSetPassword}
            disabled={setPasswordMutation.isPending}
            className="flex-1 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
          >
            Set Password
          </button>
          <button
            type="button"
            onClick={handleSendReset}
            disabled={sendResetMutation.isPending}
            className="flex-1 rounded-md bg-amber-600 px-3 py-2 text-sm font-medium text-white hover:bg-amber-500 disabled:opacity-50"
          >
            Send Reset Link
          </button>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
