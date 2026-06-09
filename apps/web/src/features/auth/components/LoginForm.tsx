import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useLoginMutation } from '../api/authApi'
import { isDemoHost } from '../../../shared/env/devMode'

interface FormErrors {
  email?: string
  password?: string
}

const inputClass =
  'mt-1 w-full rounded-md border border-slate-300 px-3 py-2 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500'

const DEMO = isDemoHost()
const DEMO_EMAIL = 'demo@chessreader.app'
const DEMO_PASSWORD = 'demo1234'

export default function LoginForm() {
  const [email, setEmail] = useState(DEMO ? DEMO_EMAIL : '')
  const [password, setPassword] = useState(DEMO ? DEMO_PASSWORD : '')
  const [errors, setErrors] = useState<FormErrors>({})
  const mutation = useLoginMutation()

  const validate = (): boolean => {
    const errs: FormErrors = {}
    if (!email.trim()) errs.email = 'Email is required'
    if (!password) errs.password = 'Password is required'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    mutation.mutate({ email, password })
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="mx-auto mt-16 max-w-md space-y-4 rounded-lg bg-white p-8 shadow"
    >
      <h1 className="text-xl font-bold">Login</h1>

      {DEMO && (
        <p className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800">
          Demo mode — credentials pre-filled. Just click Login.
        </p>
      )}

      <div>
        <label htmlFor="email" className="block text-sm font-medium text-slate-700">
          Email
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClass}
        />
        {errors.email && (
          <p role="alert" className="mt-1 text-sm text-red-600">
            {errors.email}
          </p>
        )}
      </div>
      <div>
        <label htmlFor="password" className="block text-sm font-medium text-slate-700">
          Password
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputClass}
        />
        {errors.password && (
          <p role="alert" className="mt-1 text-sm text-red-600">
            {errors.password}
          </p>
        )}
      </div>
      {mutation.error && (
        <p role="alert" className="text-sm text-red-600">
          {(mutation.error as Error).message}
        </p>
      )}
      <button
        type="submit"
        disabled={mutation.isPending}
        className="w-full rounded-md bg-slate-900 px-4 py-2 font-medium text-white hover:bg-slate-700 disabled:opacity-50"
      >
        {mutation.isPending ? 'Logging in…' : 'Login'}
      </button>
      <p className="text-center text-sm text-slate-600">
        No account?{' '}
        <Link to="/register" className="font-medium text-slate-900 underline">
          Register
        </Link>
      </p>
    </form>
  )
}
