import { LoaderCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useSession } from '@/features/auth/lib/session-state'
import { logout, restoreSession } from '@/features/auth/lib/session-actions'

export const SessionStatus = () => {
  const session = useSession()
  return (
    <div className="session-status" role="status" aria-live="polite">
      {session.status === 'checking' ? <><LoaderCircle className="size-6 animate-spin" aria-hidden="true" /><p>正在验证登录状态…</p></> : <>
        <p>{session.error || '登录状态暂时无法验证，请重试。'}</p>
        <div className="flex flex-wrap justify-center gap-3">
          <Button onClick={() => void restoreSession()}>重试验证</Button>
          <Button variant="outline" onClick={logout}>退出当前会话</Button>
        </div>
      </>}
    </div>
  )
}
