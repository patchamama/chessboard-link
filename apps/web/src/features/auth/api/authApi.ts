import { useMutation } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { httpClient } from '../../../shared/api/httpClient'
import { useAuthStore } from '../store/authStore'

interface RegisterInput {
  email: string
  password: string
}

interface RegisterResponse {
  id: number
  email: string
  status: string
}

interface LoginInput {
  email: string
  password: string
}

interface LoginResponse {
  token: string
}

// Decode the JWT payload without verifying — only used to populate the UI.
function decodeJwtPayload(token: string): Record<string, unknown> {
  try {
    const payload = token.split('.')[1]
    return JSON.parse(atob(payload))
  } catch {
    return {}
  }
}

export function useRegisterMutation() {
  const navigate = useNavigate()
  return useMutation({
    mutationFn: (input: RegisterInput) =>
      httpClient<RegisterResponse>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      navigate('/pending')
    },
  })
}

export function useLoginMutation() {
  const { setSession } = useAuthStore()
  const navigate = useNavigate()

  return useMutation({
    mutationFn: (input: LoginInput) =>
      httpClient<LoginResponse>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: ({ token }) => {
      const payload = decodeJwtPayload(token)
      setSession(token, {
        email: (payload.email as string) ?? '',
        role: (payload.role as 'user' | 'admin') ?? 'user',
        status: (payload.status as 'pending' | 'approved' | 'rejected') ?? 'approved',
      })
      navigate('/library')
    },
  })
}
