import { Navigate, Outlet, useLocation } from 'react-router'
import { useSession } from '@/features/auth/lib/session-state'
import { SessionStatus } from '@/features/auth/components/session-status'

export const RequireAuth = () => {
  const session = useSession()
  const location = useLocation()
  if (session.status === 'checking' || session.status === 'error') return <SessionStatus />
  if (session.status === 'anonymous') return <Navigate to={`/login?redirect=${encodeURIComponent(location.pathname)}`} replace />
  return <Outlet />
}
