import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { httpClient } from '../../../shared/api/httpClient'

export interface PendingUser {
  id: number
  email: string
  status: string
}

export interface ActiveUser {
  id: number
  email: string
  name: string
  registration_status: string
  login_count: number
  last_read_book_id: number | null
  last_read_book_title: string | null
  book_count: number
  storage_bytes: number
}

export interface BlockedUser {
  id: number
  email: string
  name: string
  registration_status: string
}

export interface UserBook {
  id: number
  title: string
  author: string
}

const ALL_ADMIN_KEYS = [
  ['admin', 'active-users'],
  ['admin', 'blocked-users'],
  ['admin', 'pending-users'],
] as const

export function usePendingUsers() {
  return useQuery<PendingUser[]>({
    queryKey: ['admin', 'pending-users'],
    queryFn: () => httpClient<{ users: PendingUser[] }>('/api/admin/pending-users', { method: 'GET' }).then(r => (r as any).users ?? r),
  })
}

export function useActiveUsers() {
  return useQuery<ActiveUser[]>({
    queryKey: ['admin', 'active-users'],
    queryFn: () =>
      httpClient<{ users: ActiveUser[] }>('/api/admin/active-users', { method: 'GET' }).then((r) => r.users),
  })
}

export function useBlockedUsers() {
  return useQuery<BlockedUser[]>({
    queryKey: ['admin', 'blocked-users'],
    queryFn: () =>
      httpClient<{ users: BlockedUser[] }>('/api/admin/blocked-users', { method: 'GET' }).then((r) => r.users),
  })
}

export function useUserBooks(userId: number | undefined) {
  return useQuery<UserBook[]>({
    queryKey: ['admin', 'user-books', userId],
    queryFn: () =>
      httpClient<{ books: UserBook[] }>(`/api/admin/users/${userId}/books`, { method: 'GET' }).then((r) => r.books),
    enabled: userId !== undefined,
  })
}

export function useSetUserPassword() {
  return useMutation({
    mutationFn: ({ userId, password }: { userId: number; password: string }) =>
      httpClient(`/api/admin/users/${userId}/password`, {
        method: 'POST',
        body: JSON.stringify({ password }),
      }),
  })
}

export function useSendResetLink() {
  return useMutation({
    mutationFn: (userId: number) =>
      httpClient(`/api/admin/users/${userId}/send-reset`, { method: 'POST' }),
  })
}

export function useApproveUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (userId: number) =>
      httpClient(`/api/admin/users/${userId}/approve`, { method: 'POST' }),
    onSuccess: () => {
      ALL_ADMIN_KEYS.forEach((queryKey) => qc.invalidateQueries({ queryKey }))
    },
  })
}

export function useRejectUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (userId: number) =>
      httpClient(`/api/admin/users/${userId}/reject`, { method: 'POST' }),
    onSuccess: () => {
      ALL_ADMIN_KEYS.forEach((queryKey) => qc.invalidateQueries({ queryKey }))
    },
  })
}
