import { Navigate } from 'react-router'
import { AuthShell } from '@/features/auth/components/auth-shell'
import { RegisterForm } from '@/features/auth/components/register-form'
import { SessionStatus } from '@/features/auth/components/session-status'
import { useSession } from '@/features/auth/lib/session-state'

export const RegisterPage = () => {
  const session = useSession()
  if (session.status === 'authenticated') return <Navigate to="/studio" replace />
  return <AuthShell mode="register">{session.status === 'anonymous' ? <RegisterForm /> : <SessionStatus />}</AuthShell>
}
