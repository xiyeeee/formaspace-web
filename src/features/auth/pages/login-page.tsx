import { Navigate, useSearchParams } from 'react-router'
import { AuthShell } from '@/features/auth/components/auth-shell'
import { LoginForm } from '@/features/auth/components/login-form'
import { SessionStatus } from '@/features/auth/components/session-status'
import { useSession } from '@/features/auth/lib/session-state'
import { safeDestination } from '@/features/auth/lib/safe-destination'

export const LoginPage = () => {
  const session = useSession()
  const [params] = useSearchParams()
  if (session.status === 'authenticated') return <Navigate to={safeDestination(params.get('redirect'))} replace />
  return <AuthShell mode="login">{session.status === 'anonymous' ? <LoginForm /> : <SessionStatus />}</AuthShell>
}
