import { useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { useConfirmPasswordReset } from '../api/authApi'

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') ?? ''
  const [password, setPassword] = useState('')
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  const confirmReset = useConfirmPasswordReset()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    try {
      await confirmReset.mutateAsync({ token, password })
      setSuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid or expired reset token.')
    }
  }

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="w-96 rounded-lg bg-white p-8 shadow text-center space-y-4">
          <p className="text-emerald-600 font-medium">Password has been reset successfully.</p>
          <Link to="/login" className="text-blue-600 underline text-sm">
            Back to Login
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <form onSubmit={handleSubmit} className="w-96 rounded-lg bg-white p-8 shadow space-y-4">
        <h1 className="text-xl font-bold text-slate-800">Reset Password</h1>

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">New Password</label>
          <input
            type="password"
            placeholder="New Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            required
          />
        </div>

        <button
          type="submit"
          disabled={confirmReset.isPending}
          className="w-full rounded-md bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
        >
          Reset Password
        </button>
      </form>
    </div>
  )
}
