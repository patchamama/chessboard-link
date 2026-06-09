import { createBrowserRouter } from 'react-router-dom'
import LoginForm from '../features/auth/components/LoginForm'
import RegisterForm from '../features/auth/components/RegisterForm'
import RequireApproved from '../features/auth/guards/RequireApproved'
import RequireAdmin from '../features/auth/guards/RequireAdmin'
import PendingUsersTable from '../features/admin/components/PendingUsersTable'
import LibraryGrid from '../features/library/components/LibraryGrid'
import BookReader from '../features/library/components/BookReader'

function PendingPage() {
  return <div><h1>Account Pending</h1><p>Your account is awaiting admin approval.</p></div>
}

export const router = createBrowserRouter([
  { path: '/login', element: <LoginForm /> },
  { path: '/register', element: <RegisterForm /> },
  { path: '/pending', element: <PendingPage /> },
  {
    path: '/library',
    element: (
      <RequireApproved>
        <LibraryGrid />
      </RequireApproved>
    ),
  },
  {
    path: '/read/:bookId',
    element: (
      <RequireApproved>
        <BookReader />
      </RequireApproved>
    ),
  },
  {
    path: '/admin',
    element: (
      <RequireAdmin>
        <PendingUsersTable />
      </RequireAdmin>
    ),
  },
])
